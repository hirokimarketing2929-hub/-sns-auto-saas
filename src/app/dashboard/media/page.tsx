"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

export default function MediaLibraryPage() {
    const [mediaItems, setMediaItems] = useState<any[]>([]);
    const [storage, setStorage] = useState<{ used: number; max: number; plan: string } | null>(null);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);

    useEffect(() => {
        fetchMedia();
    }, []);

    const fetchMedia = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/media");
            if (res.ok) {
                const data = await res.json();
                setMediaItems(data.media || []);
                setStorage(data.storage || null);
            }
        } catch (error) {
            console.error("Fetch media error:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        setUploading(true);
        try {
            for (let i = 0; i < files.length; i++) {
                const formData = new FormData();
                formData.append("file", files[i]);

                const res = await fetch("/api/upload", {
                    method: "POST",
                    body: formData,
                });

                if (!res.ok) {
                    const errorData = await res.json();
                    alert(`アップロード失敗: ${errorData.message}\n${errorData.details || ""}`);
                    break; // 容量制限などで失敗した場合はループを抜ける
                }
            }
            // リストと容量を再取得
            await fetchMedia();
            alert("アップロードが完了しました。");
        } catch (error) {
            console.error("Upload error:", error);
            alert("エラーが発生しました。");
        } finally {
            setUploading(false);
            e.target.value = "";
        }
    };

    // バイト数をMBなどの適切なフォーマットに変換
    const formatBytes = (bytes: number) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const dm = 2;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    };

    return (
        <div className="space-y-6 max-w-6xl">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">メディアライブラリ</h1>
                    <p className="text-gray-500 mt-1">アップロードした画像や動画を一括管理します。</p>
                </div>

                <div>
                    <label className="cursor-pointer inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2">
                        {uploading ? "アップロード中..." : "＋ 新規アップロード"}
                        <input
                            type="file"
                            className="hidden"
                            accept="image/*,video/*,application/pdf"
                            multiple
                            onChange={handleFileUpload}
                            disabled={uploading}
                        />
                    </label>
                </div>
            </div>

            {/* ストレージ使用状況ウィジェット */}
            {storage && (
                <Card>
                    <CardHeader className="pb-3">
                        <div className="flex justify-between items-end">
                            <CardTitle className="text-lg">ストレージ使用状況</CardTitle>
                            <span className="text-xs font-bold px-2 py-1 bg-blue-100 text-blue-700 rounded-full">
                                {storage.plan} プラン
                            </span>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="mb-2 flex justify-between text-sm text-gray-600">
                            <span>使用量: {formatBytes(storage.used)}</span>
                            <span>最大: {formatBytes(storage.max)}</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2.5">
                            <div
                                className={`h-2.5 rounded-full ${storage.used / storage.max > 0.9 ? 'bg-red-600' : 'bg-blue-600'}`}
                                style={{ width: `${Math.min((storage.used / storage.max) * 100, 100)}%` }}
                            ></div>
                        </div>
                        <p className="mt-3 text-xs text-gray-500 text-right">
                            {storage.used / storage.max > 0.9 ?
                                "⚠️ 容量がいっぱいに近づいています。プランのアップグレードをご検討ください。" :
                                "まだ余裕があります。引き続きファイルをアップロード可能です。"}
                        </p>
                    </CardContent>
                </Card>
            )}

            {/* メディア一覧 */}
            <div className="bg-white p-6 rounded-lg border shadow-sm">
                <h2 className="text-lg font-bold mb-4">保存されたファイル群</h2>

                {loading ? (
                    <div className="text-center py-10 text-gray-500">読み込み中...</div>
                ) : mediaItems.length === 0 ? (
                    <div className="text-center py-10 bg-gray-50 rounded-lg border border-dashed">
                        <p className="text-gray-500 mb-2">まだメディアがアップロードされていません。</p>
                        <p className="text-sm text-gray-400">右上のボタンから画像やファイルをアップロードしてください。</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                        {mediaItems.map((item) => (
                            <div key={item.id} className="border rounded-md overflow-hidden group relative hover:shadow-md transition-shadow">
                                <div className="aspect-square bg-gray-100 flex items-center justify-center">
                                    {item.mimeType.startsWith("image/") ? (
                                        <img src={item.url} alt={item.filename} className="object-cover w-full h-full" />
                                    ) : (
                                        <div className="text-4xl">📄</div>
                                    )}
                                </div>
                                <div className="p-2 bg-white">
                                    <p className="text-xs font-semibold truncate" title={item.filename}>{item.filename}</p>
                                    <div className="flex justify-between items-center mt-1">
                                        <p className="text-[10px] text-gray-500">{formatBytes(item.size)}</p>
                                        <span className="text-[10px] text-gray-400">{new Date(item.createdAt).toLocaleDateString()}</span>
                                    </div>
                                </div>

                                {/* ワンクリックでURLコピーするためのオーバーレイ */}
                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        className="text-xs"
                                        onClick={() => {
                                            navigator.clipboard.writeText(item.url);
                                            alert("URLをコピーしました！");
                                        }}
                                    >
                                        🔗 コピー
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
