import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getTwitterClient } from "@/lib/twitter";
import { getActiveXAccount } from "@/lib/active-x-account";
import { callEngine, EngineUnavailableError } from "@/lib/ai-engine";
import { enforceRateLimit, getClientIp } from "@/lib/rate-limit";
import { featureGateResponse } from "@/lib/features";

// 指定 @username の公開ポストを X API 経由で取得し、エンゲージメント最大のものを
// 既存の repurpose エンジンに投げて「型と感情」を抽出 → 自社テーマに置き換えた
// オリジナル投稿案を3つ返す。
//
// X 規約コンプライアンス上の注意:
//   - スクレイピングは禁止。公式の X API (twitter-api-v2) のみ使用する。
//   - 取得した他人のツイート本文は DB に永続化しない（メモリ上でのみ処理）。
//   - 出力は「構造」を参考にした独自コンテンツで、元ツイートをそのまま再投稿しない。
//   - ユーザー本人の BYOK キーで認証する（自分のレートリミット内で動作）。
export async function POST(req: Request) {
    try {
        // Python AIエンジン依存機能。mvp(外部公開)では縮退して提供しない（CTO決定003 §3）。
        const gated = featureGateResponse("pythonAI");
        if (gated) return gated;

        // X API + AIエンジン課金が走るため濫用ガード。
        const limited = enforceRateLimit(`research-account:${getClientIp(req)}`, 20, 60_000);
        if (limited) return limited;

        const session = await getServerSession(authOptions);
        if (!session?.user?.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const user = await prisma.user.findUnique({
            where: { email: session.user.email }
        });
        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        const data = await req.json();
        let username: unknown = data?.username;
        if (typeof username !== "string" || !username.trim()) {
            return NextResponse.json({ error: "@ユーザー名を入力してください" }, { status: 400 });
        }

        // 先頭 @ を除去し、X のユーザー名規則（英数字と _、最大15文字）で検証
        const normalized = username.replace(/^@/, "").trim();
        if (!/^[A-Za-z0-9_]{1,15}$/.test(normalized)) {
            return NextResponse.json({ error: "ユーザー名の形式が正しくありません（英数字と_のみ、最大15文字）" }, { status: 400 });
        }

        const xAccount = await getActiveXAccount(user.id);
        if (!xAccount) {
            return NextResponse.json({ error: "サブアカウントが未設定です。設定画面でアカウントを追加してください。" }, { status: 400 });
        }

        let client;
        try {
            client = await getTwitterClient(user.id, xAccount.id);
        } catch (err: any) {
            return NextResponse.json({ error: err?.message || "X API クライアント初期化に失敗しました" }, { status: 400 });
        }

        // username → userId の解決
        let targetUserId: string;
        let displayName: string;
        try {
            const lookup = await client.v2.userByUsername(normalized);
            if (!lookup.data?.id) {
                return NextResponse.json({ error: "指定されたアカウントが見つかりません" }, { status: 404 });
            }
            targetUserId = lookup.data.id;
            displayName = lookup.data.name || normalized;
        } catch (err: unknown) {
            console.error("X user lookup error:", err);
            const msg = (err as { data?: { title?: string } })?.data?.title || "ユーザー情報の取得に失敗しました";
            return NextResponse.json({ error: `X API エラー: ${msg}（X API の利用枠・キー権限をご確認ください）` }, { status: 502 });
        }

        // 最近の公開ポスト（リツイート/リプライを除外）を取得
        type TweetRow = { text: string; likes: number; retweets: number; impressions: number };
        let tweets: TweetRow[] = [];
        try {
            const timeline = await client.v2.userTimeline(targetUserId, {
                max_results: 10,
                exclude: ["retweets", "replies"],
                "tweet.fields": ["public_metrics", "created_at"]
            });
            const raw = timeline.data?.data || [];
            tweets = raw
                .filter((t: { text?: string }) => typeof t.text === "string" && t.text.length > 0)
                .map((t: { text: string; public_metrics?: { like_count?: number; retweet_count?: number; impression_count?: number } }) => ({
                    text: t.text,
                    likes: t.public_metrics?.like_count ?? 0,
                    retweets: t.public_metrics?.retweet_count ?? 0,
                    impressions: t.public_metrics?.impression_count ?? 0,
                }));
        } catch (err: unknown) {
            console.error("X timeline fetch error:", err);
            const msg = (err as { data?: { title?: string } })?.data?.title || "投稿の取得に失敗しました";
            return NextResponse.json({ error: `X API エラー: ${msg}（非公開アカウント、もしくは read 権限/レート制限の可能性があります）` }, { status: 502 });
        }

        if (tweets.length === 0) {
            return NextResponse.json({ error: "このアカウントから取得できる公開ポストがありません" }, { status: 404 });
        }

        // エンゲージメントが最大のものを選出（リツイート重み付け）
        const best = tweets.slice().sort((a, b) =>
            (b.likes + b.retweets * 2) - (a.likes + a.retweets * 2)
        )[0];

        // 既存の repurpose エンジンに投入（接続不可・タイムアウトは EngineUnavailableError で捕捉）
        const sourceMeta = {
            _source_username: `@${normalized}`,
            _source_display_name: displayName,
            _source_metrics: { likes: best.likes, retweets: best.retweets, impressions: best.impressions },
        };
        try {
            const response = await callEngine("/api/repurpose_post", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    source_post_text: best.text,
                    target_audience: xAccount.targetAudience || "",
                    target_pain: xAccount.targetPain || "",
                    account_concept: xAccount.accountConcept || "",
                    profile: xAccount.profile || ""
                }),
            }, { timeoutMs: 30000 });

            if (!response.ok) {
                const errorText = await response.text().catch(() => "");
                console.error("AI engine repurpose(account) error:", response.status, errorText);
                // 偽コンテンツは返さず、空＋警告メッセージで正直に伝える
                return NextResponse.json({
                    extracted_format: "", extracted_emotion: "", generated_posts: [],
                    _fallback: true, ...sourceMeta,
                    _message: `AIエンジンの応答エラー (${response.status}) のため横展開を生成できませんでした。`,
                });
            }

            const aiData = await response.json();
            return NextResponse.json({ ...aiData, ...sourceMeta });
        } catch (fetchError: unknown) {
            const msg = fetchError instanceof EngineUnavailableError ? fetchError.message : "AIエンジンへの接続に失敗しました。";
            console.warn("Research account: AI engine unavailable:", msg);
            return NextResponse.json({
                extracted_format: "", extracted_emotion: "", generated_posts: [],
                _fallback: true, ...sourceMeta,
                _message: `${msg} 横展開は生成できませんでした（AIエンジンが起動しているか確認してください）。`,
            });
        }
    } catch (error) {
        console.error("Research Account API Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
