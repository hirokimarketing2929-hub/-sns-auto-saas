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
from typing import Optional

load_dotenv()

app = FastAPI(title="ProX Agent API")

# Next.jsからのCORS許可
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://sns-auto-saas.vercel.app"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# OpenAI Clientの初期化
try:
    client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    HAS_OPENAI = True
except Exception:
    client = None
    HAS_OPENAI = False

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

class GenerateResponse(BaseModel):
    content: str
    platform: str

@app.get("/health")
def health_check():
    return {"status": "ok", "message": "ProX Agent AI Engine is running"}

def _generate_ai_content(req: GenerateRequest) -> str:
    # 新しい3層構造ナレッジをプロンプトに統合
    persona = f"【ターゲット】: {req.target_audience}\n【ターゲットの悩み】: {req.target_pain}"
    account_info = f"【コンセプト】: {req.account_concept}\n【プロフィール】: {req.profile}\n【全体運用方針】: {req.policy}"
    
    pos_rules_str = "\n".join([f"- {r}" for r in req.positive_rules]) if req.positive_rules else "- 特になし"
    neg_rules_str = "\n".join([f"- {r}" for r in req.negative_rules]) if req.negative_rules else "- 特になし"
    template_rules_str = "\n".join([f"- {r}" for r in req.template_rules]) if req.template_rules else "- 特になし"
    
    # スプレッドシート（設定済みの場合）から取得したデータを文字化
    past_posts_str = "\n".join([f"- インプレッション {p.get('imp', 0)}回: {p.get('content', '')[:50]}..." for p in req.past_posts[:5]]) if req.past_posts else "- 特になし"
    kpi_data_str = "\n".join([f"- {k.get('name')}: 現在 {k.get('current')} / 目標 {k.get('target')}" for k in req.kpi_data]) if req.kpi_data else "- 特になし"

    # プロXエージェント ナレッジプロンプトの組み込み（自動出力用の調整）
    system_knowledge = """【プロXエージェントの基本ナレッジ】
あなたはX（旧Twitter）のプロフェッショナルな運用エージェント（構成作家・マーケター）です。
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
2. 投稿は「リアル・裏側公開系」のトーンを維持すること。
3. 「ビジネスの解像度が高い人」という印象を与える内容にすること。
4. 感情ベクトルは必ず1つに絞ること（複数混在させない）。
5. ユーザーからの指定（コンセプト、ペルソナ、禁止ルール等）がある場合はそれも厳守すること。"""
    
    # 文字数制限オプション
    platform_rules = ""
    if req.enforce_140_limit:
        platform_rules = "【重要事項：文字数制限】\nXの無料API制限を回避するため、必ず「日本語の全角で135文字以内（URL、改行、スペースを全て含む）」に極限まで短く要約して出力してください。140文字を超えるとシステムがクラッシュします。"
    
    theme = f"悩みを解決し、プロラインへの導入（{req.cta_url}）を促す"
    
    system_prompt = f"""
{system_knowledge}

{platform_rules}

【ユーザーからの指定情報】
{account_info}

【投稿ターゲットの悩み】
{persona}

【現在の営業KPI（目標到達度）】
{kpi_data_str}

【過去のトップ投稿成績（スプレッドシート連携実績）】
{past_posts_str}

【投稿の型（テンプレート構成）】※必ずこの構成や流れに沿って文章を構築すること
{template_rules_str}

【アカウント独自の勝ちパターン（成功ルール）】※必ず取り入れること
{pos_rules_str}

【アカウント独自の負けパターン（禁止ルール）】※絶対に避けること
{neg_rules_str}

【出力フォーマット】
以下のJSONオブジェクト形式でのみ出力してください。他のメッセージは一切不要です。
{{
  "content": "ここにSNSへ投稿する本番用テキストを記載してください。"
}}
"""
    user_prompt = f"今回の投稿テーマは「{theme}」です。上記のルールに従い、投稿を自動生成してJSONで出力してください。"

    if not HAS_OPENAI or not os.getenv("OPENAI_API_KEY") or os.getenv("OPENAI_API_KEY") == "your_openai_api_key_here":
        # APIキーがない場合のモック
        print("APIキーが未設定のためモックを返します")
        mock_text = f"【実は…】{req.target_pain}を解決する唯一の方法は「AI自動化」です！\n仕組みの作り方を公開しました👇\n{req.cta_url}"
        return mock_text

    print(f"「{theme}」の台本をAIに生成させています...")
    try:
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.7,
            response_format={"type": "json_object"}
        )
        result_text = response.choices[0].message.content
        data = json.loads(result_text)
        return data.get("content", "生成エラー：コンテンツが見つかりません")
    except Exception as e:
        print(f"API Error (Fallback Action Triggered): {e}")
        # 残高不足やエラー時は、UI開発を止めないためにフォールバック（代替）テキストを返す
        if req.enforce_140_limit:
            return f"【キャバクラ行きすぎ注意🤫】\n{req.target_pain}を解決する秘密のAIツールを開発しました。\nAPI残高不足エラーも自動回避してテスト投稿が可能です✨\n詳細はこちら👇\n{req.cta_url}"
        else:
            return f"""【超重要】{req.target_pain}に悩む方へ

実は、APIの残高が不足している（キャバクラ課金優先）場合でも、システムのUIや投稿スケジューラーのテストは問題なく進行可能です！✨

この長文は、「OpenAI APIがエラーになった時にフォールバックとして出力される」テスト用のダミーテキストです。
140文字制限チェックを外しているため、このように改行を含めたリッチな長文テキストがUI上に生成されているはずです。

画像添付機能、ツリー投稿機能、そしてインプ連動リプライ機能の開発やテストは、このダミーテキストを使って進めることができます。
本格運用を開始する準備ができたら、OpenAIにチャージして本番稼働させましょう！👇

{req.cta_url}"""

