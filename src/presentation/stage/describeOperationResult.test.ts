import { describe, expect, it } from 'vitest';
import type { Score, ScoreDeduction } from '../../domain/scoring/score';
import { describeOperationResult } from './describeOperationResult';

function scoreOf(deductions: readonly ScoreDeduction[]): Score {
  const deducted = deductions.reduce((sum, deduction) => sum + deduction.points, 0);
  return { total: Math.max(0, 100 - deducted), deducted, deductions };
}
const d = (rule: ScoreDeduction['rule'], count: number): ScoreDeduction => ({ rule, count, points: count * 10 });

describe('describeOperationResult', () => {
  it('減点が増えたルールを「増えました」として出す', () => {
    // Arrange
    const before = scoreOf([d('mixed-method', 0)]);
    const after = scoreOf([d('mixed-method', 1)]);
    // Act
    const result = describeOperationResult(before, after);
    // Assert
    expect(result).toEqual({ tone: 'worse', lines: ['「責務の混ざったメソッド」の減点が1件増えました(-10)'] });
  });

  it('減点が消えたルールを「消えました」として出す', () => {
    // Arrange
    const before = scoreOf([d('line-limit', 1)]);
    const after = scoreOf([d('line-limit', 0)]);
    // Act
    const result = describeOperationResult(before, after);
    // Assert
    expect(result).toEqual({ tone: 'better', lines: ['「行数」の減点が1件消えました(+10)'] });
  });

  it('増えたものと消えたものが打ち消し合うと mixed で、増えた文が先', () => {
    // Arrange
    const before = scoreOf([d('line-limit', 1), d('mixed-method', 0)]);
    const after = scoreOf([d('line-limit', 0), d('mixed-method', 1)]);
    // Act
    const result = describeOperationResult(before, after);
    // Assert
    expect(result).toEqual({
      tone: 'mixed',
      lines: ['「責務の混ざったメソッド」の減点が1件増えました(-10)', '「行数」の減点が1件消えました(+10)'],
    });
  });

  it('1つのルールで2件増えたら点数も2件分', () => {
    // Arrange
    const before = scoreOf([d('coupling', 0)]);
    const after = scoreOf([d('coupling', 2)]);
    // Act
    const result = describeOperationResult(before, after);
    // Assert
    expect(result?.lines).toEqual(['「結合度」の減点が2件増えました(-20)']);
  });

  it('増えたルールは points の差が大きい順に並べる', () => {
    // Arrange
    const before = scoreOf([d('cycle', 0), d('coupling', 0)]);
    const after = scoreOf([d('cycle', 1), d('coupling', 2)]);
    // Act
    const result = describeOperationResult(before, after);
    // Assert
    expect(result?.lines).toEqual(['「結合度」の減点が2件増えました(-20)', '「循環依存」の減点が1件増えました(-10)']);
  });

  it('差が同じなら after.deductions の順に並べる', () => {
    // Arrange
    const before = scoreOf([d('cycle', 0), d('coupling', 0)]);
    const after = scoreOf([d('cycle', 1), d('coupling', 1)]);
    // Act
    const result = describeOperationResult(before, after);
    // Assert
    expect(result?.lines).toEqual(['「循環依存」の減点が1件増えました(-10)', '「結合度」の減点が1件増えました(-10)']);
  });

  it('変わったルールが3つ以上なら、1件目と「ほかにN項目」の2行にする', () => {
    // Arrange
    const before = scoreOf([d('cycle', 0), d('coupling', 0), d('empty', 0)]);
    const after = scoreOf([d('cycle', 1), d('coupling', 1), d('empty', 1)]);
    // Act
    const result = describeOperationResult(before, after);
    // Assert
    expect(result?.lines).toEqual([
      '「循環依存」の減点が1件増えました(-10)',
      'ほかに2項目の減点も変わりました(「減点の内訳」で確認できます)',
    ]);
  });

  it('どのルールの件数も変わらなければ null', () => {
    // Arrange
    const score = scoreOf([d('cycle', 1)]);
    // Act
    const result = describeOperationResult(score, score);
    // Assert
    expect(result).toBeNull();
  });

  it('0点の下限で total が前後とも0でも、件数が増えれば worse の文が出る', () => {
    // Arrange
    const before = scoreOf([d('coupling', 10)]);
    const after = scoreOf([d('coupling', 11)]);
    // Act
    const result = describeOperationResult(before, after);
    // Assert
    expect([before.total, after.total]).toEqual([0, 0]);
    expect(result).toEqual({ tone: 'worse', lines: ['「結合度」の減点が1件増えました(-10)'] });
  });

  it('引数の Score を変更しない', () => {
    // Arrange
    const before = scoreOf([d('cycle', 0)]);
    const after = scoreOf([d('cycle', 1)]);
    const snapshot = JSON.stringify([before, after]);
    // Act
    describeOperationResult(before, after);
    // Assert
    expect(JSON.stringify([before, after])).toBe(snapshot);
  });
});
