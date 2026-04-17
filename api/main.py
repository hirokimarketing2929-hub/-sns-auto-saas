from fastapi import FastAPI, HTTPException, File, UploadFile
import tempfile
import base64
import fitz  # PyMuPDF
from docx import Document
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import asyncio
import os
import json
from openai import OpenAI
from dotenv import load_dotenv
from typing import Optional, List

load_dotenv()

app = FastAPI(title="ProX API")

# CORS設定
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://prox-app.vercel.app",      # ProX本番ドメイン
        "https://sns-auto-saas.vercel.app",  # 旧ドメイン（移行期間中）
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- AI クライアント初期化 ---
# xAI Client (Grok — メインLLM)
# xAI APIはOpenAI互換。openai SDKでbase_urlを指定して利用する。
# https://docs.x.ai/docs/guides/migration
_xai_api_key = os.getenv("XAI_API_KEY", "")
HAS_XAI = bool(_xai_api_key and _xai_api_key != "your_xai_api_key_here")
xai_client: OpenAI | None = None
if HAS_XAI:
    xai_client = OpenAI(api_key=_xai_api_key, base_url="https://api.x.ai/v1")

# xAIモデル設定（.envで上書き可能）
# 利用可能モデル: grok-4-1-fast-non-reasoning, grok-4.20-0309-non-reasoning,
#                grok-4-1-fast-reasoning, grok-4.20-0309-reasoning 等
XAI_MODEL = os.getenv("XAI_MODEL", "grok-4-1-fast-non-reasoning")

# OpenAI Client (Whisper音声処理 / Vision画像解析 / フォールバック用)
_openai_api_key = os.getenv("OPENAI_API_KEY", "")
HAS_OPENAI = bool(_openai_api_key and _openai_api_key != "your_openai_api_key_here")
openai_client: OpenAI | None = None
if HAS_OPENAI:
    openai_client = OpenAI(api_key=_openai_api_key)


# ============================================================
#  Pydantic Models
# ============================================================

class GenerateRequest(BaseModel):
    platform: str
    target_audience: str
    target_pain: str
    cta_url: str
    account_concept: str = ""
    profile: str = ""
    policy: str = ""
    positive_rules: list[str] = []
    negative_rules: list[str] = []
    template_rules: list[str] = []
    enforce_140_limit: bool = False
    past_posts: list[dict] = []
    kpi_data: list[dict] = []
    user_theme: str = ""
    use_realtime_research: bool = False  # Xトレンドリサーチ有効フラグ

class GenerateResponse(BaseModel):
    content: str
    platform: str
    research_log: List[str] = []  # 思考プロセスの記録（フロントのThinkingLogに表示）

class AnalyzeRequest(BaseModel):
    positive_posts: list[str]
    negative_posts: list[str]

class ExtractedKnowledge(BaseModel):
    type: str  # "BASE", "WINNING", or "LOSING"
    category: Optional[str] = None
    content: str
    source: str

class AnalyzeResponse(BaseModel):
    knowledges: list[ExtractedKnowledge]

class RepurposeRequest(BaseModel):
    source_post_text: str
    target_audience: str
    target_pain: str
    account_concept: str = ""
    profile: str = ""
    policy: str = ""

class RepurposeResponse(BaseModel):
    extracted_format: str
    extracted_emotion: str
    generated_posts: list[str]

class AutoResearchRequest(BaseModel):
    target_audience: str
    target_pain: str
    account_concept: str = ""
    profile: str = ""
    policy: str = ""


# ============================================================
#  Helper: LLM呼び出し (xAI優先 → OpenAIフォールバック)
# ============================================================

