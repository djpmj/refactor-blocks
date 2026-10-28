import { describe, expect, it } from 'vitest';
import { changeKindOf } from '../../domain/change/ChangeRequest';
import { findChangeSites } from '../../domain/change/findChangeSites';
import { allClasses, type Codebase } from '../../domain/codebase/Codebase';
import type { ComparisonQuiz, QuizDesign } from '../../domain/quiz/ComparisonQuiz';
import { judgeComparison } from '../../domain/quiz/judgeComparison';
import { comparisonQuizzes } from './comparisonQuizzes';

/** 答えを透けさせる評価の言葉。設計名は中立な説明にする。 */
const JUDGEMENT_WORDS = ['全部', 'だけ', 'ひどい', '悪い', '良い', 'ダメ', '最悪', '最適'];

const hasJudgementWord = (label: string) => JUDGEMENT_WORDS.some((word) => label.includes(word));
const emptyClassesOf = (codebase: Codebase) => allClasses(codebase).filter((codeClass) => codeClass.methods.length === 0);
const emptyFilesOf = (codebase: Codebase) => codebase.files.filter((file) => file.classes.length === 0);
const siteCountsOf = (quiz: ComparisonQuiz) => [quiz.designs.a, quiz.designs.b].map((design: QuizDesign) => findChangeSites(design.codebase, quiz.changeRequest).length);

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

  it('クイズIDが決まった順に並んでいる', () => {
    // Arrange
    const expected = [
      'quiz-user-controller-mail',
      'quiz-sales-report-tax',
      'quiz-sales-report-format',
      'quiz-collapse-hierarchy',
      'quiz-discount-strategy',
      'quiz-order-state',
      'quiz-interface-segregation',
      'quiz-value-object',
    ];

    // Act
    const ids = comparisonQuizzes.map((quiz) => quiz.id);

    // Assert
    expect(ids).toEqual(expected);
  });

  it('どの問題の変更依頼も、既存コードを直す依頼(modify)になっている', () => {
    // Arrange
    const kinds = comparisonQuizzes.map((quiz) => changeKindOf(quiz.changeRequest));

    // Act
    const notModify = kinds.filter((kind) => kind !== 'modify');

    // Assert
    expect(notModify).toEqual([]);
  });

  it('5問目以降の正解の側は A, B, A, B', () => {
    // Arrange
    const laterQuizzes = comparisonQuizzes.slice(4);

    // Act
    const answers = laterQuizzes.map((quiz) => {
      const verdict = judgeComparison(quiz, 'a');
      return verdict.ok ? verdict.value.answer : null;
    });

    // Assert
    expect(answers).toEqual(['a', 'b', 'a', 'b']);
  });

  describe.each(comparisonQuizzes.map((quiz) => [quiz.title, quiz] as const))('%s', (_title, quiz) => {
    it('どの設計にも、メソッドの無いクラスとクラスの無いファイルが無い', () => {
      // Arrange
      const codebases = [quiz.designs.a.codebase, quiz.designs.b.codebase];

      // Act
      const emptyClasses = codebases.flatMap(emptyClassesOf);
      const emptyFiles = codebases.flatMap(emptyFilesOf);

      // Assert
      expect(emptyClasses).toEqual([]);
      expect(emptyFiles).toEqual([]);
    });

    it('設計名に評価の言葉が入っていない', () => {
      // Arrange
      const labels = [quiz.designs.a.label, quiz.designs.b.label];

      // Act
      const found = labels.filter(hasJudgementWord);

      // Assert
      expect(found).toEqual([]);
    });

    it('変更依頼の変更箇所が両方の設計で見つかる', () => {
      // Arrange
      const siteCounts = siteCountsOf(quiz);

      // Act
      const hasEmpty = siteCounts.includes(0);

      // Assert
      expect(hasEmpty).toBe(false);
    });

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
