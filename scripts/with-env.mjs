#!/usr/bin/env node
// 依存ゼロの env ローダー。指定した env ファイルを読み込んで process.env にマージし、
// 残りの引数をコマンドとして起動する。dotenv-cli の代替（npm install が壊れている
// ローカル環境でも動くように外部依存を持たない）。
//
// 使い方: node scripts/with-env.mjs <envファイル> <コマンド> [引数...]
//   例:   node scripts/with-env.mjs .env.prod.local next dev -p 3001
//
// 注意: ここで設定した値が既存の process.env を上書きする（明示指定を優先）。

import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";

const [, , envFile, ...command] = process.argv;

if (!envFile || command.length === 0) {
    console.error("usage: node scripts/with-env.mjs <envFile> <command> [args...]");
    process.exit(1);
}

function parseEnv(text) {
    const out = {};
    for (const rawLine of text.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith("#")) continue;
        const eq = line.indexOf("=");
        if (eq === -1) continue;
        const key = line.slice(0, eq).trim();
        let val = line.slice(eq + 1).trim();
        // 前後のクォートを除去（"..." または '...'）
        if (
            (val.startsWith('"') && val.endsWith('"')) ||
            (val.startsWith("'") && val.endsWith("'"))
        ) {
            val = val.slice(1, -1);
        }
        out[key] = val;
    }
    return out;
}

let parsed = {};
try {
    parsed = parseEnv(readFileSync(envFile, "utf8"));
} catch (e) {
    console.error(`[with-env] env ファイルを読めませんでした: ${envFile}\n${e.message}`);
    process.exit(1);
}

const env = { ...process.env, ...parsed };

const child = spawn(command[0], command.slice(1), { stdio: "inherit", env });
child.on("exit", (code) => process.exit(code ?? 0));
child.on("error", (err) => {
    console.error(`[with-env] コマンド起動に失敗: ${command.join(" ")}\n${err.message}`);
    process.exit(1);
});
