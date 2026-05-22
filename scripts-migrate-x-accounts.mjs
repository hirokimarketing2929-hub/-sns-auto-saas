// XAccount サブアカウント機能への移行スクリプト
//
// 目的:
//   - 全ユーザーごとに「メインアカウント」XAccount を 1 件作成
//   - Settings の X 連携情報・運用ルール（accountConcept/profile/policy 等）を XAccount にコピー
//   - OAuth Account（provider="twitter"）が存在する場合は最初の 1 件を XAccount.oauthAccount として紐付け
//   - 既存の Post / PastPost / Knowledge / KpiScenario / AutoReplyCampaign /
//     ReplyEngagementTarget / ReplyEngagementSuggestion / FunnelEvent /
//     RejectedSuggestion / Media の xAccountId を埋める
//   - User.activeXAccountId を作成した XAccount に設定
//
// 実行: node scripts-migrate-x-accounts.mjs
//   オプション: --dry-run  (DB を変更せず予定だけ表示)

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const DRY = process.argv.includes("--dry-run");

const log = (...args) => console.log("[migrate]", ...args);

async function main() {
    const users = await prisma.user.findMany({
        include: {
            settings: true,
            accounts: { where: { provider: "twitter" }, orderBy: { id: "asc" } },
            xAccounts: true,
        },
    });

    log(`対象ユーザー: ${users.length}件 ${DRY ? "(DRY-RUN)" : ""}`);

    let createdCount = 0;
    let backfilledRows = 0;

    for (const user of users) {
        // 既に XAccount が 1件以上ある場合は当該ユーザーは移行済みとみなしてスキップ
        if (user.xAccounts.length > 0) {
            log(`- user ${user.id} (${user.email}): すでに XAccount あり → スキップ`);
            // ただし activeXAccountId が未設定なら最古を active にする
            if (!user.activeXAccountId) {
                const oldest = user.xAccounts.sort((a, b) => +a.createdAt - +b.createdAt)[0];
                log(`  activeXAccountId 未設定 → ${oldest.id} を active に設定`);
                if (!DRY) {
                    await prisma.user.update({
                        where: { id: user.id },
                        data: { activeXAccountId: oldest.id },
                    });
                }
            }
            continue;
        }

        const settings = user.settings;
        const oauth = user.accounts[0]; // 最初に紐づいた twitter account（あれば）

        // displayName の決定
        let displayName = "メインアカウント";
        if (settings?.xAccountName) displayName = settings.xAccountName;
        else if (oauth?.accountName) displayName = oauth.accountName;
        else if (user.name) displayName = `${user.name}のメインアカウント`;

        const data = {
            userId: user.id,
            displayName,
            oauthAccountId: oauth?.id ?? null,
            xApiKey: settings?.xApiKey ?? null,
            xApiSecret: settings?.xApiSecret ?? null,
            xAccessToken: settings?.xAccessToken ?? null,
            xAccessSecret: settings?.xAccessSecret ?? null,
            xUsername: settings?.xAccountName ?? null,
            xProfileImageUrl: settings?.xProfileImageUrl ?? null,
            // 運用ルール（Settings から）
            accountConcept: settings?.accountConcept ?? undefined,
            profile: settings?.profile ?? undefined,
            policy: settings?.policy ?? undefined,
            thresholdImpression: settings?.thresholdImpression ?? undefined,
            thresholdConversion: settings?.thresholdConversion ?? undefined,
            replyEngagementMinImp: settings?.replyEngagementMinImp ?? undefined,
        };

        log(`+ user ${user.id} (${user.email}): 「${displayName}」を作成`);
        if (DRY) {
            createdCount++;
            continue;
        }

        const xAccount = await prisma.xAccount.create({ data });
        createdCount++;

        await prisma.user.update({
            where: { id: user.id },
            data: { activeXAccountId: xAccount.id },
        });

        // 既存データに xAccountId を埋める
        const fillFor = async (model, label) => {
            const res = await prisma[model].updateMany({
                where: { userId: user.id, xAccountId: null },
                data: { xAccountId: xAccount.id },
            });
            if (res.count > 0) {
                log(`    ${label}: ${res.count}件 backfill`);
                backfilledRows += res.count;
            }
        };
        await fillFor("post", "Post");
        await fillFor("pastPost", "PastPost");
        await fillFor("knowledge", "Knowledge");
        await fillFor("kpiScenario", "KpiScenario");
        await fillFor("autoReplyCampaign", "AutoReplyCampaign");
        await fillFor("replyEngagementTarget", "ReplyEngagementTarget");
        await fillFor("replyEngagementSuggestion", "ReplyEngagementSuggestion");
        await fillFor("funnelEvent", "FunnelEvent");
        await fillFor("rejectedSuggestion", "RejectedSuggestion");
        await fillFor("media", "Media");
        // ApiUsageLog は SetNull リレーションで履歴用なのでバックフィル対象外（残しても可）
    }

    log(`完了: XAccount 作成 ${createdCount}件 / 既存レコード backfill ${backfilledRows}件`);
}

main()
    .catch((e) => {
        console.error("[migrate] FAILED:", e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
