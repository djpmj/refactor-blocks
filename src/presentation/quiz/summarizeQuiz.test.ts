import { describe, expect, it } from 'vitest';
import type { DesignChoice } from '../../domain/quiz/ComparisonQuiz';
import { judgeComparison } from '../../domain/quiz/judgeComparison';
import { comparisonQuizzes } from '../../infrastructure/quizzes/comparisonQuizzes';
import { summarizeQuiz } from './summarizeQuiz';

function correctChoice(index: number): DesignChoice {
  const quiz = comparisonQuizzes.at(index);
  const verdict = quiz === undefined ? null : judgeComparison(quiz, 'a');
  if (verdict === null || !verdict.ok) throw new Error('判定できないクイズ');
  return verdict.value.answer;
}

function wrongChoice(index: number): DesignChoice {
  return correctChoice(index) === 'a' ? 'b' : 'a';
}

function answersWith(pick: (index: number) => DesignChoice | null): Record<string, DesignChoice> {
  const answers: Record<string, DesignChoice> = {};
  comparisonQuizzes.forEach((quiz, index) => {
    const choice = pick(index);
    if (choice !== null) answers[quiz.id] = choice;
  });
  return answers;
}

describe('summarizeQuiz', () => {
  it('すべて正解なら、正解数が問題数と同じで一覧は空になる', () => {
    // Arrange
    const answers = answersWith(correctChoice);

    // Act
    const summary = summarizeQuiz(comparisonQuizzes, answers);

    // Assert
    expect(summary).toEqual({ correct: comparisonQuizzes.length, total: comparisonQuizzes.length, wrongIds: [], unansweredIds: [] });
  });

  it('不正解の問題は wrongIds に入る', () => {
    // Arrange
    const answers = answersWith((index) => (index === 1 ? wrongChoice(index) : correctChoice(index)));

    // Act
    const summary = summarizeQuiz(comparisonQuizzes, answers);

    // Assert
    expect(summary.wrongIds).toEqual([comparisonQuizzes[1]?.id]);
    expect(summary.correct).toBe(comparisonQuizzes.length - 1);
    expect(summary.unansweredIds).toEqual([]);
  });

  it('未回答の問題は unansweredIds に入り、正解数は答えた問題だけで数える', () => {
    // Arrange
    const answers = answersWith((index) => (index === 2 ? null : correctChoice(index)));

    // Act
    const summary = summarizeQuiz(comparisonQuizzes, answers);

    // Assert
    expect(summary.unansweredIds).toEqual([comparisonQuizzes[2]?.id]);
    expect(summary.correct).toBe(comparisonQuizzes.length - 1);
    expect(summary.wrongIds).toEqual([]);
  });
});
