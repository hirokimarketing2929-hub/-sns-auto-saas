/**
 * 既存平文シークレットの一括暗号化スクリプト（CTO決定 003 §1-4）。
 *
 * 対象:
 *   - XAccount.{xApiKey, xApiSecret, xAccessToken, xAccessSecret}
 *   - Settings.{xApiKey, xApiSecret, xAccessToken, xAccessSecret,
 *               anthropicApiKey, openaiApiKey, chatworkApiToken}
 *   - Account.{access_token, refresh_token, id_token}（NextAuth OAuth）
 *
 * 仕様:
 *   - "enc:v1:" で始まらない値だけを暗号化する（冪等。二重暗号化しない）。
 *   - PROX_ENCRYPTION_KEY 必須（未設定なら crypto.ts が throw）。
 *   - --dry-run で件数だけ確認（書込みなし）。
 *
 * 実行手順（無停止移行）:
 *   ① crypto.ts + 読取両対応をデプロイ（平文も読める状態）
 *   ② このスクリプトを実行（既存平文を暗号化）
 *   ③ 書込みは既に暗号化に切替済み（本実装で同時投入）
 *
 * 使い方:
 *   node scripts/with-env.mjs .env.local node scripts/migrate-encrypt-secrets.mjs --dry-run
 *   node scripts/with-env.mjs .env.local node scripts/migrate-encrypt-secrets.mjs
 */

import { PrismaClient } from "@prisma/client";
import { createCipheriv, randomBytes } from "node:crypto";

const PREFIX = "enc:v1:";
const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
const KEY_BYTES = 32;

const DRY_RUN = process.argv.includes("--dry-run");

function getKey() {
    const raw = process.env.PROX_ENCRYPTION_KEY;
    if (!raw || !raw.trim()) {
        throw new Error("PROX_ENCRYPTION_KEY が未設定です。.env に設定してから実行してください。");
    }
    const key = Buffer.from(raw.trim(), "base64");
    if (key.length !== KEY_BYTES) {
        throw new Error(`PROX_ENCRYPTION_KEY の長さが不正（${key.length}バイト、期待 ${KEY_BYTES}）。`);
    }
    return key;
}

const KEY = getKey();

function isEncrypted(v) {
    return typeof v === "string" && v.startsWith(PREFIX);
}

function encrypt(plain) {
    if (typeof plain !== "string" || plain === "" || isEncrypted(plain)) return plain;
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGORITHM, KEY, iv);
    const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return ["enc:v1", iv.toString("base64"), tag.toString("base64"), ct.toString("base64")].join(":");
}

const prisma = new PrismaClient();

async function migrateTable(label, rows, fields, updateFn) {
    let touched = 0;
    for (const row of rows) {
        const patch = {};
        for (const f of fields) {
            const v = row[f];
            if (typeof v === "string" && v !== "" && !isEncrypted(v)) {
                patch[f] = encrypt(v);
            }
        }
        if (Object.keys(patch).length > 0) {
            touched++;
            if (!DRY_RUN) await updateFn(row.id, patch);
        }
    }
    console.log(`[${label}] 対象 ${rows.length} 件中 ${touched} 件を暗号化${DRY_RUN ? "（dry-run・未書込み）" : ""}`);
    return touched;
}

async function main() {
    console.log(`=== migrate-encrypt-secrets ${DRY_RUN ? "(DRY RUN)" : ""} ===`);

    const xAccounts = await prisma.xAccount.findMany();
    await migrateTable(
        "XAccount",
        xAccounts,
        ["xApiKey", "xApiSecret", "xAccessToken", "xAccessSecret"],
        (id, data) => prisma.xAccount.update({ where: { id }, data })
    );

    const settings = await prisma.settings.findMany();
    await migrateTable(
        "Settings",
        settings,
        ["xApiKey", "xApiSecret", "xAccessToken", "xAccessSecret", "anthropicApiKey", "openaiApiKey", "chatworkApiToken"],
        (id, data) => prisma.settings.update({ where: { id }, data })
    );

    const accounts = await prisma.account.findMany();
    await migrateTable(
        "Account",
        accounts,
        ["access_token", "refresh_token", "id_token"],
        (id, data) => prisma.account.update({ where: { id }, data })
    );

    console.log("=== 完了 ===");
}

main()
    .catch((e) => {
        console.error("移行失敗:", e);
        process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
