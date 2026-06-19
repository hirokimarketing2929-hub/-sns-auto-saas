"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ReactNode, ChangeEvent } from "react";

/**
 * 認証情報フィールド（APIキー等）の共通入力欄。
 * locked=true のときは保存済みの値をそのまま表示したまま読み取り専用にし、
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
    return (
        <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
                <Label htmlFor={name} className="flex items-center gap-2 text-xs">{label}{labelExtra}</Label>
                {locked && (
                    <button
                        type="button"
                        onClick={onUnlock}
                        className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded border border-slate-300 text-slate-600 hover:bg-slate-100"
                    >
                        ✏️ 編集
                    </button>
                )}
            </div>
            <Input
                id={name}
                name={name}
                type="text"
                readOnly={locked}
                autoComplete="off"
                placeholder={placeholder}
                value={value}
                onChange={onChange}
                className={locked ? "bg-slate-100 text-slate-500 cursor-not-allowed" : "bg-white"}
            />
            {locked && <p className="text-[11px] text-slate-400">設定済み（変更するには「編集」を押してください）</p>}
            {help}
        </div>
    );
}
