// パスワード強度ポリシー（RT-004 対策）。
//
// 旧実装の問題:
//   register は email/password の「存在チェックのみ」。password:"1"（1文字）でも
//   アカウント作成が成立し、弱PWユーザーがオンライン総当たりで即陥落していた。
//
// 方針（構造で防ぐ）:
//   登録時に最低要件を満たさないPWは構造的に拒否（400）。要件は「長さ≥10 かつ
//   英字・数字を各1種以上」。よくある弱PW（password / 123456 等）も即拒否する。
//   これにより「弱PWを設定する」こと自体を入口で不可能にする。

const MIN_LENGTH = 10;

// 上位の超頻出弱PW（完全一致で拒否）。長さ要件と二重で守る。
const COMMON_WEAK = new Set([
    "password", "password1", "passw0rd", "1234567890", "0123456789",
    "qwertyuiop", "11111111", "12345678", "123456789", "iloveyou",
    "admin123", "letmein123", "welcome123",
]);

export type PasswordCheck = { ok: true } | { ok: false; message: string };

/**
 * パスワードが最低要件を満たすか検証する。
 * 要件: 長さ≥10 / 英字を1つ以上 / 数字を1つ以上 / 頻出弱PWでない。
 */
export function checkPasswordStrength(password: string | undefined | null): PasswordCheck {
    const pw = typeof password === "string" ? password : "";

    if (pw.length < MIN_LENGTH) {
        return { ok: false, message: `パスワードは${MIN_LENGTH}文字以上にしてください。` };
    }
    if (pw.length > 200) {
        // bcrypt の 72 バイト切り詰め・DoS 回避のため上限も設ける。
        return { ok: false, message: "パスワードが長すぎます（200文字以下）。" };
    }
    if (!/[A-Za-z]/.test(pw)) {
        return { ok: false, message: "パスワードには英字を1文字以上含めてください。" };
    }
    if (!/[0-9]/.test(pw)) {
        return { ok: false, message: "パスワードには数字を1文字以上含めてください。" };
    }
    if (COMMON_WEAK.has(pw.toLowerCase())) {
        return { ok: false, message: "推測されやすいパスワードです。別のものにしてください。" };
    }
    return { ok: true };
}
