import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { TwitterApi } from "twitter-api-v2";

export async function GET(req: Request) {
    try {
        console.log("Starting scheduled posts publish cron job...");

        const now = new Date();

        // SCHEDULEDステータスで、scheduledAtが現在時刻以前の投稿を取得
        const postsToPublish = await prisma.post.findMany({
            where: {
                status: "SCHEDULED",
                scheduledAt: {
                    lte: now
                }
            },
            include: {
                user: {
                    include: {
                        settings: true,
                        accounts: true
                    }
                }
            }
        });

        console.log(`Found ${postsToPublish.length} posts to publish.`);

        const results = [];

        for (const post of postsToPublish) {
            try {
                const user = post.user;
                const settings = user.settings;

                if (!settings) {
                    throw new Error("ユーザー設定が見つかりません");
                }

                let twitterClient: TwitterApi | null = null;

                // --- X API クライアント初期化 (posts/[id]/publish/route.ts と同等) ---
                if (settings.xAccessToken && settings.xAccessSecret) {
                    twitterClient = new TwitterApi({
                        appKey: settings.xApiKey || "",
                        appSecret: settings.xApiSecret || "",
                        accessToken: settings.xAccessToken,
                        accessSecret: settings.xAccessSecret,
                    });
                } else if (user.accounts && user.accounts.length > 0) {
                    const twitterAccount = user.accounts.find((a: { provider: string }) => a.provider === "twitter");
                    if (twitterAccount && twitterAccount.access_token) {
                        twitterClient = new TwitterApi(twitterAccount.access_token);
                    }
                }

                if (!twitterClient) {
                    throw new Error("X API連携設定がないため投稿できません。");
                }

                let mediaIds: string[] = [];
                const attachedImages = post.mediaUrls ? JSON.parse(post.mediaUrls) : [];

                // 1. 画像アップロード処理
                if (attachedImages.length > 0) {
                    for (const url of attachedImages) {
                        try {
                            const absoluteUrl = url.startsWith('http') ? url : `http://localhost:3000${url}`;
                            const imgRes = await fetch(absoluteUrl);
                            if (!imgRes.ok) throw new Error(`Failed to fetch image: ${imgRes.statusText}`);

                            const buffer = Buffer.from(await imgRes.arrayBuffer());

                            const mimeType = imgRes.headers.get('content-type') || 'image/jpeg';
                            const mediaId = await twitterClient.v1.uploadMedia(buffer, { mimeType });
                            mediaIds.push(mediaId);

                            await new Promise(resolve => setTimeout(resolve, 1000));
                        } catch (imgUploadErr: any) {
                            console.error(`Media upload error for image ${url}:`, imgUploadErr);
                        }
                    }
                }

                // 2. ツイート処理
                const threadContents = post.threadContents ? JSON.parse(post.threadContents) : [];
                let firstTweetId = null;

                if (threadContents.length === 0) {
                    // 単発ツイート
                    const tweetPayload: any = { text: post.content };
                    if (mediaIds.length > 0) {
                        tweetPayload.media = { media_ids: mediaIds };
                    }
                    const response = await twitterClient.v2.tweet(tweetPayload);
                    firstTweetId = response.data.id;
                } else {
                    // ツリー（スレッド）ツイート
                    const tweetsPayload = [];

                    const firstPayload: any = { text: post.content };
                    if (mediaIds.length > 0) {
                        firstPayload.media = { media_ids: mediaIds };
                    }
                    tweetsPayload.push(firstPayload);

                    for (const t of threadContents) {
                        if (t && t.trim() !== '') {
                            tweetsPayload.push({ text: t });
                        }
                    }

                    const threadResponse = await twitterClient.v2.tweetThread(tweetsPayload);
                    if (threadResponse && threadResponse.length > 0) {
                        firstTweetId = threadResponse[0].data.id;
                    }
                }

                // 3. DB更新
                await prisma.post.update({
                    where: { id: post.id },
                    data: {
                        status: "PUBLISHED",
                        postedTweetId: firstTweetId,
                        updatedAt: new Date()
                    }
                });

                results.push({ id: post.id, status: "success", tweetId: firstTweetId });
                console.log(`Successfully published post ${post.id}`);

            } catch (err: any) {
                console.error(`Failed to publish post ${post.id}:`, err);
                // エラー時はステータスを戻すわけではないが、ログに残す
                results.push({ id: post.id, status: "error", error: err.message });
            }
        }

        return NextResponse.json({
            message: "Cron job completed",
            processed: postsToPublish.length,
            results
        });

    } catch (error: any) {
        console.error("Publish cron job error:", error);
        return NextResponse.json({ message: "サーバーエラー", error: error.message }, { status: 500 });
    }
}
