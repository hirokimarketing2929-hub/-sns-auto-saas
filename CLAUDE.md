@AGENTS.md

# SNS Auto SaaS プロジェクト

## 概要
X(Twitter)投稿の自動化・スケジューリングSaaS

## 技術スタック
- Next.js 16 / React 19 / TypeScript
- Prisma + Supabase
- NextAuth認証
- Twitter API v2
- TailwindCSS

## アサインエージェント

### SaaS開発部門
- agents/01_saas開発/テックリード.md
- agents/01_saas開発/フロントエンドエンジニア.md
- agents/01_saas開発/バックエンドエンジニア.md
- agents/01_saas開発/QAテスター.md
- agents/01_saas開発/UIUXデザイナー.md
- agents/01_saas開発/DevOpsエンジニア.md
- agents/01_saas開発/DBエンジニア.md

### Xマーケティング部門（機能要件の参考）
- agents/02_xマーケ/KPI目標設定分析担当.md

## 開発ルール
- Prismaスキーマ変更時は必ずマイグレーション作成
- Twitter API のレート制限に注意
- 認証フローはNextAuth経由で統一
