// ChatWork API v2 のシンプルクライアント
// https://developer.chatwork.com/docs

const CW_ENDPOINT = "https://api.chatwork.com/v2";

export type ChatworkResult = { ok: true; messageId?: string } | { ok: false; error: string; status?: number };

export async function sendChatworkMessage(
    apiToken: string,
    roomId: string,
    body: string,
): Promise<ChatworkResult> {
    try {
        const res = await fetch(`${CW_ENDPOINT}/rooms/${roomId}/messages`, {
            method: "POST",
            headers: {
                "X-ChatWorkToken": apiToken,
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({ body, self_unread: "1" }).toString(),
            signal: AbortSignal.timeout(15000),
        });

        if (!res.ok) {
            const text = await res.text().catch(() => "");
            return { ok: false, status: res.status, error: `ChatWork API error (${res.status}): ${text || res.statusText}` };
        }
        const data = await res.json().catch(() => ({} as { message_id?: string }));
        return { ok: true, messageId: data?.message_id };
    } catch (e) {
        const msg = (e as { message?: string })?.message || String(e);
        return { ok: false, error: msg };
    }
}

// 接続テスト：/me エンドポイントで API token の妥当性を確認
export async function testChatworkToken(apiToken: string): Promise<{ ok: true; name?: string; accountId?: number } | { ok: false; error: string }> {
    try {
        const res = await fetch(`${CW_ENDPOINT}/me`, {
            headers: { "X-ChatWorkToken": apiToken },
            signal: AbortSignal.timeout(10000),
        });
        if (!res.ok) {
            const text = await res.text().catch(() => "");
            return { ok: false, error: `ChatWork API error (${res.status}): ${text || res.statusText}` };
        }
        const data = await res.json() as { name?: string; account_id?: number };
        return { ok: true, name: data?.name, accountId: data?.account_id };
    } catch (e) {
        return { ok: false, error: (e as { message?: string })?.message || String(e) };
    }
}
