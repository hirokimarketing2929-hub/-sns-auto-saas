import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getActiveXAccount } from "@/lib/active-x-account";
import { TwitterApi } from "twitter-api-v2";
import { encryptSecret, decryptSecret } from "@/lib/crypto";
import { errorResponse } from "@/lib/api-error";

// Settings に保存される機微フィールド（at-rest 暗号化対象）。
const SECRET_SETTINGS_FIELDS = [
    "xApiKey", "xApiSecret", "xAccessToken", "xAccessSecret",
    "anthropicApiKey", "openaiApiKey", "chatworkApiToken",
] as const;

// アカウント別に持つフィールド（アクティブな XAccount に読み書きする）。
// これらを Settings ではなく XAccount に保存することで、投稿生成（generate / structure-rewrite）が
// 参照する XAccount と保存先が一致し、「設定したのに反映されない」問題を解消する。
const PERSONA_FIELDS = [
    "targetAudience",
    "targetPain",
    "ctaUrl",
    "accountConcept",
    "profile",
    "applyPersonaToGeneration",
] as const;

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

        // アクティブなサブアカウントのペルソナ設定（アカウント別）を取得
        const activeXAccount = await getActiveXAccount(user.id).catch(() => null);

        // 共通設定（Settings）。無ければデフォルト作成
        const settings = user.settings ?? await prisma.settings.create({ data: { userId: user.id } });

        // ペルソナ系は active XAccount を正とし、共通設定にマージして返す（フロントのレスポンス形式は維持）
        const personaOverrides: Record<string, unknown> = {};
        if (activeXAccount) {
            for (const f of PERSONA_FIELDS) personaOverrides[f] = (activeXAccount as any)[f];
        }

        const responseData = {
            ...(settings as any),
            ...personaOverrides,
            activeXAccountId: activeXAccount?.id ?? null,
            hasTwitterOAuth,
            twitterAccounts,
        };
        // 機微フィールドは復号して本人に返す（フロントの「保存済みキー表示」用）。
        for (const f of SECRET_SETTINGS_FIELDS) {
            if (typeof (responseData as any)[f] === "string") {
                (responseData as any)[f] = decryptSecret((responseData as any)[f]);
            }
        }
        return NextResponse.json(responseData);
    } catch (error) {
        return errorResponse(error, "サーバーエラーが発生しました", 500, "settings.get");
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

        // ペルソナ系（アカウント別）は active XAccount に書き込む
        const personaUpdate: Record<string, unknown> = {};
        for (const key of PERSONA_FIELDS) {
            if (has(key)) personaUpdate[key] = data[key];
        }
        if (Object.keys(personaUpdate).length > 0) {
            const activeXAccount = await getActiveXAccount(user.id).catch(() => null);
            if (activeXAccount) {
                await prisma.xAccount.update({
                    where: { id: activeXAccount.id },
                    data: personaUpdate,
                });
            }
        }

        // 共通設定（Settings）に書き込むフィールド
        const updateFields: Record<string, unknown> = {};
        for (const key of [
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

        // 保存前に機微フィールドを暗号化（送信されたものだけ）。
        for (const f of SECRET_SETTINGS_FIELDS) {
            if (typeof updateFields[f] === "string") {
                updateFields[f] = encryptSecret(updateFields[f] as string);
            }
        }

        const updatedSettings = await prisma.settings.upsert({
            where: { userId: user.id },
            update: updateFields,
            create: { userId: user.id, ...updateFields }
        });

        const responseSettings: any = { ...updatedSettings };
        for (const f of SECRET_SETTINGS_FIELDS) {
            if (typeof responseSettings[f] === "string") {
                responseSettings[f] = decryptSecret(responseSettings[f]);
            }
        }
        return NextResponse.json(responseSettings);
    } catch (error) {
        return errorResponse(error, "サーバーエラーが発生しました", 500, "settings.put");
    }
}
