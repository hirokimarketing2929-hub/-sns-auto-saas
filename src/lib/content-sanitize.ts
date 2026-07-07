// AI生成ポスト本文の「純化」共通ユーティリティ（task020）。
//
// 背景（2026-07-07 本番実測）:
//   1. AIの前置き（メタ発話）が本文の前に混入する
//      例: 「Claude Codeが今まさに…投稿を作成します。」+ 区切り線「---」
//   2. 末尾にハッシュタグが自動付与される
//      例: 「#ClaudeCode #AI活用 #生産性爆上げ #エンジニア」
//
// 対策の主軸はプロンプト側の禁止指示（各呼び出し元の systemText/instruction）。
// この後処理はあくまで保険（二次防御）であり、正当な本文を壊す誤爆リスクを避けるため
// 意図的に「保守的」な2パターンのみを対象とする（吉留さん確定方針・2026-07-07）:
//   (a) 末尾側: 行全体がハッシュタグ「のみ」で構成される行を除去する。
//       本文中に混じった単発の # を巻き込んで置換・削除することはしない。
//   (b) 先頭側: 明白なメタ発話の前置き行 + それに続く区切り線（---等）のパターンのみ除去する。
//       末尾の後書きや、本文中に紛れた区切り線は対象外（削りすぎによる誤爆を避ける）。
// 文字数制約・トンマナ等の既存仕様には一切手を触れない。

// (b) 先頭のメタ発話前置きとして検出する行パターン。
// 誤爆を避けるため「あなた（AI）がこれから/今作った投稿そのものについて言及している」ことが
// 文面から明確に読み取れるものだけに絞る。具体的には「投稿」という単語と「作成/生成する」という
// 単語が同一行に共起し、かつ文末が「します/しました/です」等の言い切りで終わる行のみを対象にする。
// なお、この判定は必ず「直後に区切り線（---等）が続く場合」に限って前置き除去の対象になる
// （stripLeadingPreamble 側のガード）。区切り線が続かない1文だけの投稿本文（例:
// 「これが投稿です」で完結する意図的な文面）を誤って壊さないための二重のセーフガード。
const PREAMBLE_LINE_PATTERNS: RegExp[] = [
    // 「投稿」＋「作成/生成」が同一行にあり、AI自身の作業について述べる言い切りで終わる行。
    // 例: 「〜投稿を作成します」「〜投稿を作成しました」「〜投稿です」「〜投稿を作成しました。」
    //     「Claude Codeが〜投稿を作成します」等。
    /^.{0,140}投稿(?:文)?を?(?:作成|生成)(?:し|致し)(?:ます|ました|ています)[。！]?$/,
    // 「〜(踏まえた/を踏まえて/を反映した/を元にした)投稿です」等、体言止めで完結する言い回し。
    /^.{0,140}(?:踏まえた|踏まえて|反映した|盛り込んだ|元にした|元に)投稿(?:を作成しました)?です[。！]?$/,
    // 「Claude(Code)が〜掴みました」等、AI自身を主語にした短い言い回し（投稿という単語がなくても検出）。
    /^Claude(?: Code)?が.{0,80}(?:掴みました|作成します|生成します)[。！]?$/,
];

// 前置き直後の区切り線（Markdown水平線・全角罫線）。
const DIVIDER_LINE_PATTERN = /^(?:-{3,}|_{3,}|\*{3,}|={3,}|ー{3,}|─{3,})$/;

// (b) 先頭の「メタ発話の前置き行 → 区切り線」パターンのみを除去する。
// 該当しない場合は原文をそのまま返す（誤爆を避けるため、本文側には一切触れない）。
function stripLeadingPreamble(text: string): string {
    const lines = text.replace(/\r\n/g, "\n").split("\n");

    // 先頭の空行はスキップして最初の非空行を見る。
    let i = 0;
    while (i < lines.length && lines[i].trim().length === 0) i++;
    if (i >= lines.length) return text;

    const firstLine = lines[i].trim();
    if (!PREAMBLE_LINE_PATTERNS.some(p => p.test(firstLine))) {
        return text; // 前置きパターンに一致しなければ何もしない
    }

    // 前置き行の直後（空行を挟んでもよい）に区切り線があることを確認してから除去する。
    let j = i + 1;
    while (j < lines.length && lines[j].trim().length === 0) j++;
    if (j >= lines.length || !DIVIDER_LINE_PATTERN.test(lines[j].trim())) {
        return text; // 区切り線が続かない＝前置きと確信できないため何もしない
    }

    // 区切り線の直後（空行はスキップ）から本文とみなす。
    let k = j + 1;
    while (k < lines.length && lines[k].trim().length === 0) k++;

    return lines.slice(k).join("\n").trim();
}

// 末尾側: 行全体がハッシュタグ「のみ」で構成される行を除去する（本番実測の典型パターン:
// 末尾のハッシュタグ列 "#ClaudeCode #AI活用 ..." のような行）。
// 【吉留さん確定方針・2026-07-07】本文中に混在する単発の # はここでは一切触らない
// （正当な文章（"C#" 等の記号利用や見出し的な "#1" 等）を誤って壊すリスクを避けるため）。
// structure-rewrite（本人連投スレッドの `---` 区切りを意図的に保持する仕様）など、
// 前置き除去を適用したくない経路ではこの関数を単体で使う。
export function stripHashtags(text: string): string {
    const lines = text.replace(/\r\n/g, "\n").split("\n");

    while (lines.length > 0) {
        const last = lines[lines.length - 1].trim();
        if (last.length === 0) {
            lines.pop();
            continue;
        }
        const tokens = last.split(/\s+/);
        const isHashtagOnlyLine = tokens.length > 0 && tokens.every(t => /^[#＃][\p{L}\p{N}_]+$/u.test(t));
        if (isHashtagOnlyLine) {
            lines.pop();
            continue;
        }
        break;
    }

    return lines.join("\n").trim();
}

// 生成ポスト本文の「純化」統合エントリポイント。
//   1. 先頭のメタ前置き＋区切り線パターンの除去（該当時のみ）
//   2. 末尾のハッシュタグのみの行の除去（該当時のみ）
// いずれも保守的な限定パターンのみを対象とし、本文中の通常の文章は変更しない。
export function sanitizeGeneratedContent(raw: string): string {
    const noPreamble = stripLeadingPreamble(raw);
    const noTrailingHashtags = stripHashtags(noPreamble);
    return noTrailingHashtags.trim();
}
