import type { MoveBests } from '../../domain/progress/moveBests';

const STORAGE_KEY = 'refactor-blocks:move-bests';

/** localStorageから読んだ値が `MoveBests`(文字列キー→0以上の整数)の形をしているか確かめる。信頼境界の入力検証。 */
export function isMoveBests(value: unknown): value is MoveBests {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  return Object.values(value).every((moves) => typeof moves === 'number' && Number.isSafeInteger(moves) && moves >= 0);
}

/** ステージごとの手数の自己ベストを読み込む。壊れている・存在しないときは空を返す(例外は投げない)。 */
export function loadMoveBests(): MoveBests {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return {};
    const parsed: unknown = JSON.parse(raw);
    return isMoveBests(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

/** ステージごとの手数の自己ベストを保存する。localStorageが使えない環境でも画面を壊さない。 */
export function saveMoveBests(bests: MoveBests): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bests));
  } catch {
    // 書き込めなくても、記録が残らないだけで遊べるようにする
  }
}
