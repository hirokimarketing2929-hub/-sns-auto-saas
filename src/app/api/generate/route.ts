import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { logLlmUsage } from "@/lib/api-usage";

// 投稿生成（Claude / OpenAI BYOK）。旧実装は FastAPI に依存していたが、
// ここでは Next.js 内で LLM を直接呼び出し、ユーザーのナレッジ・ペルソナを
// DB から組み込んで1つの高品質な投稿を生成する。

const ANTHROPIC_ENDPOINT = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
const ANTHROPIC_VERSION = "2023-06-01";

const OPENAI_ENDPOINT = "https://api.openai.com/v1/chat/completions";
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o";

type Provider = { name: "anthropic" | "openai"; apiKey: string; model: string };
type LlmResult = { text: string; inputTokens: number; outputTokens: number };

async function callClaude(args: {
    provider: Provider;
    systemText: string;
    userText: string;
    maxTokens: number;
    temperature: number;
}): Promise<LlmResult> {
    const res = await fetch(ANTHROPIC_ENDPOINT, {
        method: "POST",
        headers: {
            "x-api-key": args.provider.apiKey,
            "anthropic-version": ANTHROPIC_VERSION,
            "content-type": "application/json",
        },
        body: JSON.stringify({
            model: args.provider.model,
            max_tokens: args.maxTokens,
            temperature: args.temperature,
            system: args.systemText,
            messages: [{ role: "user", content: args.userText }],
        }),
        signal: AbortSignal.timeout(90000),
    });
    if (!res.ok) {
        const errText = await res.text().catch(() => "");
        throw new Error(`Claude API error (${res.status}): ${errText}`);
    }
    const data = await res.json() as {
        content?: Array<{ type: string; text?: string }>;
        usage?: { input_tokens?: number; output_tokens?: number };
    };
    const text = data.content?.find(c => c.type === "text")?.text ?? "";
    if (!text.trim()) throw new Error("Claude returned empty content");
    return {
        text,
        inputTokens: data.usage?.input_tokens ?? 0,
        outputTokens: data.usage?.output_tokens ?? 0,
    };
}

async function callOpenAI(args: {
    provider: Provider;
    systemText: string;
    userText: string;
    maxTokens: number;
    temperature: number;
}): Promise<LlmResult> {
    const res = await fetch(OPENAI_ENDPOINT, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${args.provider.apiKey}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            model: args.provider.model,
            max_tokens: args.maxTokens,
            temperature: args.temperature,
            response_format: { type: "json_object" },
            messages: [
                { role: "system", content: args.systemText },
                { role: "user", content: args.userText },
            ],
        }),
        signal: AbortSignal.timeout(90000),
    });
    if (!res.ok) {
        const errText = await res.text().catch(() => "");
        throw new Error(`OpenAI API error (${res.status}): ${errText}`);
    }
    const data = await res.json() as {
        choices?: Array<{ message?: { content?: string } }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    const text = data.choices?.[0]?.message?.content ?? "";
    if (!text.trim()) throw new Error("OpenAI returned empty content");
    return {
        text,
        inputTokens: data.usage?.prompt_tokens ?? 0,
        outputTokens: data.usage?.completion_tokens ?? 0,
    };
}

async function callProvider(args: {
    provider: Provider;
    systemText: string;
    userText: string;
    maxTokens: number;
    temperature: number;
}): Promise<LlmResult> {
    return args.provider.name === "anthropic" ? callClaude(args) : callOpenAI(args);
}

function safeJsonParse(raw: string): unknown | null {
    const trimmed = raw.trim();
    const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    const stripped = fenceMatch ? fenceMatch[1].trim() : trimmed;
    const firstBrace = stripped.indexOf("{");
    const lastBrace = stripped.lastIndexOf("}");
    if (firstBrace < 0 || lastBrace <= firstBrace) {
        try { return JSON.parse(stripped); } catch { return null; }
    }
    try { return JSON.parse(stripped.slice(firstBrace, lastBrace + 1)); } catch { return null; }
}

