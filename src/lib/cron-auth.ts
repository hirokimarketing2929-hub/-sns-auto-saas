// cron エンドポイント共通の認証ガード（RT-002 対策・fail-closed）。
//
// 旧実装の問題:
//   `if (process.env.NODE_ENV === "production" && authHeader !== ...)` は
//   NODE_ENV が production のときだけ認証を評価していた。preview/staging/自前ホスト/
//   NODE_ENV 未設定の誤デプロイでは認証が丸ごとスキップされ、誰でも cron を叩けた
//   （予約投稿の強制発火・自動DM/リプの強制送信・全テナント X API 呼び出し）。
//
// 新方針（構造で防ぐ）:
//   - NODE_ENV 条件を撤廃。全環境で CRON_SECRET を常時必須化（fail-closed）。
//   - CRON_SECRET 未設定なら「設定ミス」とみなし 503 で停止（認証ゼロで通すより安全側）。
//   - Bearer トークン比較は crypto.timingSafeEqual で定数時間（タイミング攻撃を遮断）。
//
// 使い方（各 cron route 冒頭）:
//   const denied = assertCronAuthorized(req);
//   if (denied) return denied;

import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";

/** 2 つの文字列を定数時間比較する（長さ差も timing で漏らさない）。 */
function safeEqual(a: string, b: string): boolean {
    const ab = Buffer.from(a, "utf8");
    const bb = Buffer.from(b, "utf8");
    // 長さが違うと timingSafeEqual が throw するため、長さを揃えた上で内容＋長さの両方を検証。
    const len = Math.max(ab.length, bb.length, 1);
    const pa = Buffer.alloc(len);
    const pb = Buffer.alloc(len);
    ab.copy(pa);
    bb.copy(pb);
    return timingSafeEqual(pa, pb) && ab.length === bb.length;
}

/**
 * cron リクエストの Authorization: Bearer <CRON_SECRET> を検証する。
 * 認可OKなら null、NGなら適切な Response を返す（呼び出し側はそのまま return）。
 */
export function assertCronAuthorized(req: Request): NextResponse | null {
    const secret = process.env.CRON_SECRET?.trim();

    // fail-closed: シークレット未設定は「設定ミス」。認証ゼロで通さず 503 で止める。
    if (!secret) {
        return NextResponse.json(
            { message: "Cron is not configured (CRON_SECRET missing)." },
            { status: 503 }
        );
    }

    const authHeader = req.headers.get("authorization") || "";
    const expected = `Bearer ${secret}`;

    if (!safeEqual(authHeader, expected)) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    return null;
}
