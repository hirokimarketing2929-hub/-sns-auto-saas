import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { writeFile } from "fs/promises";
import { join } from "path";
import { v4 as uuidv4 } from "uuid";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
    const session = await getServerSession(authOptions);

    if (!session || !session.user || !session.user.email) {
        return NextResponse.json({ message: "認証が必要です" }, { status: 401 });
    }

    try {
        const formData = await req.formData();
        const file = formData.get("file") as File;

        if (!file) {
            return NextResponse.json({ message: "ファイルが見つかりません" }, { status: 400 });
        }

        // 拡張子の取得とファイル名の生成
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        const fileSize = buffer.length;

        // ユーザー情報を取得して容量チェック
        const db = prisma as any;
        const user = await db.user.findUnique({
            where: { email: session.user.email }
        });

        if (!user) {
            return NextResponse.json({ message: "ユーザーが見つかりません" }, { status: 404 });
        }

        if (user.usedStorage + fileSize > user.maxStorage) {
            return NextResponse.json({
                message: `保存容量の上限（${Math.round(user.maxStorage / 1024 / 1024)}MB）に達しました。不要なメディアを削除するか、プランをアップグレードしてください。`
            }, { status: 403 });
        }

        const originalName = file.name;
        const extension = originalName.split('.').pop() || 'png';
        const uniqueFilename = `${uuidv4()}.${extension}`;

        // 保存先のパス (public/uploads/)
        const uploadDir = join(process.cwd(), "public", "uploads");
        const filePath = join(uploadDir, uniqueFilename);

        // ファイルを書き込む
        await writeFile(filePath, buffer);

        // アクセス可能なURLパス
        const url = `/uploads/${uniqueFilename}`;

        // DBにメディア情報を登録し、ユーザーの使用容量を更新
        try {
            await db.$transaction([
                db.media.create({
                    data: {
                        userId: user.id,
                        filename: originalName,
                        url: url,
                        size: fileSize,
                        mimeType: file.type || "application/octet-stream"
                    }
                }),
                db.user.update({
                    where: { id: user.id },
                    data: { usedStorage: { increment: fileSize } }
                })
            ]);
        } catch (dbError) {
            console.error("DB update error after media upload:", dbError);
            return NextResponse.json({ message: "DBへの登録中にエラーが発生しました。", details: String(dbError) }, { status: 500 });
        }

        return NextResponse.json({ success: true, url, filename: originalName, size: fileSize });
    } catch (error) {
        console.error("Upload error:", error);
        return NextResponse.json({ message: "アップロード中にエラーが発生しました", details: String(error) }, { status: 500 });
    }
}
