import { describe, expect, it } from 'vitest';
import type { ChangeRequest } from '../change/ChangeRequest';
import type { Codebase } from '../codebase/Codebase';
import type { ComparisonQuiz } from './ComparisonQuiz';
import { judgeComparison, judgeQuizAnswer } from './judgeComparison';

const request: ChangeRequest = { id: 'req-tax', title: '税率を変えて', description: '', responsibility: 'tax', linesPerSite: 2 };

/** 税の処理が1クラスにまとまっている設計。 */
function cohesiveDesign(): Codebase {
  return {
    files: [
      {
        id: 'file-a',
        path: 'src/a.ts',
        classes: [
          {
            id: 'class-tax',
            name: 'Tax',
            methods: [
              { id: 'm-tax-1', name: 'taxA', visibility: 'public', fragments: [{ id: 'f1', label: '税', lines: 5, responsibility: 'tax' }] },
              { id: 'm-tax-2', name: 'taxB', visibility: 'public', fragments: [{ id: 'f2', label: '税', lines: 5, responsibility: 'tax' }] },
            ],
          },
        ],
      },
    ],
  };
}

/** 税の処理が2クラスに散らばっている設計。 */
function scatteredDesign(): Codebase {
  return {
    files: [
      {
        id: 'file-a',
        path: 'src/a.ts',
        classes: [
          { id: 'class-x', name: 'X', methods: [{ id: 'm-x', name: 'taxA', visibility: 'public', fragments: [{ id: 'f1', label: '税', lines: 5, responsibility: 'tax' }] }] },
          { id: 'class-y', name: 'Y', methods: [{ id: 'm-y', name: 'taxB', visibility: 'public', fragments: [{ id: 'f2', label: '税', lines: 5, responsibility: 'tax' }] }] },
        ],
      },
    ],
  };
}

function quizOf(a: Codebase, b: Codebase): ComparisonQuiz {
  return {
    id: 'quiz-test',
    title: 'テスト',
    description: '',
    limits: { method: 50, class: 150, file: 300 },
    designs: { a: { label: 'A', codebase: a }, b: { label: 'B', codebase: b } },
    changeRequest: request,
    reason: {
      id: 'r',
      question: '理由',
      choices: [
        { text: '正', explanation: '正の解説' },
        { text: '誤1', explanation: '誤1の解説' },
        { text: '誤2', explanation: '誤2の解説' },
      ],
      answer: 0,
    },
  };
}

describe('judgeComparison', () => {
  it('変更依頼のスコアが高い方を選ぶと正解になる', () => {
    // Arrange
    const quiz = quizOf(scatteredDesign(), cohesiveDesign());

    // Act
    const result = judgeComparison(quiz, 'b');

    // Assert
    if (!result.ok) throw new Error('判定に失敗しました');
    expect([result.value.choice, result.value.answer, result.value.correct]).toEqual(['b', 'b', true]);
  });

  it('スコアが低い方を選ぶと不正解になり、答えは高い方になる', () => {
    // Arrange
    const quiz = quizOf(cohesiveDesign(), scatteredDesign());

    // Act
    const result = judgeComparison(quiz, 'b');

    // Assert
    if (!result.ok) throw new Error('判定に失敗しました');
    expect([result.value.choice, result.value.answer, result.value.correct]).toEqual(['b', 'a', false]);
  });

  it('設計ごとに、依頼を当てたときの影響(変更が必要なクラス数)を返す', () => {
    // Arrange
    const quiz = quizOf(cohesiveDesign(), scatteredDesign());

    // Act
    const result = judgeComparison(quiz, 'a');

    // Assert
    if (!result.ok) throw new Error('判定に失敗しました');
    expect(result.value.assessments.a.impact.classesTouched).toBe(1);
    expect(result.value.assessments.b.impact.classesTouched).toBe(2);
  });

  it('両方の設計のスコアが同じなら tie を返す', () => {
    // Arrange
    const quiz = quizOf(cohesiveDesign(), cohesiveDesign());

    // Act
    const result = judgeComparison(quiz, 'a');

    // Assert
    expect(result).toEqual({ ok: false, error: 'tie' });
  });

  it('どちらかの設計に変更箇所がなければ no-sites を返す', () => {
    // Arrange
    const quiz = quizOf(cohesiveDesign(), { files: [] });

    // Act
    const result = judgeComparison(quiz, 'a');

    // Assert
    expect(result).toEqual({ ok: false, error: 'no-sites' });
  });
});

describe('judgeQuizAnswer', () => {
  const good = () => quizOf(cohesiveDesign(), scatteredDesign()); // 正解の設計は a

  it('正しい設計と正しい理由なら正解になる', () => {
    // Arrange
    const quiz = good();

    // Act
    const result = judgeQuizAnswer(quiz, { design: 'a', reason: 0 });

    // Assert
    if (!result.ok) throw new Error('判定に失敗しました');
    expect([result.value.correct, result.value.design.correct, result.value.reason.correct]).toEqual([true, true, true]);
  });

  it('正しい設計でも理由が違えば不正解になり、正しい理由の添字を返す', () => {
    // Arrange
    const quiz = good();

    // Act
    const result = judgeQuizAnswer(quiz, { design: 'a', reason: 1 });

    // Assert
    if (!result.ok) throw new Error('判定に失敗しました');
    expect([result.value.correct, result.value.design.correct, result.value.reason.correct, result.value.reason.answer]).toEqual([false, true, false, 0]);
  });

  it('違う設計と正しい理由は不正解になる', () => {
    // Arrange
    const quiz = good();

    // Act
    const result = judgeQuizAnswer(quiz, { design: 'b', reason: 0 });

    // Assert
    if (!result.ok) throw new Error('判定に失敗しました');
    expect([result.value.correct, result.value.design.correct, result.value.reason.correct]).toEqual([false, false, true]);
  });

  it('違う設計と違う理由は不正解になる', () => {
    // Arrange
    const quiz = good();

    // Act
    const result = judgeQuizAnswer(quiz, { design: 'b', reason: 2 });

    // Assert
    if (!result.ok) throw new Error('判定に失敗しました');
    expect(result.value.correct).toBe(false);
  });

  it.each([-1, 3])('理由の添字が範囲外(%i)でも例外にせず、理由は不正解になる', (reason) => {
    // Arrange
    const quiz = good();

    // Act
    const result = judgeQuizAnswer(quiz, { design: 'a', reason });

    // Assert
    if (!result.ok) throw new Error('判定に失敗しました');
    expect(result.value.reason.correct).toBe(false);
  });

  it('両方の設計のスコアが同じなら tie を返す', () => {
    // Arrange
    const quiz = quizOf(cohesiveDesign(), cohesiveDesign());

    // Act
    const result = judgeQuizAnswer(quiz, { design: 'a', reason: 0 });

    // Assert
    expect(result).toEqual({ ok: false, error: 'tie' });
  });
});