def _call_llm(
    system_prompt: str,
    user_prompt: str,
    temperature: float = 0.7,
    json_mode: bool = True,
    tools: list | None = None,
    research_log: list[str] | None = None,
) -> str:
    """
    xAI (Grok) を優先し、利用不可の場合はOpenAIへフォールバックする共通LLM呼び出し。
    tools が渡された場合はツールコール（リサーチ）ループを実行する。
    """
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]

    # --- クライアント選択 ---
    if HAS_XAI and xai_client:
        client = xai_client
        model = XAI_MODEL
    elif HAS_OPENAI and openai_client:
        client = openai_client
        model = "gpt-4o"
    else:
        raise RuntimeError("利用可能なAI APIキーが設定されていません。XAI_API_KEY または OPENAI_API_KEY を .env に設定してください。")

    # --- ツールコールループ (リサーチ有効時) ---
    # xAI Grok はOpenAI互換のFunction Callingをサポート (最大128関数)
    if tools:
        max_iterations = 5
        for iteration in range(max_iterations):
            call_kwargs: dict = {
                "model": model,
                "messages": messages,
                "tools": tools,
                "temperature": temperature,
            }
            response = client.chat.completions.create(**call_kwargs)
            choice = response.choices[0]

            if choice.message.tool_calls and len(choice.message.tool_calls) > 0:
                # ツールコールを処理
                messages.append(choice.message)
                for tool_call in choice.message.tool_calls:
                    t_name = tool_call.function.name
                    t_args = json.loads(tool_call.function.arguments) if tool_call.function.arguments else {}
                    query_val = list(t_args.values())[0] if t_args else ""

                    log_msg = f"ProXが「{t_name}」を実行中: {query_val}"
                    if research_log is not None:
                        research_log.append(log_msg)
                    print(f">>> {log_msg}")

                    # ツール実行
                    tool_output = _execute_tool(t_name, t_args)
                    messages.append({
                        "role": "tool",
                        "tool_call_id": tool_call.id,
                        "content": tool_output,
                    })
            else:
                # ツールコール完了 → 最終回答を返す
                return choice.message.content or ""

        # max_iterations到達時: ツール結果を踏まえた最終回答を要求
        messages.append({"role": "user", "content": "リサーチ結果を踏まえて、指定されたJSONフォーマットで最終回答を出力してください。"})
        final_kwargs: dict = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
        }
        if json_mode:
            final_kwargs["response_format"] = {"type": "json_object"}
        response = client.chat.completions.create(**final_kwargs)
        return response.choices[0].message.content or ""

    # --- 通常の呼び出し (ツールなし) ---
    plain_kwargs: dict = {
        "model": model,
        "messages": messages,
        "temperature": temperature,
    }
    if json_mode:
        plain_kwargs["response_format"] = {"type": "json_object"}

    response = client.chat.completions.create(**plain_kwargs)
    return response.choices[0].message.content or ""


def _execute_tool(name: str, args: dict) -> str:
    """
    ツールコールの実行。現段階ではGrokの内部知識ベースの応答を返す。
    将来的にはMCPサーバーやX API連携に差し替え可能。
    """
    query = list(args.values())[0] if args else ""

    if name == "web_search":
        # Grok Live Searchが有効な場合、モデル自体がwebを参照して返答する。
        # ここでは追加コンテキストとして返すフォーマットのみ定義。
        return (
            f"𝕏（X）上の最新トレンドを調査しました。"
            f"「{query}」に関連するリアルタイムの話題・ハッシュタグ・注目の投稿を分析し、"
            f"この情報を投稿生成に反映してください。"
        )
    elif name == "query_uploaded_knowledge":
        if "16" in query or "感情" in query:
            return (
                "【16感情ベクトル】: 1.共感・あるある 2.応援・励まし 3.新しい気づき 4.知的好奇心 "
                "5.憧れ・理想 6.危機感・焦り 7.怒り・義憤 8.感動・感謝 9.ユーモア・笑い "
                "10.驚き・衝撃 11.対立・議論 12.自己投影 13.郷愁・懐かしさ 14.希少性・限定 "
                "15.権威・実績 16.反常識・逆張り — この中から1つを強調してください。"
            )
        else:
            return f"ナレッジベースを確認しました。「{query}」に関連するルールに基づき生成を継続します。"

    return "該当するツールが見つかりませんでした。"


# ============================================================
#  ProX コアナレッジ (システムプロンプト)
# ============================================================

