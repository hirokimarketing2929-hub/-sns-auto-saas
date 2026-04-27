import { createHash } from "crypto";

// AI が毎回新規生成する suggestion を「同じ提案」として識別するための安定ハッシュ。
// 表記の揺れ（前後の空白・改行・全角半角空白）で別物扱いされないよう正規化してから sha256 する。
//
// 利用箇所:
//   - POST /api/analysis/reject  ... ユーザーが却下したときにこのハッシュを永続化
//   - POST /api/analysis/insight ... 返却前にこのハッシュ集合と照合し、却下済みのものを除外

function normalize(s: string): string {
    return s
        .normalize("NFKC")          // 全角半角の正規化
        .replace(/\s+/g, " ")       // 連続空白・改行を半角スペース1個に
        .trim();
}

export function suggestionHash(args: { content: string; type: string; level: string }): string {
    const key = [normalize(args.content), args.type.toUpperCase(), args.level.toLowerCase()].join("\u0000");
    return createHash("sha256").update(key, "utf8").digest("hex");
}
