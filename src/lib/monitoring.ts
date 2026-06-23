// 本番エラー監視の最小実装（ロードマップ B-3）。
//
// 背景（CTO 監査 観点7）:
//   本番の例外監視がゼロ。errorResponse は errorId を採番してサーバーログに出すが、
//   ログを能動的に見ないと障害に気づけない。最小限「外部に飛ばして検知できる」状態にする。
//
// 設計（依存ゼロ・no-op 既定）:
//   - 重い SDK(@sentry/nextjs)は入れず、Sentry の Store API へ素の fetch で送る。
//     これにより next.config の patch やビルド結合を避けつつ、無料枠の Sentry をそのまま使える。
//   - SENTRY_DSN（または NEXT_PUBLIC_SENTRY_DSN）未設定なら完全な no-op（既存挙動を一切変えない）。
//   - 送信失敗は握りつぶす（監視のために本処理を巻き込まない）。
//
// DSN 形式: https://<publicKey>@<host>/<projectId>
//   送信先: https://<host>/api/<projectId>/store/
//   認証:   X-Sentry-Auth ヘッダに sentry_key=<publicKey>

type Dsn = { host: string; projectId: string; publicKey: string; protocol: string };

function parseDsn(raw: string | undefined): Dsn | null {
    if (!raw) return null;
    try {
        const u = new URL(raw);
        const publicKey = u.username;
        const projectId = u.pathname.replace(/^\//, "");
        if (!publicKey || !projectId) return null;
        return { host: u.host, projectId, publicKey, protocol: u.protocol.replace(":", "") };
    } catch {
        return null;
    }
}

function getDsn(): Dsn | null {
    return parseDsn(process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN);
}

/** エラー監視が有効か（DSN 設定済みか）。 */
export function isMonitoringEnabled(): boolean {
    return getDsn() !== null;
}

/**
 * 例外を監視基盤へ送る（DSN 未設定なら no-op）。
 * 失敗しても呼び出し側に例外を伝播させない（fire-and-forget）。
 */
export function captureException(
    error: unknown,
    extra?: { context?: string; errorId?: string; [k: string]: unknown }
): void {
    const dsn = getDsn();
    if (!dsn) return;

    try {
        const err = error instanceof Error ? error : new Error(String(error));
        const payload = {
            event_id: (extra?.errorId || "").replace(/-/g, "") || undefined,
            timestamp: new Date().toISOString(),
            platform: "node",
            level: "error",
            logger: extra?.context || "api",
            environment: process.env.RELEASE_MODE === "mvp" ? "production" : "development",
            exception: {
                values: [
                    {
                        type: err.name || "Error",
                        value: err.message || String(error),
                        stacktrace: err.stack ? { frames: [{ filename: "server", function: err.stack.split("\n")[1]?.trim() || "" }] } : undefined,
                    },
                ],
            },
            extra,
        };

        const endpoint = `${dsn.protocol}://${dsn.host}/api/${dsn.projectId}/store/`;
        const auth = [
            "Sentry sentry_version=7",
            `sentry_client=prox-min/1.0`,
            `sentry_key=${dsn.publicKey}`,
        ].join(", ");

        // fire-and-forget。await しない。失敗は無視。
        void fetch(endpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Sentry-Auth": auth,
            },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(3000),
        }).catch(() => { /* 監視送信失敗は無視 */ });
    } catch {
        // payload 構築失敗も握りつぶす（監視で本処理を壊さない）
    }
}
