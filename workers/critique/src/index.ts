import Anthropic from '@anthropic-ai/sdk';
import { CRITIQUE_CONTRACT_VERSION, isCritiqueRequestBody, MAX_BODY_LENGTH, type CritiqueRequestBody } from './validate';

export interface Env {
  readonly ANTHROPIC_API_KEY: string;
  readonly CRITIQUE_RATE_LIMITER: RateLimit;
}

const MODEL = 'claude-haiku-4-5-20251001';
const MAX_OUTPUT_TOKENS = 1024;
/** レート制限にかかったときに、次に試してよいまでの目安として返す秒数(wrangler.tomlのperiodと合わせる)。 */
const RATE_LIMIT_RETRY_AFTER_SECONDS = 60;

/** 採点結果とファイル構成から、Claudeに渡す日本語のプロンプトを組み立てる。 */
function buildPrompt(request: CritiqueRequestBody): string {
  return [
    '新卒〜4年目のエンジニア向けリファクタリング学習ゲームです。',
    'プレイヤーが今のコードベースの構造(ファイル・クラス・メソッドの行数、採点の減点内訳)を送ってきました。',
    'ルールベースの点数だけでは伝わらない「なぜこの分け方が良い/悪いのか」を、やさしい日本語で3〜5文の講評として書いてください。',
    '責務が混ざっているクラスや行数が多いファイルには具体的に触れ、良い点があればそれも1つ挙げてください。',
    `ステージの目標: ${request.goal}`,
    `採点データ(JSON): ${JSON.stringify({ score: request.score, files: request.files })}`,
  ].join('\n');
}

async function handleCritique(body: unknown, apiKey: string): Promise<Response> {
  if (!isCritiqueRequestBody(body)) return jsonResponse({ error: 'invalid-request' }, 400);
  const client = new Anthropic({ apiKey });
  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_OUTPUT_TOKENS,
      messages: [{ role: 'user', content: buildPrompt(body) }],
    });
    const critique = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('\n');
    return jsonResponse({ critique }, 200);
  } catch {
    return jsonResponse({ error: 'critique-failed' }, 502);
  }
}

function jsonResponse(body: unknown, status: number, extraHeaders?: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', ...extraHeaders },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, X-Critique-Contract',
        },
      });
    }
    if (request.method !== 'POST') return jsonResponse({ error: 'method-not-allowed' }, 405);
    const contractVersion = request.headers.get('X-Critique-Contract');
    if (contractVersion !== null && contractVersion !== String(CRITIQUE_CONTRACT_VERSION)) {
      return jsonResponse({ error: 'version-mismatch', expected: CRITIQUE_CONTRACT_VERSION }, 409);
    }
    // 認証なしで誰でも呼べるプロキシなので、IPごとにレート制限してAPI費用の乱用を防ぐ
    const clientIp = request.headers.get('CF-Connecting-IP') ?? 'unknown';
    const { success } = await env.CRITIQUE_RATE_LIMITER.limit({ key: clientIp });
    if (!success) {
      return jsonResponse({ error: 'rate-limited' }, 429, { 'Retry-After': String(RATE_LIMIT_RETRY_AFTER_SECONDS) });
    }
    const raw = await request.text();
    if (raw.length > MAX_BODY_LENGTH) return jsonResponse({ error: 'request-too-large' }, 413);
    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      return jsonResponse({ error: 'invalid-json' }, 400);
    }
    return handleCritique(body, env.ANTHROPIC_API_KEY);
  },
};
