import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await getServerSession(authOptions);

    if (!session || !session.user || !session.user.email) {
        return NextResponse.json({ message: "認証が必要です" }, { status: 401 });
    }

    try {
        const data = await req.json();
        const user = await prisma.user.findUnique({
            where: { email: session.user.email }
        });

        if (!user) return NextResponse.json({ message: "User not found" }, { status: 404 });

        const resolvedParams = await params;
        const postId = resolvedParams.id;

        const post = await prisma.post.findUnique({
            where: { id: postId }
        });

        if (!post || post.userId !== user.id) {
            return NextResponse.json({ message: "Post not found or unauthorized" }, { status: 404 });
        }

        // 投稿済みは編集不可
        if (post.status === "PUBLISHED") {
            return NextResponse.json({ message: "投稿済みのため編集できません" }, { status: 400 });
        }

        // 更新用のデータを動的に構築（指定されたフィールドのみ更新）
        const updateData: Record<string, unknown> = {};

        // --- 予約日時（従来機能を維持） ---
        // 呼び出し元が scheduledAt を明示的に送ってきた場合のみ、スケジュール更新とみなす
        // （content だけの編集時に status が意図せず変わらないようにする）
        if (Object.prototype.hasOwnProperty.call(data, "scheduledAt")) {
            const scheduledAt = data.scheduledAt ? new Date(data.scheduledAt) : null;
            updateData.scheduledAt = scheduledAt;
            updateData.status = scheduledAt ? "SCHEDULED" : "DRAFT";
        }

        // --- 投稿本文 ---
        if (typeof data.content === "string") {
            const trimmed = data.content.trim();
            if (trimmed.length === 0) {
                return NextResponse.json({ message: "投稿本文は必須です" }, { status: 400 });
            }
            updateData.content = data.content;
        }

        // --- スレッドスタイル（chain / impression_triggered） ---
        if (Object.prototype.hasOwnProperty.call(data, "threadStyle")) {
            updateData.threadStyle = data.threadStyle === "impression_triggered" ? "impression_triggered" : "chain";
        }

        // --- スレッド投稿（配列を渡す想定。未指定なら触らない） ---
        if (Object.prototype.hasOwnProperty.call(data, "threadContents")) {
            if (data.threadContents === null) {
                updateData.threadContents = null;
            } else if (Array.isArray(data.threadContents)) {
                // 空文字だけのエントリは除外
                const filtered = data.threadContents
                    .filter((t: unknown): t is string => typeof t === "string")
                    .map((t: string) => t)
                    .filter((t: string) => t.trim().length > 0);
                updateData.threadContents = filtered.length > 0 ? JSON.stringify(filtered) : null;
            } else {
                return NextResponse.json({ message: "threadContents は配列で指定してください" }, { status: 400 });
            }
        }

        // --- メディアURL（配列を渡す想定。未指定なら触らない） ---
        if (Object.prototype.hasOwnProperty.call(data, "mediaUrls")) {
            if (data.mediaUrls === null) {
                updateData.mediaUrls = null;
            } else if (Array.isArray(data.mediaUrls)) {
                const filtered = data.mediaUrls
                    .filter((u: unknown): u is string => typeof u === "string")
                    .filter((u: string) => u.trim().length > 0);
                updateData.mediaUrls = filtered.length > 0 ? JSON.stringify(filtered) : null;
            } else {
                return NextResponse.json({ message: "mediaUrls は配列で指定してください" }, { status: 400 });
            }
        }

        // --- インプレッション連動 ---
        if (Object.prototype.hasOwnProperty.call(data, "impressionTarget")) {
            if (data.impressionTarget === null || data.impressionTarget === "") {
                updateData.impressionTarget = null;
            } else {
                const n = Number(data.impressionTarget);
                if (!Number.isFinite(n) || n < 0) {
                    return NextResponse.json({ message: "impressionTarget は0以上の数値で指定してください" }, { status: 400 });
                }
                updateData.impressionTarget = Math.floor(n);
            }
        }

        if (Object.prototype.hasOwnProperty.call(data, "impressionReplyContent")) {
            updateData.impressionReplyContent =
                typeof data.impressionReplyContent === "string" && data.impressionReplyContent.trim().length > 0
                    ? data.impressionReplyContent
                    : null;
        }

        // 送信前に未送信フラグをリセット（閾値やリプライ内容を編集した場合に備え）
        if (
            Object.prototype.hasOwnProperty.call(updateData, "impressionTarget") ||
            Object.prototype.hasOwnProperty.call(updateData, "impressionReplyContent")
        ) {
            updateData.isImpressionReplySent = false;
        }

        if (Object.keys(updateData).length === 0) {
            return NextResponse.json({ message: "更新対象のフィールドが指定されていません" }, { status: 400 });
        }

        const updatedPost = await prisma.post.update({
            where: { id: postId },
            data: updateData
        });

        return NextResponse.json(updatedPost);
    } catch (error) {
        console.error("Posts PUT error:", error);
        return NextResponse.json({ message: "サーバーエラー" }, { status: 500 });
    }
}
