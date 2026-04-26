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

        const twitterAccounts = user.accounts
            .filter((acc: any) => acc.provider === "twitter")
            .map((acc: any) => ({
                id: acc.id,
                provider: acc.provider,
                providerAccountId: acc.providerAccountId,
                accountName: acc.accountName,
                scope: acc.scope,
            }));
        const hasTwitterOAuth = twitterAccounts.length > 0;

        // 設定がない場合はデフォルト値を返す
        if (!user.settings) {
            const defaultSettings = await prisma.settings.create({
                data: {
                    userId: user.id
                }
            });
            return NextResponse.json({ ...defaultSettings, hasTwitterOAuth, twitterAccounts });
        }

        // anyキャストでTypeScriptエラーを回避しつつhasTwitterOAuth/twitterAccountsを追加
        const responseData = { ...(user.settings as any), hasTwitterOAuth, twitterAccounts };
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

        // 部分更新対応：リクエストに含まれたフィールドのみを書き込む（未送信のフィールドは保持）
        const has = (key: string) => Object.prototype.hasOwnProperty.call(data, key);
        const updateFields: Record<string, unknown> = {};

        for (const key of [
            "targetAudience",
            "targetPain",
            "ctaUrl",
            "accountConcept",
            "profile",
            "xApiKey",
            "xApiSecret",
            "xAccessToken",
            "xAccessSecret",
            "spreadsheetUrl",
            "anthropicApiKey",
            "openaiApiKey",
            "chatworkApiToken",
            "chatworkRoomId",
            "replyEngagementMinImp",
        ]) {
            if (has(key)) updateFields[key] = data[key];
        }

        // X アカウント名 / アイコンは、明示送信または APIキー連携による自動取得があった場合のみ更新
        let xAccountName: string | undefined = has("xAccountName") ? data.xAccountName : undefined;
        let xProfileImageUrl: string | null | undefined = has("xProfileImageUrl") ? (data.xProfileImageUrl || null) : undefined;

        if ((!xAccountName || !xProfileImageUrl) && data.xApiKey && data.xApiSecret && data.xAccessToken && data.xAccessSecret) {
            try {
                const client = new TwitterApi({
                    appKey: data.xApiKey,
                    appSecret: data.xApiSecret,
                    accessToken: data.xAccessToken,
                    accessSecret: data.xAccessSecret,
                });
                const me = await client.v2.me({ "user.fields": ["profile_image_url"] });
                if (!xAccountName) xAccountName = `@${me.data.username}`;
                if (!xProfileImageUrl && me.data.profile_image_url) xProfileImageUrl = me.data.profile_image_url;
            } catch (err) {
                console.error("Failed to fetch twitter profile automatically:", err);
            }
        }

        if (xAccountName !== undefined) updateFields.xAccountName = xAccountName;
        if (xProfileImageUrl !== undefined) updateFields.xProfileImageUrl = xProfileImageUrl;

        const updatedSettings = await prisma.settings.upsert({
            where: { userId: user.id },
            update: updateFields,
            create: { userId: user.id, ...updateFields }
        });

        return NextResponse.json(updatedSettings);
    } catch (error) {
        console.error("Settings PUT error:", error);
        return NextResponse.json({ message: "サーバーエラー" }, { status: 500 });
    }
}
