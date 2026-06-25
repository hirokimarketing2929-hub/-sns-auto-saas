import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { randomBytes } from "crypto";
import { deriveWebhookSecret } from "@/lib/webhook-sig";

function generateToken(): string {
    // URL-safe 32 文字のランダム token
    return randomBytes(24).toString("base64url");
}

// トークン取得（無ければ自動発行）
export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const user = await prisma.user.findUnique({ where: { email: session.user.email }, select: { id: true } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    let settings = await prisma.settings.findUnique({
        where: { userId: user.id },
        select: { funnelWebhookToken: true }
    });

    if (!settings) {
        settings = await prisma.settings.create({
            data: { userId: user.id, funnelWebhookToken: generateToken() },
            select: { funnelWebhookToken: true }
        });
    } else if (!settings.funnelWebhookToken) {
        settings = await prisma.settings.update({
            where: { userId: user.id },
            data: { funnelWebhookToken: generateToken() },
            select: { funnelWebhookToken: true }
        });
    }

    // 署名秘密（HMAC 鍵）。token から サーバ鍵で導出した値で、GAS の署名に使う。
    // 認証済みの本人セッションにのみ返す（誰でも叩ける webhook 受信側には絶対に返さない）。
    // サーバ鍵未設定なら null（署名機能オフ）。
    const signingSecret = settings.funnelWebhookToken
        ? deriveWebhookSecret(settings.funnelWebhookToken)
        : null;

    return NextResponse.json({ token: settings.funnelWebhookToken, signingSecret });
}

// トークン再発行（古い token を無効化したい場合）
export async function POST() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const user = await prisma.user.findUnique({ where: { email: session.user.email }, select: { id: true } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const token = generateToken();
    await prisma.settings.upsert({
        where: { userId: user.id },
        update: { funnelWebhookToken: token },
        create: { userId: user.id, funnelWebhookToken: token },
    });
    const signingSecret = deriveWebhookSecret(token);
    return NextResponse.json({ token, signingSecret });
}
