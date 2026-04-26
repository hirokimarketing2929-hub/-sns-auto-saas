import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { logLlmUsage } from "@/lib/api-usage";

// 2段階フロー（Claude / OpenAI 両対応 BYOK 版）:
//   Step 1: 元ポスト → テーマ固有部分だけを [プレースホルダ] 化したテンプレート抽出
//   Step 2: テンプレート × ユーザー入力テーマ × 自社ナレッジ で 3 軸並列穴埋め
//
// プロバイダ選択ロジック（優先順位）:
//   1. Settings.anthropicApiKey → Claude Sonnet
//   2. Settings.openaiApiKey   → OpenAI GPT
//   3. サーバ環境変数 ANTHROPIC_API_KEY → Claude（開発者/オーナー用フォールバック）
//   4. 何もなければエラー

// ===== プロバイダ抽象化 =====

const ANTHROPIC_ENDPOINT = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
const ANTHROPIC_VERSION = "2023-06-01";

const OPENAI_ENDPOINT = "https://api.openai.com/v1/chat/completions";
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o";

type ProviderName = "anthropic" | "openai";

type Provider = {
    name: ProviderName;
    apiKey: string;
    model: string;
};

type LlmCallArgs = {
    provider: Provider;
    systemText: string;           // system prompt (共通部分, キャッシュ対象)
    contextText: string;          // ナレッジ/ペルソナ (共通部分, キャッシュ対象)
    userText: string;             // リクエストごとに変わる本文
    maxTokens?: number;
    temperature?: number;
};

type LlmResult = { text: string; inputTokens: number; outputTokens: number };

