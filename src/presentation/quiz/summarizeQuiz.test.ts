import { describe, expect, it } from 'vitest';
import type { ComparisonQuiz, DesignChoice, QuizAnswer } from '../../domain/quiz/ComparisonQuiz';
import { judgeComparison } from '../../domain/quiz/judgeComparison';
import { comparisonQuizzes } from '../../infrastructure/quizzes/comparisonQuizzes';
import { answerMark, summarizeQuiz } from './summarizeQuiz';

function correctDesign(quiz: ComparisonQuiz): DesignChoice {
  const verdict = judgeComparison(quiz, 'a');
  if (!verdict.ok) throw new Error('判定できないクイズ');
  return verdict.value.answer;
}

function correctAnswer(quiz: ComparisonQuiz): QuizAnswer {
  return { design: correctDesign(quiz), reason: quiz.reason.answer };
}

/** 設計は合っているが、理由がちがう答え。 */
function wrongReasonAnswer(quiz: ComparisonQuiz): QuizAnswer {
  return { design: correctDesign(quiz), reason: (quiz.reason.answer + 1) % quiz.reason.choices.length };
}

function answersWith(pick: (quiz: ComparisonQuiz, index: number) => QuizAnswer | null): Record<string, QuizAnswer> {
  const answers: Record<string, QuizAnswer> = {};
  comparisonQuizzes.forEach((quiz, index) => {
    const answer = pick(quiz, index);
    if (answer !== null) answers[quiz.id] = answer;
  });
  return answers;
}

describe('summarizeQuiz', () => {
  it('すべて正解なら、正解数が問題数と同じで一覧は空になる', () => {
    // Arrange
    const answers = answersWith(correctAnswer);

    // Act
    const summary = summarizeQuiz(comparisonQuizzes, answers);

    // Assert
    expect(summary).toEqual({ correct: comparisonQuizzes.length, total: comparisonQuizzes.length, wrongIds: [], unansweredIds: [] });
  });

  it('設計が合っていても理由がちがう問題は wrongIds に入る', () => {
    // Arrange
    const answers = answersWith((quiz, index) => (index === 1 ? wrongReasonAnswer(quiz) : correctAnswer(quiz)));

    // Act
    const summary = summarizeQuiz(comparisonQuizzes, answers);

    // Assert
    expect(summary.wrongIds).toEqual([comparisonQuizzes[1]?.id]);
    expect(summary.correct).toBe(comparisonQuizzes.length - 1);
    expect(summary.unansweredIds).toEqual([]);
  });

  it('未回答の問題は unansweredIds に入り、正解数は答えた問題だけで数える', () => {
    // Arrange
    const answers = answersWith((quiz, index) => (index === 2 ? null : correctAnswer(quiz)));

    // Act
    const summary = summarizeQuiz(comparisonQuizzes, answers);

    // Assert
    expect(summary.unansweredIds).toEqual([comparisonQuizzes[2]?.id]);
    expect(summary.correct).toBe(comparisonQuizzes.length - 1);
    expect(summary.wrongIds).toEqual([]);
  });
});

describe('answerMark', () => {
  const quiz = comparisonQuizzes.at(0);
  if (quiz === undefined) throw new Error('クイズがありません');

  it('設計も理由も合っていれば (✓)', () => {
    // Arrange
    const answer = correctAnswer(quiz);

    // Act
    const mark = answerMark(quiz, answer);

    // Assert
    expect(mark).toBe('(✓)');
  });

  it('理由がちがえば (✗)', () => {
    // Arrange
    const answer = wrongReasonAnswer(quiz);

    // Act
    const mark = answerMark(quiz, answer);

    // Assert
    expect(mark).toBe('(✗)');
  });

  it('答えが無ければ空文字', () => {
    // Arrange
    const answer = Object.values<QuizAnswer>({}).at(0);

    // Act
    const mark = answerMark(quiz, answer);

    // Assert
    expect(mark).toBe('');
  });
});
