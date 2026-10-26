const STORAGE_KEY = 'refactor-blocks:last-stage';

/** 最後に開いたステージのIDを読み込む。保存なし・空文字・読めない環境のときは undefined(例外は投げない)。 */
export function loadLastStageId(): string | undefined {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw === null || raw === '' ? undefined : raw;
  } catch {
    return undefined;
  }
}

/** 最後に開いたステージのIDを保存する。localStorageが使えない環境でも画面を壊さない。 */
export function saveLastStageId(stageId: string): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, stageId);
    return true;
  } catch {
    // 書き込めなくても、続きから始められないだけで遊べるようにする
    return false;
  }
}
