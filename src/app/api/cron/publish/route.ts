import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api-error";
import { prisma } from "@/lib/prisma";
import { getTwitterClient } from "@/lib/twitter";
import { assertCronAuthorized } from "@/lib/cron-auth";

export async function GET(req: Request) {
    // cron 認証: 全環境で CRON_SECRET 必須（fail-closed・RT-002）。
    const denied = assertCronAuthorized(req);
    if (denied) return denied;

    try {
        console.log("Starting scheduled posts publish cron job...");

        const now = new Date();

        // SCHEDULEDステータスで、scheduledAtが現在時刻以前の投稿を取得
        // multi-account 対応: 各 Post の xAccountId に応じて getTwitterClient で正しい認証を解決する
        const postsToPublish = await prisma.post.findMany({
            where: {
                status: "SCHEDULED",
                scheduledAt: {
                    lte: now
                }
            },
        });

        console.log(`Found ${postsToPublish.length} posts to publish.`);

        const results = [];

        for (const post of postsToPublish) {
            try {
                // 投稿に紐づくサブアカウント(xAccountId)の認証で投稿する（手動投稿と同じ getTwitterClient 経由）。
                // BYOK / OAuth の判定とトークンリフレッシュを内部で行う。
                const twitterClient = await getTwitterClient(post.userId, post.xAccountId ?? undefined);

                let mediaIds: string[] = [];
                const attachedImages = post.mediaUrls ? JSON.parse(post.mediaUrls) : [];

                // 1. 画像アップロード処理
                if (attachedImages.length > 0) {
                    const baseUrl = process.env.NEXT_PUBLIC_API_URL || process.env.NEXTAUTH_URL || "http://localhost:3000";
                    for (const url of attachedImages) {
                        try {
                            const absoluteUrl = url.startsWith('http') ? url : `${baseUrl}${url}`;
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
                //    threadStyle = "chain" は今すぐリプ連鎖でぶら下げ、
                //    "impression_triggered" は元ポストのみ投稿し、続くリプは impressionTarget 到達時に cron/check-impressions が送る
                const threadContents = post.threadContents ? JSON.parse(post.threadContents) : [];
                const threadStyle = (post as { threadStyle?: string }).threadStyle === "impression_triggered" ? "impression_triggered" : "chain";
                const postThreadsNow = threadContents.length > 0 && threadStyle === "chain";
                let firstTweetId = null;

                if (!postThreadsNow) {
                    // 単発 or 遅延投稿モード: 元ポストだけ送る
                    const tweetPayload: any = { text: post.content };
                    if (mediaIds.length > 0) {
                        tweetPayload.media = { media_ids: mediaIds };
                    }
                    const response = await twitterClient.v2.tweet(tweetPayload);
                    firstTweetId = response.data.id;
                } else {
                    // chain モード: 元ポストに続けて今すぐリプ連鎖
                    const firstPayload: any = { text: post.content };
                    if (mediaIds.length > 0) {
                        firstPayload.media = { media_ids: mediaIds };
                    }
                    const rootResp = await twitterClient.v2.tweet(firstPayload);
                    firstTweetId = rootResp.data.id;
                    let lastId = firstTweetId;

                    for (const t of threadContents) {
                        if (!t || t.trim() === '') continue;
                        await new Promise(resolve => setTimeout(resolve, 1000));
                        const replyRes = await twitterClient.v2.reply(t, lastId);
                        lastId = replyRes.data.id;
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
        return errorResponse(error, "サーバーエラーが発生しました", 500, "cron.publish");
    }
}
