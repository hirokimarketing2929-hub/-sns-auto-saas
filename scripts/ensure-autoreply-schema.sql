-- ============================================================================
-- 自動リプライ機能 スキーマ補完スクリプト（冪等 / idempotent）
-- ----------------------------------------------------------------------------
-- 目的:
--   本番 build は `prisma generate && next build` で `migrate deploy` を実行しない
--   （既存DBの安全のため意図的）。そのため自動リプライの新カラム/テーブルが本番DB
--   （Supabase）に入っていない可能性がある。未適用だと自動リプライが実行時エラーになる。
--
-- 安全性:
--   全文 `IF NOT EXISTS` / 例外無視で構成。既にカラム・テーブルが存在しても何も壊さない。
--   既存データの削除・変更は一切行わない（CREATE / ADD COLUMN / ADD CONSTRAINT のみ）。
--
-- 使い方（Supabase）:
--   ダッシュボード → SQL Editor → New query → このファイルの中身を貼り付け → Run。
--   最後の SELECT で AutoReplyCampaign の列が揃っているか確認できる。
-- ============================================================================

-- 1) AutoReplyCampaign: テーブルが無ければ最小構成で作成 -----------------------
CREATE TABLE IF NOT EXISTS "AutoReplyCampaign" (
    "id"           TEXT NOT NULL,
    "userId"       TEXT NOT NULL,
    "name"         TEXT NOT NULL,
    "targetUrl"    TEXT NOT NULL,
    "replyContent" TEXT NOT NULL,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AutoReplyCampaign_pkey" PRIMARY KEY ("id")
);

-- 1b) 既存テーブルに不足カラムを補完（新カラム含む。順不同・冪等） -------------
ALTER TABLE "AutoReplyCampaign"
    ADD COLUMN IF NOT EXISTS "xAccountId"           TEXT,
    ADD COLUMN IF NOT EXISTS "name"                 TEXT,
    ADD COLUMN IF NOT EXISTS "targetUrl"            TEXT,
    ADD COLUMN IF NOT EXISTS "isTriggerRt"          BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS "isTriggerLike"        BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS "isTriggerReply"       BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS "keyword"              TEXT,
    ADD COLUMN IF NOT EXISTS "replyContent"         TEXT,
    ADD COLUMN IF NOT EXISTS "openingVariants"      TEXT,
    ADD COLUMN IF NOT EXISTS "openingsSentCount"    INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "isActive"             BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS "replyType"            TEXT NOT NULL DEFAULT 'REPLY',
    ADD COLUMN IF NOT EXISTS "triggerMode"          TEXT NOT NULL DEFAULT 'OR',
    ADD COLUMN IF NOT EXISTS "endsAt"               TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "checkIntervalMinutes" INTEGER NOT NULL DEFAULT 5,
    ADD COLUMN IF NOT EXISTS "lastCheckedAt"        TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN IF NOT EXISTS "updatedAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- 2) AutoReplyLog: テーブルが無ければ作成 ------------------------------------
CREATE TABLE IF NOT EXISTS "AutoReplyLog" (
    "id"           TEXT NOT NULL,
    "campaignId"   TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "triggerEvent" TEXT NOT NULL,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AutoReplyLog_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "AutoReplyLog"
    ADD COLUMN IF NOT EXISTS "campaignId"   TEXT,
    ADD COLUMN IF NOT EXISTS "targetUserId" TEXT,
    ADD COLUMN IF NOT EXISTS "triggerEvent" TEXT,
    ADD COLUMN IF NOT EXISTS "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- 3) インデックス（冪等） ----------------------------------------------------
CREATE INDEX IF NOT EXISTS "AutoReplyCampaign_xAccountId_idx"
    ON "AutoReplyCampaign"("xAccountId");

CREATE UNIQUE INDEX IF NOT EXISTS "AutoReplyLog_campaignId_targetUserId_key"
    ON "AutoReplyLog"("campaignId", "targetUserId");

-- 4) 外部キー（既に存在する場合は無視） --------------------------------------
DO $$ BEGIN
    ALTER TABLE "AutoReplyCampaign"
        ADD CONSTRAINT "AutoReplyCampaign_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "AutoReplyCampaign"
        ADD CONSTRAINT "AutoReplyCampaign_xAccountId_fkey"
        FOREIGN KEY ("xAccountId") REFERENCES "XAccount"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "AutoReplyLog"
        ADD CONSTRAINT "AutoReplyLog_campaignId_fkey"
        FOREIGN KEY ("campaignId") REFERENCES "AutoReplyCampaign"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 5) 確認用: AutoReplyCampaign の列が揃っているか目視 -------------------------
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'AutoReplyCampaign'
ORDER BY ordinal_position;