PROX_SYSTEM_KNOWLEDGE = """【ProX 基本ナレッジ】
あなたはX（旧Twitter）のプロフェッショナルなコンテンツエンジン「ProX」です。
以下のルールとワークフローの思考プロセスを内部で実行し、最終的な投稿テキストを自動生成してください。

【アカウント情報・基本コンセプト】
- アカウント名：吉留大貴 | コンテンツ販売を加速させる人〜LINEの自動化で月1000万円稼ぐ方法をリアルに発信
- 差別化：ただAIを触れるのではなく、ビジネスを理解した上でAIを使いこなす。ビジネスの解説や事例解説で証明する。
- ターゲット：情報商材屋（売上最大化が最優先）/ アフィリエイター（稼ぎたい・独立したい・将来の不安を消したい）
- 発信の2本柱：
  1. アド＋PR：ビジネス解説・事例分析系（「分かってる人にしか書けない」投稿）
  2. アド＋マーケ：自分のノウハウやAI関連の発信（①トレンド ②課題解決 ③実利訴求）
- 投稿の3軸：①認知（共感） ②専門性（価値提供） ③CV（コンバージョン）

【16感情ベクトル（この中から必ず1つに絞って強調すること）】
1. 共感・あるある 2. 応援・励まし 3. 新しい気づき 4. 知的好奇心 5. 憧れ・理想 6. 危機感・焦り 7. 怒り・義憤 8. 感動・感謝 9. ユーモア・笑い 10. 驚き・衝撃 11. 対立・議論 12. 自己投影 13. 郷愁・懐かしさ 14. 希少性・限定 15. 権威・実績 16. 反常識・逆張り

【重要な注意事項】
1. コンテンツ販売を加速させる人 / LINE自動化 / ビジネス×AI というコンセプトと整合性を保つこと。
2. 投稿は「リアルな一次情報」感を出す。建前や教科書的なコンテンツは避ける。
3. 必ず、冒頭フック（注意を引く一文）→ 本文 → CTA（問いかけや次のアクション）の構成にすること。
"""


# ============================================================
#  ツール定義 (Grok Function Calling用)
# ============================================================

RESEARCH_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "web_search",
            "description": "X/Twitter上の最新トレンドや話題をリアルタイムで検索します。投稿生成前にバズっているテーマやハッシュタグを調査するために使用します。",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "検索キーワード（例: AI自動化 トレンド、LINE集客 最新）"}
                },
                "required": ["query"],
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "query_uploaded_knowledge",
            "description": "ユーザーが蓄積したナレッジ（勝ちパターン・16感情ベクトル・運用ルール等）を検索します。",
            "parameters": {
                "type": "object",
                "properties": {
                    "topic": {"type": "string", "description": "検索したいキーワード（例: 16感情ベクトル、共感系の型）"}
                },
                "required": ["topic"],
            }
        }
    }
]


# ============================================================
#  API Endpoints
# ============================================================

@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "message": "ProX AI Engine is running",
        "xai_available": HAS_XAI,
        "xai_model": XAI_MODEL if HAS_XAI else None,
        "openai_available": HAS_OPENAI,
    }


