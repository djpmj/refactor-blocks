const STORAGE_KEY = 'refactor-blocks:story';

/** ストーリーのオン/オフを読み込む。無い・壊れている・読めないときは false(例外は投げない)。 */
export function loadStoryEnabled(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

/** ストーリーのオン/オフを保存する。localStorageが使えない環境でも画面を壊さない。 */
export function saveStoryEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(enabled));
  } catch {
    // 書き込めなくても、好みが保存されないだけで遊べるようにする
  }
}
