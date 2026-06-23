# ローカル2環境 & リリース機能ゲーティング 運用メモ

最終更新: 2026-06-22（origin/main 同期後に再適用）

## 概要

ローカルを2つの設定で同時に動かせる。

| コマンド | 用途 | ポート | DB | 機能表示 | ビルドDir |
|---------|------|------|----|---------|---------|
| `npm run dev` | **開発用**（自由に壊してOK） | 3000 | ローカル `prox_dev` | 全機能 (`RELEASE_MODE=full`) | `.next` |
| `npm run dev:prod` | **本番ミラー**（本番に出る見た目の確認・反映してOK） | 3001 | 本番 Render `proxeziento` | MVPのみ (`RELEASE_MODE=mvp`) | `.next-prod` |

両方を**同時起動できる**（`next.config.ts` の `distDir` を環境変数で分離しているため）。

## リリース機能ゲーティング（MVP）

`RELEASE_MODE=mvp` のとき、本番では以下を**隠す**（[src/lib/features.ts](src/lib/features.ts) の `MVP_HIDDEN_FEATURES`）。ブロックリスト方式なので、新ページが増えても既定で表示され、絞り込み対象だけ管理すればよい。

- **隠す**: データ分析 / KPI目標 / リプ周り半自動化 / メディアライブラリ
- 表示（それ以外すべて）: ダッシュボード / アカウント連携・詳細 / ナレッジ / リサーチ / 投稿作成 / スケジューラー / 自動リプライ / 設定 / Q&A・使い方 / お問い合わせ / ProLine

非表示はサイドバーから消すだけでなく、URL直アクセスも各ルートの `layout.tsx` ガードで `/dashboard` へ退避する。**データ・API・cron は削除していない**ので、開発(`full`)では従来どおり全部見える。

## ローカルDB（PostgreSQL 18 / Homebrew）

- データディレクトリ: `/usr/local/var/postgresql@18`
- 起動: `npm run db:start` / 停止: `npm run db:stop`（`LC_ALL=C` 込み。macOSの "postmaster became multithreaded" 回避）
- 接続: `postgresql://yoshidomehiroki@localhost:5432/prox_dev`（パスワード不要）

### 本番データを開発DBへ再同期したいとき

```bash
export PATH="/usr/local/opt/postgresql@18/bin:$PATH"; export LC_ALL=C LANG=C
PROD_URL=$(grep '^DATABASE_URL=' .env.prod.local | sed 's/^DATABASE_URL=//; s/^"//; s/"$//')
PGSSLMODE=require pg_dump "$PROD_URL" --no-owner --no-privileges -Fc -f /tmp/prox_prod.dump
dropdb prox_dev; createdb prox_dev
pg_restore --no-owner --no-privileges -d prox_dev /tmp/prox_prod.dump
```

## env ファイル（すべて git 管理外）

- `.env` … Prisma CLI と既定実行が読む。**安全のためローカル `prox_dev` を指す**（誤って本番スキーマを変更しないため）。
- `.env.local` … `npm run dev`（開発）。ローカルDB + `RELEASE_MODE=full` + 各種シークレット。
- `.env.prod.local` … `npm run dev:prod`（本番ミラー）。本番DB + `RELEASE_MODE=mvp` + `NEXT_DIST_DIR=.next-prod`。

## 本番デプロイ（Vercel）

プラットフォームの環境変数に **`RELEASE_MODE=mvp`** を設定すること（DATABASE_URL は本番のまま）。これでデプロイ版もMVP表示になる。

## 重要メモ

- ローカルは 2026-06-22 に `origin/main`（本番=Vercel `sns-auto-saas.vercel.app`）へ同期した。同期前の作業は git ブランチ `backup/pre-sync-20260622` に退避済み。
- アカウント切替のフルリロード・歯車アイコン・認証フィールド編集ロック等は**本番コードに既存**（このメモのゲーティングとは別）。
- `npm install` は package-lock に linux 固定の `lightningcss-linux-x64-gnu` が混ざっており macOS でこけることがある。env 切替には外部CLIを使わず自前の [scripts/with-env.mjs](scripts/with-env.mjs) を使用。