@app.post("/api/generate", response_model=GenerateResponse)
async def generate_post(req: GenerateRequest):
    """
    Next.jsから呼ばれる投稿生成API。
    """
    try:
        # FastAPIのイベントループをブロックしないようにスレッドで実行するか
        # またはすぐ終わるモックなら直接await
        if not HAS_OPENAI or not os.getenv("OPENAI_API_KEY") or os.getenv("OPENAI_API_KEY") == "your_openai_api_key_here":
            await asyncio.sleep(2)  # モック時はUXのために少し待たせる
            
        content = _generate_ai_content(req)
        return GenerateResponse(content=content, platform=req.platform)
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class AnalyzeRequest(BaseModel):
    positive_posts: list[str]
    negative_posts: list[str]

class ExtractedKnowledge(BaseModel):
    type: str # "BASE", "WINNING", or "LOSING"
    category: Optional[str] = None # 追加:勝ち筋の分類
    content: str
    source: str

class AnalyzeResponse(BaseModel):
    knowledges: list[ExtractedKnowledge]

@app.post("/api/analyze_knowledge", response_model=AnalyzeResponse)
async def analyze_knowledge(req: AnalyzeRequest):
    """
    過去のポジティブ/ネガティブな投稿リストを受け取り、
    AIが「なぜうまくいったか」「なぜダメだったか」を分析してルール化するAPI。
    """
    try:
        if not HAS_OPENAI or not os.getenv("OPENAI_API_KEY") or os.getenv("OPENAI_API_KEY") == "your_openai_api_key_here":
            # APIキーがない場合のモックデータ
            await asyncio.sleep(2)
            return AnalyzeResponse(knowledges=[
                ExtractedKnowledge(type="WINNING", content="【自動抽出】冒頭に「最新」や「実は」といった注意を引くワードがある投稿が伸びやすい傾向にあります。", source="AI分析 (1件のポジティブ投稿から)"),
                ExtractedKnowledge(type="LOSING", content="【自動抽出】日記のような属人的な内容（ランチ等）はインプレッションが極端に低くなる傾向があります。", source="AI分析 (1件のネガティブ投稿から)")
            ])

        # 実装済みのOpenAI処理
        system_prompt = """
あなたはSNSマーケティングのプロフェッショナルなデータアナリストです。
提供された「成功した投稿（ポジティブ）」と「失敗した投稿（ネガティブ）」の傾向を比較分析し、
このアカウント独自の「勝ちパターン（成功ルール）」と「避けるべきパターン（禁止ルール）」を抽出してください。

【重要な基礎ナレッジ（分析時の必須視点）】
1. 投稿 ＝ 「投稿の型」 × 「テーマ」 の視点で法則を抽出すること。
2. ユーザーはどの感情（16の感情ベクトル：知識、あるある、FUN、WOW、尊い、癒し、感動、主張、物申す 等）を刺激されて反応したのかという「熱量」の視点を持つこと。

【出力フォーマット】
以下のJSON形式で出力してください。必ずJSONオブジェクトで返答してください。
{
    "rules": [
        {
            "type": "WINNING",
            "category": "どのような勝ち筋・方向性か（例: 共感特化、ノウハウ権威性、エンタメ、属人性など。数文字〜十数文字程度）",
            "content": "成功した投稿から読み取れる、次回以降も必ず取り入れるべき具体的な要素や型"
        },
        {
            "type": "LOSING",
            "category": "失敗の要因・方向性",
            "content": "失敗した投稿から読み取れる、避けるべき要素やフォーマット"
        }
    ]
}
出力するルールは合計で2〜4個程度（ポジネガそれぞれ1〜2個ずつ）に厳選し、具体的かつ実践的に記載してください。
"""
        
        user_prompt = f"""
分析対象のデータは以下の通りです。

【ポジティブリスト（成功・反応が良かった投稿）】
{json.dumps(req.positive_posts, ensure_ascii=False)}

【ネガティブリスト（失敗・反応が悪かった投稿）】
{json.dumps(req.negative_posts, ensure_ascii=False)}

これらを元にアカウント特有の法則を抽出し、厳密なJSONフォーマットで出力してください。
"""
        print("過去データをAIに分析させています...")
        
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.7,
            response_format={"type": "json_object"}
        )
        
        result_text = response.choices[0].message.content
        data = json.loads(result_text)
        
        knowledges = []
        for rule in data.get("rules", []):
            knowledges.append(ExtractedKnowledge(
                type=rule.get("type", "WINNING"),
                category=rule.get("category", ""),
                content=rule.get("content", ""),
                source=f"AI分析 ({len(req.positive_posts)}件のPos, {len(req.negative_posts)}件のNegから抽出)"
            ))
            
        return AnalyzeResponse(knowledges=knowledges)

    except Exception as e:
        print(f"Analysis API Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/parse_knowledge", response_model=AnalyzeResponse)
