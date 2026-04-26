import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

        const posts = await prisma.post.findMany({
            where: { userId: user.id },
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

        const post = await prisma.post.create({
            data: {
                userId: user.id,
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

        return NextResponse.json(post);
    } catch (error) {
        console.error("Posts POST error:", error);
        return NextResponse.json({ message: "サーバーエラー" }, { status: 500 });
    }
}
