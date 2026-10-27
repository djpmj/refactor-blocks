const STORAGE_KEY = 'refactor-blocks:story';

/** ストーリーのオン/オフを読み込む。オフの保存値が無い・読めないときはオン(例外は投げない)。 */
export function loadStoryEnabled(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== 'false';
  } catch {
    return true;
  }
}

/** ストーリーのオン/オフを保存する。localStorageが使えない環境でも画面を壊さない。 */
export function saveStoryEnabled(enabled: boolean): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, String(enabled));
    return true;
  } catch {
    // 書き込めなくても、好みが保存されないだけで遊べるようにする
    return false;
  }
}
