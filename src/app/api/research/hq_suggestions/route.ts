import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Fetch HQ Knowledge base items
        // In a real app with large data, we would random sample properly.
        // For MVP, fetch recent ones, shuffle them in memory, and return 3.
        const hqKnowledgeItems = await prisma.knowledge.findMany({
            where: { isSharedToHQ: true },
            orderBy: { createdAt: "desc" },
            take: 20
        });

        if (!hqKnowledgeItems || hqKnowledgeItems.length === 0) {
            return NextResponse.json({ suggestions: [] });
        }

        // Fisher-Yates shuffle
        for (let i = hqKnowledgeItems.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [hqKnowledgeItems[i], hqKnowledgeItems[j]] = [hqKnowledgeItems[j], hqKnowledgeItems[i]];
        }

        const suggestions = hqKnowledgeItems.slice(0, 3).map((k: { id: string; category: string | null; type: string; content: string; source: string | null }) => ({
            id: k.id,
            category: k.category || "不明の型",
            type: k.type,
            content: k.content,
            source: k.source || "本部ナレッジ"
        }));

        return NextResponse.json({ suggestions });

    } catch (error) {
        console.error("HQ Suggestions API Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
