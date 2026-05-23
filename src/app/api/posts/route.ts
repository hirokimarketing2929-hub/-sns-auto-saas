import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getActiveXAccountId } from "@/lib/active-x-account";
import { applyUtmToContent, postCampaignTag } from "@/lib/utm";

export async function GET(req: Request) {
    const session = await getServerSession(authOptions);

    if (!session || !session.user || !session.user.email) {
        return NextResponse.json({ message: "認証が必要です" }, { status: 401 });
    }

    try {
        const user = await prisma.user.findUnique({
            where: { email: session.user.email }
        });

        if (!user) return NextResponse.json({ message: "User not found" }, { status: 404 });

        const xAccountId = await getActiveXAccountId(user.id);

        const posts = await prisma.post.findMany({
            where: { userId: user.id, xAccountId },
            orderBy: { createdAt: 'desc' }
        });

        return NextResponse.json(posts);
    } catch (error) {
        console.error("Posts GET error:", error);
        return NextResponse.json({ message: "サーバーエラー" }, { status: 500 });
    }
}

export async function POST(req: Request) {
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

        // threadContents / mediaUrls は配列で来る場合と JSON 文字列で来る場合を吸収
        const normalizeJsonArrayField = (v: unknown): string | null => {
            if (v === null || v === undefined) return null;
            if (typeof v === "string") {
                const trimmed = v.trim();
                return trimmed.length > 0 ? trimmed : null;
            }
            if (Array.isArray(v)) {
                const filtered = v.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
                return filtered.length > 0 ? JSON.stringify(filtered) : null;
            }
            return null;
        };

        const impressionTarget = (() => {
            const raw = data.impressionTarget;
            if (raw === null || raw === undefined || raw === "") return null;
            const n = Number(raw);
            return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
        })();

        const threadStyle = data.threadStyle === "impression_triggered" ? "impression_triggered" : "chain";

        const xAccountId = await getActiveXAccountId(user.id);

        // CTA URL は投稿先 XAccount から取得（未設定の場合は付与処理スキップ）
        const xAccount = xAccountId
            ? await prisma.xAccount.findUnique({ where: { id: xAccountId }, select: { ctaUrl: true } })
            : null;
        const ctaUrl = xAccount?.ctaUrl ?? null;

        // 一旦そのまま作成して Post.id を得る。スレッド投稿の各セグメントにも CTA URL が含まれ得るので
        // create 後に content と threadContents に UTM を一括付与する。
        const post = await prisma.post.create({
            data: {
                userId: user.id,
                xAccountId,
                content: data.content,
                platform: data.platform || "X",
                status: data.status || "DRAFT",
                scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
                threadContents: normalizeJsonArrayField(data.threadContents),
                threadStyle,
                mediaUrls: normalizeJsonArrayField(data.mediaUrls),
                impressionTarget,
                impressionReplyContent:
                    typeof data.impressionReplyContent === "string" && data.impressionReplyContent.trim().length > 0
                        ? data.impressionReplyContent
                        : null,
            }
        });

        // UTM 後付け: content / threadContents / impressionReplyContent に含まれる CTA URL に
        // utm_source=x & utm_campaign=post_<id> を付与する。CTA URL が未設定なら content は変わらない。
        if (ctaUrl) {
            const utmParams = { utm_source: "x", utm_campaign: postCampaignTag(post.id) };
            const rewrittenContent = applyUtmToContent(post.content, ctaUrl, utmParams);
            let rewrittenThreads: string | null = post.threadContents;
            if (post.threadContents) {
                try {
                    const arr = JSON.parse(post.threadContents);
                    if (Array.isArray(arr)) {
                        const rewritten = arr.map((s: unknown) =>
                            typeof s === "string" ? applyUtmToContent(s, ctaUrl, utmParams) : s
                        );
                        rewrittenThreads = JSON.stringify(rewritten);
                    }
                } catch { /* 不正JSONは触らない */ }
            }
            const rewrittenImpReply = post.impressionReplyContent
                ? applyUtmToContent(post.impressionReplyContent, ctaUrl, utmParams)
                : post.impressionReplyContent;

            const changed =
                rewrittenContent !== post.content ||
                rewrittenThreads !== post.threadContents ||
                rewrittenImpReply !== post.impressionReplyContent;
            if (changed) {
                const updated = await prisma.post.update({
                    where: { id: post.id },
                    data: {
                        content: rewrittenContent,
                        threadContents: rewrittenThreads,
                        impressionReplyContent: rewrittenImpReply,
                    },
                });
                return NextResponse.json(updated);
            }
        }

        return NextResponse.json(post);
    } catch (error) {
        console.error("Posts POST error:", error);
        return NextResponse.json({ message: "サーバーエラー" }, { status: 500 });
    }
}
