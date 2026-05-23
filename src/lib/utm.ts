// 投稿本文に含まれる「アカウント設定の CTA URL」に UTM パラメータを付与するユーティリティ。
// 投稿経由の連携貢献を FunnelEvent.utmCampaign 経由で逆引きするための仕込み。
//
// 仕様:
//  - 既存のクエリ・ハッシュは保持する
//  - 同名 UTM がすでに付いていれば上書きする（古い utm_campaign を残さない）
//  - 一致判定は「scheme+host+pathname の prefix 一致」（ctaUrl 側のクエリ・ハッシュは比較に使わない）
//  - content 内の他の URL（短縮URL や別ドメイン）は触らない

export type UtmParams = {
    utm_source?: string;
    utm_medium?: string;
    utm_campaign?: string;
    utm_content?: string;
    utm_term?: string;
};

// URL を厳密に組み立て直す形でクエリを付与する。
// 失敗時は元の URL を返す（投稿本文を壊さない）。
export function appendUtmParams(url: string, params: UtmParams): string {
    try {
        const u = new URL(url);
        for (const [k, v] of Object.entries(params)) {
            if (v === undefined || v === null) continue;
            const sv = String(v).trim();
            if (sv.length === 0) continue;
            u.searchParams.set(k, sv);
        }
        return u.toString();
    } catch {
        return url;
    }
}

// 一致判定に使う比較基準を返す: "scheme://host + pathname"
function normalizedBase(url: string): string | null {
    try {
        const u = new URL(url);
        return `${u.protocol}//${u.host}${u.pathname}`;
    } catch {
        return null;
    }
}

// 投稿本文（content）の中で、ctaUrl と同じドメイン+パスで始まる URL に UTM を付与する。
//   - ctaUrl が null/不正なら content をそのまま返す
//   - マッチした URL がなければ content をそのまま返す（投稿本文に URL が無いケース）
export function applyUtmToContent(content: string, ctaUrl: string | null | undefined, params: UtmParams): string {
    if (!ctaUrl) return content;
    const ctaBase = normalizedBase(ctaUrl);
    if (!ctaBase) return content;

    // 末尾に句読点や改行が来ても URL の一部と誤認しないようにする
    // (`generate/route.ts` の stripUrls と同じ境界文字: 半角空白・全角句読点)
    return content.replace(/https?:\/\/[^\s、。]+/g, (match) => {
        const matchBase = normalizedBase(match);
        if (!matchBase) return match;
        if (matchBase !== ctaBase) return match;
        return appendUtmParams(match, params);
    });
}

// 投稿IDに対応する canonical な utm_campaign 値。FunnelEvent.utmCampaign と突き合わせる側でも同じ関数を使う。
export function postCampaignTag(postId: string): string {
    return `post_${postId}`;
}