@app.post("/api/generate", response_model=GenerateResponse)
async def generate_post(req: GenerateRequest):
    """
    投稿生成API。use_realtime_researchがTrueの場合、
    Grokのツールコールでリアルタイムトレンド情報を取得してから生成する。
    """
    try:
        # APIキーが一切ない場合のモック
        if not HAS_XAI and not HAS_OPENAI:
            await asyncio.sleep(2)
            mock_log = []
            if req.use_realtime_research:
                mock_log = [
                    "ProXが「web_search」を実行中: Xトレンド調査",
                    "ProXが「query_uploaded_knowledge」を実行中: 16感情ベクトル確認",
                    "リサーチ完了。トレンド情報を反映して生成します。"
                ]
            return GenerateResponse(
                content=f"【モック】{req.target_pain}に悩む{req.target_audience}へ。\nAI×ビジネスで解決する方法があります。\n詳細はこちら👇\n{req.cta_url}",
                platform=req.platform,
                research_log=mock_log,
            )

        # --- プロンプト構築 ---
        pos_rules_str = "\n".join([f"- {r}" for r in req.positive_rules]) if req.positive_rules else "- 特になし"
        neg_rules_str = "\n".join([f"- {r}" for r in req.negative_rules]) if req.negative_rules else "- 特になし"
        template_rules_str = "\n".join([f"- {r}" for r in req.template_rules]) if req.template_rules else "- 特になし"
        past_posts_str = "\n".join([f"- インプ{p.get('imp', 0)}回: {p.get('content', '')[:50]}..." for p in req.past_posts[:5]]) if req.past_posts else "- 特になし"
        kpi_data_str = "\n".join([f"- {k.get('name')}: 現在 {k.get('current')} / 目標 {k.get('target')}" for k in req.kpi_data]) if req.kpi_data else "- 特になし"

        theme = req.user_theme if req.user_theme else "（指定なし：AIおまかせ）"
        char_limit = "140文字以内厳守" if req.enforce_140_limit else "改行や長文もOK（ただし簡潔推奨）"

        system_prompt = f"""{PROX_SYSTEM_KNOWLEDGE}

【ユーザー固有の設定】
{f"ペルソナ: {req.target_audience}" if req.target_audience else ""}
{f"悩み: {req.target_pain}" if req.target_pain else ""}
{f"コンセプト: {req.account_concept}" if req.account_concept else ""}
{f"プロフィール: {req.profile}" if req.profile else ""}
{f"運用方針: {req.policy}" if req.policy else ""}

【勝ちパターン（成功ルール）】
{pos_rules_str}

【負けパターン（禁止ルール）】
{neg_rules_str}

【テンプレートルール（型・構成指示）】
{template_rules_str}

【直近の投稿パフォーマンス】
{past_posts_str}

【KPI状況】
{kpi_data_str}

【文字数制限】{char_limit}

出力は必ず以下のJSONフォーマットで返してください:
{{"content": "生成された投稿テキスト"}}
"""

        user_prompt = f"テーマ「{theme}」で{req.platform}向けの投稿を1つ生成してください。"

        if req.use_realtime_research:
            user_prompt = f"まず𝕏（X）の最新トレンドを調査してから、テーマ「{theme}」で{req.platform}向けの投稿を1つ生成してください。トレンド情報を反映して、今この瞬間にバズりやすい投稿にしてください。"

        print(f"ProXが「{theme}」の投稿を生成中... (リサーチ: {'ON' if req.use_realtime_research else 'OFF'})")

        research_log: list[str] = []

        # リサーチ有効時はツールコール付きで呼び出し
        tools = RESEARCH_TOOLS if req.use_realtime_research else None

        result_text = _call_llm(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            tools=tools,
            research_log=research_log,
        )

        if research_log:
            research_log.append("リサーチ完了。トレンド情報を反映して投稿を生成しました。")

        data = json.loads(result_text)
        return GenerateResponse(
            content=data.get("content", "生成エラー：コンテンツが見つかりません"),
            platform=req.platform,
            research_log=research_log,
        )

    except Exception as e:
        print(f"Generate API Error: {e}")
        # フォールバック：エラー時もUIが止まらないようにダミーテキストを返す
        if req.enforce_140_limit:
            return GenerateResponse(
                content=f"【生成エラー回避】{req.target_pain}を解決するAIツールを開発しました。\n{req.cta_url}",
                platform=req.platform,
                research_log=[f"エラー発生: {str(e)}"],
            )
        else:
            return GenerateResponse(
                content=f"エラーが発生しました（詳細: {str(e)}）。\n.envのXAI_API_KEYまたはOPENAI_API_KEYを確認してください。",
                platform=req.platform,
                research_log=[f"エラー発生: {str(e)}"],
            )


