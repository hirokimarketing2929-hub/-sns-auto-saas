import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logLlmUsage } from "@/lib/api-usage";
import { errorResponse } from "@/lib/api-error";
import { enforceRateLimit, getClientIp } from "@/lib/rate-limit";
import { resolveAIProvider, checkOwnerKeyUsageCap, ownerKeyCapResponse } from "@/lib/ai-provider";

// 自動リプライキャンペーン用「冒頭バリエーション」量産エンドポイント。
// 同一テンプレを大量送信すると不自然＆スパム判定リスクが上がるため、
// 共通CTA（replyContent）の前に置く 1〜2行の自然な導入文を最大100通り生成する。

// Vercel Hobby は関数を 60 秒で強制切断する。AI 呼び出しは 55 秒で自前にタイムアウトさせ、
// 基盤切断による原因不明の 504 を避けてクリーンなエラー応答を返す。
export const maxDuration = 60;

const AI_TIMEOUT_MS = 55000;

const ANTHROPIC_ENDPOINT = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
const ANTHROPIC_VERSION = "2023-06-01";

const OPENAI_ENDPOINT = "https://api.openai.com/v1/chat/completions";
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o";

const MAX_COUNT = 100;
const DEFAULT_COUNT = 30;

type Provider = { name: "anthropic" | "openai"; apiKey: string; model: string };
type LlmResult = { text: string; inputTokens: number; outputTokens: number };

