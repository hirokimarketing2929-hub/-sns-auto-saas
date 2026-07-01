import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { sendToOwnerSheet } from "@/lib/owner-sheets";
import { sendRegistrationToLedger } from "@/lib/prox-reg-sheet";
import { enforceRateLimit, getClientIp } from "@/lib/rate-limit";
import { checkInviteCode } from "@/lib/beta-gate";
import { checkPasswordStrength } from "@/lib/password-policy";

export async function POST(req: Request) {
    try {
        // アカウント作成の濫用（大量登録）対策（IP単位）。
        const limited = enforceRateLimit(`register:${getClientIp(req)}`, 5, 60_000);
        if (limited) return limited;

        const {
            email,
            password,
            name,
            inviteCode,
            // 任意: 登録フォーム/LP が UTM や X ID を載せていれば台帳へ転送する（無ければ省略）。
            utmSource,
            utmMedium,
            utmCampaign,
            utmContent,
            xId,
        } = await req.json();

        if (!email || !password) {
            return NextResponse.json(
                { message: "メールアドレスとパスワードは必須です" },
                { status: 400 }
            );
        }

        // パスワード強度ポリシー（RT-004）。弱PWは入口で構造的に拒否する。
        const pwCheck = checkPasswordStrength(password);
        if (!pwCheck.ok) {
            return NextResponse.json({ message: pwCheck.message }, { status: 400 });
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

        // 管理台帳 GAS へ署名付き登録イベントを非同期 POST（task018② / meeting #007）。
        //   登録レスポンスをブロックしない。失敗は sendRegistrationToLedger 内でログのみ（握りつぶさない）。
        //   utm_*/x_id は登録フォームが載せていれば転送する（クレデンシャル登録では通常未送出＝省略）。
        sendRegistrationToLedger({
            email,
            name: typeof name === "string" ? name : undefined,
            registered_at: new Date().toISOString(),
            invite_code: typeof inviteCode === "string" ? inviteCode : undefined,
            utm_source: typeof utmSource === "string" ? utmSource : undefined,
            utm_medium: typeof utmMedium === "string" ? utmMedium : undefined,
            utm_campaign: typeof utmCampaign === "string" ? utmCampaign : undefined,
            utm_content: typeof utmContent === "string" ? utmContent : undefined,
            x_id: typeof xId === "string" ? xId : undefined,
        }).catch(() => { /* noop: 例外は内部で握っているが念のため */ });

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