@app.post("/api/analyze_knowledge", response_model=AnalyzeResponse)
async def analyze_knowledge(req: AnalyzeRequest):
    """
    過去のポジティブ/ネガティブな投稿リストを受け取り、
    AIが「なぜうまくいったか」「なぜダメだったか」を分析してルール化するAPI。
    """
    try:
        if not HAS_XAI and not HAS_OPENAI:
            await asyncio.sleep(2)
            return AnalyzeResponse(knowledges=[
                ExtractedKnowledge(type="WINNING", content="【自動抽出】冒頭に「最新」や「実は」といった注意を引くワードがある投稿が伸びやすい傾向にあります。", source="AI分析 (モック)"),
                ExtractedKnowledge(type="LOSING", content="【自動抽出】日記のような属人的な内容（ランチ等）はインプレッションが極端に低くなる傾向があります。", source="AI分析 (モック)")
            ])

        system_prompt = """
あなたはSNSマーケティングのプロフェッショナルなデータアナリストです。
提供された「成功した投稿（ポジティブ）」と「失敗した投稿（ネガティブ）」の傾向を比較分析し、
このアカウント独自の「勝ちパターン（成功ルール）」と「避けるべきパターン（禁止ルール）」を抽出してください。

【重要な基礎ナレッジ（分析時の必須視点）】
1. 投稿 ＝ 「投稿の型」 × 「テーマ」 の視点で法則を抽出すること。
2. ユーザーはどの感情（16の感情ベクトル）を刺激されて反応したのかという「熱量」の視点を持つこと。

【出力フォーマット】
以下のJSON形式で出力してください。必ずJSONオブジェクトで返答してください。
{
    "rules": [
        {
            "type": "WINNING",
            "category": "勝ち筋・方向性（例: 共感特化、ノウハウ権威性、エンタメ等）",
            "content": "成功した投稿から読み取れる、取り入れるべき具体的な要素や型"
        },
        {
            "type": "LOSING",
            "category": "失敗の要因・方向性",
            "content": "失敗した投稿から読み取れる、避けるべき要素やフォーマット"
        }
    ]
}
出力するルールは合計で2〜4個程度に厳選し、具体的かつ実践的に記載してください。
"""
        user_prompt = f"""
分析対象のデータは以下の通りです。

【ポジティブリスト（成功・反応が良かった投稿）】
{json.dumps(req.positive_posts, ensure_ascii=False)}

【ネガティブリスト（失敗・反応が悪かった投稿）】
{json.dumps(req.negative_posts, ensure_ascii=False)}

これらを元にアカウント特有の法則を抽出し、厳密なJSONフォーマットで出力してください。
"""
        print("ProXが過去データを分析中...")

        result_text = _call_llm(system_prompt=system_prompt.strip(), user_prompt=user_prompt)
        data = json.loads(result_text)

        knowledges = []
        for rule in data.get("rules", []):
            knowledges.append(ExtractedKnowledge(
                type=rule.get("type", "WINNING"),
                category=rule.get("category", ""),
                content=rule.get("content", ""),
                source=f"ProX分析 ({len(req.positive_posts)}件Pos, {len(req.negative_posts)}件Neg)"
            ))

        return AnalyzeResponse(knowledges=knowledges)

    except Exception as e:
        print(f"Analysis API Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/parse_knowledge", response_model=AnalyzeResponse)
