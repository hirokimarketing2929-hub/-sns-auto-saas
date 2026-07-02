import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { logLlmUsage, calculateLlmCost } from "@/lib/api-usage";
import { getActiveXAccount } from "@/lib/active-x-account";
import { researchGenerate } from "@/lib/research-llm";
import { resolveAIProviderFromSettings } from "@/lib/ai-provider";
import { enforceLlmRateLimit, acquireOwnerKeyGuard } from "@/lib/owner-key-guard";

// 投稿生成（Claude / OpenAI BYOK）。旧実装は FastAPI に依存していたが、
// ここでは Next.js 内で LLM を直接呼び出し、ユーザーのナレッジ・ペルソナを
// DB から組み込んで1つの高品質な投稿を生成する。

// Vercel の関数実行上限（Hobby は 60 秒で強制切断）。基盤切断による原因不明の 504 を避けるため、
// AI 呼び出し側は 55 秒でクリーンに AbortError を投げ、アプリが分かりやすいタイムアウト応答を返す。
export const maxDuration = 60;

// AI 呼び出しのタイムアウト（ミリ秒）。基盤の 60 秒切断より手前で自前に止める。
const AI_TIMEOUT_MS = 55000;

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

// AbortSignal.timeout 由来の中断（TimeoutError / AbortError）かどうかを判定する。
function isTimeoutError(e: unknown): boolean {
    return e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError");
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
        // LLM 課金が走るため濫用ガード（IP 単位の連打抑止・全 LLM route 共通ラッパ）。
        const limited = enforceLlmRateLimit(req, "generate", 30, 60_000);
        if (limited) return limited;

        const session = await getServerSession(authOptions);
        if (!session?.user?.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const user = await prisma.user.findUnique({ where: { email: session.user.email } });
        if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

        const xAccount = await getActiveXAccount(user.id);
        if (!xAccount) {
            return NextResponse.json({ error: "サブアカウントが未設定です。" }, { status: 400 });
        }
        const xAccountId = xAccount.id;

        const body = await req.json();
        const userTheme: string = typeof body?.user_theme === "string" ? body.user_theme : "";
        const enforce140: boolean = body?.enforce_140_limit === true;
        const enableResearch: boolean = body?.enable_research === true;

        // DB から自社情報を取得
        const [settings, allKnowledges, pastPosts, kpis] = await Promise.all([
            prisma.settings.findUnique({ where: { userId: user.id } }),
            prisma.knowledge.findMany({
                where: { userId: user.id, xAccountId },
                orderBy: [{ order: "asc" }, { createdAt: "desc" }],
            }),
            prisma.pastPost.findMany({
                where: { userId: user.id, xAccountId },
                orderBy: { postedAt: "desc" },
                take: 20,
            }),
            prisma.kpiScenario.findMany({
                where: { userId: user.id, xAccountId },
                orderBy: { order: "asc" },
            }),
        ]);

        if (!settings) {
            return NextResponse.json({ error: "設定情報が見つかりません。ナレッジ画面から AI 生成設定を保存してください。" }, { status: 400 });
        }

        const baseRules = allKnowledges.filter(k => k.type === "BASE").map(k => k.content);
        const templateRules = allKnowledges.filter(k => k.type === "TEMPLATE").map(k => k.content);
        const winningRules = allKnowledges.filter(k => k.type === "WINNING").map(k => k.content);
        const losingRules = allKnowledges.filter(k => k.type === "LOSING").map(k => k.content);

        // プロバイダ選択（自鍵は復号してから解決）。research/direct 双方で使う。
        const resolved = resolveAIProviderFromSettings({
            anthropicApiKey: settings.anthropicApiKey,
            openaiApiKey: settings.openaiApiKey,
            anthropicModel: ANTHROPIC_MODEL,
            openaiModel: OPENAI_MODEL,
        });
        if (!resolved) {
            return NextResponse.json({
                error: "AI プロバイダの API キーが未設定です。設定画面で Anthropic または OpenAI の API キーを保存してください。"
            }, { status: 400 });
        }
        // フリーミアム（決定 #033）＋濫用ガード（#032）を共通ラッパで一括適用。
        //   - 当社鍵（env:anthropic）利用時のみ「1日1枠」を atomic 予約（RT-015 TOCTOU 封鎖）＋ 24h キャップ。
        //   - 自鍵（user:*）は無制限・予約なし（guard.finalize/release は no-op）。
        // 予約は「生成の直前」に取り、研究/通常いずれの分岐でも finalize（成功）or release（全滅）する。
        const usingOwnKey = resolved.source !== "env:anthropic";
        const provider: Provider = resolved;
        const guardResult = await acquireOwnerKeyGuard({
            userId: user.id,
            usingOwnKey,
            operation: enableResearch ? "generate-research" : "generate",
            model: provider.model,
        });
        if (!guardResult.ok) return guardResult.response;
        const guard = guardResult.guard;
        // 生成成功後にレスポンスへ載せる「本日の残り無料回数」（自鍵時は UI 非表示用に freeLimit）。
        const freeRemaining = guard.freeRemaining;
        const freeLimit = guard.freeLimit;

        // リサーチモード ON: Render/Python 不要。設定の Anthropic/OpenAI キーで各社の web 検索ツールを使い、
        // 最新トレンドを調べてから投稿を生成する。失敗時は偽装せず direct-LLM パスへフォールバックし
        // research_unavailable を明示する。
        let researchUnavailable = false;
        if (enableResearch) {
            const usePersona = (xAccount as { applyPersonaToGeneration?: boolean }).applyPersonaToGeneration === true;
            const researchSystem = [
                "あなたは X(Twitter) で高エンゲージメントを出すプロのコピーライターです。",
                "まず web 検索で『今この瞬間』の最新トレンド・ニュース・話題を調べ、それを踏まえて X 投稿を1本だけ作成します。",
                "出力は完成した投稿本文のみ。説明・前置き・見出し・引用符・コードフェンス・URL は一切含めないでください。",
                enforce140 ? "本文は必ず 140 文字以内に収めてください。" : "本文は読みやすい長さに収めてください。",
            ].join("\n");
            const researchUser = [
                `【テーマ】${userTheme || "（指定なし。トレンドから最適な切り口を選ぶ）"}`,
                "",
                ...(usePersona ? [
                    `【ターゲット】${xAccount.targetAudience || "（未設定）"}`,
                    `【悩み】${xAccount.targetPain || "（未設定）"}`,
                    `【コンセプト】${xAccount.accountConcept || "（未設定）"}`,
                    "",
                ] : []),
                winningRules.length > 0 ? `【勝ちパターン】\n${truncateList(winningRules, 5, 200)}` : "",
                losingRules.length > 0 ? `【避ける表現】\n${truncateList(losingRules, 5, 150)}` : "",
                "",
                "最新トレンドを必ず web 検索で確認し、テーマに沿って今バズりやすい投稿を作ってください。",
            ].filter(Boolean).join("\n");

            // RT-012: research 分岐は web_search（max_uses:5, max_tokens:1500）の追加課金が乗るため、
            //   研究の成功・失敗いずれでも usage を必ず計上する（計上漏れで当社鍵を無制限消費させない）。
            //   researchGenerate はトークンを返さないため、web_search コストを多めに概算で固定計上する。
            //   出力 max_tokens=1500 ＋ web_search(最大5回)の入力増を見込み、保守的に input/output を大きめに置く。
            const RESEARCH_EST_INPUT_TOKENS = 12000;  // web_search 結果の取り込み分を多めに見積もり
            const RESEARCH_EST_OUTPUT_TOKENS = 1500;  // max_tokens 上限
            const researchEstCost = calculateLlmCost(
                provider.name,
                provider.model,
                RESEARCH_EST_INPUT_TOKENS,
                RESEARCH_EST_OUTPUT_TOKENS,
            );
            try {
                const { content: rc, researchLog } = await researchGenerate(provider, researchSystem, researchUser);
                const cleaned = stripUrls(rc);
                if (cleaned.length > 0) {
                    // 成功: 予約行を research 実績へ確定（当社鍵時のみ実体・自鍵は no-op）。
                    await guard.finalize({
                        provider: provider.name,
                        operation: "generate-research",
                        model: provider.model,
                        inputTokens: RESEARCH_EST_INPUT_TOKENS,
                        outputTokens: RESEARCH_EST_OUTPUT_TOKENS,
                        costUsd: researchEstCost,
                    });
                    return NextResponse.json({
                        content: cleaned,
                        platform: "X",
                        research_log: researchLog,
                        _engine: `research:${provider.name}`,
                        freeRemaining,
                        freeLimit,
                        usingOwnKey,
                    });
                }
                researchUnavailable = true;
            } catch (e) {
                researchUnavailable = true;
                console.warn("research generation failed, falling back to direct LLM:", e instanceof Error ? e.message : e);
            }
            // 研究が失敗/空でも web_search コストは発生済み。漏れなく別行で計上する（RT-012）。
            // ※ 予約行は後段の direct 生成で finalize されるため、ここは追加コストの独立ログとして残す。
            if (researchUnavailable) {
                await logLlmUsage({
                    userId: user.id,
                    provider: provider.name,
                    operation: "generate-research-failed",
                    model: provider.model,
                    inputTokens: RESEARCH_EST_INPUT_TOKENS,
                    outputTokens: RESEARCH_EST_OUTPUT_TOKENS,
                    success: false,
                    errorMessage: "research_unavailable (web_search cost charged)",
                });
            }
        }

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
            // ペルソナ反映はオプトイン（applyPersonaToGeneration）。OFF時は特定ペルソナに寄せず汎用・バズ優先で生成する。
            ...((xAccount as any).applyPersonaToGeneration ? [
                "【自社アカウント情報】",
                `- ターゲット層: ${xAccount.targetAudience || "（未設定）"}`,
                `- ターゲットの悩み: ${xAccount.targetPain || "（未設定）"}`,
                `- アカウントのコンセプト: ${xAccount.accountConcept || "（未設定）"}`,
                `- 発信者のプロフィール: ${xAccount.profile || "（未設定）"}`,
                `- 誘導先 URL: ${xAccount.ctaUrl || "（未設定）"}（※参考情報。投稿本文には URL を載せない）`,
                "",
            ] : [
                "【方針】特定のペルソナには寄せず、幅広い読者に刺さる汎用的でバズりやすい切り口を優先する。",
                "",
            ]),
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
        let timedOut = false;
        let authFailed = false;
        // 予約行（success=false プレースホルダ）への確定は最後に1回だけ行う。
        // 失敗試行ぶんの追加コストは独立ログで漏れなく計上する。
        let lastInputTokens = 0;
        let lastOutputTokens = 0;
        for (const temp of [0.7, 0.85]) {
            try {
                const llm = await callProvider({
                    provider,
                    systemText,
                    userText,
                    maxTokens: 1024,
                    temperature: temp,
                });
                lastInputTokens = llm.inputTokens;
                lastOutputTokens = llm.outputTokens;
                const obj = safeJsonParse(llm.text) as { content?: unknown } | null;
                if (obj && typeof obj.content === "string" && obj.content.trim().length > 0) {
                    // URL を後処理で強制除去（LLM がルール違反した場合の保険）
                    content = stripUrls(obj.content);
                    if (content.length > 0) {
                        parseOk = true;
                        break;
                    }
                }
                // パース失敗でも当社鍵コストは発生済み＝独立ログで計上（予約行は最後に finalize）。
                await logLlmUsage({
                    userId: user.id,
                    provider: provider.name,
                    operation: "generate-parse-failed",
                    model: provider.model,
                    inputTokens: llm.inputTokens,
                    outputTokens: llm.outputTokens,
                    success: false,
                    errorMessage: "parse_failed",
                });
            } catch (e) {
                if (isTimeoutError(e)) timedOut = true;
                // プロバイダの 401 = API キー無効。リトライしても回復しないため区別して案内する。
                if (e instanceof Error && /error \(401\)/.test(e.message)) authFailed = true;
                console.warn(`generate attempt at temp ${temp} failed:`, e);
            }
        }

        if (!parseOk) {
            // 生成が一切成功しなかった: 予約枠を解放して無料枠を焼かない（RT-015 整合）。
            await guard.release();
            if (timedOut) {
                return NextResponse.json({
                    error: "生成がタイムアウトしました。もう一度お試しください。"
                }, { status: 504 });
            }
            // 自鍵（BYOK）利用時のみキー無効を明示する（当社鍵側の状態は外部に出さない: RT-006）。
            if (authFailed && usingOwnKey) {
                return NextResponse.json({
                    error: "設定されたAPIキーが無効です。設定画面でキーを確認・再登録してください。"
                }, { status: 401 });
            }
            return NextResponse.json({
                error: "AI による投稿生成に失敗しました。テーマをもう少し具体的にして再実行してください。"
            }, { status: 502 });
        }

        // 成功: 予約行を実績トークン/コストへ確定（当社鍵時のみ実体・自鍵は no-op）。
        await guard.finalize({
            provider: provider.name,
            operation: "generate",
            model: provider.model,
            inputTokens: lastInputTokens,
            outputTokens: lastOutputTokens,
            costUsd: calculateLlmCost(provider.name, provider.model, lastInputTokens, lastOutputTokens),
        });

        return NextResponse.json({
            content,
            platform: "X",
            _engine: `${provider.name}:${provider.model}`,
            freeRemaining,
            freeLimit,
            usingOwnKey,
            // リサーチを要求されたがエンジンに繋がらず通常生成にフォールバックした場合に true。
            ...(researchUnavailable ? { research_unavailable: true } : {}),
        });
    } catch (error) {
        console.error("generate API Error:", error);
        if (isTimeoutError(error)) {
            return NextResponse.json({ error: "生成がタイムアウトしました。もう一度お試しください。" }, { status: 504 });
        }
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
