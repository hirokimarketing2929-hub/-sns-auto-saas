// 運営（オーナー）のリード/問い合わせ集約用 GAS ウェブフックへ送信する共通関数。
//
// OWNER_LEADS_WEBHOOK_URL（環境変数）に、Google Apps Script で公開した
// ウェブアプリの URL を設定する。GAS 側でスプレッドシートへの追記＋
// オーナーへのメール通知を行う想定。未設定でも本体機能は止めない（送信スキップ）。

export type OwnerSheetPayload = {
    type: "registration" | "contact";
    name?: string;
    email?: string;
    category?: string;
    message?: string;
    date?: string;
};

export async function sendToOwnerSheet(payload: OwnerSheetPayload): Promise<boolean> {
    // 既定の送信先（オーナーの GAS ウェブアプリ）。env があればそちらを優先。
    const DEFAULT_WEBHOOK_URL =
        "https://script.google.com/macros/s/AKfycbxVL4u16e-Y7ARniUd75c5S9qwze68xbqZNEcgt3TwYXISZdgt9o6bIUP3B1GnI2dqA/exec";
    const url = process.env.OWNER_LEADS_WEBHOOK_URL || DEFAULT_WEBHOOK_URL;
    if (!url) {
        console.warn("[owner-sheets] 送信先URL未設定のため送信をスキップしました");
        return false;
    }
    try {
        const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...payload, date: payload.date ?? new Date().toISOString() }),
            signal: AbortSignal.timeout(10000),
        });
        if (!res.ok) {
            console.error("[owner-sheets] webhook responded", res.status);
            return false;
        }
        return true;
    } catch (e) {
        console.error("[owner-sheets] webhook error:", e);
        return false;
    }
}
