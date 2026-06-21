# SNS Auto SaaS (ProX)

X(Twitter)投稿の自動化・スケジューリング・分析、ProLine導線によるマネタイズを行う SaaS。

## アーキテクチャ（2サービス構成）

| サービス | 役割 | デプロイ先 | 設定 |
|---|---|---|---|
| **Next.js アプリ** | 本体（UI / API / 認証 / DB / cron） | Vercel | `vercel.json` |
| **Python AIエンジン** (`api/`) | ナレッジ解析・リサーチ・横展開（FastAPI） | Render | `render.yaml` |

Next.js → Python は `AI_ENGINE_URL` で接続する。両方が動いていないとリサーチ/横展開/ナレッジ解析が機能しない。

## 技術スタック
Next.js 16 / React 19 / TypeScript / Prisma + PostgreSQL(Supabase) / NextAuth / Twitter API v2 / TailwindCSS

---

## ローカル開発セットアップ

```bash
# 1. 依存インストール
npm ci

# 2. 環境変数
cp .env.example .env   # 各値を設定（最低限 DATABASE_URL / NEXTAUTH_SECRET / NEXTAUTH_URL）

# 3. DB スキーマ適用（マイグレーション履歴を使う場合）
npm run db:deploy      # = prisma migrate deploy

# 4. 起動
npm run dev            # http://localhost:3000
```

> **フォント取得エラーが出る環境**: `next/font` が Google Fonts を取得できない場合、
> `NEXT_TURBOPACK_EXPERIMENTAL_USE_SYSTEM_TLS_CERTS=1 npm run build` のように起動する。
> （Vercel 本番では不要）

### Python AIエンジン（任意・リサーチ系を使う場合）
```bash
cd api
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
export OPENAI_API_KEY=...      # AIエンジン用
uvicorn main:app --reload --port 8000
```

---

## 環境変数
すべて `.env.example` に記載。必須: `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`,
`TWITTER_CLIENT_ID`, `TWITTER_CLIENT_SECRET`, `ANTHROPIC_API_KEY`, `CRON_SECRET`, `AI_ENGINE_URL`。
本番DBは Render の PostgreSQL（`proxeziento`）。`DATABASE_URL` はその接続文字列。
マネタイズ用(任意): `NEXT_PUBLIC_PROLINE_URL` / `NEXT_PUBLIC_PROLINE_DIRECT_URL`。
オーナーのProLineアフィリリンク(`https://q169hcpg.proline.blog`)はコードに焼き込み済みのため通常は設定不要。別リンクに差し替える場合のみ指定する。

---

## 本番デプロイ手順（ローカル → 本番）

> ⚠️ **DBが最大の注意点。** 本番DBは Render の PostgreSQL（`proxeziento`）で、`prisma db push` 運用のため
> マイグレーション履歴テーブル(`_prisma_migrations`)が無い。`build` は `migrate deploy` を**実行しない**
> （`prisma generate && next build`）ので、スキーマ変更時は下記手順で別途同期する。

### A. Next.js（Vercel）
1. Vercel の Environment Variables に `.env.example` の必須キーを登録（`NEXTAUTH_URL` は本番ドメイン）。
   `DATABASE_URL` は Render の接続文字列。
2. **スキーマに変更がある場合のみ** 同期（ローカルから本番 `DATABASE_URL` を指定）:
   ```bash
   # 差分確認（読み取りのみ）
   DATABASE_URL="<本番>" npx prisma migrate diff --from-url "<本番>" --to-schema-datamodel prisma/schema.prisma --script
   # 既存テーブルへ不足分を反映（非破壊。必要な列のみ追加）
   DATABASE_URL="<本番>" npx prisma db push
   # 自動リプライ列だけを冪等に補完したい場合は下記でも可
   #   psql "<本番>" -f scripts/ensure-autoreply-schema.sql
   ```
3. ブランチを `main` にマージ → Vercel が自動ビルド/デプロイ。
4. cron 疎通確認: `curl -H "Authorization: Bearer $CRON_SECRET" https://<本番>/api/cron/publish` が 200。

