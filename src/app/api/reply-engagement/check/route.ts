import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTwitterClient } from "@/lib/twitter";
import { sendChatworkMessage } from "@/lib/chatwork";
import { logXApiUsage, logLlmUsage } from "@/lib/api-usage";

// リプ回り半自動化：
//   1. アクティブなターゲットアカウントの最新ポストを X API で取得
//   2. インプ閾値を超え、まだ提案してないポストを抽出
//   3. Claude/OpenAI で 3 案のリプを生成
//   4. ChatWork に「URL + 3案」を送信
//
// 手動トリガー（UI から POST）と cron（Bearer/header）両対応。
// manual = true パラメータで認証ユーザーとして実行、body 空だと cron モードで全ユーザー処理。

const ANTHROPIC_ENDPOINT = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
const ANTHROPIC_VERSION = "2023-06-01";
const OPENAI_ENDPOINT = "https://api.openai.com/v1/chat/completions";
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o";

type Provider = { name: "anthropic" | "openai"; apiKey: string; model: string };

async function callLlm(provider: Provider, systemText: string, userText: string): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
    if (provider.name === "anthropic") {
        const res = await fetch(ANTHROPIC_ENDPOINT, {
            method: "POST",
            headers: { "x-api-key": provider.apiKey, "anthropic-version": ANTHROPIC_VERSION, "content-type": "application/json" },
            body: JSON.stringify({
                model: provider.model,
                max_tokens: 2000,
                temperature: 0.7,
                system: systemText,
                messages: [{ role: "user", content: userText }],
            }),
            signal: AbortSignal.timeout(60000),
        });
        if (!res.ok) throw new Error(`Claude API error (${res.status}): ${await res.text().catch(() => "")}`);
        const data = await res.json() as { content?: Array<{ type: string; text?: string }>; usage?: { input_tokens?: number; output_tokens?: number } };
        const text = data.content?.find(c => c.type === "text")?.text ?? "";
        if (!text.trim()) throw new Error("empty response");
        return { text, inputTokens: data.usage?.input_tokens ?? 0, outputTokens: data.usage?.output_tokens ?? 0 };
    } else {
        const res = await fetch(OPENAI_ENDPOINT, {
            method: "POST",
            headers: { "Authorization": `Bearer ${provider.apiKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({
                model: provider.model,
                max_tokens: 2000,
                temperature: 0.7,
                response_format: { type: "json_object" },
                messages: [
                    { role: "system", content: systemText },
                    { role: "user", content: userText },
                ],
            }),
            signal: AbortSignal.timeout(60000),
        });
        if (!res.ok) throw new Error(`OpenAI API error (${res.status}): ${await res.text().catch(() => "")}`);
        const data = await res.json() as { choices?: Array<{ message?: { content?: string } }>; usage?: { prompt_tokens?: number; completion_tokens?: number } };
        const text = data.choices?.[0]?.message?.content ?? "";
        if (!text.trim()) throw new Error("empty response");
        return { text, inputTokens: data.usage?.prompt_tokens ?? 0, outputTokens: data.usage?.completion_tokens ?? 0 };
    }
}

function safeJsonParse(raw: string): unknown | null {
    const t = raw.trim();
    const fence = t.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    const s = fence ? fence[1].trim() : t;
    const f = s.indexOf("{"), l = s.lastIndexOf("}");
    const slice = f >= 0 && l > f ? s.slice(f, l + 1) : s;
    try { return JSON.parse(slice); } catch { return null; }
}

function buildPromptForReplies(args: {
    tweetText: string; targetUsername: string;
    selfPersona: { targetAudience: string; accountConcept: string; profile: string };
    winning: string[];
}): { systemText: string; userText: string } {
    const systemText = [
        "あなたは X (Twitter) のリプ回り戦略家です。他人のポストに対して、インプを獲得するための価値あるリプライを書きます。",
        "",
        "【方針】",
        "- スパム臭・媚び・定型文は絶対禁止。読者に価値を提供する返信だけを生成。",
        "- 対象ポストの内容にしっかり言及し、自分の視点/経験/具体例を短く加える。",
        "- 自社アカウントのポジショニングを自然に示す（ただし宣伝臭はNG）。",
        "- 140文字以内を目安に、最初の1文でフック。",
        "",
        "【出力】",
        `必ず JSON オブジェクトのみ：{"variants":["案1","案2","案3"]}。`,
        "3案はトーンや切り口を変える（例: 共感→逆説→質問 / 同意→補足→実体験）。",
    ].join("\n");

    const userText = [
        `対象アカウント: @${args.targetUsername}`,
        "対象ポスト本文:",
        "```",
        args.tweetText,
        "```",
        "",
        "【自分のポジショニング】",
        `- ターゲット層: ${args.selfPersona.targetAudience || "（未設定）"}`,
        `- アカウントコンセプト: ${args.selfPersona.accountConcept || "（未設定）"}`,
        `- プロフィール: ${args.selfPersona.profile || "（未設定）"}`,
        "",
        "【勝ちパターン（参考）】",
        args.winning.length > 0 ? args.winning.slice(0, 5).map(w => `- ${w.slice(0, 120)}`).join("\n") : "（未設定）",
        "",
        "上記を踏まえて 3 案のリプを生成してください。必ず JSON だけを返す。",
    ].join("\n");

    return { systemText, userText };
}

function formatChatworkMessage(args: {
    target: string;
    tweetUrl: string;
    tweetText: string;
    impressions?: number;
    variants: string[];
}): string {
    const lines: string[] = [];
    lines.push("[info][title]🔁 リプ回り提案[/title]");
    lines.push(`🎯 対象: @${args.target}`);
    if (args.impressions) lines.push(`👁️ インプ: ${args.impressions.toLocaleString()}`);
    lines.push(`🔗 ${args.tweetUrl}`);
    lines.push("");
    lines.push("📝 ポスト本文:");
    lines.push(args.tweetText.length > 200 ? args.tweetText.slice(0, 200) + "..." : args.tweetText);
    lines.push("");
    lines.push("💬 リプ案（コピーして X に貼り付け）:");
    args.variants.forEach((v, i) => {
        lines.push(`[hr]`);
        lines.push(`【案 ${i + 1}】`);
        lines.push(v);
    });
    lines.push("[/info]");
    return lines.join("\n");
}

async function resolveProvider(userId: string): Promise<Provider | null> {
    const settings = await prisma.settings.findUnique({ where: { userId } });
    if (settings?.anthropicApiKey?.trim()) {
        return { name: "anthropic", apiKey: settings.anthropicApiKey.trim(), model: ANTHROPIC_MODEL };
    }
    if (settings?.openaiApiKey?.trim()) {
        return { name: "openai", apiKey: settings.openaiApiKey.trim(), model: OPENAI_MODEL };
    }
    if (process.env.ANTHROPIC_API_KEY) {
        return { name: "anthropic", apiKey: process.env.ANTHROPIC_API_KEY, model: ANTHROPIC_MODEL };
    }
    return null;
}

// 1ユーザー分の実行
async function processUser(userId: string): Promise<{ suggested: number; notified: number; errors: string[] }> {
    const errors: string[] = [];
    let suggested = 0;
    let notified = 0;

    const settings = await prisma.settings.findUnique({ where: { userId } });
    if (!settings?.chatworkApiToken || !settings?.chatworkRoomId) {
        errors.push("ChatWork 未設定（API token または Room ID）");
        return { suggested, notified, errors };
    }
    const minImp = settings.replyEngagementMinImp ?? 500;

    const targets = await prisma.replyEngagementTarget.findMany({
        where: { userId, isActive: true },
        orderBy: { createdAt: "asc" },
        take: 10,
    });
    if (targets.length === 0) {
        errors.push("アクティブなターゲットなし");
        return { suggested, notified, errors };
    }

    // X API クライアント
    let client;
    try {
        client = await getTwitterClient(userId);
    } catch (e) {
        errors.push(`X API: ${(e as { message?: string })?.message || String(e)}`);
        return { suggested, notified, errors };
    }

    // AI プロバイダ
    const provider = await resolveProvider(userId);
    if (!provider) {
        errors.push("AI プロバイダキー未設定");
        return { suggested, notified, errors };
    }

    // ナレッジ（WINNING）
    const winning = await prisma.knowledge.findMany({
        where: { userId, type: "WINNING" },
        take: 10,
    });

    for (const target of targets) {
        try {
            // username -> userId
            const lookup = await client.v2.userByUsername(target.username);
            await logXApiUsage({ userId, operation: "x-user-by-username-engage", rateLimit: (lookup as unknown as { rateLimit?: { limit?: number; remaining?: number; reset?: number } }).rateLimit });
            if (!lookup.data?.id) {
                errors.push(`@${target.username}: ユーザー見つからず`);
                continue;
            }
            const targetUserId = lookup.data.id;

            // 最近24h の本人ポスト
            const since = new Date();
            since.setHours(since.getHours() - 24);
            const timeline = await client.v2.userTimeline(targetUserId, {
                max_results: 10,
                exclude: ["retweets", "replies"],
                "tweet.fields": ["public_metrics", "created_at"],
                start_time: since.toISOString(),
            });
            await logXApiUsage({ userId, operation: "x-user-timeline-engage", rateLimit: (timeline as unknown as { rateLimit?: { limit?: number; remaining?: number; reset?: number } }).rateLimit });

            type TweetRow = { id: string; text: string; impressions: number };
            const rawTweets = (timeline as unknown as { data?: { data?: Array<{ id: string; text: string; public_metrics?: { impression_count?: number } }> } }).data?.data || [];
            const candidates: TweetRow[] = rawTweets
                .map(t => ({ id: t.id, text: t.text, impressions: t.public_metrics?.impression_count ?? 0 }))
                .filter(t => t.impressions >= minImp);

            if (candidates.length === 0) {
                continue;
            }

            // 既に提案済みのポストを除外
            const existingIds = new Set(
                (await prisma.replyEngagementSuggestion.findMany({
                    where: { userId, tweetId: { in: candidates.map(c => c.id) } },
                    select: { tweetId: true },
                })).map(r => r.tweetId)
            );
            const newCandidates = candidates.filter(c => !existingIds.has(c.id));

            // 上位1件だけ処理（API節約）
            const target1 = newCandidates.sort((a, b) => b.impressions - a.impressions)[0];
            if (!target1) continue;

            // AI でリプ案生成
            const { systemText, userText } = buildPromptForReplies({
                tweetText: target1.text,
                targetUsername: target.username,
                selfPersona: {
                    targetAudience: settings?.targetAudience || "",
                    accountConcept: settings?.accountConcept || "",
                    profile: settings?.profile || "",
                },
                winning: winning.map(w => w.content),
            });
            const llm = await callLlm(provider, systemText, userText);
            await logLlmUsage({
                userId,
                provider: provider.name,
                operation: "reply-engagement-generate",
                model: provider.model,
                inputTokens: llm.inputTokens,
                outputTokens: llm.outputTokens,
            });
            const parsed = safeJsonParse(llm.text) as { variants?: unknown } | null;
            const variants = Array.isArray(parsed?.variants)
                ? (parsed!.variants as unknown[]).filter((v): v is string => typeof v === "string" && v.trim().length > 0).slice(0, 3)
                : [];
            if (variants.length === 0) {
                errors.push(`@${target.username}: AI 応答のパース失敗`);
                continue;
            }

            const tweetUrl = `https://x.com/${target.username}/status/${target1.id}`;

            // DB 保存（重複防止のため先に insert）
            const created = await prisma.replyEngagementSuggestion.create({
                data: {
                    userId,
                    targetUsername: target.username,
                    tweetId: target1.id,
                    tweetUrl,
                    tweetText: target1.text,
                    impressions: target1.impressions,
                    variants: JSON.stringify(variants),
                    status: "pending",
                },
            });
            suggested++;

            // ChatWork 送信
            const message = formatChatworkMessage({
                target: target.username,
                tweetUrl,
                tweetText: target1.text,
                impressions: target1.impressions,
                variants,
            });
            const cwRes = await sendChatworkMessage(settings.chatworkApiToken, settings.chatworkRoomId, message);
            if (cwRes.ok) {
                notified++;
                await prisma.replyEngagementSuggestion.update({
                    where: { id: created.id },
                    data: { status: "notified", notifiedAt: new Date() },
                });
            } else {
                errors.push(`ChatWork 送信失敗: ${cwRes.error}`);
                await prisma.replyEngagementSuggestion.update({
                    where: { id: created.id },
                    data: { status: "failed" },
                });
            }

            // ターゲットの lastCheckedAt 更新
            await prisma.replyEngagementTarget.update({
                where: { id: target.id },
                data: { lastCheckedAt: new Date() },
            });
        } catch (e) {
            errors.push(`@${target.username}: ${(e as { message?: string })?.message || String(e)}`);
        }
    }

    return { suggested, notified, errors };
}

// 手動トリガー（ログイン必須、自分のユーザーのみ処理）
export async function POST() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const user = await prisma.user.findUnique({ where: { email: session.user.email }, select: { id: true } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const result = await processUser(user.id);
    return NextResponse.json(result);
}

// cron 用（全ユーザーをループ）
export async function GET(req: Request) {
    const authHeader = req.headers.get("authorization");
    if (process.env.NODE_ENV === "production" && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // ChatWork が設定済みかつターゲットを持つユーザーを対象
    const users = await prisma.user.findMany({
        where: {
            settings: {
                chatworkApiToken: { not: null },
                chatworkRoomId: { not: null },
            },
            replyEngagementTargets: { some: { isActive: true } },
        },
        select: { id: true },
    });

    const results: Array<{ userId: string; suggested: number; notified: number; errors: string[] }> = [];
    for (const u of users) {
        const r = await processUser(u.id);
        results.push({ userId: u.id, ...r });
    }
    return NextResponse.json({ processedUsers: users.length, results });
}
