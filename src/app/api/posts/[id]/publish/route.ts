import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTwitterClient } from "@/lib/twitter";
import { join } from "path";

export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    const session = await getServerSession(authOptions);

    if (!session || !session.user || !session.user.email) {
        return NextResponse.json({ message: "認証が必要です" }, { status: 401 });
    }

    try {
        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
            include: { settings: true, accounts: true }
        });

        if (!user) {
            return NextResponse.json({ message: "ユーザーが見つかりません" }, { status: 404 });
        }

        const dbForPost = prisma as any;
        const post = await dbForPost.post.findUnique({
            where: { id: params.id }
        });

        if (!post || post.userId !== user.id) {
            return NextResponse.json({ message: "投稿が見つからないか、権限がありません" }, { status: 404 });
        }

        if (post.status === "PUBLISHED") {
            return NextResponse.json({ message: "すでに投稿済みです" }, { status: 400 });
        }

        // 共通Twitterクライアント（OAuthトークンリフレッシュ対応）を取得
        let client;
        try {
            client = await getTwitterClient(user.id);
        } catch (error: any) {
            return NextResponse.json({ message: error.message || "X(Twitter)アカウントの連携エラー" }, { status: 400 });
        }

        // 実際にポストする
        const rwClient = client.readWrite;
        console.log(`Sending tweet for user ${session.user.email}: ${post.content.substring(0, 20)}...`);

        // 1. メディア（画像）のアップロード処理
        let mediaIds: string[] = [];
        if (post.mediaUrls) {
            try {
                const urls = JSON.parse(post.mediaUrls);
                if (Array.isArray(urls) && urls.length > 0) {
                    console.log(`Uploading ${urls.length} media files...`);
                    for (const url of urls) {
                        // URL (例: /uploads/abc.jpg) からローカル絶対パスを構築
                        const filePath = join(process.cwd(), "public", url);
                        // v1 API でメディアをアップロードし、media_id を取得
                        const mediaId = await client.v1.uploadMedia(filePath);
                        mediaIds.push(mediaId);
                    }
                }
            } catch (mediaError) {
                console.error("Media upload failed:", mediaError);
                // 画像取得に失敗してもテキストだけで投稿を続行するかは要検討だが、SaaSとしては処理を継続する
            }
        }

        // 2. 親投稿を送信
        let tweetResponse;
        if (mediaIds.length > 0) {
            tweetResponse = await rwClient.v2.tweet({
                text: post.content,
                media: { media_ids: mediaIds as any }
            });
        } else {
            tweetResponse = await rwClient.v2.tweet(post.content);
        }

        const rootTweetId = tweetResponse.data.id;
        let lastTweetId = rootTweetId;

        // 3. ツリー投稿（スレッド）があれば順次ぶら下げていく
        if (post.threadContents) {
            try {
                const threads = JSON.parse(post.threadContents);
                if (Array.isArray(threads) && threads.length > 0) {
                    console.log(`Publishing ${threads.length} thread posts...`);
                    for (const text of threads) {
                        if (!text.trim()) continue;

                        // X APIのRateLimit対策で1アクション毎に1秒待つ
                        await new Promise(resolve => setTimeout(resolve, 1000));

                        // 前回のツイートIDに対してリプライを送る形でツリー化する
                        const replyRes = await rwClient.v2.reply(text, lastTweetId);
                        lastTweetId = replyRes.data.id;
                    }
                }
            } catch (threadError) {
                console.error("Failed to post thread contents:", threadError);
                // スレッド投稿のみ失敗した場合はメインエラーにはしない
            }
        }

        // 3. 成功した場合、DBのステータスとIDを更新
        const db = prisma as any;
        const updatedPost = await db.post.update({
            where: { id: post.id },
            data: {
                status: "PUBLISHED",
                scheduledAt: new Date(),   // 実際に投稿された時刻
                postedTweetId: rootTweetId // インプレッション監視・URL連携用
            }
        });

        return NextResponse.json({ success: true, tweetId: rootTweetId, post: updatedPost });

    } catch (error: any) {
        console.error("X API Publish Error:", error);

        let errorMessage = "X(Twitter)への投稿中にエラーが発生しました。APIキーに間違いがないか確認してください。";
        // Twitter API特有のエラーメッセージがあれば付与する
        if (error.code && error.data && error.data.detail) {
            errorMessage += `\n詳細: ${error.data.detail}`;
        }

        return NextResponse.json({ message: errorMessage }, { status: 500 });
    }
}
