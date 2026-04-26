import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// プロラインフリーからの form_data を受け取る webhook 受信エンドポイント。
// 想定: ユーザーの GAS が doPost 内で本エンドポイントに JSON を転送してくる。
//
// ペイロード例（GAS 側でそのまま転送する想定）:
// {
//   "form_name": "無料相談フォーム",        // シート名 form_XXX の XXX 部分
//   "date": "2026-04-24T10:30:00Z",        // プロライン側の発生時刻（ISO）
//   "uid": "U12345...",                    // LINE userId など
//   "snsname": "山田太郎",                 // 表示名
//   "form_data": { ...任意フィールド },    // フォームの全入力値
//   "utm_source": "x",                     // 任意（LP 側で渡していれば）
//   "utm_medium": "post",
//   "utm_campaign": "april-launch",
//   "utm_content": "post_id_xxx"
// }
//
// 認証: URL パスの token で行う（ユーザー別にユニーク、推測不可）。

export async function POST(
    req: Request,
    context: { params: Promise<{ token: string }> }
) {
    try {
        const { token } = await context.params;
        if (!token || token.length < 16) {
            return NextResponse.json({ error: "Invalid token" }, { status: 401 });
        }

        const settings = await prisma.settings.findUnique({
            where: { funnelWebhookToken: token },
            select: { userId: true }
        });
        if (!settings) {
            return NextResponse.json({ error: "Unknown token" }, { status: 401 });
        }

        const body = await req.json().catch(() => ({} as Record<string, unknown>));

        // プロラインのデータ構造を吸収（フォーム送信 / シナリオ登録 両対応）
        //   - フォーム送信: form_name + form_data
        //   - シナリオ登録: scenario_name (プロライン直接 or GAS 経由)
        // どちらの payload 形式でも label と source を決定する
        const formName = typeof body.form_name === "string" ? body.form_name.trim() : "";
        const scenarioName = typeof body.scenario_name === "string" ? body.scenario_name.trim() : "";

        let source = "proline";
        let label: string | null = null;
        if (scenarioName.length > 0) {
            source = "proline_scenario";
            label = scenarioName;
        } else if (formName.length > 0) {
            source = "proline_form";
            label = formName;
        } else {
            // 名前が無い場合は汎用 proline として扱う
            source = "proline";
            label = null;
        }

        const externalUid = typeof body.uid === "string" ? body.uid : null;
        const displayName = typeof body.snsname === "string" ? body.snsname : null;
        const occurredAt = typeof body.date === "string" && !Number.isNaN(Date.parse(body.date))
            ? new Date(body.date)
            : new Date();

        // UTM (LP 経由で form_data / scenario_data に入っている場合も拾う)
        const formData = (typeof body.form_data === "object" && body.form_data !== null) ? body.form_data as Record<string, unknown> : {};
        const scenarioData = (typeof body.scenario_data === "object" && body.scenario_data !== null) ? body.scenario_data as Record<string, unknown> : {};
        const pick = (k: string): string | null => {
            const direct = body[k as keyof typeof body];
            if (typeof direct === "string" && direct.length > 0) return direct;
            const fromForm = formData[k];
            if (typeof fromForm === "string" && fromForm.length > 0) return fromForm;
            const fromScenario = scenarioData[k];
            if (typeof fromScenario === "string" && fromScenario.length > 0) return fromScenario;
            return null;
        };
        const utmSource = pick("utm_source");
        const utmMedium = pick("utm_medium");
        const utmCampaign = pick("utm_campaign");
        const utmContent = pick("utm_content");

        await prisma.funnelEvent.create({
            data: {
                userId: settings.userId,
                source,
                formName: label,  // シナリオ名もここに格納（スキーマ互換のため formName を再利用）
                externalUid,
                displayName,
                utmSource,
                utmMedium,
                utmCampaign,
                utmContent,
                rawData: body as object,
                occurredAt,
            },
        });

        return NextResponse.json({ ok: true, source, label });
    } catch (error) {
        console.error("funnel webhook error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

// GAS の疎通確認用。ブラウザで開いたときに 200 を返せば接続OK のサイン
export async function GET(
    _req: Request,
    context: { params: Promise<{ token: string }> }
) {
    const { token } = await context.params;
    const settings = await prisma.settings.findUnique({
        where: { funnelWebhookToken: token },
        select: { userId: true }
    });
    if (!settings) {
        return NextResponse.json({ ok: false, error: "Unknown token" }, { status: 401 });
    }
    return NextResponse.json({ ok: true, message: "Webhook endpoint reachable. POST form data here." });
}
