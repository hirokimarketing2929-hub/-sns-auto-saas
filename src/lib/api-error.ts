/**
 * API エラーレスポンスの共通ヘルパー（CTO決定 003 §G2）。
 *
 * 目的: error.message / stack / SQL / キー値などの内部情報を外部レスポンスに漏らさない。
 * - 外部には「汎用メッセージ＋エラーID」だけを返す。
 * - 詳細（生エラー）はサーバーログにのみ出力する（運用者が追えるように）。
 *
 * 使い方:
 *   try { ... } catch (e) {
 *     return errorResponse(e, "サーバーエラーが発生しました", 500, "settings.put");
 *   }
 */

import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { captureException } from "@/lib/monitoring";

/**
 * 例外をサーバーログに記録し、外部には汎用メッセージ＋エラーIDのみ返す。
 *
 * @param error   捕捉した例外（ログにのみ出力。レスポンスには含めない）
 * @param publicMessage 外部に見せる汎用メッセージ
 * @param status  HTTP ステータス（既定 500）
 * @param context ログ識別用のタグ（任意）
 */
export function errorResponse(
    error: unknown,
    publicMessage = "サーバーエラーが発生しました",
    status = 500,
    context?: string
): NextResponse {
    const errorId = randomUUID();
    // 生エラーはサーバーログにのみ出す（外部には出さない）
    console.error(`[api-error]${context ? ` [${context}]` : ""} id=${errorId}`, error);
    // 監視基盤へ送信（SENTRY_DSN 未設定なら no-op、送信失敗は握りつぶす）
    captureException(error, { context, errorId });
    return NextResponse.json(
        { message: publicMessage, errorId },
        { status }
    );
}
