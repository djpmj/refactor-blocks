import type { ComparisonQuiz, DesignChoice } from '../../domain/quiz/ComparisonQuiz';
import { judgeComparison } from '../../domain/quiz/judgeComparison';

export type QuizSummary = {
  /** 答えた問題のうち正解の数。 */
  readonly correct: number;
  readonly total: number;
  readonly wrongIds: readonly string[];
  readonly unansweredIds: readonly string[];
};

function isCorrect(quiz: ComparisonQuiz, choice: DesignChoice): boolean {
  const judged = judgeComparison(quiz, choice);
  return judged.ok && judged.value.correct;
}

/** 各問の答えから、正解数・不正解の問題・未回答の問題を数える。 */
export function summarizeQuiz(quizzes: readonly ComparisonQuiz[], answers: Readonly<Record<string, DesignChoice>>): QuizSummary {
  const wrongIds: string[] = [];
  const unansweredIds: string[] = [];
  let correct = 0;
  const answered: Partial<Record<string, DesignChoice>> = answers;
  for (const quiz of quizzes) {
    const choice = answered[quiz.id];
    if (choice === undefined) unansweredIds.push(quiz.id);
    else if (isCorrect(quiz, choice)) correct += 1;
    else wrongIds.push(quiz.id);
  }
  return { correct, total: quizzes.length, wrongIds, unansweredIds };
}

/** 問題ごとの答えの印。未回答なら空。 */
export function answerMark(quiz: ComparisonQuiz, choice: DesignChoice | undefined): string {
  if (choice === undefined) return '';
  return isCorrect(quiz, choice) ? '(✓)' : '(✗)';
}
