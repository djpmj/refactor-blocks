import { describe, expect, it } from 'vitest';
import { judgeComparison } from '../../domain/quiz/judgeComparison';
import { comparisonQuizzes } from './comparisonQuizzes';

describe('comparisonQuizzes', () => {
  it('クイズIDは重複しない', () => {
    // Arrange
    const ids = comparisonQuizzes.map((quiz) => quiz.id);

    // Act
    const unique = new Set(ids);

    // Assert
    expect(unique.size).toBe(ids.length);
  });

  it('正解が全問同じ側に偏っていない', () => {
    // Arrange
    const verdicts = comparisonQuizzes.map((quiz) => judgeComparison(quiz, 'a'));

    // Act
    const answers = new Set(verdicts.map((verdict) => (verdict.ok ? verdict.value.answer : null)));

    // Assert
    expect(answers).toEqual(new Set(['a', 'b']));
  });

  describe.each(comparisonQuizzes.map((quiz) => [quiz.title, quiz] as const))('%s', (_title, quiz) => {
    it('引き分けにならず、両方の設計に変更箇所がある', () => {
      // Arrange
      const choice = 'a';

      // Act
      const verdict = judgeComparison(quiz, choice);

      // Assert
      expect(verdict.ok).toBe(true);
    });

    it('2つの設計のスコアの差が5点以上あり、答えが明確', () => {
      // Arrange
      const verdict = judgeComparison(quiz, 'a');
      if (!verdict.ok) throw new Error(`判定に失敗しました: ${verdict.error}`);

      // Act
      const gap = Math.abs(verdict.value.assessments.a.score.total - verdict.value.assessments.b.score.total);

      // Assert
      expect(gap).toBeGreaterThanOrEqual(5);
    });
  });
});
