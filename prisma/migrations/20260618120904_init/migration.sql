-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "password" TEXT,
    "activeXAccountId" TEXT,
    "plan" TEXT NOT NULL DEFAULT 'FREE',
    "maxStorage" INTEGER NOT NULL DEFAULT 524288000,
    "usedStorage" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "XAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "oauthAccountId" TEXT,
    "xApiKey" TEXT,
    "xApiSecret" TEXT,
    "xAccessToken" TEXT,
    "xAccessSecret" TEXT,
    "xUsername" TEXT,
    "xUserId" TEXT,
    "xProfileImageUrl" TEXT,
    "accountConcept" TEXT DEFAULT '売上目標達成を支援する実践的なノウハウ発信',
    "profile" TEXT DEFAULT 'SNS集客のプロフェッショナル',
    "policy" TEXT DEFAULT '1日3投稿。図解を活用する。専門用語を避ける。',
    "thresholdImpression" INTEGER DEFAULT 1000,
    "thresholdConversion" INTEGER DEFAULT 1,
    "replyEngagementMinImp" INTEGER NOT NULL DEFAULT 500,
    "targetAudience" TEXT DEFAULT 'SNS運用代行会社、個人事業主',
    "targetPain" TEXT DEFAULT 'フォロワーが伸びない、集客から販売につながらない',
    "ctaUrl" TEXT DEFAULT 'https://proline.example.com',
    "competitor1" TEXT,
    "competitor2" TEXT,
    "applyPersonaToGeneration" BOOLEAN NOT NULL DEFAULT false,
    "chatworkRoomId" TEXT,
    "spreadsheetUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "XAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,
    "accountName" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "Settings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "targetAudience" TEXT DEFAULT 'SNS運用代行会社、個人事業主',
    "targetPain" TEXT DEFAULT 'フォロワーが伸びない、集客から販売につながらない',
    "ctaUrl" TEXT DEFAULT 'https://proline.example.com',
    "competitor1" TEXT,
    "competitor2" TEXT,
    "accountConcept" TEXT DEFAULT '売上目標達成を支援する実践的なノウハウ発信',
    "profile" TEXT DEFAULT 'SNS集客のプロフェッショナル',
    "policy" TEXT DEFAULT '1日3投稿。図解を活用する。専門用語を避ける。',
    "thresholdImpression" INTEGER DEFAULT 1000,
    "thresholdConversion" INTEGER DEFAULT 1,
    "xApiKey" TEXT,
    "xApiSecret" TEXT,
    "xAccessToken" TEXT,
    "xAccessSecret" TEXT,
    "xAccountName" TEXT,
    "xProfileImageUrl" TEXT,
    "anthropicApiKey" TEXT,
    "openaiApiKey" TEXT,
    "spreadsheetUrl" TEXT,
    "funnelWebhookToken" TEXT,
    "chatworkApiToken" TEXT,
    "chatworkRoomId" TEXT,
    "replyEngagementMinImp" INTEGER NOT NULL DEFAULT 500,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PastPost" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "xAccountId" TEXT,
    "content" TEXT NOT NULL,
    "platform" TEXT NOT NULL DEFAULT 'X',
    "postedAt" TIMESTAMP(3) NOT NULL,
    "externalId" TEXT,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "conversions" INTEGER NOT NULL DEFAULT 0,
    "replies" INTEGER NOT NULL DEFAULT 0,
    "retweets" INTEGER NOT NULL DEFAULT 0,
    "likes" INTEGER NOT NULL DEFAULT 0,
    "quotes" INTEGER NOT NULL DEFAULT 0,
    "urlClicks" INTEGER NOT NULL DEFAULT 0,
    "profileClicks" INTEGER NOT NULL DEFAULT 0,
    "analysisStatus" TEXT NOT NULL DEFAULT 'UNANALYZED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PastPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Knowledge" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "xAccountId" TEXT,
    "content" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "category" TEXT,
    "source" TEXT,
    "isSharedToHQ" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Knowledge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Post" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "xAccountId" TEXT,
    "content" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "scheduledAt" TIMESTAMP(3),
    "mediaUrls" TEXT,
    "postedTweetId" TEXT,
    "threadContents" TEXT,
    "threadStyle" TEXT NOT NULL DEFAULT 'chain',
    "impressionTarget" INTEGER,
    "impressionReplyContent" TEXT,
    "isImpressionReplySent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Post_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KpiScenario" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "xAccountId" TEXT,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "targetValue" INTEGER NOT NULL DEFAULT 0,
    "currentValue" INTEGER NOT NULL DEFAULT 0,
    "metricSource" TEXT NOT NULL DEFAULT 'manual',
    "metricPeriodDays" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KpiScenario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutoReplyCampaign" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "xAccountId" TEXT,
    "name" TEXT NOT NULL,
    "targetUrl" TEXT NOT NULL,
    "isTriggerRt" BOOLEAN NOT NULL DEFAULT false,
    "isTriggerLike" BOOLEAN NOT NULL DEFAULT false,
    "isTriggerReply" BOOLEAN NOT NULL DEFAULT false,
    "keyword" TEXT,
    "replyContent" TEXT NOT NULL,
    "openingVariants" TEXT,
    "openingsSentCount" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "replyType" TEXT NOT NULL DEFAULT 'REPLY',
    "triggerMode" TEXT NOT NULL DEFAULT 'OR',
    "endsAt" TIMESTAMP(3),
    "checkIntervalMinutes" INTEGER NOT NULL DEFAULT 5,
    "lastCheckedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutoReplyCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutoReplyLog" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "triggerEvent" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AutoReplyLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Media" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "xAccountId" TEXT,
    "filename" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReplyEngagementTarget" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "xAccountId" TEXT,
    "username" TEXT NOT NULL,
    "displayName" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastCheckedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReplyEngagementTarget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReplyEngagementSuggestion" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "xAccountId" TEXT,
    "targetUsername" TEXT NOT NULL,
    "tweetId" TEXT NOT NULL,
    "tweetUrl" TEXT NOT NULL,
    "tweetText" TEXT NOT NULL,
    "impressions" INTEGER,
    "variants" TEXT NOT NULL,
    "notifiedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReplyEngagementSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FunnelEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "xAccountId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'proline',
    "formName" TEXT,
    "externalUid" TEXT,
    "displayName" TEXT,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "utmContent" TEXT,
    "rawData" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FunnelEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiUsageLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "xAccountId" TEXT,
    "provider" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "model" TEXT,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "costUsd" DOUBLE PRECISION,
    "xRateLimitRemaining" INTEGER,
    "xRateLimitMax" INTEGER,
    "xRateLimitReset" TIMESTAMP(3),
    "success" BOOLEAN NOT NULL DEFAULT true,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiUsageLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RejectedSuggestion" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "xAccountId" TEXT,
    "contentHash" TEXT NOT NULL,
    "contentSnippet" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "rejectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RejectedSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "XAccount_oauthAccountId_key" ON "XAccount"("oauthAccountId");

