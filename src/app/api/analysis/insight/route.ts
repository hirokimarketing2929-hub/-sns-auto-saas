import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logLlmUsage } from "@/lib/api-usage";

// Claude / OpenAI を使って「直近 N 日のパフォーマンス」を自然言語で要約・助言する。
// 出力は JSON: { headline, what_worked, what_didnt, next_moves: string[], tldr }

const ANTHROPIC_ENDPOINT = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
const ANTHROPIC_VERSION = "2023-06-01";
const OPENAI_ENDPOINT = "https://api.openai.com/v1/chat/completions";
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o";

type Provider = { name: "anthropic" | "openai"; apiKey: string; model: string };
type LlmResult = { text: string; inputTokens: number; outputTokens: number };

async function callClaude(p: Provider, systemText: string, userText: string): Promise<LlmResult> {
    const res = await fetch(ANTHROPIC_ENDPOINT, {
        method: "POST",
        headers: {
            "x-api-key": p.apiKey,
            "anthropic-version": ANTHROPIC_VERSION,
            "content-type": "application/json",
        },
        body: JSON.stringify({
            model: p.model,
            max_tokens: 4000,
            temperature: 0.5,
            system: systemText,
            messages: [{ role: "user", content: userText }],
        }),
        signal: AbortSignal.timeout(120000),
    });
    if (!res.ok) throw new Error(`Claude API error (${res.status}): ${await res.text().catch(() => "")}`);
    const data = await res.json() as {
        content?: Array<{ type: string; text?: string }>;
        usage?: { input_tokens?: number; output_tokens?: number };
    };
    return {
        text: data.content?.find(c => c.type === "text")?.text ?? "",
        inputTokens: data.usage?.input_tokens ?? 0,
        outputTokens: data.usage?.output_tokens ?? 0,
    };
}

