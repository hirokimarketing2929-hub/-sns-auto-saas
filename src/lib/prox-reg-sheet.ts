// ProX 新規登録 → 管理台帳 GAS（Web アプリ）への署名付き非同期 POST（task018② / meeting #007）。
//
// 目的:
//   ユーザー新規登録が「成功した直後」に、管理台帳スプレッドシートへ1行追記するための
//   署名付きイベントを GAS ウェブアプリへ送る。登録レスポンスはブロックしない（fire-and-forget）。
//   失敗はログに残す（握りつぶさない）。重複到達は許容（at-least-once）= GAS 側で吸収する想定。
//
// 署名方式（リポジトリ既存の funnel webhook 署名 src/lib/webhook-sig.ts と同一作法に揃える）:
//   _sig = HMAC-SHA256(SECRET, `${_sig_ts}.${signed_payload}`) を小文字 hex。
//   ＝ GAS 側 Utilities.computeHmacSha256Signature(message, SECRET) と一致する
//     （createHmac("sha256", SECRET).update(message).digest("hex")）。
//
// 送信 body（案B＝body ミラー。GAS は実 HTTP ステータスを返さないため応答 body の ok で成否判定）:
//   { signed_payload: "<payload の JSON 文字列>", _sig_ts: "<Date.now() の ms>", _sig: "<署名 hex>" }
//   - signed_payload は payload を JSON.stringify した「確定文字列」。以後作り直さない（署名対象と一致させる）。
//
// env（値は運営が保有・本番に投入）:
//   PROX_REG_SHEET_WEBHOOK_URL     … GAS の /exec URL。未設定なら送信スキップ（dev/test を止めない）。
//   PROX_REG_SHEET_SIGNING_SECRET  … GAS と同一の合鍵。URL があるのに未設定なら署名できないので送信しない。

import { createHmac } from "node:crypto";

/** 管理台帳へ送る登録イベント。email 必須、その他は判明している分だけ載せる。 */
export type ProxRegLedgerPayload = {
    email: string;
    name?: string;
    /** ISO8601。未指定なら送信時刻を使う。 */
    registered_at?: string;
    invite_code?: string;
    utm_source?: string;
    utm_medium?: string;
    utm_campaign?: string;
    utm_content?: string;
    x_id?: string;
};

const TIMEOUT_MS = 10_000;
const MAX_ATTEMPTS = 2; // at-least-once（重複許容）なので失敗時に1回だけ再送する。

/** payload から undefined/空文字を除いた確定オブジェクトを作る（署名対象＝送信内容を安定させる）。 */
function buildPayload(p: ProxRegLedgerPayload): Record<string, string> {
    const out: Record<string, string> = { email: p.email };
    const optional: Array<[keyof ProxRegLedgerPayload, string | undefined]> = [
        ["name", p.name],
        ["registered_at", p.registered_at],
        ["invite_code", p.invite_code],
        ["utm_source", p.utm_source],
        ["utm_medium", p.utm_medium],
        ["utm_campaign", p.utm_campaign],
        ["utm_content", p.utm_content],
        ["x_id", p.x_id],
    ];
    for (const [key, value] of optional) {
        const v = value?.trim();
        if (v) out[key as string] = v;
    }
    return out;
}

/** _sig = HMAC-SHA256(secret, `${ts}.${signedPayload}`) を小文字 hex で返す。 */
function sign(secret: string, ts: string, signedPayload: string): string {
    return createHmac("sha256", secret).update(`${ts}.${signedPayload}`).digest("hex");
}

/**
 * 管理台帳 GAS へ署名付き登録イベントを送る。
 *  - 戻り値: 追記成功（応答 body の ok===true）なら true、それ以外は false。
 *  - env 未設定・署名不可・通信失敗・GAS 応答 ok!==true はすべて false（呼び出し側は登録を成功扱いにする）。
 *  - 例外は投げない（fire-and-forget の呼び出し側を壊さない）。失敗内容は console に残す。
 */
export async function sendRegistrationToLedger(input: ProxRegLedgerPayload): Promise<boolean> {
    const url = process.env.PROX_REG_SHEET_WEBHOOK_URL?.trim();
    const secret = process.env.PROX_REG_SHEET_SIGNING_SECRET?.trim();

    if (!url) {
        // 送信先未設定。dev/test では正常系（黙ってスキップ）。
        console.warn("[prox-reg-sheet] PROX_REG_SHEET_WEBHOOK_URL 未設定のため台帳送信をスキップしました");
        return false;
    }
    if (!secret) {
        // URL はあるのに合鍵が無い＝設定漏れ。署名できないので送らない（無署名で送って GAS に弾かれるのを防ぐ）。
        console.error("[prox-reg-sheet] PROX_REG_SHEET_SIGNING_SECRET 未設定のため署名できず台帳送信を中止しました");
        return false;
    }
    if (!input.email) {
        console.error("[prox-reg-sheet] email 未指定のため台帳送信を中止しました");
        return false;
    }

    // signed_payload は一度だけ確定させ、署名対象と送信内容を同一文字列にする（以後作り直さない）。
    const payload = buildPayload({ ...input, registered_at: input.registered_at ?? new Date().toISOString() });
    const signedPayload = JSON.stringify(payload);
    const sigTs = String(Date.now());
    const sig = sign(secret, sigTs, signedPayload);
    const body = JSON.stringify({ signed_payload: signedPayload, _sig_ts: sigTs, _sig: sig });

    let lastError: unknown = null;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        try {
            const res = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body,
                signal: AbortSignal.timeout(TIMEOUT_MS),
            });
            // GAS は処理結果に依らず HTTP 200 を返すため、応答 body の ok で判定する。
            const data = (await res.json().catch(() => ({}))) as { ok?: unknown };
            if (data?.ok === true) return true;
            console.error(
                `[prox-reg-sheet] 台帳が ok を返しませんでした (attempt ${attempt}/${MAX_ATTEMPTS}, http ${res.status}):`,
                data
            );
        } catch (e) {
            lastError = e;
            console.error(`[prox-reg-sheet] 台帳送信に失敗 (attempt ${attempt}/${MAX_ATTEMPTS}):`, e);
        }
    }
    if (lastError) console.error("[prox-reg-sheet] 台帳送信を断念しました（再送上限到達）");
    return false;
}
