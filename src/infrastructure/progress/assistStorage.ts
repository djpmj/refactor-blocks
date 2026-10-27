import { isStageAssists, type Assists } from '../../domain/progress/assists';

const STORAGE_KEY = 'refactor-blocks:assists';

/** ステージごとの助けの記録を読み込む。壊れている・存在しないときは空を返し(例外は投げない)、不正なエントリだけ捨てる。 */
export function loadAssists(): Assists {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return {};
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed).filter(([, entry]) => isStageAssists(entry)));
  } catch {
    return {};
  }
}

/** ステージごとの助けの記録を保存する。localStorageが使えない環境でも画面を壊さない。 */
export function saveAssists(assists: Assists): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(assists));
  } catch {
    // 書き込めなくても、印が残らないだけで遊べるようにする
  }
}
