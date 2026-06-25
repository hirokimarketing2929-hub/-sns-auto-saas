// funnel webhook の HMAC 署名検証（RT-003 対策）。
//
// 旧実装の問題:
//   認証は URL パスの funnelWebhookToken のみ。トークンは推測不可だが「署名」がないため、
//   トークンが一度でも漏れると（GAS・履歴・プロキシログ・スクショ・サポート経由）、
//   攻撃者が任意の FunnelEvent を無制限に偽造投入でき、連携KPI（Project A の月間100連携）を
//   水増し/汚染できた。rawData をそのまま保存するため二次汚染の種にもなる。
//
// 新方針（構造で防ぐ／2段構え）:
//   - トークン = 識別子（どのユーザーか）。
//   - 署名     = 真正性（本当にそのユーザーの GAS が送ったか）。
//   署名秘密はユーザーごとに「サーバ鍵(PROX_ENCRYPTION_KEY) から token を使って導出」する
//   （HKDF 相当の HMAC）。DB に別カラムを増やさず、token が漏れても署名秘密は
//   サーバ鍵なしには再現できない。GAS には設定画面でこの導出済みシークレットを提示する。
//
//   検証は rawBody（パース前の生バイト列）に対して定数時間比較。
//   さらに X-ProX-Timestamp によるリプレイ窓（既定 5 分）で再送を抑止する。
//
// 必須化（fail-safe・RT-001 と一貫）:
//   β(mvp) では署名を「既定で必須」にする（isSignatureRequired 参照）。env の入れ忘れで
//   緩まない＝設定漏れは締まる側へ。明示的に PROX_WEBHOOK_REQUIRE_SIGNATURE=false と
//   書いたときだけ移行猶予で緩む。開発(full) は既定で緩く、明示 true で必須にできる。
//   署名必須時: 署名ヘッダ無し / timestamp 欠落・不正 / 窓外 / 鍵不一致 は全て fail-closed で拒否。

import { createHmac, timingSafeEqual } from "node:crypto";
import { getReleaseMode } from "./features";

const SIG_HEADER = "x-prox-signature";
const TS_HEADER = "x-prox-timestamp";
const REPLAY_WINDOW_MS = 5 * 60 * 1000; // 5 分

// -----------------------------------------------------------------------------
// RT-011 対策: 窓内（±5分）リプレイの使い切り（nonce 相当）。
//
// 問題: timestamp が窓内かつ署名一致のリクエストは、同一 (timestamp,signature,body)
//   を 5 分以内に再送すると重複受理され、連携イベントを水増しできた（nonce/使い切り無し）。
//
// 方針（構造で防ぐ・DB 無しの軽量実装）:
//   検証成功した署名を「署名文字列そのもの」をキーにプロセス内 Map で短期保持し、
//   2 回目以降の同一署名を拒否する。署名は (secret, timestamp.rawBody) に依存するため、
//   同一署名 = 同一 timestamp かつ同一 body = まさにリプレイ。TTL は REPLAY_WINDOW_MS を
//   採用（窓外になった署名は二度と通らないので保持不要）＝メモリは窓幅に比例した有界サイズ。
//
//   注意（単機前提）: メモリ式なのでマルチインスタンスでは各ノード独立（RT-007 と同質の制約）。
//   β（単機）では使い切りとして機能する。フル公開で水平スケールする際は共有ストア
//   （Redis SETNX 等）か送信側採番 nonce の @@unique 冪等化へ移行する。Day2 申し送り。
// -----------------------------------------------------------------------------
const seenSignatures = new Map<string, number>(); // signature(hex) -> 受理時刻(ms)
const MAX_SEEN_ENTRIES = 10_000; // 異常流入時の上限（メモリ枯渇防止）

/** 期限切れエントリを掃除する（呼ばれる度に軽く間引く）。 */
function pruneSeenSignatures(now: number): void {
    for (const [sig, ts] of seenSignatures) {
        if (now - ts > REPLAY_WINDOW_MS) seenSignatures.delete(sig);
    }
}

/**
 * 署名がこの窓内で既に受理済みか判定し、未使用なら使い切りとして記録する。
 * @returns true = 初出（受理してよい） / false = 再送（拒否すべき）
 */
function consumeSignatureOnce(signature: string, now: number): boolean {
    const prev = seenSignatures.get(signature);
    if (prev !== undefined && now - prev <= REPLAY_WINDOW_MS) {
        return false; // 窓内リプレイ
    }
    // 上限到達時はまず prune、それでも溢れるなら最古を1件捨てて受理を止めない。
    if (seenSignatures.size >= MAX_SEEN_ENTRIES) {
        pruneSeenSignatures(now);
        if (seenSignatures.size >= MAX_SEEN_ENTRIES) {
            const oldest = seenSignatures.keys().next().value;
            if (oldest !== undefined) seenSignatures.delete(oldest);
        }
    }
    seenSignatures.set(signature, now);
    return true;
}