-- CreateIndex
CREATE INDEX "XAccount_userId_idx" ON "XAccount"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "Settings_userId_key" ON "Settings"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Settings_funnelWebhookToken_key" ON "Settings"("funnelWebhookToken");

-- CreateIndex
CREATE UNIQUE INDEX "PastPost_externalId_key" ON "PastPost"("externalId");

-- CreateIndex
CREATE INDEX "PastPost_xAccountId_idx" ON "PastPost"("xAccountId");

-- CreateIndex
CREATE INDEX "Knowledge_xAccountId_idx" ON "Knowledge"("xAccountId");

-- CreateIndex
CREATE INDEX "Post_xAccountId_idx" ON "Post"("xAccountId");

-- CreateIndex
CREATE INDEX "KpiScenario_xAccountId_idx" ON "KpiScenario"("xAccountId");

-- CreateIndex
CREATE INDEX "AutoReplyCampaign_xAccountId_idx" ON "AutoReplyCampaign"("xAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "AutoReplyLog_campaignId_targetUserId_key" ON "AutoReplyLog"("campaignId", "targetUserId");

-- CreateIndex
CREATE INDEX "Media_userId_idx" ON "Media"("userId");

-- CreateIndex
CREATE INDEX "Media_xAccountId_idx" ON "Media"("xAccountId");

-- CreateIndex
CREATE INDEX "ReplyEngagementTarget_userId_isActive_idx" ON "ReplyEngagementTarget"("userId", "isActive");

-- CreateIndex
CREATE INDEX "ReplyEngagementTarget_xAccountId_isActive_idx" ON "ReplyEngagementTarget"("xAccountId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "ReplyEngagementTarget_userId_username_key" ON "ReplyEngagementTarget"("userId", "username");

-- CreateIndex
CREATE INDEX "ReplyEngagementSuggestion_userId_createdAt_idx" ON "ReplyEngagementSuggestion"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ReplyEngagementSuggestion_xAccountId_createdAt_idx" ON "ReplyEngagementSuggestion"("xAccountId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReplyEngagementSuggestion_userId_tweetId_key" ON "ReplyEngagementSuggestion"("userId", "tweetId");

-- CreateIndex
CREATE INDEX "FunnelEvent_userId_occurredAt_idx" ON "FunnelEvent"("userId", "occurredAt");

-- CreateIndex
CREATE INDEX "FunnelEvent_userId_utmCampaign_idx" ON "FunnelEvent"("userId", "utmCampaign");

-- CreateIndex
CREATE INDEX "FunnelEvent_userId_source_occurredAt_idx" ON "FunnelEvent"("userId", "source", "occurredAt");

-- CreateIndex
CREATE INDEX "FunnelEvent_xAccountId_occurredAt_idx" ON "FunnelEvent"("xAccountId", "occurredAt");

-- CreateIndex
CREATE INDEX "ApiUsageLog_userId_createdAt_idx" ON "ApiUsageLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ApiUsageLog_userId_provider_createdAt_idx" ON "ApiUsageLog"("userId", "provider", "createdAt");

-- CreateIndex
CREATE INDEX "ApiUsageLog_xAccountId_createdAt_idx" ON "ApiUsageLog"("xAccountId", "createdAt");

-- CreateIndex
CREATE INDEX "RejectedSuggestion_userId_rejectedAt_idx" ON "RejectedSuggestion"("userId", "rejectedAt");

-- CreateIndex
CREATE INDEX "RejectedSuggestion_xAccountId_rejectedAt_idx" ON "RejectedSuggestion"("xAccountId", "rejectedAt");

-- CreateIndex
CREATE UNIQUE INDEX "RejectedSuggestion_userId_contentHash_key" ON "RejectedSuggestion"("userId", "contentHash");

-- AddForeignKey
ALTER TABLE "XAccount" ADD CONSTRAINT "XAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "XAccount" ADD CONSTRAINT "XAccount_oauthAccountId_fkey" FOREIGN KEY ("oauthAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Settings" ADD CONSTRAINT "Settings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PastPost" ADD CONSTRAINT "PastPost_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PastPost" ADD CONSTRAINT "PastPost_xAccountId_fkey" FOREIGN KEY ("xAccountId") REFERENCES "XAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Knowledge" ADD CONSTRAINT "Knowledge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Knowledge" ADD CONSTRAINT "Knowledge_xAccountId_fkey" FOREIGN KEY ("xAccountId") REFERENCES "XAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_xAccountId_fkey" FOREIGN KEY ("xAccountId") REFERENCES "XAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KpiScenario" ADD CONSTRAINT "KpiScenario_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KpiScenario" ADD CONSTRAINT "KpiScenario_xAccountId_fkey" FOREIGN KEY ("xAccountId") REFERENCES "XAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutoReplyCampaign" ADD CONSTRAINT "AutoReplyCampaign_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutoReplyCampaign" ADD CONSTRAINT "AutoReplyCampaign_xAccountId_fkey" FOREIGN KEY ("xAccountId") REFERENCES "XAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutoReplyLog" ADD CONSTRAINT "AutoReplyLog_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "AutoReplyCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Media" ADD CONSTRAINT "Media_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Media" ADD CONSTRAINT "Media_xAccountId_fkey" FOREIGN KEY ("xAccountId") REFERENCES "XAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReplyEngagementTarget" ADD CONSTRAINT "ReplyEngagementTarget_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReplyEngagementTarget" ADD CONSTRAINT "ReplyEngagementTarget_xAccountId_fkey" FOREIGN KEY ("xAccountId") REFERENCES "XAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReplyEngagementSuggestion" ADD CONSTRAINT "ReplyEngagementSuggestion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReplyEngagementSuggestion" ADD CONSTRAINT "ReplyEngagementSuggestion_xAccountId_fkey" FOREIGN KEY ("xAccountId") REFERENCES "XAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FunnelEvent" ADD CONSTRAINT "FunnelEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FunnelEvent" ADD CONSTRAINT "FunnelEvent_xAccountId_fkey" FOREIGN KEY ("xAccountId") REFERENCES "XAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiUsageLog" ADD CONSTRAINT "ApiUsageLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiUsageLog" ADD CONSTRAINT "ApiUsageLog_xAccountId_fkey" FOREIGN KEY ("xAccountId") REFERENCES "XAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RejectedSuggestion" ADD CONSTRAINT "RejectedSuggestion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RejectedSuggestion" ADD CONSTRAINT "RejectedSuggestion_xAccountId_fkey" FOREIGN KEY ("xAccountId") REFERENCES "XAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

