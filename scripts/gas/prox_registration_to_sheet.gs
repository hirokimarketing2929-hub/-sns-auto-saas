/**
 * 管理台帳GAS — ProX 新規登録イベントの署名付き受信＆スプレッドシート追記（task018② / meeting #007）。
 *
 * 【セットアップ手順】
 *  1. 管理台帳スプレッドシートを開き、拡張機能 > Apps Script でこのコードを貼り付ける。
 *  2. プロジェクトの設定 > スクリプト プロパティに以下を登録（コードに鍵を直書きしない）:
 *       PROX_REG_SHEET_SIGNING_SECRET = <ProX(Vercel)側と同一の合鍵>
 *       SHEET_NAME                    = <追記先シート名。未設定なら "登録台帳">
 *  3. デプロイ > 新しいデプロイ > 種類「ウェブアプリ」:
 *       - 次のユーザーとして実行: 自分
 *       - アクセスできるユーザー: 全員（匿名POSTを受けるため）
 *     発行された /exec URL を Vercel env PROX_REG_SHEET_WEBHOOK_URL に設定する。
 *
 * 【ProX(送信側)との契約】
 *  受信body（案B＝bodyミラー）: { signed_payload, _sig_ts, _sig }
 *   - signed_payload : payload を JSON.stringify した確定文字列（再構築しない）。
 *   - _sig_ts        : 送信時刻 Date.now() の ms 文字列。
 *   - _sig           : HMAC-SHA256(SECRET, _sig_ts + "." + signed_payload) の小文字hex。
 *  GAS は実HTTPステータスを返せないため、必ず応答bodyの ok で成否を伝える:
 *   - 成功      : {"ok": true,  "appended": true}
 *   - 署名NG    : {"ok": false, "error": "invalid signature"}   ← 追記しない
 *   - 期限切れ  : {"ok": false, "error": "stale timestamp"}      ← 追記しない
 *   - 不正形式  : {"ok": false, "error": "bad request"}          ← 追記しない
 */

var REPLAY_WINDOW_MS = 5 * 60 * 1000; // 署名対象の _sig_ts が現在時刻から±5分以内であることを要求（任意の防御）。

function doPost(e) {
  try {
    var props = PropertiesService.getScriptProperties();
    var secret = props.getProperty('PROX_REG_SHEET_SIGNING_SECRET');
    var sheetName = props.getProperty('SHEET_NAME') || '登録台帳';

    if (!secret) {
      return jsonOut_({ ok: false, error: 'server not configured' });
    }
    if (!e || !e.postData || !e.postData.contents) {
      return jsonOut_({ ok: false, error: 'bad request' });
    }

    var envelope = JSON.parse(e.postData.contents);
    var signedPayload = envelope.signed_payload;
    var sigTs = envelope._sig_ts;
    var sig = envelope._sig;
    if (typeof signedPayload !== 'string' || typeof sigTs !== 'string' || typeof sig !== 'string') {
      return jsonOut_({ ok: false, error: 'bad request' });
    }

    // 署名照合: ProX 側と同一式（_sig_ts + "." + signed_payload を署名）。
    var expected = proxSign_(secret, sigTs + '.' + signedPayload);
    if (!safeEquals_(expected, String(sig).toLowerCase())) {
      return jsonOut_({ ok: false, error: 'invalid signature' });
    }

    // リプレイ窓（任意）。_sig_ts が古すぎる/未来すぎるものは弾く。
    var tsNum = Number(sigTs);
    if (!isFinite(tsNum) || Math.abs(Date.now() - tsNum) > REPLAY_WINDOW_MS) {
      return jsonOut_({ ok: false, error: 'stale timestamp' });
    }

    // 署名検証OK。確定文字列をパースして1行追記する。
    var payload = JSON.parse(signedPayload);
    appendRow_(sheetName, payload);

    return jsonOut_({ ok: true, appended: true });
  } catch (err) {
    // 例外時も ok:false で返す（ProX 側は登録自体は成功扱い・ログのみ）。
    return jsonOut_({ ok: false, error: String(err) });
  }
}

/** payload を台帳シートへ1行追記。ヘッダ行が無ければ作成する。 */
function appendRow_(sheetName, payload) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName) || ss.insertSheet(sheetName);

  var headers = [
    'received_at', 'email', 'name', 'registered_at', 'invite_code',
    'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'x_id'
  ];
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
  }

  var row = [
    new Date(),
    payload.email || '',
    payload.name || '',
    payload.registered_at || '',
    payload.invite_code || '',
    payload.utm_source || '',
    payload.utm_medium || '',
    payload.utm_campaign || '',
    payload.utm_content || '',
    payload.x_id || ''
  ];
  sheet.appendRow(row);
}

/**
 * HMAC-SHA256 を小文字hexで返す（Node の createHmac('sha256', secret).update(msg).digest('hex') と一致）。
 * ProX 設定画面の prox_sign_ と同一実装。
 */
function proxSign_(secret, message) {
  var raw = Utilities.computeHmacSha256Signature(message, secret);
  var hex = '';
  for (var i = 0; i < raw.length; i++) {
    var b = (raw[i] + 256) % 256;
    var h = b.toString(16);
    if (h.length === 1) h = '0' + h;
    hex += h;
  }
  return hex; // lowercase hex
}

/** 長さ非依存にならない単純比較で十分（GAS 環境・短い hex 同士）。大小は呼び出し側で正規化済み。 */
function safeEquals_(a, b) {
  if (a.length !== b.length) return false;
  var diff = 0;
  for (var i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/** JSON レスポンスを返す。 */
function jsonOut_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
