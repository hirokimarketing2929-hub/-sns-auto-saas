import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { testChatworkToken, sendChatworkMessage } from "@/lib/chatwork";

export async function POST(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const user = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { id: true, settings: true },
    });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const body = await req.json().catch(() => ({} as { apiToken?: string; roomId?: string; sendTest?: boolean }));
    const apiToken = body?.apiToken || user.settings?.chatworkApiToken || "";
    const roomId = body?.roomId || user.settings?.chatworkRoomId || "";
    const sendTest = !!body?.sendTest;

    if (!apiToken) {
        return NextResponse.json({ error: "API トークンが設定されていません" }, { status: 400 });
    }

    const meResult = await testChatworkToken(apiToken);
    if (!meResult.ok) {
        return NextResponse.json({ ok: false, error: meResult.error }, { status: 400 });
    }

    if (sendTest) {
        if (!roomId) {
            return NextResponse.json({ ok: false, error: "ルームIDが設定されていません" }, { status: 400 });
        }
        const msg = `[info][title]✅ 接続テスト（リプ周り半自動化）[/title]ChatWork 連携が正常に動作しています。\nアカウント: ${meResult.name || "?"}\n今後、ターゲットアカウントの高インプ投稿に対するリプライ案がこのルームに届きます。[/info]`;
        const sent = await sendChatworkMessage(apiToken, roomId, msg);
        if (!sent.ok) {
            return NextResponse.json({ ok: false, error: sent.error }, { status: 400 });
        }
        return NextResponse.json({ ok: true, name: meResult.name, messageId: sent.messageId });
    }

    return NextResponse.json({ ok: true, name: meResult.name, accountId: meResult.accountId });
}
