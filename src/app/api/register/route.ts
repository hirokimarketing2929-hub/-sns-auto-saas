import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { sendToOwnerSheet } from "@/lib/owner-sheets";
import { enforceRateLimit, getClientIp } from "@/lib/rate-limit";
import { checkInviteCode } from "@/lib/beta-gate";

export async function POST(req: Request) {
    try {
        // アカウント作成の濫用（大量登録）対策（IP単位）。
        const limited = enforceRateLimit(`register:${getClientIp(req)}`, 5, 60_000);
        if (limited) return limited;

        const { email, password, name, inviteCode } = await req.json();

        if (!email || !password) {
            return NextResponse.json(
                { message: "メールアドレスとパスワードは必須です" },
                { status: 400 }
            );
        }

        // クローズドβ招待制ゲート（B-4）。mvp では有効な招待コードが無いと登録不可。
        const invite = checkInviteCode(inviteCode);
        if (!invite.ok) {
            return NextResponse.json({ message: invite.message }, { status: 403 });
        }

        const existingUser = await prisma.user.findUnique({
            where: { email },
        });

        if (existingUser) {
            return NextResponse.json(
                { message: "このメールアドレスは既に登録されています" },
                { status: 400 }
            );
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await prisma.user.create({
            data: {
                email,
                name,
                password: hashedPassword,
            },
        });

        // 運営の登録一覧シートへ name/email を追記（GAS ウェブフック）。失敗しても登録は成功扱い。
        sendToOwnerSheet({ type: "registration", name: name || "", email }).catch(() => { /* noop */ });

        return NextResponse.json(
            { message: "ユーザー登録が完了しました。ログインしてください。" },
            { status: 201 }
        );
    } catch (error) {
        console.error("Registration error:", error);
        return NextResponse.json(
            { message: "登録中にエラーが発生しました" },
            { status: 500 }
        );
    }
}