// Claude: system は配列で cache_control を付与。Claude 4 系はプリフィル非対応のため、
// JSON 出力はシステムプロンプトの指示のみで制御（フロント側で頑健にパース）。
async function callClaude(args: LlmCallArgs): Promise<LlmResult> {
    const res = await fetch(ANTHROPIC_ENDPOINT, {
        method: "POST",
        headers: {
            "x-api-key": args.provider.apiKey,
            "anthropic-version": ANTHROPIC_VERSION,
            "content-type": "application/json",
        },
        body: JSON.stringify({
            model: args.provider.model,
            max_tokens: args.maxTokens ?? 2048,
            temperature: args.temperature ?? 0.7,
            system: [
                { type: "text", text: args.systemText, cache_control: { type: "ephemeral" } },
                { type: "text", text: args.contextText, cache_control: { type: "ephemeral" } },
            ],
            messages: [
                { role: "user", content: [{ type: "text", text: args.userText }] },
            ],
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

// OpenAI: response_format で JSON モード強制
async function callOpenAI(args: LlmCallArgs): Promise<LlmResult> {
    const res = await fetch(OPENAI_ENDPOINT, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${args.provider.apiKey}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            model: args.provider.model,
            max_tokens: args.maxTokens ?? 2048,
            temperature: args.temperature ?? 0.7,
            response_format: { type: "json_object" },
            messages: [
                { role: "system", content: args.systemText + "\n\n" + args.contextText },
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

async function callProvider(args: LlmCallArgs): Promise<LlmResult> {
    return args.provider.name === "anthropic" ? callClaude(args) : callOpenAI(args);
}

// Claude / OpenAI 応答から JSON オブジェクトを頑健に抽出。
//  - ```json ... ``` の Markdown コードフェンスを剥がす
//  - 前後の余計な文章があっても最外側の { ... } を切り出す
function safeJsonParse(raw: string): unknown | null {
    const trimmed = raw.trim();

    // 1) Markdown コードフェンスの除去
    const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    const stripped = fenceMatch ? fenceMatch[1].trim() : trimmed;

    // 2) 最初の { から最後の } までを抜き出す
    const firstBrace = stripped.indexOf("{");
    const lastBrace = stripped.lastIndexOf("}");
    if (firstBrace < 0 || lastBrace <= firstBrace) {
        // ブレースが見つからなければ生のまま試す
        try {
            return JSON.parse(stripped);
        } catch {
            return null;
        }
    }
    const slice = stripped.slice(firstBrace, lastBrace + 1);
    try {
        return JSON.parse(slice);
    } catch {
        return null;
    }
}

// ===== 切り口 =====

type Angle = { key: string; label: string; instruction: string };

const ANGLES: Angle[] = [
    {
        key: "audience",
        label: "ターゲット軸",
        instruction: "【誰に刺さるか】を前面に。ターゲット層の属性・立場・状況を具体化する言葉を使って穴埋めしてください。",
    },
    {
        key: "pain",
        label: "悩み軸",
        instruction: "【どんな痛み・損失・不安を抱えているか】を前面に。悩みの具体像・失敗エピソード・感情を匂わせる言葉で穴埋めしてください。",
    },
    {
        key: "concept",
        label: "コンセプト軸",
        instruction: "【自社のコンセプト・独自の解決策・提供価値】を前面に。どう解決できるか・何が独自かを示す言葉で穴埋めしてください。",
    },
];

// ===== Step 1: テンプレ抽出 =====

type ExtractedTemplate = {
    template: string;
    placeholders: Array<{ key: string; meaning: string }>;
    extracted_format: string;
    extracted_emotion: string;
};

const EXTRACT_SYSTEM_TEXT = [
    "あなたは X (Twitter) のポスト構造分析家です。",
    "元ポストから「どのテーマでも再利用できる普遍的な骨組み・言い回し」と「テーマ固有の差し替えが必要な部分」を厳密に区別します。",
    "",
    "【絶対ルール】",
    "1. 出力する template は、元ポストを一字一句そのままコピーし、テーマ固有の語句だけを [...] に置き換えたもの。それ以外の文字（助詞・接続詞・絵文字・記号・改行・空白・半角全角の違い）は完全に一致させる。",
    "2. 普遍的な表現（『実は』『ぶっちゃけ』『保存推奨』『〜すると』『▼』『★』等）はそのまま残す。",
    "3. テーマ固有の固有名詞・具体例・数字・対象・原因・解決策だけを角括弧 [...] のプレースホルダに置換する。",
    "4. プレースホルダ名は必ず [テーマ] [ターゲット] [悩み] [具体例] [数字] [原因] [解決策] [理由] [CTA] などの意味のある日本語で。英語や記号は禁止。",
    "5. 同じ意味の単語は同じプレースホルダ名を使う（例: 本文中に『営業』が2回出てきて両方テーマ固有なら、どちらも [テーマ] とする）。",
    "6. 元の文章構造を壊さないよう、細切れに [...] を入れすぎない。1つの具体例は1つのプレースホルダにまとめる。",
    "7. 元ポストに URL（http/https/www/t.co 等）が含まれていた場合、その URL 部分ごと [CTA] や [誘導] などのプレースホルダに置き換える（URL 文字列は template に残さない）。",
    "8. 出力は必ず JSON オブジェクトのみ。説明文・前置き・マークダウンは一切禁止。",
].join("\n");

function buildExtractUserText(sourceText: string): string {
    return [
        "以下の元ポストをテンプレート化してください。骨組みはそのまま残し、テーマ固有の部分だけを [プレースホルダ] に置換します。",
        "",
        "【元ポスト】",
        "```",
        sourceText,
        "```",
        "",
        "【出力形式】JSON オブジェクトのみ。",
        `{"template": "プレースホルダ入りの骨格（改行・絵文字含めて元ポストと完全一致）", "placeholders": [{"key": "[テーマ]", "meaning": "この箇所に入れるべき内容の説明"}], "extracted_format": "投稿の型を一文で", "extracted_emotion": "感情ベクトル（FUN / WOW / 尊い / 癒し / 感動 / 知識 / あるある / 納得 / 主張 / 物申す / 応援 / 共感 / 驚愕 / 好奇心 / 危機感 / 欲求 から1〜2個）"}`,
    ].join("\n");
}

function parseExtracted(raw: string): ExtractedTemplate | null {
    const obj = safeJsonParse(raw) as {
        template?: unknown;
        placeholders?: unknown;
        extracted_format?: unknown;
        extracted_emotion?: unknown;
    } | null;
    if (!obj) return null;
    const template = typeof obj.template === "string" ? obj.template : "";
    const placeholders = Array.isArray(obj.placeholders)
        ? obj.placeholders
            .filter((p: unknown): p is { key: string; meaning: string } =>
                typeof p === "object" && p !== null &&
                typeof (p as { key: unknown }).key === "string" &&
                typeof (p as { meaning: unknown }).meaning === "string"
            )
            .map((p: { key: string; meaning: string }) => ({ key: p.key, meaning: p.meaning }))
        : [];
    const fmt = typeof obj.extracted_format === "string" ? obj.extracted_format : "";
    const emo = typeof obj.extracted_emotion === "string" ? obj.extracted_emotion : "";
    if (!template || !fmt || !emo) return null;
    return { template, placeholders, extracted_format: fmt, extracted_emotion: emo };
}

// ===== Step 2: 穴埋め =====

type Persona = {
    target_audience: string;
    target_pain: string;
    account_concept: string;
    profile: string;
    cta_url: string;
};

type KnowledgeBundle = {
    base: string[];
    template: string[];
    winning: string[];
    losing: string[];
};

function truncateList(arr: string[], n: number, maxChars: number): string {
    return arr.slice(0, n).map(s => s.length > maxChars ? s.slice(0, maxChars) + "..." : s).join("\n");
}

// ポスト本文から URL を徹底除去（共通ルール）
function stripUrls(text: string): string {
    let t = text;
    t = t.replace(/https?:\/\/[^\s、。]+/gi, "");
    t = t.replace(/\bwww\.[^\s、。]+/gi, "");
    t = t.replace(/\b(?:t\.co|bit\.ly|buff\.ly|ow\.ly|lnkd\.in|amzn\.to|goo\.gl|tinyurl\.com)\/[^\s、。]+/gi, "");
    t = t.replace(/[→>]\s*(?:こちら|こちらから|詳細)?\s*(?=\n|$)/g, "");
    t = t.replace(/[ \t]{2,}/g, " ").replace(/\n{3,}/g, "\n\n");
    return t.trim();
}

const FILL_SYSTEM_TEXT = [
    "あなたは X (Twitter) のコピーライターアシスタントです。",
    "テンプレート内の [プレースホルダ] に対して、入るべき具体的な単語・フレーズを JSON で出力する仕事をします。",
    "",
    "【あなたの仕事（厳格）】",
    "- テンプレート全文は出力しない。プレースホルダごとの「中に入れる値」だけを出力する。",
    "- テンプレート本文への置換はシステム側（別プロセス）がプログラムで行うため、あなたは値を出すだけで構造は絶対に保持される。",
    "",
    "【値の作り方】",
    "1. 各プレースホルダは、その意味説明に沿った1つの短い日本語フレーズで埋める（なるべく簡潔に、テンプレ文字数を崩さない長さ）。",
    "2. 同じプレースホルダ名が複数出てきても、まとめて1つの値を返す（自動で全箇所に適用される）。",
    "3. 値はメインテーマ・自社ペルソナ・ナレッジから抽出した具体的な言葉にする（抽象的すぎる値は禁止）。",
    "4. 元ポストを連想させる情報（元のテーマ・数字・固有名詞）は絶対に使わない。",
    "5. 自社ナレッジの勝ちパターンを意識した語彙を優先する。",
    "6. 値には URL（http://、https://、www.、t.co 等の短縮 URL を含む）を絶対に含めない。",
    "7. 【誘導禁止・デフォルト】[CTA]・[誘導] 等の誘導系プレースホルダの値は、基本的に『（空文字）』『（誘導なし）』または自然な終わりとなる短い一言（例: 『試してみてください』『保存推奨です』）で埋める。『プロフへ』『DM ください』『LINE登録』などの外部誘導は入れない。",
    "8. 例外: ユーザーのメインテーマに誘導の指示が明示的に含まれている場合のみ、そのとおりの誘導値を入れて良い。",
    "9. 出力は必ず JSON オブジェクトのみ。説明文・前置き・マークダウン・余計なキーは一切禁止。",
].join("\n");

function buildFillContextText(persona: Persona, knowledge: KnowledgeBundle): string {
    return [
        "【自社アカウント情報】",
        `- ターゲット層: ${persona.target_audience || "（未設定）"}`,
        `- ターゲットの悩み: ${persona.target_pain || "（未設定）"}`,
        `- アカウントのコンセプト: ${persona.account_concept || "（未設定）"}`,
        `- 発信者のプロフィール: ${persona.profile || "（未設定）"}`,
        `- 誘導先 URL: ${persona.cta_url || "（未設定）"}（※参考情報。投稿本文・値には URL を載せない）`,
        "",
        "【自社ナレッジ - ベース（基本方針）】",
        knowledge.base.length > 0 ? truncateList(knowledge.base, 10, 300) : "（なし）",
        "",
        "【自社ナレッジ - 投稿の型】",
        knowledge.template.length > 0 ? truncateList(knowledge.template, 10, 300) : "（なし）",
        "",
        "【自社ナレッジ - 勝ちパターン】",
        knowledge.winning.length > 0 ? truncateList(knowledge.winning, 10, 300) : "（なし）",
        "",
        "【避けるべき表現 - LOSING】",
        knowledge.losing.length > 0 ? truncateList(knowledge.losing, 8, 200) : "（なし）",
    ].join("\n");
}

function buildFillUserText(args: {
    template: string;
    placeholders: Array<{ key: string; meaning: string }>;
    userTheme: string;
    angle: Angle;
}): string {
    const phList = args.placeholders.length > 0
        ? args.placeholders.map(p => `  - ${p.key}: ${p.meaning}`).join("\n")
        : "  （テンプレートから `[...]` 形式を全て拾う。各キーに対応する値を返す）";

    const exampleKey = args.placeholders[0]?.key || "[テーマ]";
    const exampleKey2 = args.placeholders[1]?.key || "[具体例]";

    return [
        "【今回の切り口（この案のフォーカス）】",
        `▶ ${args.angle.label}: ${args.angle.instruction}`,
        "",
        "【メインテーマ（最優先で反映）】",
        args.userTheme,
        "",
        "【対象のテンプレート（参考のため全文を提示）】",
        "```",
        args.template,
        "```",
        "",
        "【穴埋め対象のプレースホルダ】",
        phList,
        "",
        "【重要】あなたの出力はテンプレート本文ではなく、プレースホルダ → 値 のマッピングだけ。値は簡潔な1フレーズ。",
        "",
        "【出力形式】JSON オブジェクトのみ。",
        `{"fills": {"${exampleKey}": "この切り口・テーマに沿った具体的なフレーズ", "${exampleKey2}": "同じくフレーズ"}}`,
    ].join("\n");
}

function parseFills(raw: string): Record<string, string> | null {
    const obj = safeJsonParse(raw) as { fills?: unknown } | null;
    if (!obj || typeof obj.fills !== "object" || obj.fills === null || Array.isArray(obj.fills)) return null;
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(obj.fills as Record<string, unknown>)) {
        if (typeof value === "string" && value.trim().length > 0) {
            result[key] = value.trim();
        }
    }
    return Object.keys(result).length > 0 ? result : null;
}

// テンプレートの [...] をプログラム的に置換（構造を100%保持）
function applyFills(template: string, fills: Record<string, string>): string {
    let result = template;
    // キーは長い順にソート（部分一致を避ける。例: [悩み] が [悩みの話] より先にヒットしないように）
    const sortedKeys = Object.keys(fills).sort((a, b) => b.length - a.length);
    for (const key of sortedKeys) {
        result = result.split(key).join(fills[key]);
    }
    return result;
}

// 未置換のプレースホルダ [xxx] が残っているか検出
function hasUnfilledPlaceholders(text: string): boolean {
    return /\[[^\[\]]{1,30}\]/.test(text);
}

function isNearDuplicate(source: string, candidate: string): boolean {
    const normalize = (s: string) => s.replace(/\s+/g, "").trim();
    const a = normalize(source);
    const b = normalize(candidate);
    if (a === b) return true;
    const minLen = Math.min(a.length, b.length);
    if (minLen === 0) return false;
    let common = 0;
    for (let i = 0; i < minLen; i++) {
        if (a[i] === b[i]) common++;
        else break;
    }
    return common / Math.max(a.length, b.length) >= 0.85;
}

async function generateOneVariant(opts: {
    provider: Provider;
    template: string;
    placeholders: Array<{ key: string; meaning: string }>;
    userTheme: string;
    angle: Angle;
    sourceText: string;
    contextText: string;
    userId: string;
}): Promise<string | null> {
    for (const temp of [0.6, 0.85]) {
        try {
            const userText = buildFillUserText({
                template: opts.template,
                placeholders: opts.placeholders,
                userTheme: opts.userTheme,
                angle: opts.angle,
            });
            const llm = await callProvider({
                provider: opts.provider,
                systemText: FILL_SYSTEM_TEXT,
                contextText: opts.contextText,
                userText,
                maxTokens: 1024,
                temperature: temp,
            });
            // 使用量ログ（各軸の各試行ごとに記録）
            await logLlmUsage({
                userId: opts.userId,
                provider: opts.provider.name,
                operation: `research-fill-${opts.angle.key}`,
                model: opts.provider.model,
                inputTokens: llm.inputTokens,
                outputTokens: llm.outputTokens,
            });
            const fills = parseFills(llm.text);
            if (!fills) continue;

            // プログラム側で置換（構造は完全保持される）
            const filled = applyFills(opts.template, fills);
            if (hasUnfilledPlaceholders(filled)) {
                // 未置換があれば次の温度で再試行
                console.warn(`[${opts.angle.key}] unfilled placeholders remain, retrying`);
                continue;
            }
            // URL 後処理（fills に URL が紛れ込んでいたら強制除去）
            const cleaned = stripUrls(filled);
            if (isNearDuplicate(opts.sourceText, cleaned)) continue;
            return cleaned;
        } catch (e) {
            console.warn(`fill ${opts.angle.key} at temp ${temp} failed:`, e);
        }
    }
    return null;
}

// ===== メインハンドラ =====

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const user = await prisma.user.findUnique({
            where: { email: session.user.email }
        });
        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        const data = await req.json();
        const sourcePostText: unknown = data?.sourcePostText;
        const userTheme: unknown = data?.userTheme;
        if (typeof sourcePostText !== "string" || !sourcePostText.trim()) {
            return NextResponse.json({ error: "元になる投稿テキストが必要です。" }, { status: 400 });
        }
        if (typeof userTheme !== "string" || !userTheme.trim()) {
            return NextResponse.json({ error: "テーマを入力してください（必須）。" }, { status: 400 });
        }

        const [settings, allKnowledges] = await Promise.all([
            prisma.settings.findUnique({ where: { userId: user.id } }),
            prisma.knowledge.findMany({
                where: { userId: user.id },
                orderBy: [{ order: "asc" }, { createdAt: "desc" }],
            }),
        ]);

        if (!settings) {
            return NextResponse.json({ error: "設定情報が見つかりません。ナレッジ画面から AI 生成設定を保存してください。" }, { status: 400 });
        }

        // プロバイダ選択（優先順位: ユーザーAnthropic → ユーザーOpenAI → サーバ環境Anthropic）
        let provider: Provider | null = null;
        let providerSource = "none";
        if (settings.anthropicApiKey && settings.anthropicApiKey.trim()) {
            provider = { name: "anthropic", apiKey: settings.anthropicApiKey.trim(), model: ANTHROPIC_MODEL };
            providerSource = "user:anthropic";
        } else if (settings.openaiApiKey && settings.openaiApiKey.trim()) {
            provider = { name: "openai", apiKey: settings.openaiApiKey.trim(), model: OPENAI_MODEL };
            providerSource = "user:openai";
        } else if (process.env.ANTHROPIC_API_KEY) {
            provider = { name: "anthropic", apiKey: process.env.ANTHROPIC_API_KEY, model: ANTHROPIC_MODEL };
            providerSource = "env:anthropic";
        }
        console.log(`[structure-rewrite] provider resolved: ${providerSource}, user-anthropic-len: ${settings.anthropicApiKey?.length ?? 0}, user-openai-len: ${settings.openaiApiKey?.length ?? 0}, env-anthropic: ${process.env.ANTHROPIC_API_KEY ? "set" : "unset"}`);

        const persona: Persona = {
            target_audience: settings.targetAudience || "",
            target_pain: settings.targetPain || "",
            account_concept: settings.accountConcept || "",
            profile: settings.profile || "",
            cta_url: settings.ctaUrl || "",
        };

        if (!provider) {
            return NextResponse.json({
                extracted_format: "",
                extracted_emotion: "",
                generated_posts: [],
                generated_variants: [],
                _fallback: true,
                _message: "AI プロバイダの API キーが未設定です。設定画面で Anthropic または OpenAI の API キーを保存してください。",
                _used_theme: persona,
                _user_theme: userTheme.trim(),
            }, { status: 200 });
        }

        const knowledge: KnowledgeBundle = {
            base: allKnowledges.filter(k => k.type === "BASE").map(k => k.content),
            template: allKnowledges.filter(k => k.type === "TEMPLATE").map(k => k.content),
            winning: allKnowledges.filter(k => k.type === "WINNING").map(k => k.content),
            losing: allKnowledges.filter(k => k.type === "LOSING").map(k => k.content),
        };

        // ---- Step 1: テンプレート抽出 ----
        let extracted: ExtractedTemplate | null = null;
        try {
            const llm = await callProvider({
                provider,
                systemText: EXTRACT_SYSTEM_TEXT,
                contextText: "（Step 1 ではナレッジは使いません）",
                userText: buildExtractUserText(sourcePostText),
                maxTokens: 2048,
                temperature: 0.3,
            });
            await logLlmUsage({
                userId: user.id,
                provider: provider.name,
                operation: "research-extract",
                model: provider.model,
                inputTokens: llm.inputTokens,
                outputTokens: llm.outputTokens,
            });
            extracted = parseExtracted(llm.text);
        } catch (err) {
            console.error("Template extraction failed:", err);
        }

        if (!extracted) {
            return NextResponse.json({
                extracted_format: "",
                extracted_emotion: "",
                generated_posts: [],
                generated_variants: [],
                _fallback: true,
                _message: "元ポストのテンプレート化に失敗しました。別の投稿でお試しください。",
                _used_theme: persona,
                _user_theme: userTheme.trim(),
                _engine: `${provider.name}:${provider.model}`,
            }, { status: 200 });
        }

        // ---- Step 2: 3 軸並列穴埋め ----
        const contextText = buildFillContextText(persona, knowledge);

        const variantResults = await Promise.all(
            ANGLES.map(angle =>
                generateOneVariant({
                    provider: provider!,
                    template: extracted!.template,
                    placeholders: extracted!.placeholders,
                    userTheme: userTheme.trim(),
                    angle,
                    sourceText: sourcePostText,
                    contextText,
                    userId: user.id,
                })
            )
        );

        const variants = ANGLES
            .map((angle, i) => {
                const content = variantResults[i];
                return content ? { angle_key: angle.key, angle_label: angle.label, content } : null;
            })
            .filter((x): x is { angle_key: string; angle_label: string; content: string } => x !== null);

        if (variants.length === 0) {
            return NextResponse.json({
                extracted_format: extracted.extracted_format,
                extracted_emotion: extracted.extracted_emotion,
                generated_posts: [],
                generated_variants: [],
                template: extracted.template,
                placeholders: extracted.placeholders,
                _fallback: true,
                _message: "全ての軸で穴埋めに失敗しました。テーマをより具体的にして再実行してください。",
                _used_theme: persona,
                _user_theme: userTheme.trim(),
                _engine: `${provider.name}:${provider.model}`,
            }, { status: 200 });
        }

        return NextResponse.json({
            extracted_format: extracted.extracted_format,
            extracted_emotion: extracted.extracted_emotion,
            generated_posts: variants.map(v => v.content),
            generated_variants: variants,
            template: extracted.template,
            placeholders: extracted.placeholders,
            _used_theme: persona,
            _user_theme: userTheme.trim(),
            _engine: `${provider.name}:${provider.model}`,
        });
    } catch (error) {
        console.error("structure-rewrite Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
