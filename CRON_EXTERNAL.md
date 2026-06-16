# 外部 cron 設定（cron-job.org）

Vercel Hobby は日次 cron のみ許可のため、毎分〜30分間隔のジョブは外部スケジューラ（cron-job.org）へ移行。

## Vercel に残すジョブ（日次・無料枠OK）
| path | schedule |
|------|----------|
| /api/cron/fetch-x-analytics | 0 3 * * *（毎日3時） |

## cron-job.org に登録するジョブ
全て対象URL: `https://sns-auto-saas.vercel.app<path>`
HTTPメソッド: GET / ヘッダ: `Authorization: Bearer <CRON_SECRET>`
（CRON_SECRET は Vercel 環境変数の値と一致させる）

| path | 間隔 | 用途 |
|------|------|------|
| /api/cron/publish | 毎分 | 予約投稿の公開 |
| /api/cron/autoreply | 毎分 | 自動リプライ |
| /api/cron/check-impressions | 15分 | インプレ取得 |
| /api/reply-engagement/check | 30分 | リプ回り半自動 |