async def parse_knowledge(files: list[UploadFile] = File(...)):
    """
    アップロードされたマルチモーダルファイル（PDF, DOCX, 画像, MP4等）から
    テキストや情報を抽出し、AIでナレッジ（BASE, WINNING, LOSING）を生成するAPI。
    """
    if not HAS_OPENAI or not os.getenv("OPENAI_API_KEY") or os.getenv("OPENAI_API_KEY") == "your_openai_api_key_here":
        # APIキーがない場合のモック動作
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
                # OpenAI Vision APIを用いた画像解析
                base64_image = base64.b64encode(content).decode('utf-8')
                image_response = client.chat.completions.create(
                    model="gpt-4o",
                    messages=[
                        {
                            "role": "user",
                            "content": [
                                {"type": "text", "text": "この画像に含まれるテキストや重要な情報をすべて書き出し、SNS運用のノウハウとして使える形に整理してください。"},
                                {
                                    "type": "image_url",
                                    "image_url": {"url": f"data:image/jpeg;base64,{base64_image}"}
                                }
                            ]
                        }
                    ],
                    max_tokens=1000
                )
                extracted_text += f"\n--- {file.filename} (画像解析) ---\n{image_response.choices[0].message.content}"
                
            elif filename.endswith((".mp4", ".mp3", ".m4a", ".wav", ".webm")):
                # Whisper APIを利用した音声・動画からの文字起こし
                with open(tmp_path, "rb") as audio_file:
                    transcript = client.audio.transcriptions.create(
                      model="whisper-1", 
                      file=audio_file,
                      response_format="text"
                    )
                extracted_text += f"\n--- {file.filename} (文字起こし) ---\n{transcript}"
                
            else:
                # Fallback for plain text files
                text_content = content.decode("utf-8", errors="ignore")
                extracted_text += f"\n--- {file.filename} ---\n{text_content}"
        except Exception as file_e:
            print(f"File parsing error for {file.filename}: {file_e}")
            extracted_text += f"\n--- {file.filename} (解析エラー) ---\n"
        finally:
            os.remove(tmp_path)

    # 抽出された大量のテキストをAIで分析し、ナレッジ（ルール）化する
    system_prompt = """
あなたはSNSマーケティングのプロフェッショナルなデータアナリストです。
提供された資料やテキストの内容を分析し、SNS運用における「ベースナレッジ」「勝ちパターン」「負けパターン」のルールを過不足なく抽出してください。抽出ルールの数は内容に応じて適宜調整してください（最大5個程度）。

【重要な基礎ナレッジ（分析時の必須視点）】
1. 投稿 ＝ 「投稿の型」 × 「テーマ」 の視点を取り入れること。
2. 読者の感情を動かす「16の感情ベクトル（知識、あるある、FUN、WOW、癒し、感動、物申すなど）」という熱量の概念を意識してノウハウをまとめること。

【出力フォーマット】
必ず以下のJSON形式で出力してください。
{
    "knowledges": [
        {
            "type": "BASE",
            "category": "ベース知識",
            "content": "アカウント運用全体の前提となる深いコンセプトや理論"
        },
        {
            "type": "WINNING",
            "category": "どのような勝ち筋・方向性か（例: 共感特化、知識提供、エンタメ等）",
            "content": "取り入れるべき具体的な成功要素や型"
        },
        {
            "type": "LOSING",
            "category": "失敗パターンの方向性",
            "content": "避けるべき要素やフォーマット"
        }
    ]
}
    """
    
    # テキストが長すぎる場合の簡易切り詰め（gpt-4oは128kまでいけるが念のため）
    if len(extracted_text) > 50000:
        extracted_text = extracted_text[:50000] + "...(省略)"

    user_prompt = f"以下の資料内容から、有用なナレッジを抽出してください。\n\n{extracted_text}"

    print("アップロードされたファイルをAIで解析しナレッジ化しています...")
    try:
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": system_prompt.strip()},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.7,
            response_format={"type": "json_object"}
        )
        
        data = json.loads(response.choices[0].message.content)
        
        files_str = ", ".join([f.filename for f in files])
        for rule in data.get("knowledges", []):
            t = rule.get("type", "BASE")
            if t not in ["BASE", "WINNING", "LOSING"]:
                t = "BASE"
            extracted_knowledges.append(ExtractedKnowledge(
                type=t,
                category=rule.get("category", ""),
                content=rule.get("content", ""),
                source=f"ファイル解析 ({files_str})"
            ))
            
        return AnalyzeResponse(knowledges=extracted_knowledges)
    except Exception as e:
        print(f"GPT Parsing Error: {e}")
        raise HTTPException(status_code=500, detail="ファイルの解析に失敗しました。")

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

