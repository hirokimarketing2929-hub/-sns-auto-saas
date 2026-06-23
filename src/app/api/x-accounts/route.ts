import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TwitterApi } from "twitter-api-v2";
import { encryptSecret } from "@/lib/crypto";
import { enforceRateLimit, getClientIp } from "@/lib/rate-limit";

// 認証されたユーザー（Userレコード）を取得
async function getCurrentUser() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return null;
    return prisma.user.findUnique({ where: { email: session.user.email } });
}

// 機微なフィールドはマスクして返す
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
        createdAt: xa.createdAt,
        updatedAt: xa.updatedAt,
    };
}

export async function GET() {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ message: "認証が必要です" }, { status: 401 });

    const xAccounts = await prisma.xAccount.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({
        activeXAccountId: user.activeXAccountId,
        xAccounts: xAccounts.map(mask),
    });
}

// 新規サブアカウント作成（手動BYOK or OAuth Account への紐付け or 単に空のサブアカウント）
export async function POST(req: Request) {
    // BYOK 検証で外部 X API を叩くため、IP単位の濫用ガードを置く。
    const limited = enforceRateLimit(`x-accounts:post:${getClientIp(req)}`, 20, 60_000);
    if (limited) return limited;

    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ message: "認証が必要です" }, { status: 401 });

    const body = await req.json().catch(() => ({} as any));
    const {
        displayName,
        xApiKey,
        xApiSecret,
        xAccessToken,
        xAccessSecret,
        oauthAccountId,
    } = body || {};

    if (!displayName || typeof displayName !== "string" || !displayName.trim()) {
        return NextResponse.json({ message: "displayName は必須です" }, { status: 400 });
    }

    // OAuth Account を紐付ける場合: 当該ユーザーの所有か、まだ XAccount に紐付いていないかを検証
    if (oauthAccountId) {
        const oauth = await prisma.account.findFirst({
            where: { id: oauthAccountId, userId: user.id, provider: "twitter" },
            include: { xAccount: true },
        });
        if (!oauth) {
            return NextResponse.json({ message: "指定された OAuth Account が見つかりません" }, { status: 400 });
        }
        if (oauth.xAccount && oauth.xAccount.userId === user.id) {
            return NextResponse.json({ message: "この X 連携は既に別のサブアカウントに紐付いています" }, { status: 400 });
        }
    }

    // BYOK が来ている場合は username/icon を取得試行
    let xUsername: string | null = null;
    let xUserId: string | null = null;
    let xProfileImageUrl: string | null = null;
    if (xApiKey && xApiSecret && xAccessToken && xAccessSecret) {
        try {
            const client = new TwitterApi({
                appKey: xApiKey, appSecret: xApiSecret,
                accessToken: xAccessToken, accessSecret: xAccessSecret,
            });
            const me = await client.v2.me({ "user.fields": ["profile_image_url"] });
            xUsername = `@${me.data.username}`;
            xUserId = me.data.id;
            xProfileImageUrl = me.data.profile_image_url ?? null;
        } catch (e) {
            console.error("[x-accounts POST] BYOK 検証失敗:", e);
            return NextResponse.json({ message: "入力された API キーで X に接続できませんでした。値を確認してください。" }, { status: 400 });
        }
    }

    const created = await prisma.xAccount.create({
        data: {
            userId: user.id,
            displayName: displayName.trim(),
            oauthAccountId: oauthAccountId || null,
            // at-rest 暗号化（AES-256-GCM）。検証は上で平文のまま済ませ、保存時のみ暗号化する。
            xApiKey: (encryptSecret(xApiKey) as string) || null,
            xApiSecret: (encryptSecret(xApiSecret) as string) || null,
            xAccessToken: (encryptSecret(xAccessToken) as string) || null,
            xAccessSecret: (encryptSecret(xAccessSecret) as string) || null,
            xUsername,
            xUserId,
            xProfileImageUrl,
        },
    });

    // ユーザーがまだ active を持っていない場合は新規作成したものを active に
    if (!user.activeXAccountId) {
        await prisma.user.update({
            where: { id: user.id },
            data: { activeXAccountId: created.id },
        });
    }

    return NextResponse.json({ xAccount: mask(created) }, { status: 201 });
}