### B. Python AIエンジン（Render）
1. `render.yaml` の `prox-agent-api` をデプロイ。Render ダッシュボードで `OPENAI_API_KEY` を設定。
2. デプロイ後の URL を Vercel の `AI_ENGINE_URL` に設定し、Next.js を再デプロイ。
3. `api/main.py` の CORS `allow_origins` に本番ドメインが含まれているか確認。

### C. マルチアカウント移行（旧データがある場合のみ・1回だけ）
本番DBが旧スキーマ（XAccount導入前）からの移行なら、デプロイ後に：
```bash
DATABASE_URL="<本番>" node scripts-migrate-x-accounts.mjs --dry-run   # 確認
DATABASE_URL="<本番>" node scripts-migrate-x-accounts.mjs             # 実行
DATABASE_URL="<本番>" node scripts-migrate-x-account-persona.mjs --dry-run
DATABASE_URL="<本番>" node scripts-migrate-x-account-persona.mjs
```

### D. デプロイ後スモーク
- ログイン（メール / X OAuth）/ 投稿生成 / スケジュール作成 / 設定保存 が動くこと。
- `/dashboard/proline` の最終CTAがアフィリリンクの `/direct`（LINE友だち追加に直行）を指していること。

### E. 自動化(cron)の有効化 — Vercel Hobby の場合は GitHub Actions
予約投稿・自動リプライ・インプレ追撃は cron エンドポイントで実行される：
`/api/cron/publish`, `/api/cron/autoreply`, `/api/cron/check-impressions`（いずれも GET + `Authorization: Bearer $CRON_SECRET`）。

**Vercel Pro** なら `vercel.json` の `crons` に追記すれば毎分実行できる。
**Vercel Hobby（無料）** は cron が「1日1回・最大2個」に制限されるため、リポジトリ同梱の
`.github/workflows/cron.yml`（GitHub Actions・**5分間隔**）で上記3つを定期的に叩く。手順：

1. GitHub リポジトリ → **Settings → Secrets and variables → Actions** で2つ登録：
   - `APP_URL` = 本番URL（例 `https://prox-app.vercel.app`・末尾スラッシュ無し）
   - `CRON_SECRET` = Vercel env の `CRON_SECRET` と**同じ値**
2. リポジトリの **Actions が有効**であること。
3. Actions タブ → 「Scheduled Cron」→ **Run workflow** で手動実行し、ログに各 `-> 200` が出るか確認。

制約: GitHub Actions のスケジュールは最短5分・ベストエフォート（高負荷時遅延・リポジトリ60日無活動で自動停止）。
分単位の正確さが必要なら [cron-job.org](https://cron-job.org)（1分・無料）等で同じ3つのURLを Bearer 付きで叩いてもよい。

#### 1分間隔（cron-job.org）— 精密運用（推奨構成: 1分=cron-job.org / 5分=GitHub Actions 併存）
cron エンドポイントは冪等（`AutoReplyLog` / `status` / `isImpressionReplySent` で二重送信を防止）なので、
cron-job.org(1分) と GitHub Actions(5分) を**両方動かしても二重送信は起きない**（5分側は保険）。

手順（**先に上の GitHub Actions「Run workflow」で各 `-> 200` を確認してから**実施するのが確実。
cron-job.org も同じ `CRON_SECRET`/URL を使うため）:
1. [cron-job.org](https://cron-job.org) に無料登録。
2. 下記3つの **Cronjob を作成**（いずれも **Method: GET**, **実行間隔: every 1 minute**）：
   - `https://<本番>/api/cron/publish`
   - `https://<本番>/api/cron/autoreply`
   - `https://<本番>/api/cron/check-impressions`
3. 各ジョブの **Headers** に `Authorization: Bearer <CRON_SECRET>`（Vercel env と同値）を追加。
4. 数分後、各ジョブの実行履歴が **200**、予約投稿/自動リプライが1分精度で動くことを確認。