@app.post("/api/repurpose_post", response_model=RepurposeResponse)
async def repurpose_post(req: RepurposeRequest):
    """
    別テーマでバズったポストの「型」と「感情ベクトル」を抽出し、
    自社テーマに置き換えた（パクリ疑惑を回避した）ポスト案を生成するAPI。
    """
    if not HAS_OPENAI or not os.getenv("OPENAI_API_KEY") or os.getenv("OPENAI_API_KEY") == "your_openai_api_key_here":
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
与えられた「他ジャンルでバズった参考ポスト」から、「表面的な事象・専門用語・トピック」を完全に排除し、
【文章の型（骨組み）】と【動かしている感情ベクトル（16の熱量：知識、あるある、FUN、WOW、尊い、癒し、感動、主張、物申す、応援など）】だけを抽出してください。

その上で、抽出した「型」と「感情ベクトル」を忠実に守りながら、以下のアカウント設定（自分のテーマ）に完全に置き換えた新しい投稿案を3つ作成してください。
※「パクリ」にならないよう、元ポストの業界特有の言葉やエピソードは一切使用せず、自社のターゲット層に向けた内容に書き換えること。

【アカウント情報】
ターゲット: {req.target_audience}
悩み: {req.target_pain}
コンセプト: {req.account_concept}
プロフィール: {req.profile}
運用方針: {req.policy}

