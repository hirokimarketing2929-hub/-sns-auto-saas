import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { suggestionHash } from "@/lib/analysis-hash";

// analysis画面で「却下」されたAI提案を永続化する。
// 同じ contentHash が再度送られても upsert で 1 行に保つ（複数回押しても DB は冪等）。

const ALLOWED_TYPES = new Set(["BASE", "TEMPLATE", "WINNING", "LOSING"]);
const ALLOWED_LEVELS = new Set(["tactic", "strategy"]);

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
            select: { id: true },
        });
        if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

        const body = await req.json().catch(() => ({})) as {
            content?: unknown;
            type?: unknown;
            level?: unknown;
        };

        const content = typeof body.content === "string" ? body.content.trim() : "";
        const typeRaw = typeof body.type === "string" ? body.type.toUpperCase() : "";
        const levelRaw = typeof body.level === "string" ? body.level.toLowerCase() : "";

        if (!content) return NextResponse.json({ error: "content required" }, { status: 400 });
        const type = ALLOWED_TYPES.has(typeRaw) ? typeRaw : "WINNING";
        const level = ALLOWED_LEVELS.has(levelRaw) ? levelRaw : "tactic";

        const contentHash = suggestionHash({ content, type, level });
        const contentSnippet = content.slice(0, 200);

        const db = prisma as unknown as {
            rejectedSuggestion: {
                upsert: (args: unknown) => Promise<{ id: string; rejectedAt: Date }>;
            };
        };

        const rec = await db.rejectedSuggestion.upsert({
            where: { userId_contentHash: { userId: user.id, contentHash } },
            update: { rejectedAt: new Date() },
            create: {
                userId: user.id,
                contentHash,
                contentSnippet,
                type,
                level,
            },
        });

        return NextResponse.json({ ok: true, id: rec.id, rejectedAt: rec.rejectedAt });
    } catch (error) {
        console.error("analysis/reject POST error:", error);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