async function callClaude(args: { provider: Provider; systemText: string; userText: string }): Promise<LlmResult> {
    const res = await fetch(ANTHROPIC_ENDPOINT, {
        method: "POST",
        headers: {
            "x-api-key": args.provider.apiKey,
            "anthropic-version": ANTHROPIC_VERSION,
            "content-type": "application/json",
        },
        body: JSON.stringify({
            model: args.provider.model,
            max_tokens: 4096,
            temperature: 0.9,
            system: args.systemText,
            messages: [{ role: "user", content: args.userText }],
        }),
        signal: AbortSignal.timeout(AI_TIMEOUT_MS),
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

async function callOpenAI(args: { provider: Provider; systemText: string; userText: string }): Promise<LlmResult> {
    const res = await fetch(OPENAI_ENDPOINT, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${args.provider.apiKey}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            model: args.provider.model,
            max_tokens: 4096,
            temperature: 0.9,
            response_format: { type: "json_object" },
            messages: [
                { role: "system", content: args.systemText },
                { role: "user", content: args.userText },
            ],
        }),
        signal: AbortSignal.timeout(AI_TIMEOUT_MS),
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

function callProvider(args: { provider: Provider; systemText: string; userText: string }): Promise<LlmResult> {
    return args.provider.name === "anthropic" ? callClaude(args) : callOpenAI(args);
}

// LLM 出力（コードフェンス込み・前置きありなど）から JSON オブジェクトだけを抽出する。
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

// URL を含まないかの軽い防御（生成された冒頭が URL を持っていたら除去）。
function stripUrls(text: string): string {
    return text
        .replace(/https?:\/\/[^\s、。]+/gi, "")
        .replace(/\bwww\.[^\s、。]+/gi, "")
        .replace(/[ \t]{2,}/g, " ")
        .trim();
}

export async function POST(req: Request) {
    try {
        // LLM 課金が走る（最大100件生成）ため濫用ガード。
        const limited = enforceRateLimit(`gen-openings:${getClientIp(req)}`, 10, 60_000);
        if (limited) return limited;

        const session = await getServerSession(authOptions);
        if (!session?.user?.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const user = await prisma.user.findUnique({ where: { email: session.user.email } });
        if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

        const body = await req.json().catch(() => ({}));
        const replyContent: string = typeof body?.replyContent === "string" ? body.replyContent.trim() : "";
        const requestedCount: number = Number.isFinite(Number(body?.count)) ? Math.max(5, Math.min(MAX_COUNT, Math.floor(Number(body.count)))) : DEFAULT_COUNT;
        const tone: string = typeof body?.tone === "string" ? body.tone.trim() : "";

        if (!replyContent) {
            return NextResponse.json({ error: "replyContent（共通CTA本文）は必須です。" }, { status: 400 });
        }

        const settings = await prisma.settings.findUnique({ where: { userId: user.id } });
        const resolved = resolveAIProvider({
            anthropicApiKey: settings?.anthropicApiKey,
            openaiApiKey: settings?.openaiApiKey,
            anthropicModel: ANTHROPIC_MODEL,
            openaiModel: OPENAI_MODEL,
        });
        if (!resolved) {
            return NextResponse.json({
                error: "AI プロバイダの API キーが未設定です。設定画面で Anthropic または OpenAI の API キーを保存してください。"
            }, { status: 400 });
        }
        // 濫用ガード: 当社鍵フォールバック（BYOK OFF）のときだけ 1ユーザー日次上限を適用。
        if (resolved.source === "env:anthropic") {
            const cap = await checkOwnerKeyUsageCap(user.id);
            if (!cap.ok) return ownerKeyCapResponse(cap);
        }
        const provider: Provider = resolved;

        const systemText = [
            "あなたは X (Twitter) で自動リプライを送るときに使う「冒頭の一言」を量産するコピーライターです。",
            "ユーザーが用意した『共通CTA本文』の前に付ける、自然で人間味のある短い導入文を生成します。",
            "",
            "【目的】",
            "同一文面の機械的な大量送信は、受け取った側に冷たい印象を与え、また X 側の自動スパム検知でも不利になります。",
            "受け手ごとに少しずつ違う、人が書いたように自然な導入をいくつも用意することで、コミュニケーションの質を上げます。",
            "",
            "【絶対ルール】",
            "1. 出力は必ず JSON オブジェクトのみ。説明文・前置き・マークダウン・コードフェンスは一切禁止。",
            "2. 各バリエーションは 1〜2 行・全角40文字以内に収める（CTA 本文と連結したときに X の制限を超えないため）。",
            "3. URL（http://, https://, www.,t.co 等の短縮URL）を絶対に含めない。",
            "4. 共通CTA本文と内容が重複しないこと。冒頭は『感謝・反応への一言・呼びかけ』など導入役に徹する。",
            "5. 過度な絵文字の連打・煽り・断定的な収益保証・宗教/政治的な表現は禁止。",
            "6. 受け取り手の username などのパーソナライズトークンは入れない（後段で挿入するわけではないため）。",
            "7. すべて日本語。同じ言い回し・同じ語尾の連続は避け、語彙・トーンに自然なバラつきを持たせる。",
            "8. 「いいね/RT/リプ ありがとうございます」「ご反応ありがとうございます」「気になってもらえて嬉しいです」など、X のリアクションを受けた直後の自然な反応のバリエーションを中心にする。",
            "",
            "【出力形式】",
            `{"openings": ["冒頭文1", "冒頭文2", ...]}`,
        ].join("\n");

        const userText = [
            `【生成数】${requestedCount} 通り`,
            tone ? `【希望トーン】${tone}` : "【希望トーン】指定なし（カジュアル〜丁寧の幅を持たせる）",
            "",
            "【この後に続く共通CTA本文（参考。冒頭はこの内容と重複しないこと）】",
            replyContent.slice(0, 600),
        ].join("\n");

        let llmResult: LlmResult;
        try {
            llmResult = await callProvider({ provider, systemText, userText });
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            await logLlmUsage({
                userId: user.id,
                provider: provider.name,
                operation: "autoreply-generate-openings",
                model: provider.model,
                inputTokens: 0,
                outputTokens: 0,
                success: false,
                errorMessage: msg,
            });
            console.error("[generate-openings] LLM call failed:", msg);
            if (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")) {
                return NextResponse.json({ error: "生成がタイムアウトしました。もう一度お試しください。" }, { status: 504 });
            }
            return NextResponse.json({ error: "AI 呼び出しに失敗しました。時間をおいて再試行してください。" }, { status: 502 });
        }

        await logLlmUsage({
            userId: user.id,
            provider: provider.name,
            operation: "autoreply-generate-openings",
            model: provider.model,
            inputTokens: llmResult.inputTokens,
            outputTokens: llmResult.outputTokens,
        });

        const parsed = safeJsonParse(llmResult.text);
        const rawOpenings: unknown = (parsed && typeof parsed === "object" && "openings" in parsed)
            ? (parsed as { openings: unknown }).openings
            : null;
        if (!Array.isArray(rawOpenings)) {
            return NextResponse.json({
                error: "AI 応答を解釈できませんでした。もう一度お試しください。",
                rawSample: llmResult.text.slice(0, 200),
            }, { status: 502 });
        }

        const openings = rawOpenings
            .filter((s): s is string => typeof s === "string")
            .map(s => stripUrls(s).replace(/\r?\n+/g, "\n").trim())
            .filter(s => s.length > 0 && s.length <= 120)
            .slice(0, MAX_COUNT);

        if (openings.length === 0) {
            return NextResponse.json({ error: "AI が有効なバリエーションを返しませんでした。" }, { status: 502 });
        }

        return NextResponse.json({ openings, count: openings.length });
    } catch (error) {
        return errorResponse(error, "サーバーエラーが発生しました", 500, "generate-openings");
    }
}
