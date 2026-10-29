import type { QuizRecord } from '../../domain/quiz/quizRecord';

const STORAGE_KEY = 'refactor-blocks:quiz-record';

/** localStorageから読んだ値が `QuizRecord`(値が 'correct' か 'wrong' のオブジェクト)の形をしているか確かめる。信頼境界の入力検証。 */
export function isQuizRecord(value: unknown): value is QuizRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  return Object.values(value).every((outcome) => outcome === 'correct' || outcome === 'wrong');
}

/** 設計くらべの正答状況を読み込む。壊れている・存在しないときは空を返す(例外は投げない)。 */
export function loadQuizRecord(): QuizRecord {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return {};
    const parsed: unknown = JSON.parse(raw);
    return isQuizRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

/** 設計くらべの正答状況を保存する。localStorageが使えない環境でも画面を壊さない。 */
export function saveQuizRecord(record: QuizRecord): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
  } catch {
    // 書き込めなくても、記録が残らないだけで遊べるようにする
  }
}
