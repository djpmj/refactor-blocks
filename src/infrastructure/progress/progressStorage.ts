import { isProgress, type Progress } from '../../domain/progress/Progress';
import type { Milestones } from '../../domain/progress/milestones';

const STORAGE_KEY = 'refactor-blocks:progress';

/** ステージごとの自己ベストスコアを読み込む。壊れている・存在しないときは空を返す(例外は投げない)。 */
export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return {};
    const parsed: unknown = JSON.parse(raw);
    return isProgress(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

/** ステージごとの自己ベストスコアを保存する。localStorageが使えない環境でも画面を壊さない。 */
export function saveProgress(progress: Progress): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    return true;
  } catch {
    // プライベートブラウジング等で書き込めなくても、進捗が保存されないだけで遊べるようにする
    return false;
  }
}

const MILESTONES_KEY = 'refactor-blocks:milestones';

/** localStorage から読んだ値が Milestones(文字列キー → 既知の段階名の配列)の形か。信頼境界の入力検証。 */
export function isMilestones(value: unknown): value is Milestones {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  return Object.values(value).every(
    (done) => Array.isArray(done) && done.every((milestone) => milestone === 'concept-check' || milestone === 'change-request'),
  );
}

/** ステージごとの、終えた段階を読み込む。壊れている・形が違う・存在しないときは空を返す(例外は投げない)。 */
export function loadMilestones(): Milestones {
  try {
    const raw = localStorage.getItem(MILESTONES_KEY);
    if (raw === null) return {};
    const parsed: unknown = JSON.parse(raw);
    return isMilestones(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

/** ステージごとの、終えた段階を保存する。localStorageが使えない環境でも画面を壊さない。 */
export function saveMilestones(milestones: Milestones): void {
  try {
    localStorage.setItem(MILESTONES_KEY, JSON.stringify(milestones));
  } catch {
    // 書き込めなくても、記録が残らないだけで遊べるようにする
  }
}