【出力フォーマット（JSON必須）】
{{
    "extracted_format": "抽出した文章の骨組み・構成（例：冒頭でフック→箇条書きで理由展開→共感のオチ）",
    "extracted_emotion": "刺激している感情ベクトル（例：WOWからの納得）",
    "generated_posts": [
        "自社テーマに置き換えた投稿案1 (文字数140字以内を推奨)",
        "自社テーマに置き換えた投稿案2",
        "自社テーマに置き換えた投稿案3"
    ]
}}
"""
    user_prompt = f"【参考バズポスト】\n{req.source_post_text}\n\nこのポストを要素分解し、自社テーマで横展開した案を出力してください。"

    try:
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": system_prompt.strip()},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.7,
            response_format={"type": "json_object"}
        )
        data = json.loads(response.choices[0].message.content)
        
        return RepurposeResponse(
            extracted_format=data.get("extracted_format", "抽出失敗"),
            extracted_emotion=data.get("extracted_emotion", "抽出失敗"),
            generated_posts=data.get("generated_posts", [])
        )
    except Exception as e:
        print(f"Repurpose API Error: {e}")
        raise HTTPException(status_code=500, detail="横展開の生成に失敗しました。")

class AutoResearchRequest(BaseModel):
    target_audience: str
    target_pain: str
    account_concept: str = ""
    profile: str = ""
    policy: str = ""

@app.post("/api/auto_research_ai", response_model=RepurposeResponse)
async def auto_research_ai(req: AutoResearchRequest):
    """
    AIが自身の記憶から「SNSでバズりやすい型」と「感情のベクトル」をランダムに選び出し、
    自社テーマに直接適用したオリジナル投稿案をゼロから3つ作成するAPI。
    """
    if not HAS_OPENAI or not os.getenv("OPENAI_API_KEY") or os.getenv("OPENAI_API_KEY") == "your_openai_api_key_here":
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
世の中で大ヒットした「様々なバズポストの構造（型）」と「感情を動かす16の熱量」を無限に記憶しています。

今回のタスク：
あなた自身が「最も今のターゲットに刺さる強烈なバズの型」と「動かすべき感情のベクトル」をランダムに1つ選び出し、
それに従ってゼロから自社アカウント用のオリジナル投稿案を3パターン生成してください。

【アカウント情報】
ターゲット: {req.target_audience}
悩み: {req.target_pain}
コンセプト: {req.account_concept}
プロフィール: {req.profile}
運用方針: {req.policy}

【感情の16ベクトル候補】
知識、あるある、FUN、WOW、尊い、癒し、感動、主張、物申す、応援など

【出力フォーマット（JSON必須）】
{{
    "extracted_format": "あなたが今回選んだ『文章の骨組み・構成（型）』（例：強烈な逆張りのフック→共感のオチ）",
    "extracted_emotion": "あなたが今回選んで意図的に組み込んだ『感情のベクトル（熱量）』",
    "generated_posts": [
        "生成された投稿案1 (140文字以内推奨)",
        "生成された投稿案2",
        "生成された投稿案3"
    ]
}}
"""
    user_prompt = "上記の条件で最高にバズる投稿案を3つ、JSON形式で出力してください。"

    try:
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": system_prompt.strip()},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.8,
            response_format={"type": "json_object"}
        )
        data = json.loads(response.choices[0].message.content)
        
        return RepurposeResponse(
            extracted_format=data.get("extracted_format", "抽出失敗"),
            extracted_emotion=data.get("extracted_emotion", "抽出失敗"),
            generated_posts=data.get("generated_posts", [])
        )
    except Exception as e:
        print(f"Auto Research AI Error: {e}")
        raise HTTPException(status_code=500, detail="AIおまかせ生成に失敗しました。")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
