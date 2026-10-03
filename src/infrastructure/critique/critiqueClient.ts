import type { RequestCritique } from '../../application/CritiqueUseCases';

type CritiqueResponseBody = { readonly critique: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isCritiqueResponseBody(value: unknown): value is CritiqueResponseBody {
  return isRecord(value) && typeof value.critique === 'string';
}

/**
 * Cloudflare Workersの講評プロキシを呼び、講評文を受け取る。
 * `ANTHROPIC_API_KEY` はWorkers側にあり、ブラウザ(このクライアント)は一切持たない。
 */
export const fetchCritique: RequestCritique = async (request) => {
  const endpoint = import.meta.env.VITE_CRITIQUE_ENDPOINT;
  if (endpoint === undefined || endpoint === '') {
    throw new Error('AI講評の呼び出し先が設定されていません(VITE_CRITIQUE_ENDPOINT)');
  }
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  if (!response.ok) throw new Error(`AI講評の取得に失敗しました(status: ${response.status})`);
  const body: unknown = await response.json();
  if (!isCritiqueResponseBody(body)) throw new Error('AI講評の応答が不正です');
  return body.critique;
};
