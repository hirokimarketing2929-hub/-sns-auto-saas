import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { TwitterApi } from "twitter-api-v2";
import { logXApiUsage } from "@/lib/api-usage";

// 入力は @username もしくは X (Twitter) のポスト URL のいずれか。
//   - URL の場合: `/status/<id>` を抽出して該当ポストを単体取得
//   - @username の場合: 最近の公開ポストを取得し、エンゲージメント最大の1件を返す
// AI による書き換え処理はしない（フロントから別途 /api/research/repurpose を呼ぶ2段階フロー）。
//
// X 規約コンプライアンス:
//   - 公式 X API (twitter-api-v2) のみ使用、スクレイピングなし
//   - 取得テキストは DB に永続化しない
//   - 本 API は「取得 + 公開メトリクス参照」のみ。AI 学習・再配布には使わない前提
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
        const rawInput: unknown = data?.input;
        if (typeof rawInput !== "string" || !rawInput.trim()) {
            return NextResponse.json({ error: "@ユーザー名または投稿 URL を入力してください" }, { status: 400 });
        }

        const settings = await prisma.settings.findUnique({
            where: { userId: user.id }
        });
        if (!settings || !settings.xApiKey || !settings.xApiSecret || !settings.xAccessToken || !settings.xAccessSecret) {
            return NextResponse.json({ error: "X API キーが未登録です。設定画面で BYOK キーを保存してください。" }, { status: 400 });
        }

        const client = new TwitterApi({
            appKey: settings.xApiKey,
            appSecret: settings.xApiSecret,
            accessToken: settings.xAccessToken,
            accessSecret: settings.xAccessSecret,
        });

        // 入力判定：URL 優先（/status/<数字> を含めば URL とみなす）
        const input = rawInput.trim();
        const tweetIdMatch = input.match(/\/status(?:es)?\/(\d{5,25})/);

        if (tweetIdMatch) {
            // ---- URL 入力 ----
            const tweetId = tweetIdMatch[1];
            try {
                const resp = await client.v2.singleTweet(tweetId, {
                    // note_tweet: X Premium の長文ポスト（280字超）の完全版本文を取得
                    "tweet.fields": ["public_metrics", "created_at", "author_id", "note_tweet"],
                    expansions: ["author_id"],
                    "user.fields": ["username", "name"],
                });

                // X API 使用量ログ（レートリミット情報付き）
                const rl = (resp as unknown as { rateLimit?: { limit?: number; remaining?: number; reset?: number } }).rateLimit;
                await logXApiUsage({
                    userId: user.id,
                    operation: "x-single-tweet",
                    rateLimit: rl,
                });

                const tweet = resp.data as unknown as {
                    id: string;
                    text: string;
                    created_at?: string;
                    note_tweet?: { text?: string };
                    public_metrics?: {
                        like_count?: number;
                        retweet_count?: number;
                        reply_count?: number;
                        quote_count?: number;
                        impression_count?: number;
                        bookmark_count?: number;
                    };
                } | undefined;

                if (!tweet?.text) {
                    return NextResponse.json({ error: "対象のポストが取得できません（削除済み・非公開の可能性）" }, { status: 404 });
                }

                // 長文ポストの完全版があればそちらを優先（通常 ~280 字、長文は数千字可）
                const fullText = tweet.note_tweet?.text?.trim() || tweet.text;

                const authorFromIncludes = (resp.includes?.users || [])[0] as { username?: string; name?: string } | undefined;

                return NextResponse.json({
                    text: fullText,
                    author: {
                        username: authorFromIncludes?.username ? `@${authorFromIncludes.username}` : null,
                        displayName: authorFromIncludes?.name || null,
                    },
                    metrics: {
                        likes: tweet.public_metrics?.like_count ?? 0,
                        retweets: tweet.public_metrics?.retweet_count ?? 0,
                        replies: tweet.public_metrics?.reply_count ?? 0,
                        quotes: tweet.public_metrics?.quote_count ?? 0,
                        // impression_count は自分のポスト以外では返らないことが多い
                        impressions: tweet.public_metrics?.impression_count ?? null,
                    },
                    tweetUrl: authorFromIncludes?.username
                        ? `https://x.com/${authorFromIncludes.username}/status/${tweet.id}`
                        : null,
                    createdAt: tweet.created_at ?? null,
                    mode: "url",
                });
            } catch (err: unknown) {
                console.error("X single tweet error:", err);
                const msg = (err as { data?: { title?: string } })?.data?.title || "ポスト取得に失敗しました";
                return NextResponse.json({ error: `X API エラー: ${msg}（キー権限・レート制限・プランをご確認ください）` }, { status: 502 });
            }
        }

        // ---- @username 入力 ----
        const normalized = input.replace(/^@/, "").trim();
        if (!/^[A-Za-z0-9_]{1,15}$/.test(normalized)) {
            return NextResponse.json({ error: "ユーザー名の形式が正しくありません（英数字と _ のみ、最大15文字）。または投稿 URL を貼り付けてください。" }, { status: 400 });
        }

        let targetUserId: string;
        let displayName: string;
        try {
            const lookup = await client.v2.userByUsername(normalized);
            const rl = (lookup as unknown as { rateLimit?: { limit?: number; remaining?: number; reset?: number } }).rateLimit;
            await logXApiUsage({ userId: user.id, operation: "x-user-by-username", rateLimit: rl });
            if (!lookup.data?.id) {
                return NextResponse.json({ error: "指定されたアカウントが見つかりません" }, { status: 404 });
            }
            targetUserId = lookup.data.id;
            displayName = lookup.data.name || normalized;
        } catch (err: unknown) {
            console.error("X user lookup error:", err);
            const msg = (err as { data?: { title?: string } })?.data?.title || "ユーザー情報の取得に失敗しました";
            return NextResponse.json({ error: `X API エラー: ${msg}（キー権限・プラン・レート制限をご確認ください）` }, { status: 502 });
        }

        type TweetRow = { id: string; text: string; likes: number; retweets: number; replies: number; quotes: number; impressions: number | null };
        let tweets: TweetRow[] = [];
        try {
            const timeline = await client.v2.userTimeline(targetUserId, {
                max_results: 10,
                exclude: ["retweets", "replies"],
                // note_tweet: X Premium の長文ポスト（280字超）の完全版本文を取得
                "tweet.fields": ["public_metrics", "created_at", "note_tweet"]
            });
            const rl = (timeline as unknown as { rateLimit?: { limit?: number; remaining?: number; reset?: number } }).rateLimit;
            await logXApiUsage({ userId: user.id, operation: "x-user-timeline", rateLimit: rl });
            const raw = timeline.data?.data || [];
            tweets = raw
                .filter((t: { text?: string }) => typeof t.text === "string" && t.text.length > 0)
                .map((t: {
                    id: string;
                    text: string;
                    note_tweet?: { text?: string };
                    public_metrics?: { like_count?: number; retweet_count?: number; reply_count?: number; quote_count?: number; impression_count?: number };
                }) => ({
                    id: t.id,
                    // 長文ポストの完全版があればそれを優先
                    text: t.note_tweet?.text?.trim() || t.text,
                    likes: t.public_metrics?.like_count ?? 0,
                    retweets: t.public_metrics?.retweet_count ?? 0,
                    replies: t.public_metrics?.reply_count ?? 0,
                    quotes: t.public_metrics?.quote_count ?? 0,
                    impressions: t.public_metrics?.impression_count ?? null,
                }));
        } catch (err: unknown) {
            console.error("X timeline fetch error:", err);
            const msg = (err as { data?: { title?: string } })?.data?.title || "タイムライン取得に失敗しました";
            return NextResponse.json({ error: `X API エラー: ${msg}（非公開アカウント・プラン不足・レート制限の可能性があります）` }, { status: 502 });
        }

        if (tweets.length === 0) {
            return NextResponse.json({ error: "このアカウントから取得できる公開ポストがありません" }, { status: 404 });
        }

        // エンゲージメント最大のポストを選出（RTを重く評価）
        const best = tweets.slice().sort((a, b) =>
            (b.likes + b.retweets * 2) - (a.likes + a.retweets * 2)
        )[0];

        return NextResponse.json({
            text: best.text,
            author: {
                username: `@${normalized}`,
                displayName,
            },
            metrics: {
                likes: best.likes,
                retweets: best.retweets,
                replies: best.replies,
                quotes: best.quotes,
                impressions: best.impressions,
            },
            tweetUrl: `https://x.com/${normalized}/status/${best.id}`,
            createdAt: null,
            mode: "username",
        });
    } catch (error) {
        console.error("fetch-post API Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
