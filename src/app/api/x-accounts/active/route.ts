import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { ACTIVE_XACCOUNT_COOKIE } from "@/lib/active-x-account";

// アクティブサブアカウントを切り替える
// body: { xAccountId: string }
export async function POST(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return NextResponse.json({ message: "認証が必要です" }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!user) return NextResponse.json({ message: "ユーザーが見つかりません" }, { status: 404 });

    const { xAccountId } = (await req.json().catch(() => ({}))) as { xAccountId?: string };
    if (!xAccountId) return NextResponse.json({ message: "xAccountId が必要です" }, { status: 400 });

    const xa = await prisma.xAccount.findFirst({ where: { id: xAccountId, userId: user.id } });
    if (!xa) return NextResponse.json({ message: "Not Found" }, { status: 404 });

    await prisma.user.update({
        where: { id: user.id },
        data: { activeXAccountId: xa.id },
    });

    const cookieStore = await cookies();
    cookieStore.set(ACTIVE_XACCOUNT_COOKIE, xa.id, {
        httpOnly: false, // クライアント側でも参照可（UI 表示用）
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
    });

    return NextResponse.json({ activeXAccountId: xa.id });
}