async function callOpenAI(p: Provider, systemText: string, userText: string): Promise<LlmResult> {
    const res = await fetch(OPENAI_ENDPOINT, {
        method: "POST",
        headers: { "Authorization": `Bearer ${p.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
            model: p.model,
            max_tokens: 4000,
            temperature: 0.5,
            response_format: { type: "json_object" },
            messages: [
                { role: "system", content: systemText },
                { role: "user", content: userText },
            ],
        }),
        signal: AbortSignal.timeout(90000),
    });
    if (!res.ok) throw new Error(`OpenAI API error (${res.status}): ${await res.text().catch(() => "")}`);
    const data = await res.json() as {
        choices?: Array<{ message?: { content?: string } }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    return {
        text: data.choices?.[0]?.message?.content ?? "",
        inputTokens: data.usage?.prompt_tokens ?? 0,
        outputTokens: data.usage?.completion_tokens ?? 0,
    };
}

function safeJsonParse(raw: string): unknown | null {
    const t = raw.trim();
    const fence = t.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    const s = fence ? fence[1].trim() : t;
    const first = s.indexOf("{"), last = s.lastIndexOf("}");
    const slice = first >= 0 && last > first ? s.slice(first, last + 1) : s;
    try { return JSON.parse(slice); } catch { return null; }
}

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const user = await prisma.user.findUnique({ where: { email: session.user.email }, select: { id: true } });
        if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

        const { days = 7 } = (await req.json().catch(() => ({}))) as { days?: number };
        const rangeDays = Math.max(1, Math.min(90, Number(days)));

        const settings = await prisma.settings.findUnique({ where: { userId: user.id } });
        if (!settings) return NextResponse.json({ error: "設定情報が見つかりません" }, { status: 400 });

        let provider: Provider | null = null;
        if (settings.anthropicApiKey?.trim()) {
            provider = { name: "anthropic", apiKey: settings.anthropicApiKey.trim(), model: ANTHROPIC_MODEL };
        } else if (settings.openaiApiKey?.trim()) {
            provider = { name: "openai", apiKey: settings.openaiApiKey.trim(), model: OPENAI_MODEL };
        } else if (process.env.ANTHROPIC_API_KEY) {
            provider = { name: "anthropic", apiKey: process.env.ANTHROPIC_API_KEY, model: ANTHROPIC_MODEL };
        }
        if (!provider) {
            return NextResponse.json({
                headline: "AI プロバイダの API キー未設定",
                tldr: "設定画面から Anthropic または OpenAI の API キーを保存すると、AI 週次インサイトが使えます。",
                what_worked: "",
                what_didnt: "",
                next_moves: [],
                _fallback: true,
            });
        }

        const since = new Date();
        since.setDate(since.getDate() - rangeDays);

        const [pastPosts, funnelEvents, knowledges] = await Promise.all([
            prisma.pastPost.findMany({
                where: { userId: user.id, postedAt: { gte: since } },
                orderBy: { impressions: "desc" },
                take: 20,
            }),
            prisma.funnelEvent.findMany({
                where: { userId: user.id, occurredAt: { gte: since } },
                select: { occurredAt: true, formName: true, utmCampaign: true, utmContent: true },
            }),
            prisma.knowledge.findMany({
                where: { userId: user.id, OR: [{ type: "WINNING" }, { type: "LOSING" }] },
                take: 15,
            }),
        ]);

        const topSnippets = pastPosts.slice(0, 10).map(p => ({
            snippet: p.content.slice(0, 200),
            imp: p.impressions,
            conv: p.conversions,
            postedAt: p.postedAt.toISOString().slice(0, 10),
        }));
        const avgImp = pastPosts.length > 0 ? Math.round(pastPosts.reduce((s, p) => s + p.impressions, 0) / pastPosts.length) : 0;

        const systemText = [
            "あなたは X (Twitter) 運用のデータアナリスト兼コーチです。",
            "ユーザーの投稿データとプロライン導線データを元に、何が効いて何が効かなかったかを日本語で分析し、ナレッジ追加候補を提案します。",
            "",
            "【絶対ルール】",
            "- 出力は **有効な JSON オブジェクト1つのみ**。前置き文・説明文・マークダウンコードブロック（```）は一切禁止。",
            "- 1文字目は必ず `{` で始まり、最後は `}` で終わる。",
            "- 文字列内の改行はエスケープ（\\n）して JSON として valid に。",
            "",
            "【suggestions の付け方】",
            "type: \"BASE\" | \"TEMPLATE\" | \"WINNING\" | \"LOSING\"",
            "level: \"tactic\"（戦術・1〜2週で検証可: フック、時間帯、絵文字、文字数） / \"strategy\"（戦略・3ヶ月以上の傾向が必要: ターゲット、CTA方向、コンセプト）",
            "confidence: \"high\"（投稿10件以上+効果差1.5x以上）/ \"medium\"（中間）/ \"low\"（データ少or微差）",
            "強制ルール: level=\"strategy\" かつ confidence=\"low\" の提案は絶対に出さない",
            "caveat: strategy または low confidence には反映前の注意点を日本語で。tactic+high は null で可。",
            "",
            "【出力スキーマ】",
            `{"headline":"一文の総括","tldr":"3行以内要約","what_worked":"根拠数値含む上手くいった点","what_didnt":"上手くいかなかった点","next_moves":["具体アクション1","2","3"],"suggestions":[{"type":"WINNING","level":"tactic","confidence":"high","content":"ルール本文","rationale":"数値根拠","caveat":null}]}`,
            "",
            "【分量の目安】各文字列フィールドは 200 字程度まで。next_moves は各100字まで・最大5件。suggestions は最大5件。冗長になりすぎないこと。",
            "",
            "上記形式の JSON のみを出力してください。必ず valid な JSON で、最初の文字は { です。最後までちゃんと閉じること。",
        ].join("\n");

        const userText = [
            `【分析期間】直近 ${rangeDays} 日`,
            `【投稿数】${pastPosts.length} 件 / 平均インプ ${avgImp.toLocaleString()}`,
            `【ファネル】プロライン登録 ${funnelEvents.length} 件`,
            "",
            "【上位10ポスト（インプ降順）】",
            topSnippets.length > 0
                ? topSnippets.map((p, i) => `${i + 1}. [${p.imp.toLocaleString()} imp / ${p.conv} CV / ${p.postedAt}] ${p.snippet}`).join("\n")
                : "データなし（PastPost の同期がまだ実行されていない可能性）",
            "",
            "【自社ナレッジ（勝ち/負けパターン）】",
            knowledges.length > 0
                ? knowledges.map(k => `- [${k.type}] ${k.content.slice(0, 100)}`).join("\n")
                : "（未設定）",
            "",
            "【出力形式】JSON オブジェクトのみ。",
        ].join("\n");

        type SuggestionIn = {
            type?: string; level?: string; confidence?: string;
            content?: string; rationale?: string; caveat?: string | null;
        };
        type ParsedInsight = {
            headline?: string; tldr?: string; what_worked?: string; what_didnt?: string;
            next_moves?: string[]; suggestions?: SuggestionIn[];
        };
        let parsed: ParsedInsight | null = null;
        let rawText = "";
        try {
            const llm = provider.name === "anthropic"
                ? await callClaude(provider, systemText, userText)
                : await callOpenAI(provider, systemText, userText);
            rawText = llm.text;
            await logLlmUsage({
                userId: user.id,
                provider: provider.name,
                operation: "analysis-insight",
                model: provider.model,
                inputTokens: llm.inputTokens,
                outputTokens: llm.outputTokens,
            });
            parsed = safeJsonParse(llm.text) as ParsedInsight | null;
            if (!parsed) {
                console.warn("[analysis/insight] JSON parse failed. raw text (first 500 chars):", llm.text.slice(0, 500));
            }
        } catch (e) {
            console.error("insight call failed:", e);
        }

        // suggestions の正規化
        const allowedTypes = new Set(["BASE", "TEMPLATE", "WINNING", "LOSING"]);
        const rawSuggestions: SuggestionIn[] = Array.isArray(parsed?.suggestions) ? parsed!.suggestions : [];
        const suggestions = rawSuggestions
            .filter(s => typeof s.content === "string" && s.content.trim().length > 0)
            .map(s => {
                const typeUpper = (s.type || "").toUpperCase();
                return {
                    type: allowedTypes.has(typeUpper) ? typeUpper : "WINNING",
                    level: s.level === "strategy" ? "strategy" : "tactic",
                    confidence: ["high", "medium", "low"].includes(s.confidence || "") ? (s.confidence as "high" | "medium" | "low") : "medium",
                    content: (s.content || "").trim(),
                    rationale: typeof s.rationale === "string" ? s.rationale.trim() : "",
                    caveat: typeof s.caveat === "string" && s.caveat.trim().length > 0 ? s.caveat.trim() : null,
                };
            });

        const parseFailed = !parsed;
        return NextResponse.json({
            headline: parsed?.headline || (parseFailed ? "⚠️ 応答のパースに失敗しました" : "分析インサイト"),
            tldr: parsed?.tldr || (parseFailed
                ? "AI の返答が JSON 形式で解析できませんでした。もう一度『分析を実行』を押すか、期間を変えてお試しください。"
                : ""),
            what_worked: parsed?.what_worked || "",
            what_didnt: parsed?.what_didnt || "",
            next_moves: Array.isArray(parsed?.next_moves) ? parsed!.next_moves : [],
            suggestions,
            _meta: {
                days: rangeDays,
                engine: `${provider.name}:${provider.model}`,
                posts_analyzed: pastPosts.length,
                funnel_events: funnelEvents.length,
            },
            _parseFailed: parseFailed,
            _rawPreview: parseFailed ? rawText.slice(0, 500) : undefined,
        });
    } catch (error) {
        console.error("analysis/insight error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
