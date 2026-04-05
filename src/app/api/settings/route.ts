import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TwitterApi } from "twitter-api-v2";

export async function GET() {
    const session = await getServerSession(authOptions);

    if (!session || !session.user || !session.user.email) {
        return NextResponse.json({ message: "認証が必要です" }, { status: 401 });
    }

    try {
        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
            include: { settings: true, accounts: true }
        });

        if (!user) {
            return NextResponse.json({ message: "ユーザーが見つかりません" }, { status: 404 });
        }

        const hasTwitterOAuth = user.accounts.some((acc) => acc.provider === "twitter");

        // 設定がない場合はデフォルト値を返す
        if (!user.settings) {
            const defaultSettings = await prisma.settings.create({
                data: {
                    userId: user.id
                }
            });
            return NextResponse.json({ ...defaultSettings, hasTwitterOAuth });
        }

        // anyキャストでTypeScriptエラーを回避しつつhasTwitterOAuthを追加
        const responseData = { ...(user.settings as any), hasTwitterOAuth };
        return NextResponse.json(responseData);
    } catch (error) {
        console.error("Settings GET error:", error);
        return NextResponse.json({ message: "サーバーエラー" }, { status: 500 });
    }
}

export async function PUT(req: Request) {
    const session = await getServerSession(authOptions);

    if (!session || !session.user || !session.user.email) {
        return NextResponse.json({ message: "認証が必要です" }, { status: 401 });
    }

    try {
        const data = await req.json();
        const user = await prisma.user.findUnique({
            where: { email: session.user.email }
        });

        if (!user) {
            return NextResponse.json({ message: "ユーザーが見つかりません" }, { status: 404 });
        }

        let finalAccountName = data.xAccountName;
        let finalProfileImageUrl = data.xProfileImageUrl || null; // 既存があれば維持

        // xAccountName または アイコン が空で、APIキーが入力されている場合（自動取得）
        if ((!finalAccountName || !finalProfileImageUrl) && data.xApiKey && data.xApiSecret && data.xAccessToken && data.xAccessSecret) {
            try {
                const client = new TwitterApi({
                    appKey: data.xApiKey,
                    appSecret: data.xApiSecret,
                    accessToken: data.xAccessToken,
                    accessSecret: data.xAccessSecret,
                });
                const me = await client.v2.me({ "user.fields": ["profile_image_url"] });
                if (!finalAccountName) finalAccountName = `@${me.data.username}`;
                if (!finalProfileImageUrl && me.data.profile_image_url) finalProfileImageUrl = me.data.profile_image_url;
            } catch (err) {
                console.error("Failed to fetch twitter profile automatically:", err);
            }
        }

        const updatedSettings = await prisma.settings.upsert({
            where: { userId: user.id },
            update: {
                targetAudience: data.targetAudience,
                targetPain: data.targetPain,
                ctaUrl: data.ctaUrl,
                competitor1: data.competitor1,
                competitor2: data.competitor2,
                accountConcept: data.accountConcept,
                profile: data.profile,
                policy: data.policy,
                xApiKey: data.xApiKey,
                xApiSecret: data.xApiSecret,
                xAccessToken: data.xAccessToken,
                xAccessSecret: data.xAccessSecret,
                xAccountName: finalAccountName,
                xProfileImageUrl: finalProfileImageUrl,
                spreadsheetUrl: data.spreadsheetUrl,
            },
            create: {
                userId: user.id,
                targetAudience: data.targetAudience,
                targetPain: data.targetPain,
                ctaUrl: data.ctaUrl,
                competitor1: data.competitor1,
                competitor2: data.competitor2,
                accountConcept: data.accountConcept,
                profile: data.profile,
                policy: data.policy,
                xApiKey: data.xApiKey,
                xApiSecret: data.xApiSecret,
                xAccessToken: data.xAccessToken,
                xAccessSecret: data.xAccessSecret,
                xAccountName: finalAccountName,
                xProfileImageUrl: finalProfileImageUrl,
                spreadsheetUrl: data.spreadsheetUrl,
            }
        });

        return NextResponse.json(updatedSettings);
    } catch (error) {
        console.error("Settings PUT error:", error);
        return NextResponse.json({ message: "サーバーエラー" }, { status: 500 });
    }
}
