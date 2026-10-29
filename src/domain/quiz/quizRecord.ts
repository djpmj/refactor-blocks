export type QuizOutcome = 'correct' | 'wrong';
/** クイズのID → その問題の正答状況。一度でも正解したら 'correct'。 */
export type QuizRecord = Readonly<Partial<Record<string, QuizOutcome>>>;

/** 答えを記録に足す。一度 'correct' になった問題は、あとでまちがえても下げない(自己ベストと同じ考え方)。 */
export function recordQuizAnswer(record: QuizRecord, quizId: string, correct: boolean): QuizRecord {
  if (record[quizId] === 'correct') return record;
  return { ...record, [quizId]: correct ? 'correct' : 'wrong' };
}

export type QuizRecordSummary = { readonly correct: number; readonly answered: number; readonly total: number };

/** 一覧に出す数。記録に残っていても `quizIds` に無い(消した)問題は数えない。 */
export function summarizeQuizRecord(quizIds: readonly string[], record: QuizRecord): QuizRecordSummary {
  const outcomes = quizIds.map((id) => record[id]);
  return {
    correct: outcomes.filter((outcome) => outcome === 'correct').length,
    answered: outcomes.filter((outcome) => outcome !== undefined).length,
    total: quizIds.length,
  };
}
