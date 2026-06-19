// リアルタイムリサーチ付き生成（Render/Python 不要版）。
// ユーザーが ProX 設定に保存した Anthropic または OpenAI のキーで、
// 各社の「web 検索ツール」を使って最新情報を調べてから投稿を1つ生成する。
//
// - Anthropic: Messages API + server tool `web_search_20250305`
// - OpenAI:    Responses API + tool `web_search_preview`
//
// 失敗時は例外を投げる（呼び出し側が通常生成へフォールバックする）。

export type ResearchProvider = { name: "anthropic" | "openai"; apiKey: string; model: string };
export type ResearchResult = { content: string; researchLog: string[] };

const ANTHROPIC_ENDPOINT = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const OPENAI_RESPONSES_ENDPOINT = "https://api.openai.com/v1/responses";

const TIMEOUT_MS = 90000;

// --- Anthropic（web_search サーバーツール） ---
async function researchWithAnthropic(
    provider: ResearchProvider,
    systemText: string,
    userText: string,
): Promise<ResearchResult> {
    const res = await fetch(ANTHROPIC_ENDPOINT, {
        method: "POST",
        headers: {
            "x-api-key": provider.apiKey,
            "anthropic-version": ANTHROPIC_VERSION,
            "content-type": "application/json",
        },
        body: JSON.stringify({
            model: provider.model,
            max_tokens: 1500,
            system: systemText,
            messages: [{ role: "user", content: userText }],
            tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 5 }],
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
        const errText = await res.text().catch(() => "");
        throw new Error(`Anthropic web検索エラー (${res.status}): ${errText.slice(0, 300)}`);
    }
    const data = await res.json() as {
        content?: Array<{ type: string; text?: string; name?: string; input?: { query?: string } }>;
    };
    const blocks = Array.isArray(data.content) ? data.content : [];
    const researchLog: string[] = [];
    const textParts: string[] = [];
    for (const b of blocks) {
        if (b.type === "server_tool_use" && b.name === "web_search" && b.input?.query) {
            researchLog.push(`🔎 「${b.input.query}」を検索`);
        } else if (b.type === "text" && typeof b.text === "string") {
            textParts.push(b.text);
        }
    }
    const content = textParts.join("\n").trim();
    if (!content) throw new Error("Anthropic がリサーチ後に空の応答を返しました");
    return { content, researchLog };
}

// --- OpenAI（Responses API + web_search_preview） ---
async function researchWithOpenAI(
    provider: ResearchProvider,
    systemText: string,
    userText: string,
): Promise<ResearchResult> {
    const res = await fetch(OPENAI_RESPONSES_ENDPOINT, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${provider.apiKey}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            model: provider.model,
            tools: [{ type: "web_search_preview" }],
            input: `${systemText}\n\n${userText}`,
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
        const errText = await res.text().catch(() => "");
        throw new Error(`OpenAI web検索エラー (${res.status}): ${errText.slice(0, 300)}`);
    }
    const data = await res.json() as {
        output_text?: string;
        output?: Array<{
            type: string;
            action?: { query?: string };
            content?: Array<{ type: string; text?: string }>;
        }>;
    };
    const researchLog: string[] = [];
    const textParts: string[] = [];
    for (const item of data.output ?? []) {
        if (item.type === "web_search_call") {
            const q = item.action?.query;
            researchLog.push(q ? `🔎 「${q}」を検索` : "🔎 web 検索を実行");
        } else if (item.type === "message" && Array.isArray(item.content)) {
            for (const c of item.content) {
                if ((c.type === "output_text" || c.type === "text") && typeof c.text === "string") {
                    textParts.push(c.text);
                }
            }
        }
    }
    const content = (textParts.join("\n").trim() || (data.output_text ?? "").trim());
    if (!content) throw new Error("OpenAI がリサーチ後に空の応答を返しました");
    return { content, researchLog };
}

export async function researchGenerate(
    provider: ResearchProvider,
    systemText: string,
    userText: string,
): Promise<ResearchResult> {
    if (provider.name === "anthropic") {
        return researchWithAnthropic(provider, systemText, userText);
    }
    return researchWithOpenAI(provider, systemText, userText);
}
