// Next.js 起動時フック（プロセス起動ごとに1回 register() が呼ばれる）。
// RT-001 対策の fail-fast 層: 危険な環境変数構成を起動時に検出して可視化する。
//
// 設計（RT-001 の多層防御）:
//   1) features.ts: 既定を mvp に倒す fail-safe（不正値でも締まる）。← 第一防壁
//   2) ここ: RELEASE_MODE が想定外の値（mvp/full 以外）なら起動ログに警告を出す。
//      「full のつもりが誤字で mvp に縮退していた」「mvp のつもりが誤字で…」を運用者に気づかせる。
//   3) 本番(NODE_ENV=production)では、安全側に倒れていることをログで明示する。
//
// 注意: 本ファイルは Edge/Node 双方で読まれうるため、Node 専用 API は runtime 判定で囲む。

export async function register() {
    // Edge ランタイムでは process.env のみ参照（重い検証はしない）。
    const raw = process.env.RELEASE_MODE;
    const trimmed = raw?.trim();
    const effective = trimmed === "full" ? "full" : "mvp";

    const KNOWN = new Set(["mvp", "full"]);
    const isKnown = trimmed !== undefined && KNOWN.has(trimmed);

    if (process.env.NEXT_RUNTIME === "nodejs") {
        // 構成サマリを起動時に1回出す（鍵そのものは出さない＝存在有無のみ）。
        const lines: string[] = [];
        lines.push(`[startup] RELEASE_MODE raw=${JSON.stringify(raw)} -> effective="${effective}"`);

        if (!isKnown) {
            lines.push(
                `[startup][WARN] RELEASE_MODE が想定外の値です（mvp/full 以外）。` +
                `fail-safe により "${effective}" として動作します。意図と一致するか確認してください。`
            );
        }

        // mvp（本番/β）で前提となる秘匿系 env の存在を fail-fast チェック（値は出さない）。
        if (effective === "mvp") {
            const requiredForMvp: Array<[string, string]> = [
                ["PROX_ENCRYPTION_KEY", "BYOK/OAuth トークンの at-rest 暗号化に必須"],
                ["CRON_SECRET", "cron 認証に必須（全環境 fail-closed）"],
                ["NEXTAUTH_SECRET", "セッション署名に必須"],
            ];
            for (const [key, why] of requiredForMvp) {
                if (!process.env[key] || process.env[key]!.trim() === "") {
                    lines.push(`[startup][ERROR] ${key} が未設定です（${why}）。mvp 運用では必須。`);
                }
            }
            // mvp なのに招待コード未設定だと全員登録不可になる（beta-gate の fail-closed）。
            if (!process.env.BETA_INVITE_CODES || process.env.BETA_INVITE_CODES.trim() === "") {
                lines.push(
                    `[startup][WARN] RELEASE_MODE=mvp かつ BETA_INVITE_CODES 未設定です。` +
                    `招待ゲートが fail-closed で全員登録不可になります（意図的なら無視可）。`
                );
            }
        }

        // まとめて1回出力（ログ汚染を避ける）。
        for (const l of lines) {
            if (l.includes("[ERROR]")) console.error(l);
            else if (l.includes("[WARN]")) console.warn(l);
            else console.log(l);
        }
    }
}
