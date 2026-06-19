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
マネタイズ用(任意): `NEXT_PUBLIC_PROLINE_URL` / `NEXT_PUBLIC_PROLINE_DIRECT_URL`。
オーナーのProLineアフィリリンク(`https://q169hcpg.proline.blog`)はコードに焼き込み済みのため通常は設定不要。別リンクに差し替える場合のみ指定する。

---

## 本番デプロイ手順（ローカル → 本番）

> ⚠️ **DBが最大の注意点。** 本プロジェクトは以前 `prisma db push` 運用で、本番DBに
> マイグレーション履歴テーブル(`_prisma_migrations`)が無い可能性がある。
> 既存テーブルがある本番DBへ初回 `migrate deploy` をそのまま実行すると「テーブルが既に存在する」で失敗する。
> 下記の **baseline** 手順を必ず踏むこと。

### A. Next.js（Vercel）
1. Vercel の Environment Variables に `.env.example` の必須キーを登録（`NEXTAUTH_URL` は本番ドメイン）。
2. **DBマイグレーションの整合**（ローカルから本番 `DATABASE_URL` を指定して実行）:
   ```bash
   # 現状確認
   DATABASE_URL="<本番>" npm run db:status

   # ケース1: 本番DBが空 → そのまま適用
   DATABASE_URL="<本番>" npm run db:deploy

   # ケース2: 本番DBに既にテーブルがある（履歴なし）→ 初回マイグレーションを「適用済み」として登録
   DATABASE_URL="<本番>" npm run db:baseline   # 20260618120904_init を applied 扱いに
   DATABASE_URL="<本番>" npm run db:deploy      # 以降の差分のみ適用
   ```
   > スキーマに差分がある場合は事前に `prisma migrate diff` で確認し、必要なら新規マイグレーションを作成する。
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