function truncateList(arr: string[], n: number, maxChars: number): string {
    return arr.slice(0, n).map(s => s.length > maxChars ? s.slice(0, maxChars) + "..." : s).join("\n");
}

// ポスト本文から URL を徹底除去する。
//   - http/https URL
//   - 先頭 www. で始まる URL
//   - t.co / bit.ly 等の短縮 URL
// 除去後は余計な空白・改行を整える。
function stripUrls(text: string): string {
    let t = text;
    // プロトコル付きURL
    t = t.replace(/https?:\/\/[^\s、。]+/gi, "");
    // www. で始まる裸URL
    t = t.replace(/\bwww\.[^\s、。]+/gi, "");
    // t.co / bit.ly などの代表的な短縮URL（プロトコルなしでもマッチ）
    t = t.replace(/\b(?:t\.co|bit\.ly|buff\.ly|ow\.ly|lnkd\.in|amzn\.to|goo\.gl|tinyurl\.com)\/[^\s、。]+/gi, "");
    // URLが消えた直後の「→」や余計な装飾を掃除
    t = t.replace(/[→>]\s*(?:こちら|こちらから|詳細)?\s*(?=\n|$)/g, "");
    // 連続空白・空行を整形
    t = t.replace(/[ \t]{2,}/g, " ").replace(/\n{3,}/g, "\n\n");
    return t.trim();
}

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const user = await prisma.user.findUnique({ where: { email: session.user.email } });
        if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

        const body = await req.json();
        const userTheme: string = typeof body?.user_theme === "string" ? body.user_theme : "";
        const enforce140: boolean = body?.enforce_140_limit === true;

        // DB から自社情報を取得
        const [settings, allKnowledges, pastPosts, kpis] = await Promise.all([
            prisma.settings.findUnique({ where: { userId: user.id } }),
            prisma.knowledge.findMany({
                where: { userId: user.id },
                orderBy: [{ order: "asc" }, { createdAt: "desc" }],
            }),
            prisma.pastPost.findMany({
                where: { userId: user.id },
                orderBy: { postedAt: "desc" },
                take: 20,
            }),
            prisma.kpiScenario.findMany({
                where: { userId: user.id },
                orderBy: { order: "asc" },
            }),
        ]);

        if (!settings) {
            return NextResponse.json({ error: "設定情報が見つかりません。ナレッジ画面から AI 生成設定を保存してください。" }, { status: 400 });
        }

        // プロバイダ選択
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
                error: "AI プロバイダの API キーが未設定です。設定画面で Anthropic または OpenAI の API キーを保存してください。"
            }, { status: 400 });
        }

        const baseRules = allKnowledges.filter(k => k.type === "BASE").map(k => k.content);
        const templateRules = allKnowledges.filter(k => k.type === "TEMPLATE").map(k => k.content);
        const winningRules = allKnowledges.filter(k => k.type === "WINNING").map(k => k.content);
        const losingRules = allKnowledges.filter(k => k.type === "LOSING").map(k => k.content);

        const systemText = [
            "あなたは X (Twitter) で高エンゲージメントを叩き出すコピーライターです。",
            "ユーザーのアカウント情報・ナレッジ・テーマから、1本の完成版の投稿を生成します。",
            "",
            "【絶対ルール】",
            "1. 出力は必ず JSON オブジェクトのみ。説明文・前置き・マークダウン・コードフェンスは一切禁止。",
            "2. 勝ちパターン（WINNING）を意識した構造で書く。",
            "3. 負けパターン（LOSING）の表現・構造は絶対に使わない。",
            "4. アカウントのコンセプト・ターゲット・悩みに刺さる、具体的で独自性のある投稿にする。",
            "5. 冒頭 1 文で読み手を引き込むフックを置く。",
            "6. 装飾（絵文字・改行・箇条書き）は読みやすさ優先で効果的に使う。",
            "7. 投稿本文に URL を絶対に含めない（http://、https://、www.、t.co 等の短縮 URL も全て禁止）。",
            "8. 【誘導禁止・デフォルト】投稿の末尾に『プロフへ』『固ツイ参照』『DM ください』『続きはこちら』等の外部誘導を基本入れない。投稿単体で完結する価値提供を優先する。",
            "9. 例外: ユーザーが指定した『メインテーマ』に明示的に誘導の指示（『プロフに誘導する』『LINE登録を促す』等）が含まれている場合のみ、その意図に沿った誘導を末尾に入れて良い。",
            enforce140 ? "10. 140 文字以内に厳格に収める。" : "10. 文字数の上限は柔軟。内容を優先し、長文になりすぎないよう注意。",
            "",
            "【出力形式】",
            `{"content": "そのまま X にコピペできる完成版の投稿本文"}`,
        ].join("\n");

        const userText = [
            "【メインテーマ（最優先で反映）】",
            userTheme || "（未指定。ペルソナ・ナレッジに基づく最適な提案をしてください）",
            "",
            "【自社アカウント情報】",
            `- ターゲット層: ${settings.targetAudience || "（未設定）"}`,
            `- ターゲットの悩み: ${settings.targetPain || "（未設定）"}`,
            `- アカウントのコンセプト: ${settings.accountConcept || "（未設定）"}`,
            `- 発信者のプロフィール: ${settings.profile || "（未設定）"}`,
            `- 誘導先 URL: ${settings.ctaUrl || "（未設定）"}（※参考情報。投稿本文には URL を載せない）`,
            "",
            "【自社ナレッジ - ベース（基本方針）】",
            baseRules.length > 0 ? truncateList(baseRules, 10, 300) : "（なし）",
            "",
            "【自社ナレッジ - 投稿の型】",
            templateRules.length > 0 ? truncateList(templateRules, 10, 300) : "（なし）",
            "",
            "【自社ナレッジ - 勝ちパターン】",
            winningRules.length > 0 ? truncateList(winningRules, 10, 300) : "（なし）",
            "",
            "【避けるべき表現 - LOSING】",
            losingRules.length > 0 ? truncateList(losingRules, 8, 200) : "（なし）",
            "",
            "【過去の高パフォポスト（参考）】",
            pastPosts.length > 0
                ? pastPosts.slice(0, 5).map(p => `- [${p.impressions.toLocaleString()} imp] ${p.content.slice(0, 150)}`).join("\n")
                : "（なし）",
            "",
            "【KPI シナリオ】",
            kpis.length > 0
                ? kpis.map(k => `- ${k.name}: 目標 ${k.targetValue.toLocaleString()} / 現在 ${k.currentValue.toLocaleString()}`).join("\n")
                : "（なし）",
            "",
            `【出力形式】{"content": "投稿本文"} の JSON のみ。`,
        ].join("\n");

        let content = "";
        let parseOk = false;
        for (const temp of [0.7, 0.85]) {
            try {
                const llm = await callProvider({
                    provider,
                    systemText,
                    userText,
                    maxTokens: 1024,
                    temperature: temp,
                });
                // 成功・失敗に関わらず usage を記録（失敗時は errorMessage 付き）
                await logLlmUsage({
                    userId: user.id,
                    provider: provider.name,
                    operation: "generate",
                    model: provider.model,
                    inputTokens: llm.inputTokens,
                    outputTokens: llm.outputTokens,
                });
                const obj = safeJsonParse(llm.text) as { content?: unknown } | null;
                if (obj && typeof obj.content === "string" && obj.content.trim().length > 0) {
                    // URL を後処理で強制除去（LLM がルール違反した場合の保険）
                    content = stripUrls(obj.content);
                    if (content.length > 0) {
                        parseOk = true;
                        break;
                    }
                }
            } catch (e) {
                console.warn(`generate attempt at temp ${temp} failed:`, e);
            }
        }

        if (!parseOk) {
            return NextResponse.json({
                error: "AI による投稿生成に失敗しました。テーマをもう少し具体的にして再実行してください。"
            }, { status: 502 });
        }

        return NextResponse.json({
            content,
            platform: "X",
            _engine: `${provider.name}:${provider.model}`,
        });
    } catch (error) {
        console.error("generate API Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
