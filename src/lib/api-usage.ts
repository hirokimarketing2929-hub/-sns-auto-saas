import { prisma } from "@/lib/prisma";

// 価格表（USD / 1 トークン）。最新モデルに合わせて定期的に更新する。
// Anthropic Claude: https://www.anthropic.com/pricing
// OpenAI:          https://openai.com/api/pricing/
const CLAUDE_PRICING: Record<string, { input: number; output: number }> = {
    "claude-sonnet-4-6": { input: 3 / 1_000_000, output: 15 / 1_000_000 },
    "claude-opus-4-7": { input: 15 / 1_000_000, output: 75 / 1_000_000 },
    "claude-haiku-4-5": { input: 0.8 / 1_000_000, output: 4 / 1_000_000 },
};
const OPENAI_PRICING: Record<string, { input: number; output: number }> = {
    "gpt-4o": { input: 2.5 / 1_000_000, output: 10 / 1_000_000 },
    "gpt-4o-mini": { input: 0.15 / 1_000_000, output: 0.6 / 1_000_000 },
};

function priceFor(provider: string, model: string): { input: number; output: number } {
    if (provider === "anthropic") {
        return CLAUDE_PRICING[model] ?? CLAUDE_PRICING["claude-sonnet-4-6"];
    }
    if (provider === "openai") {
        return OPENAI_PRICING[model] ?? OPENAI_PRICING["gpt-4o"];
    }
    return { input: 0, output: 0 };
}

export function calculateLlmCost(
    provider: string,
    model: string,
    inputTokens: number,
    outputTokens: number,
): number {
    const p = priceFor(provider, model);
    return inputTokens * p.input + outputTokens * p.output;
}

// LLM 呼び出しの使用量を記録。失敗しても業務ロジックは止めない。
export async function logLlmUsage(args: {
    userId: string;
    provider: "anthropic" | "openai";
    operation: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
    success?: boolean;
    errorMessage?: string;
}): Promise<void> {
    try {
        const costUsd = calculateLlmCost(args.provider, args.model, args.inputTokens, args.outputTokens);
        await prisma.apiUsageLog.create({
            data: {
                userId: args.userId,
                provider: args.provider,
                operation: args.operation,
                model: args.model,
                inputTokens: args.inputTokens,
                outputTokens: args.outputTokens,
                costUsd,
                success: args.success ?? true,
                errorMessage: args.errorMessage,
            },
        });
    } catch (e) {
        console.warn("[api-usage] logLlmUsage failed:", e);
    }
}

// X API 呼び出しの使用量を記録（レートリミット情報込み）
export async function logXApiUsage(args: {
    userId: string;
    operation: string;
    rateLimit?: { remaining?: number; limit?: number; reset?: number };
    success?: boolean;
    errorMessage?: string;
}): Promise<void> {
    try {
        await prisma.apiUsageLog.create({
            data: {
                userId: args.userId,
                provider: "x",
                operation: args.operation,
                xRateLimitRemaining: args.rateLimit?.remaining ?? null,
                xRateLimitMax: args.rateLimit?.limit ?? null,
                xRateLimitReset: args.rateLimit?.reset
                    ? new Date(args.rateLimit.reset * 1000)
                    : null,
                success: args.success ?? true,
                errorMessage: args.errorMessage,
            },
        });
    } catch (e) {
        console.warn("[api-usage] logXApiUsage failed:", e);
    }
}

// Anthropic レスポンスから usage を安全に抜き出す
export function extractAnthropicUsage(resp: unknown): { inputTokens: number; outputTokens: number } {
    const r = resp as { usage?: { input_tokens?: number; output_tokens?: number } };
    return {
        inputTokens: r?.usage?.input_tokens ?? 0,
        outputTokens: r?.usage?.output_tokens ?? 0,
    };
}

// OpenAI レスポンスから usage を安全に抜き出す
export function extractOpenAiUsage(resp: unknown): { inputTokens: number; outputTokens: number } {
    const r = resp as { usage?: { prompt_tokens?: number; completion_tokens?: number } };
    return {
        inputTokens: r?.usage?.prompt_tokens ?? 0,
        outputTokens: r?.usage?.completion_tokens ?? 0,
    };
}
