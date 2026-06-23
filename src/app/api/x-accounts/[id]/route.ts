import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TwitterApi } from "twitter-api-v2";
import { encryptSecret, decryptSecret } from "@/lib/crypto";

async function getCurrentUser() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return null;
    return prisma.user.findUnique({ where: { email: session.user.email } });
}

function mask(xa: any) {
    return {
        id: xa.id,
        displayName: xa.displayName,
        oauthAccountId: xa.oauthAccountId,
        xUsername: xa.xUsername,
        xUserId: xa.xUserId,
        xProfileImageUrl: xa.xProfileImageUrl,
        hasOAuth: !!xa.oauthAccountId,
        hasManualKeys: !!(xa.xApiKey && xa.xApiSecret && xa.xAccessToken && xa.xAccessSecret),
        accountConcept: xa.accountConcept,
        profile: xa.profile,
        policy: xa.policy,
        thresholdImpression: xa.thresholdImpression,
        thresholdConversion: xa.thresholdConversion,
        replyEngagementMinImp: xa.replyEngagementMinImp,
        targetAudience: xa.targetAudience,
        targetPain: xa.targetPain,
        ctaUrl: xa.ctaUrl,
        competitor1: xa.competitor1,
        competitor2: xa.competitor2,
        applyPersonaToGeneration: xa.applyPersonaToGeneration,
        createdAt: xa.createdAt,
        updatedAt: xa.updatedAt,
    };
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ message: "認証が必要です" }, { status: 401 });
    const { id } = await ctx.params;
    const xa = await prisma.xAccount.findFirst({ where: { id, userId: user.id } });
    if (!xa) return NextResponse.json({ message: "Not Found" }, { status: 404 });
    // アカウント詳細ページで保存済みキーを表示するため、本人にのみ平文で返す（復号して返す）
    return NextResponse.json({
        xAccount: {
            ...mask(xa),
            xApiKey: (decryptSecret(xa.xApiKey) as string) ?? "",
            xApiSecret: (decryptSecret(xa.xApiSecret) as string) ?? "",
            xAccessToken: (decryptSecret(xa.xAccessToken) as string) ?? "",
            xAccessSecret: (decryptSecret(xa.xAccessSecret) as string) ?? "",
        },
    });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ message: "認証が必要です" }, { status: 401 });
    const { id } = await ctx.params;

    const existing = await prisma.xAccount.findFirst({ where: { id, userId: user.id } });
    if (!existing) return NextResponse.json({ message: "Not Found" }, { status: 404 });

    const body = await req.json().catch(() => ({} as any));
    const has = (k: string) => Object.prototype.hasOwnProperty.call(body, k);
    const data: Record<string, unknown> = {};

    for (const k of [
        "displayName",
        "xApiKey", "xApiSecret", "xAccessToken", "xAccessSecret",
        "accountConcept", "profile", "policy",
        "thresholdImpression", "thresholdConversion", "replyEngagementMinImp",
        "targetAudience", "targetPain", "ctaUrl", "competitor1", "competitor2",
        "applyPersonaToGeneration",
    ]) {
        if (has(k)) data[k] = body[k];
    }

    // BYOK が新たに揃ったら username/icon を取得して更新。
    // 検証用の平文を解決する: リクエスト値はそのまま平文、既存値は復号する。
    const plainApiKey = (data.xApiKey ?? decryptSecret(existing.xApiKey)) as string | null | undefined;
    const plainApiSecret = (data.xApiSecret ?? decryptSecret(existing.xApiSecret)) as string | null | undefined;
    const plainAccessToken = (data.xAccessToken ?? decryptSecret(existing.xAccessToken)) as string | null | undefined;
    const plainAccessSecret = (data.xAccessSecret ?? decryptSecret(existing.xAccessSecret)) as string | null | undefined;

    const fullKey = plainApiKey && plainApiSecret && plainAccessToken && plainAccessSecret;

    const keysChanged = ["xApiKey", "xApiSecret", "xAccessToken", "xAccessSecret"].some(k => has(k));
    if (fullKey && keysChanged) {
        try {
            const client = new TwitterApi({
                appKey: plainApiKey as string,
                appSecret: plainApiSecret as string,
                accessToken: plainAccessToken as string,
                accessSecret: plainAccessSecret as string,
            });
            const me = await client.v2.me({ "user.fields": ["profile_image_url"] });
            data.xUsername = `@${me.data.username}`;
            data.xUserId = me.data.id;
            data.xProfileImageUrl = me.data.profile_image_url ?? null;
        } catch (e) {
            console.error("[x-accounts PATCH] BYOK 検証失敗:", e);
            return NextResponse.json({ message: "入力された API キーで X に接続できませんでした。" }, { status: 400 });
        }
    }

    // 保存前に BYOK キー欄を暗号化（リクエストに含まれたものだけ）。
    for (const k of ["xApiKey", "xApiSecret", "xAccessToken", "xAccessSecret"] as const) {
        if (typeof data[k] === "string") data[k] = encryptSecret(data[k] as string);
    }

    const updated = await prisma.xAccount.update({ where: { id }, data });
    return NextResponse.json({ xAccount: mask(updated) });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ message: "認証が必要です" }, { status: 401 });
    const { id } = await ctx.params;

    const target = await prisma.xAccount.findFirst({ where: { id, userId: user.id } });
    if (!target) return NextResponse.json({ message: "Not Found" }, { status: 404 });

    // 最後の 1 件は削除不可（必ず 1 件は残す）
    const total = await prisma.xAccount.count({ where: { userId: user.id } });
    if (total <= 1) {
        return NextResponse.json({ message: "最後のサブアカウントは削除できません。先に別のアカウントを追加してください。" }, { status: 400 });
    }

    await prisma.xAccount.delete({ where: { id } });

    // active が消えた場合は別のものに切替
    if (user.activeXAccountId === id) {
        const next = await prisma.xAccount.findFirst({
            where: { userId: user.id },
            orderBy: { createdAt: "asc" },
        });
        await prisma.user.update({
            where: { id: user.id },
            data: { activeXAccountId: next?.id ?? null },
        });
    }

    return NextResponse.json({ ok: true });
}
