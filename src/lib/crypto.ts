/**
 * アプリケーション層 AES-256-GCM 暗号化（CTO決定 003 §1）。
 *
 * BYOK の X API キー・OAuth トークンを at-rest で暗号化するための共通ヘルパー。
 * 鍵は環境変数 PROX_ENCRYPTION_KEY（base64 32バイト=256bit）から読む。
 *
 * 保存フォーマット: enc:v1:<base64(iv)>:<base64(authTag)>:<base64(ciphertext)>
 *   - 先頭 "enc:v1:" がバージョン兼「暗号化済み判定」の目印。
 *   - decryptSecret は先頭が enc:v1: でなければ平文とみなしそのまま返す（移行期グレース）。
 *
 * 鍵生成: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
 */

import {
    createCipheriv,
    createDecipheriv,
    randomBytes,
} from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12; // GCM 推奨 nonce 長
const KEY_BYTES = 32; // 256bit
const PREFIX = "enc:v1:";

/** 鍵キャッシュ（プロセス内で1度だけ検証・デコードする）。 */
let cachedKey: Buffer | null = null;

/**
 * PROX_ENCRYPTION_KEY を読み込み 32バイトの Buffer を返す。
 * 未設定 / 長さ不正なら throw（fail-fast。平文書込み事故を防ぐ）。
 */
function getKey(): Buffer {
    if (cachedKey) return cachedKey;

    const raw = process.env.PROX_ENCRYPTION_KEY;
    if (!raw || raw.trim() === "") {
        throw new Error(
            "PROX_ENCRYPTION_KEY が未設定です。BYOK キー暗号化に必須です。" +
            "`node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\"` で生成し .env に設定してください。"
        );
    }

    const key = Buffer.from(raw.trim(), "base64");
    if (key.length !== KEY_BYTES) {
        throw new Error(
            `PROX_ENCRYPTION_KEY の長さが不正です（base64 デコード後 ${key.length} バイト、期待値 ${KEY_BYTES} バイト）。`
        );
    }

    cachedKey = key;
    return key;
}

/** 値が暗号化済みフォーマットかどうか判定する。 */
export function isEncrypted(value: string | null | undefined): boolean {
    return typeof value === "string" && value.startsWith(PREFIX);
}

/**
 * 平文を AES-256-GCM で暗号化し、保存用の単一文字列を返す。
 * 既に暗号化済み（enc:v1:）の場合は二重暗号化を避けてそのまま返す（冪等）。
 * 空文字 / null / undefined はそのまま返す（任意キー欄の未入力を尊重）。
 */
export function encryptSecret(plain: string | null | undefined): string | null | undefined {
    if (plain === null || plain === undefined) return plain;
    if (plain === "") return plain;
    if (isEncrypted(plain)) return plain; // 冪等

    const key = getKey();
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGORITHM, key, iv);
    const ciphertext = Buffer.concat([
        cipher.update(plain, "utf8"),
        cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    return [
        PREFIX.slice(0, -1), // "enc:v1"
        iv.toString("base64"),
        authTag.toString("base64"),
        ciphertext.toString("base64"),
    ].join(":");
}

/**
 * 保存済み文字列を復号して平文を返す。
 * - 先頭が enc:v1: でなければ平文とみなしそのまま返す（移行期グレース）。
 * - 空文字 / null / undefined はそのまま返す。
 * - フォーマット不正・復号失敗（改ざん・鍵不一致）は throw。
 */
export function decryptSecret(stored: string | null | undefined): string | null | undefined {
    if (stored === null || stored === undefined) return stored;
    if (stored === "") return stored;
    if (!isEncrypted(stored)) return stored; // 平文グレース

    const parts = stored.split(":");
    // ["enc", "v1", iv, authTag, ciphertext]
    if (parts.length !== 5) {
        throw new Error("暗号化データのフォーマットが不正です。");
    }
    const [, , ivB64, tagB64, dataB64] = parts;

    const key = getKey();
    const iv = Buffer.from(ivB64, "base64");
    const authTag = Buffer.from(tagB64, "base64");
    const ciphertext = Buffer.from(dataB64, "base64");

    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    const plain = Buffer.concat([
        decipher.update(ciphertext),
        decipher.final(),
    ]);
    return plain.toString("utf8");
}

// =============================================================================
// 機微情報のマスク表示（RT-005 対策・defensive）
//
// 方針（構造で防ぐ）:
//   GET レスポンスでは BYOK 鍵・トークンの「平文」を二度と返さない。
//   保存有無の判定（フロントの locked 表示）に必要なのは「設定済みか」だけなので、
//   末尾4桁だけを残した固定長マスクを返す。実体（平文）はサーバ外に出ない。
//
//   マスク文字列は MASK_SENTINEL_PREFIX で始まる。書込み API はこの接頭辞を持つ値を
//   「ユーザーが編集していない＝そのまま据え置き」とみなし、絶対に鍵として保存しない
//   （フロントが据え置き値をそのまま PUT で送り返しても、鍵がマスクで上書きされない）。
// =============================================================================

/** マスク済み値であることを示す接頭辞（書込み側のガードに使う）。 */
export const MASK_SENTINEL_PREFIX = "••••";

/**
 * 機微値を表示用にマスクする。設定済みなら "••••設定済み"、未設定なら "" を返す。
 * 暗号化済み(enc:v1:)でも平文でも「設定されている」事実だけを表現する。
 * 復号はしない（平文をプロセス外/レスポンスに出さないため）。
 *
 * OBS-2 是正: 以前は平文グレース滞留分（enc:v1: 以外）について末尾4桁を露出していた。
 *   これは RT-008（平文滞留）が残る限り「暗号化済みは末尾秘匿・平文だけ末尾露出」という
 *   不整合な扱いで、平文が残っているユーザーほど多く漏れる逆転を生んでいた。
 *   マスク方針（中身・長さ・末尾を一切出さない）と一貫させ、平文・暗号文を問わず
 *   一律 "設定済み" の固定マスクにする。平文は末尾4桁すら露出しない。
 */
export function maskSecret(stored: string | null | undefined): string {
    if (stored === null || stored === undefined || stored === "") return "";
    // 暗号化済み・平文グレース滞留を問わず「設定されている」事実のみ表現。
    // 末尾4桁を含む一切の平文断片をレスポンスに出さない（構造で防ぐ）。
    return `${MASK_SENTINEL_PREFIX}設定済み`;
}

/** 値がマスク表示（＝ユーザー未編集の据え置き）かどうか。書込み側で弾く判定に使う。 */
export function isMaskedSentinel(value: unknown): boolean {
    return typeof value === "string" && value.startsWith(MASK_SENTINEL_PREFIX);
}

/**
 * オブジェクトの指定キー群をまとめて暗号化（書込み前用）。元オブジェクトは破壊しない。
 * undefined のキーは触らない（部分更新を尊重）。
 */
export function encryptFields<T extends Record<string, unknown>>(
    obj: T,
    fields: ReadonlyArray<keyof T>
): T {
    const out: Record<string, unknown> = { ...obj };
    for (const f of fields) {
        const v = obj[f];
        if (typeof v === "string") {
            out[f as string] = encryptSecret(v);
        }
    }
    return out as T;
}
