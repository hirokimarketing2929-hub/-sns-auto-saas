// Settings の targetAudience / targetPain / ctaUrl / competitor1 / competitor2 / spreadsheetUrl を
// 各ユーザーの「最古の XAccount」（メインアカウント）にコピーするバックフィル。
// 既に XAccount 側に値が入っている（≠ デフォルト）場合は上書きしない。
//
// 実行: node scripts-migrate-x-account-persona.mjs [--dry-run]

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const DRY = process.argv.includes("--dry-run");
const log = (...a) => console.log("[migrate-persona]", ...a);

const DEFAULTS = {
    targetAudience: "SNS運用代行会社、個人事業主",
    targetPain: "フォロワーが伸びない、集客から販売につながらない",
    ctaUrl: "https://proline.example.com",
};

async function main() {
    const users = await prisma.user.findMany({
        include: { settings: true, xAccounts: { orderBy: { createdAt: "asc" } } },
    });
    log(`対象ユーザー: ${users.length}件 ${DRY ? "(DRY-RUN)" : ""}`);

    let updated = 0;
    for (const user of users) {
        const settings = user.settings;
        if (!settings) {
            log(`- user ${user.id}: Settings なし、スキップ`);
            continue;
        }
        const main = user.xAccounts[0];
        if (!main) {
            log(`- user ${user.id}: XAccount なし（先に scripts-migrate-x-accounts を流してください）`);
            continue;
        }

        // 「Settings の値が入っていて かつ XAccount 側がデフォルト/未設定なら採用」
        const data = {};

        const setIfWorthMoving = (key, defaultVal) => {
            const fromSettings = settings[key];
            const fromXAccount = main[key];
            // settings 側が空 / null / undefined ならコピー対象外
            if (fromSettings === null || fromSettings === undefined || fromSettings === "") return;
            // settings 側がデフォルトと同じならコピーする意味なし
            if (defaultVal !== undefined && fromSettings === defaultVal) return;
            // XAccount 側に既に "デフォルト以外" の値が入っていれば上書きしない
            if (fromXAccount && fromXAccount !== defaultVal) return;
            data[key] = fromSettings;
        };

        setIfWorthMoving("targetAudience", DEFAULTS.targetAudience);
        setIfWorthMoving("targetPain", DEFAULTS.targetPain);
        setIfWorthMoving("ctaUrl", DEFAULTS.ctaUrl);
        setIfWorthMoving("competitor1");
        setIfWorthMoving("competitor2");
        setIfWorthMoving("spreadsheetUrl");

        if (Object.keys(data).length === 0) {
            log(`- user ${user.id} (${user.email}): 移行する値なし`);
            continue;
        }

        log(`+ user ${user.id} (${user.email}) → XAccount ${main.id}`, data);
        if (!DRY) {
            await prisma.xAccount.update({ where: { id: main.id }, data });
        }
        updated++;
    }

    log(`完了: ${updated}件 update`);
}

main()
    .catch((e) => { console.error("[migrate-persona] FAILED:", e); process.exit(1); })
    .finally(async () => prisma.$disconnect());
