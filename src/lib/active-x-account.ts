import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

const ACTIVE_COOKIE = "x-active-xaccount";

export type XAccountWithOAuth = Awaited<ReturnType<typeof prisma.xAccount.findFirst>> extends infer T
    ? T extends null ? null : T & { oauthAccount: any }
    : never;

/**
 * 現在のリクエストで使用すべきサブアカウント (XAccount) を取得する。
 *
 * 優先順位:
 *   1. Cookie `x-active-xaccount` で指定された XAccount（当該ユーザー所有のものに限る）
 *   2. User.activeXAccountId で指定された XAccount
 *   3. 当該ユーザーの最古の XAccount（フォールバック）
 *   4. それでも無い場合（新規ユーザー等）はデフォルトのサブアカウントを自動作成
 */
export async function getActiveXAccount(userId: string) {
    const cookieStore = await cookies();
    const fromCookie = cookieStore.get(ACTIVE_COOKIE)?.value;

    const candidateIds: string[] = [];
    if (fromCookie) candidateIds.push(fromCookie);

    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { activeXAccountId: true, name: true, settings: { select: { xAccountName: true } } } as any,
    });
    if ((user as any)?.activeXAccountId) candidateIds.push((user as any).activeXAccountId);

    for (const id of candidateIds) {
        const xa = await prisma.xAccount.findFirst({
            where: { id, userId },
            include: { oauthAccount: true },
        });
        if (xa) return xa;
    }

    // フォールバック1: 最古の XAccount を active に昇格
    const oldest = await prisma.xAccount.findFirst({
        where: { userId },
        orderBy: { createdAt: "asc" },
        include: { oauthAccount: true },
    });
    if (oldest) {
        if (!(user as any)?.activeXAccountId) {
            await prisma.user.update({
                where: { id: userId },
                data: { activeXAccountId: oldest.id },
            }).catch(() => undefined);
        }
        return oldest;
    }

    // フォールバック2: ひとつも持っていないユーザー → デフォルトを自動作成
    // 既存の OAuth Account（twitter）があれば最古を新 XAccount に紐付ける
    const oauth = await prisma.account.findFirst({
        where: { userId, provider: "twitter", xAccount: { is: null } as any },
        orderBy: { id: "asc" },
    }).catch(() => null);

    const displayName = (user as any)?.settings?.xAccountName
        || ((user as any)?.name ? `${(user as any).name}のメインアカウント` : "メインアカウント");
    const created = await prisma.xAccount.create({
        data: {
            userId,
            displayName,
            oauthAccountId: oauth?.id ?? null,
        },
        include: { oauthAccount: true },
    });
    await prisma.user.update({
        where: { id: userId },
        data: { activeXAccountId: created.id },
    }).catch(() => undefined);
    return created;
}

/**
 * アクティブな XAccount.id を返す（id だけ必要なケース用、軽量版）。
 * 見つからない場合は null。
 */
export async function getActiveXAccountId(userId: string): Promise<string | null> {
    const xa = await getActiveXAccount(userId);
    return xa?.id ?? null;
}

export const ACTIVE_XACCOUNT_COOKIE = ACTIVE_COOKIE;
