import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { TwitterApi } from "twitter-api-v2";

// 指定 @username の公開ポストを X API 経由で取得し、エンゲージメント最大のものを
// 既存の repurpose エンジンに投げて「型と感情」を抽出 → 自社テーマに置き換えた
// オリジナル投稿案を3つ返す。
//
// X 規約コンプライアンス上の注意:
//   - スクレイピングは禁止。公式の X API (twitter-api-v2) のみ使用する。
//   - 取得した他人のツイート本文は DB に永続化しない（メモリ上でのみ処理）。
//   - 出力は「構造」を参考にした独自コンテンツで、元ツイートをそのまま再投稿しない。
//   - ユーザー本人の BYOK キーで認証する（自分のレートリミット内で動作）。
export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const user = await prisma.user.findUnique({
            where: { email: session.user.email }
        });
        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        const data = await req.json();
        let username: unknown = data?.username;
        if (typeof username !== "string" || !username.trim()) {
            return NextResponse.json({ error: "@ユーザー名を入力してください" }, { status: 400 });
        }

        // 先頭 @ を除去し、X のユーザー名規則（英数字と _、最大15文字）で検証
        const normalized = username.replace(/^@/, "").trim();
        if (!/^[A-Za-z0-9_]{1,15}$/.test(normalized)) {
            return NextResponse.json({ error: "ユーザー名の形式が正しくありません（英数字と_のみ、最大15文字）" }, { status: 400 });
        }

        const settings = await prisma.settings.findUnique({
            where: { userId: user.id }
        });

        if (!settings) {
            return NextResponse.json({ error: "設定情報が見つかりません。設定画面からターゲットやコンセプトを登録してください。" }, { status: 400 });
        }

        if (!settings.xApiKey || !settings.xApiSecret || !settings.xAccessToken || !settings.xAccessSecret) {
            return NextResponse.json({ error: "X API キーが未登録です。設定画面で BYOK キーを保存してください。" }, { status: 400 });
        }

        const client = new TwitterApi({
            appKey: settings.xApiKey,
            appSecret: settings.xApiSecret,
            accessToken: settings.xAccessToken,
            accessSecret: settings.xAccessSecret,
        });

        // username → userId の解決
        let targetUserId: string;
        let displayName: string;
        try {
            const lookup = await client.v2.userByUsername(normalized);
            if (!lookup.data?.id) {
                return NextResponse.json({ error: "指定されたアカウントが見つかりません" }, { status: 404 });
            }
            targetUserId = lookup.data.id;
            displayName = lookup.data.name || normalized;
        } catch (err: unknown) {
            console.error("X user lookup error:", err);
            const msg = (err as { data?: { title?: string } })?.data?.title || "ユーザー情報の取得に失敗しました";
            return NextResponse.json({ error: `X API エラー: ${msg}（X API の利用枠・キー権限をご確認ください）` }, { status: 502 });
        }

        // 最近の公開ポスト（リツイート/リプライを除外）を取得
        type TweetRow = { text: string; likes: number; retweets: number; impressions: number };
        let tweets: TweetRow[] = [];
        try {
            const timeline = await client.v2.userTimeline(targetUserId, {
                max_results: 10,
                exclude: ["retweets", "replies"],
                "tweet.fields": ["public_metrics", "created_at"]
            });
            const raw = timeline.data?.data || [];
            tweets = raw
                .filter((t: { text?: string }) => typeof t.text === "string" && t.text.length > 0)
                .map((t: { text: string; public_metrics?: { like_count?: number; retweet_count?: number; impression_count?: number } }) => ({
                    text: t.text,
                    likes: t.public_metrics?.like_count ?? 0,
                    retweets: t.public_metrics?.retweet_count ?? 0,
                    impressions: t.public_metrics?.impression_count ?? 0,
                }));
        } catch (err: unknown) {
            console.error("X timeline fetch error:", err);
            const msg = (err as { data?: { title?: string } })?.data?.title || "投稿の取得に失敗しました";
            return NextResponse.json({ error: `X API エラー: ${msg}（非公開アカウント、もしくは read 権限/レート制限の可能性があります）` }, { status: 502 });
        }

        if (tweets.length === 0) {
            return NextResponse.json({ error: "このアカウントから取得できる公開ポストがありません" }, { status: 404 });
        }

        // エンゲージメントが最大のものを選出（リツイート重み付け）
        const best = tweets.slice().sort((a, b) =>
            (b.likes + b.retweets * 2) - (a.likes + a.retweets * 2)
        )[0];

        // 既存の repurpose エンジンに投入
        const engineUrl = process.env.AI_ENGINE_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
        try {
            const response = await fetch(`${engineUrl}/api/repurpose_post`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    source_post_text: best.text,
                    target_audience: settings.targetAudience || "",
                    target_pain: settings.targetPain || "",
                    account_concept: settings.accountConcept || "",
                    profile: settings.profile || ""
                }),
                signal: AbortSignal.timeout(30000),
            });

            if (!response.ok) {
                throw new Error(`AIエンジン応答エラー (${response.status})`);
            }

            const aiData = await response.json();
            return NextResponse.json({
                ...aiData,
                _source_username: `@${normalized}`,
                _source_display_name: displayName,
                _source_metrics: { likes: best.likes, retweets: best.retweets, impressions: best.impressions },
            });
        } catch (fetchError: unknown) {
            // FastAPI接続失敗時のフォールバック（テンプレート生成）
            console.warn("FastAPI unreachable, returning fallback:", fetchError);
            return NextResponse.json({
                extracted_format: "【オフライン分析】冒頭フック → 理由の展開 → 行動を促すCTA の三段構成",
                extracted_emotion: "知的好奇心 × 危機感",
                generated_posts: [
                    `${settings.targetPain || "集客"}に悩む${settings.targetAudience || "あなた"}へ。\n実はこの構造を真似するだけでインプレッションは3倍になります。\n\n具体的には...\n1. 冒頭で常識を否定する\n2. データで裏付ける\n3. 明確なアクションを示す\n\n保存して今日から実践してください。`,
                    `「まだその方法で消耗してるの？」\n\n${settings.targetAudience || "多くの人"}が見落としている事実があります。\n${settings.accountConcept || "ビジネス"}の掛け合わせで成果が出る人と出ない人の差はたった1つ。\n\nそれは...（続きはプロフへ）`,
                    `【警告】${settings.targetPain || "SNS集客"}で最もやってはいけないこと\n\nそれは「毎日投稿すること」です。\n\nえ？と思った方、正解です。\n大事なのは頻度ではなく"構造"。\n\n${settings.profile || "プロ"}が使う具体的な構造を公開します👇`,
                ],
                _fallback: true,
                _source_username: `@${normalized}`,
                _source_display_name: displayName,
                _source_metrics: { likes: best.likes, retweets: best.retweets, impressions: best.impressions },
                _message: "AIエンジン(FastAPI)に接続できなかったため、テンプレートベースで生成しました。"
            });
        }
    } catch (error) {
        console.error("Research Account API Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
