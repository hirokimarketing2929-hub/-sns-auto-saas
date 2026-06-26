"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ReactNode, ChangeEvent } from "react";

/**
 * RT-005: 機微値の GET レスポンスは crypto.ts の MASK_SENTINEL_PREFIX で始まる
 * マスク文字列（"••••設定済み" / "••••<末尾4桁>"）で返る。マスク自体はセキュリティ要件
 * （平文を返さない）なので維持しつつ、入力欄にはその生のマスク文字列を出さず
 * 「設定済み」バッジで伏せて見せる。サーバには依存させずクライアント側で判定する。
 */
const MASK_SENTINEL_PREFIX = "••••";

/**
 * 認証情報フィールド（APIキー等）の共通入力欄。
 * locked=true のときは「設定済み」を示すバッジ＋空欄を表示して読み取り専用にし、
 * 「編集」を押すまで入力できない。空欄（未設定）のときは通常どおり入力可能。
 */
export default function CredentialField({
    name, label, value, locked, onChange, onUnlock, placeholder, help, labelExtra,
}: {
    name: string;
    label: string;
    value: string;
    locked: boolean;
    onChange: (e: ChangeEvent<HTMLInputElement>) => void;
    onUnlock: () => void;
    placeholder?: string;
    help?: ReactNode;
    labelExtra?: ReactNode;
}) {
    const isMasked = typeof value === "string" && value.startsWith(MASK_SENTINEL_PREFIX);
    const showAsSaved = locked && isMasked;

    // 「編集」解除時はマスク文字列を据え置かずクリアする。"••••..." に追記すると、その値が
    // 依然マスク接頭辞で始まり書込み側のマスクガードに弾かれて新キーが保存されない事故を防ぐ。
    const handleUnlock = () => {
        if (isMasked) {
            onChange({ target: { name, value: "" } } as ChangeEvent<HTMLInputElement>);
        }
        onUnlock();
    };

    return (
        <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
                <Label htmlFor={name} className="flex items-center gap-2 text-xs">{label}{labelExtra}</Label>
                <div className="flex items-center gap-2">
                    {showAsSaved && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600">
                            <span aria-hidden>🔒</span> 設定済み
                        </span>
                    )}
                    {locked && (
                        <button
                            type="button"
                            onClick={handleUnlock}
                            className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded border border-slate-300 text-slate-600 hover:bg-slate-100"
                        >
                            ✏️ 編集
                        </button>
                    )}
                </div>
            </div>
            <Input
                id={name}
                name={name}
                type="text"
                readOnly={locked}
                autoComplete="off"
                placeholder={showAsSaved ? "設定済み（変更するには「編集」を押してください）" : placeholder}
                value={showAsSaved ? "" : value}
                onChange={onChange}
                className={locked ? "bg-slate-100 text-slate-500 cursor-not-allowed" : "bg-white"}
            />
            {locked && <p className="text-[11px] text-slate-400">設定済み（変更するには「編集」を押してください）</p>}
            {help}
        </div>
    );
}
