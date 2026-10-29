import type { ComparisonQuiz, QuizAnswer } from '../../domain/quiz/ComparisonQuiz';
import { judgeQuizAnswer } from '../../domain/quiz/judgeComparison';

export type QuizSummary = {
  /** 答えた問題のうち正解の数。 */
  readonly correct: number;
  readonly total: number;
  readonly wrongIds: readonly string[];
  readonly unansweredIds: readonly string[];
};

function isCorrect(quiz: ComparisonQuiz, answer: QuizAnswer): boolean {
  const judged = judgeQuizAnswer(quiz, answer);
  return judged.ok && judged.value.correct;
}

/** 各問の答えから、正解数・不正解の問題・未回答の問題を数える。 */
export function summarizeQuiz(quizzes: readonly ComparisonQuiz[], answers: Readonly<Record<string, QuizAnswer>>): QuizSummary {
  const wrongIds: string[] = [];
  const unansweredIds: string[] = [];
  let correct = 0;
  const answered: Partial<Record<string, QuizAnswer>> = answers;
  for (const quiz of quizzes) {
    const answer = answered[quiz.id];
    if (answer === undefined) unansweredIds.push(quiz.id);
    else if (isCorrect(quiz, answer)) correct += 1;
    else wrongIds.push(quiz.id);
  }
  return { correct, total: quizzes.length, wrongIds, unansweredIds };
}

/** 問題ごとの答えの印。未回答なら空。 */
export function answerMark(quiz: ComparisonQuiz, answer: QuizAnswer | undefined): string {
  if (answer === undefined) return '';
  return isCorrect(quiz, answer) ? '(✓)' : '(✗)';
}