/**
 * 署名を必須にするか（fail-safe 設計／RT-001 と一貫）。
 *
 * 方針:
 *   - β(mvp) では「未設定で緩まない」= 既定で署名必須。明示 `false` のときだけ移行猶予で緩める。
 *     β公開時点で `PROX_WEBHOOK_REQUIRE_SIGNATURE=true` 必須化する決裁（ミーティング#002）を、
 *     env の設定漏れに賭けず構造で担保する。本番で env を入れ忘れても締まる側に倒れる。
 *   - 開発(full) では既定で緩める（既存 GAS 改修猶予）。明示 `true` で必須にできる。
 *
 * 真理値表:
 *   RELEASE_MODE  | PROX_WEBHOOK_REQUIRE_SIGNATURE | requireSig
 *   mvp(既定/誤設定)|  未設定 / その他             | true   ← fail-safe
 *   mvp           |  "false"                       | false  ← 明示的に緩める意思のみ
 *   full(dev)     |  "true"                        | true
 *   full(dev)     |  未設定 / その他               | false
 */
export function isSignatureRequired(): boolean {
    const flag = process.env.PROX_WEBHOOK_REQUIRE_SIGNATURE?.trim();
    if (getReleaseMode() === "mvp") {
        // β: 明示的に "false" と書いたときだけ緩む。未設定・誤字・"true" は必須に倒す。
        return flag !== "false";
    }
    // 開発(full): 明示的に "true" のときだけ必須。
    return flag === "true";
}

/** サーバ鍵を読む（crypto.ts と同じ env。署名導出専用に再利用）。未設定なら null。 */
function getServerKey(): Buffer | null {
    const raw = process.env.PROX_ENCRYPTION_KEY?.trim();
    if (!raw) return null;
    const key = Buffer.from(raw, "base64");
    return key.length === 32 ? key : null;
}

/**
 * ユーザーの webhook 署名秘密を token から決定論的に導出する。
 * 設定画面でこの値をユーザーに提示し、GAS 側の署名に使ってもらう。
 * 戻り値は hex 文字列。サーバ鍵が無ければ null（署名機能は無効）。
 */
export function deriveWebhookSecret(token: string): string | null {
    const key = getServerKey();
    if (!key) return null;
    return createHmac("sha256", key).update(`funnel-webhook-sig:${token}`).digest("hex");
}

/** 期待署名を計算（timestamp.rawBody を署名対象にしてリプレイ耐性を持たせる）。 */
function computeSignature(secretHex: string, timestamp: string, rawBody: string): string {
    return createHmac("sha256", secretHex).update(`${timestamp}.${rawBody}`).digest("hex");
}

function safeEqualHex(a: string, b: string): boolean {
    const ab = Buffer.from(a, "utf8");
    const bb = Buffer.from(b, "utf8");
    if (ab.length !== bb.length) return false;
    return timingSafeEqual(ab, bb);
}

export type SigVerifyResult =
    | { ok: true; mode: "verified" | "skipped-legacy" }
    | { ok: false; status: number; message: string };

/**
 * webhook 署名を検証する。
 * @param token   path の funnelWebhookToken（署名秘密の導出に使う）
 * @param rawBody req.text() で得た生ボディ（パース前。署名対象と一致させる）
 * @param headers リクエストヘッダ
 */
export function verifyWebhookSignature(
    token: string,
    rawBody: string,
    headers: Headers
): SigVerifyResult {
    const requireSig = isSignatureRequired();
    const provided = headers.get(SIG_HEADER);
    const timestamp = headers.get(TS_HEADER);

    // 署名ヘッダが無いケース
    if (!provided) {
        if (requireSig) {
            return { ok: false, status: 401, message: "Missing signature" };
        }
        // 移行期: 署名なしはトークンのみで従来通り受理（猶予）。
        return { ok: true, mode: "skipped-legacy" };
    }

    const secret = deriveWebhookSecret(token);
    if (!secret) {
        // サーバ鍵未設定で署名検証できない。署名必須なら fail-closed、そうでなければ受理。
        return requireSig
            ? { ok: false, status: 503, message: "Signature verification unavailable" }
            : { ok: true, mode: "skipped-legacy" };
    }

    if (!timestamp) {
        return { ok: false, status: 401, message: "Missing timestamp" };
    }
    // リプレイ窓チェック（ミリ秒 or 秒のどちらでも受ける）。
    const tsNum = Number(timestamp);
    if (!Number.isFinite(tsNum)) {
        return { ok: false, status: 401, message: "Invalid timestamp" };
    }
    const tsMs = tsNum < 1e12 ? tsNum * 1000 : tsNum; // 秒なら ms に正規化
    if (Math.abs(Date.now() - tsMs) > REPLAY_WINDOW_MS) {
        return { ok: false, status: 401, message: "Timestamp outside allowed window" };
    }

    const expected = computeSignature(secret, timestamp, rawBody);
    if (!safeEqualHex(provided, expected)) {
        return { ok: false, status: 401, message: "Invalid signature" };
    }
    // RT-011: 窓内リプレイ防止（使い切り）。署名は (timestamp,body) に一意なので、
    // 同一署名の2回目以降は同じ payload の再送＝拒否する。expected をキーにすることで
    // 攻撃者が送る provided の表記揺れ（大小文字等）に影響されず正規化された値で一意化する。
    if (!consumeSignatureOnce(expected, Date.now())) {
        return { ok: false, status: 409, message: "Replay detected" };
    }
    return { ok: true, mode: "verified" };
}