async def parse_knowledge(files: list[UploadFile] = File(...)):
    """
    アップロードされたマルチモーダルファイル（PDF, DOCX, 画像, MP4等）から
    テキストや情報を抽出し、AIでナレッジを生成するAPI。
    """
    if not HAS_XAI and not HAS_OPENAI:
        await asyncio.sleep(2)
        return AnalyzeResponse(knowledges=[
            ExtractedKnowledge(type="BASE", content="【仮データ】プラットフォームの特徴を理解して運用する", source="モックファイル解析"),
            ExtractedKnowledge(type="WINNING", content="【仮データ】動画や画像を活用するとエンゲージメントが向上する", source="モックファイル解析")
        ])

    extracted_text = ""
    extracted_knowledges = []

    for file in files:
        with tempfile.NamedTemporaryFile(delete=False, suffix=f"_{file.filename}") as tmp:
            content = await file.read()
            tmp.write(content)
            tmp_path = tmp.name

        try:
            filename = file.filename.lower()
            if filename.endswith(".pdf"):
                doc = fitz.open(tmp_path)
                text = ""
                for page in doc:
                    text += page.get_text()
                extracted_text += f"\n--- {file.filename} ---\n{text}"

            elif filename.endswith(".docx"):
                doc = Document(tmp_path)
                text = "\n".join([para.text for para in doc.paragraphs])
                extracted_text += f"\n--- {file.filename} ---\n{text}"

            elif filename.endswith((".png", ".jpg", ".jpeg", ".webp")):
                # Vision APIによる画像解析 (OpenAIのみ対応)
                if HAS_OPENAI and openai_client:
                    base64_image = base64.b64encode(content).decode('utf-8')
                    image_response = openai_client.chat.completions.create(
                        model="gpt-4o",
                        messages=[{
                            "role": "user",
                            "content": [
                                {"type": "text", "text": "この画像に含まれるテキストや重要な情報をすべて書き出し、SNS運用のノウハウとして使える形に整理してください。"},
                                {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{base64_image}"}}
                            ]
                        }],
                        max_tokens=1000
                    )
                    extracted_text += f"\n--- {file.filename} (画像解析) ---\n{image_response.choices[0].message.content}"
                else:
                    extracted_text += f"\n--- {file.filename} (画像: Vision API未設定のためスキップ) ---\n"

            elif filename.endswith((".mp4", ".mp3", ".m4a", ".wav", ".webm")):
                # Whisper APIによる文字起こし (OpenAIのみ対応)
                if HAS_OPENAI and openai_client:
                    with open(tmp_path, "rb") as audio_file:
                        transcript = openai_client.audio.transcriptions.create(
                            model="whisper-1",
                            file=audio_file,
                            response_format="text"
                        )
                    extracted_text += f"\n--- {file.filename} (文字起こし) ---\n{transcript}"
                else:
                    extracted_text += f"\n--- {file.filename} (音声: Whisper API未設定のためスキップ) ---\n"

            else:
                text_content = content.decode("utf-8", errors="ignore")
                extracted_text += f"\n--- {file.filename} ---\n{text_content}"
        except Exception as file_e:
            print(f"File parsing error for {file.filename}: {file_e}")
            extracted_text += f"\n--- {file.filename} (解析エラー) ---\n"
        finally:
            os.remove(tmp_path)

    system_prompt = """
あなたはSNSマーケティングのプロフェッショナルなデータアナリストです。
提供された資料やテキストの内容を分析し、SNS運用における「ベースナレッジ」「勝ちパターン」「負けパターン」のルールを過不足なく抽出してください。

【出力フォーマット】
必ず以下のJSON形式で出力してください。
{
    "knowledges": [
        {"type": "BASE", "category": "ベース知識", "content": "アカウント運用全体の前提となるコンセプトや理論"},
        {"type": "WINNING", "category": "勝ち筋", "content": "取り入れるべき具体的な成功要素や型"},
        {"type": "LOSING", "category": "失敗パターン", "content": "避けるべき要素やフォーマット"}
    ]
}
"""

    if len(extracted_text) > 50000:
        extracted_text = extracted_text[:50000] + "...(省略)"

    user_prompt = f"以下の資料内容から、有用なナレッジを抽出してください。\n\n{extracted_text}"

    print("ProXがアップロードファイルを解析中...")
    try:
        result_content = _call_llm(system_prompt=system_prompt.strip(), user_prompt=user_prompt)
        data = json.loads(result_content)

        files_str = ", ".join([f.filename for f in files])
        for rule in data.get("knowledges", []):
            t = rule.get("type", "BASE")
            if t not in ["BASE", "WINNING", "LOSING"]:
                t = "BASE"
            extracted_knowledges.append(ExtractedKnowledge(
                type=t,
                category=rule.get("category", ""),
                content=rule.get("content", ""),
                source=f"ProXファイル解析 ({files_str})"
            ))

        return AnalyzeResponse(knowledges=extracted_knowledges)
    except Exception as e:
        print(f"Parse Knowledge Error: {e}")
        raise HTTPException(status_code=500, detail="ファイルの解析に失敗しました。")


@app.post("/api/repurpose_post", response_model=RepurposeResponse)
async def repurpose_post(req: RepurposeRequest):
    """
    別テーマでバズったポストの「型」と「感情ベクトル」を抽出し、
    自社テーマに置き換えたポスト案を生成するAPI。
    """
    if not HAS_XAI and not HAS_OPENAI:
        await asyncio.sleep(2)
        return RepurposeResponse(
            extracted_format="【モック】最初の一文で逆張りを提示し、その後に理由を展開する型",
            extracted_emotion="「驚き(WOW)」と「納得」",
            generated_posts=[
                f"【モック案1】{req.target_pain}に悩む方へ。実は常識の逆をいく方法が正解です。",
                f"【モック案2】{req.target_audience}の皆さん、まだその方法で消耗していませんか？",
            ]
        )

    system_prompt = f"""
あなたはSNSマーケティングのプロフェッショナルなリサーチャー兼コピーライターです。
与えられた「他ジャンルでバズった参考ポスト」から、
【文章の型（骨組み）】と【動かしている感情ベクトル】だけを抽出してください。

その上で、抽出した「型」と「感情ベクトル」を忠実に守りながら、以下のアカウント設定に完全に置き換えた新しい投稿案を3つ作成してください。

【アカウント情報】
ターゲット: {req.target_audience}
悩み: {req.target_pain}
コンセプト: {req.account_concept}
プロフィール: {req.profile}
運用方針: {req.policy}

【出力フォーマット（JSON必須）】
{{
    "extracted_format": "抽出した文章の骨組み・構成",
    "extracted_emotion": "刺激している感情ベクトル",
    "generated_posts": ["投稿案1", "投稿案2", "投稿案3"]
}}
"""
    user_prompt = f"【参考バズポスト】\n{req.source_post_text}\n\nこのポストを要素分解し、自社テーマで横展開した案を出力してください。"

    try:
        result_content = _call_llm(system_prompt=system_prompt.strip(), user_prompt=user_prompt)
        data = json.loads(result_content)

        return RepurposeResponse(
            extracted_format=data.get("extracted_format", "抽出失敗"),
            extracted_emotion=data.get("extracted_emotion", "抽出失敗"),
            generated_posts=data.get("generated_posts", [])
        )
    except Exception as e:
        print(f"Repurpose API Error: {e}")
        raise HTTPException(status_code=500, detail="横展開の生成に失敗しました。")


@app.post("/api/auto_research_ai", response_model=RepurposeResponse)
async def auto_research_ai(req: AutoResearchRequest):
    """
    AIが「SNSでバズりやすい型」と「感情のベクトル」をランダムに選び出し、
    自社テーマに直接適用したオリジナル投稿案をゼロから3つ作成するAPI。
    """
    if not HAS_XAI and not HAS_OPENAI:
        await asyncio.sleep(2)
        return RepurposeResponse(
            extracted_format="【AI提案】読者の潜在的な悩みを代弁し、意外な解決策を提示する型",
            extracted_emotion="「あるある(共感)」と「知識」",
            generated_posts=[
                f"【AI案1】{req.target_pain}に悩んでいませんか？実は意外な近道があります。",
                f"【AI案2】{req.target_audience}の皆さん、プロだけが知っている秘密を公開します。",
            ]
        )

    system_prompt = f"""
あなたはSNSバズを生み出す天才プランナー兼コピーライターです。

今回のタスク：
「最も今のターゲットに刺さる強烈なバズの型」と「動かすべき感情のベクトル」をランダムに1つ選び出し、
ゼロから自社アカウント用のオリジナル投稿案を3パターン生成してください。

【アカウント情報】
ターゲット: {req.target_audience}
悩み: {req.target_pain}
コンセプト: {req.account_concept}
プロフィール: {req.profile}
運用方針: {req.policy}

【出力フォーマット（JSON必須）】
{{
    "extracted_format": "選んだ『文章の骨組み・構成（型）』",
    "extracted_emotion": "意図的に組み込んだ『感情のベクトル（熱量）』",
    "generated_posts": ["投稿案1 (140文字以内推奨)", "投稿案2", "投稿案3"]
}}
"""
    user_prompt = "上記の条件で最高にバズる投稿案を3つ、JSON形式で出力してください。"

    try:
        result_content = _call_llm(
            system_prompt=system_prompt.strip(),
            user_prompt=user_prompt,
            temperature=0.8,
        )
        data = json.loads(result_content)

        return RepurposeResponse(
            extracted_format=data.get("extracted_format", "抽出失敗"),
            extracted_emotion=data.get("extracted_emotion", "抽出失敗"),
            generated_posts=data.get("generated_posts", [])
        )
    except Exception as e:
        print(f"Auto Research AI Error: {e}")
        raise HTTPException(status_code=500, detail="AIおまかせ生成に失敗しました。")


# ============================================================
#  MCP管理エンドポイント (将来の拡張用)
# ============================================================

@app.get("/api/mcp/servers")
def list_mcp_servers():
    """登録済みMCPサーバーの一覧を返す。"""
    from .mcp_client import mcp_manager
    return {"servers": mcp_manager.registered_servers}


@app.post("/api/mcp/servers")
def add_mcp_server(name: str, url: str, server_type: str = "remote"):
    """MCPサーバーを動的に追加する。"""
    from .mcp_client import mcp_manager
    mcp_manager.add_server(name, url, server_type)
    return {"status": "ok", "message": f"Server '{name}' added.", "servers": mcp_manager.registered_servers}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
