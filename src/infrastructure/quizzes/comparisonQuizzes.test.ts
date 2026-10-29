import { describe, expect, it } from 'vitest';
import { changeKindOf } from '../../domain/change/ChangeRequest';
import { findChangeSites } from '../../domain/change/findChangeSites';
import { measureChange } from '../../domain/change/measureChange';
import { allClasses, type Codebase } from '../../domain/codebase/Codebase';
import { classLines, fileLines, methodLines } from '../../domain/codebase/lineCount';
import type { ComparisonQuiz, QuizDesign } from '../../domain/quiz/ComparisonQuiz';
import { judgeComparison } from '../../domain/quiz/judgeComparison';
import { validateCheck } from '../../domain/stage/conceptCheck';
import { comparisonQuizzes } from './comparisonQuizzes';

/** 答えを透けさせる評価の言葉。設計名は中立な説明にする。 */
const JUDGEMENT_WORDS = ['全部', 'だけ', 'ひどい', '悪い', '良い', 'ダメ', '最悪', '最適'];

const textOf = (choice: { readonly text: string }) => choice.text;
const namesDesign = (text: string) => text.includes('設計A') || text.includes('設計B');
const hasJudgementWord = (label: string) => JUDGEMENT_WORDS.some((word) => label.includes(word));
const emptyClassesOf = (codebase: Codebase) => allClasses(codebase).filter((codeClass) => codeClass.methods.length === 0);
const emptyFilesOf = (codebase: Codebase) => codebase.files.filter((file) => file.classes.length === 0);
const siteCountsOf = (quiz: ComparisonQuiz) => [quiz.designs.a, quiz.designs.b].map((design: QuizDesign) => findChangeSites(design.codebase, quiz.changeRequest).length);

/** 解説に書いてよい行数: 上限・各メソッド/クラス/ファイルの実測値・追加行数・追加後の行数(ステージ定義から計算する)。 */
function allowedLineNumbers(quiz: ComparisonQuiz): Set<number> {
  const allowed = new Set<number>([quiz.limits.method, quiz.limits.class, quiz.limits.file]);
  for (const design of [quiz.designs.a, quiz.designs.b]) {
    const { codebase } = design;
    const impact = measureChange(codebase, quiz.changeRequest, quiz.limits);
    const added = impact.ok ? impact.value.linesAdded : 0;
    allowed.add(added);
    codebase.files.forEach((file) => allowed.add(fileLines(file, codebase)));
    for (const codeClass of allClasses(codebase)) {
      allowed.add(classLines(codeClass, codebase));
      allowed.add(classLines(codeClass, codebase) + added);
      codeClass.methods.forEach((method) => allowed.add(methodLines(method, codebase)));
      codeClass.methods.forEach((method) => allowed.add(methodLines(method, codebase) + added));
    }
  }
  return allowed;
}

const unmeasuredLinesOf = (quiz: ComparisonQuiz) => {
  const allowed = allowedLineNumbers(quiz);
  const mentioned = quiz.reason.choices.flatMap((choice) => [...choice.explanation.matchAll(/\d{1,4}(?=行)/g)].map((match) => Number(match[0])));
  return mentioned.filter((lines) => !allowed.has(lines));
};

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

  it('理由の正解の添字が全問同じ値ではない', () => {
    // Arrange
    const answers = comparisonQuizzes.map((quiz) => quiz.reason.answer);

    // Act
    const unique = new Set(answers);

    // Assert
    expect(unique.size).toBeGreaterThan(1);
  });

  it('理由のIDは全問で重複しない', () => {
    // Arrange
    const ids = comparisonQuizzes.map((quiz) => quiz.reason.id);

    // Act
    const unique = new Set(ids);

    // Assert
    expect(unique.size).toBe(ids.length);
  });

  describe.each(comparisonQuizzes.map((quiz) => [quiz.title, quiz] as const))('%s', (_title, quiz) => {
    it('理由の3択が書き方の決まりを満たしている', () => {
      // Arrange
      const { reason } = quiz;

      // Act
      const result = validateCheck(reason);

      // Assert
      expect(result.ok).toBe(true);
      expect(reason.choices).toHaveLength(3);
    });

    it('解説に書かれた行数が、ステージ定義から計算した実測値と一致する', () => {
      // Arrange
      const { reason } = quiz;

      // Act
      const unknown = unmeasuredLinesOf(quiz);

      // Assert
      expect(reason.choices).toHaveLength(3);
      expect(unknown).toEqual([]);
    });

    it('理由の選択肢の文に、設計A・Bを名指しする語が入っていない', () => {
      // Arrange
      const texts = [...quiz.reason.choices].map(textOf);

      // Act
      const found = texts.filter(namesDesign);

      // Assert
      expect(found).toEqual([]);
    });

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
