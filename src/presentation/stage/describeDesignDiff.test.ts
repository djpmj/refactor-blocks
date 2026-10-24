import { describe, expect, it } from 'vitest';
import type { Score } from '../../domain/scoring/score';
import type { FragmentPlacementDiff } from '../../domain/stage/designDiff';
import { describeDesignDiff, describeScoreGap, groupDesignDiff } from './describeDesignDiff';

function diff(fragmentLabel: string, responsibility: string, playerClass: string, answerClass: string): FragmentPlacementDiff {
  return { fragmentLabel, responsibility, playerClass, answerClass };
}

function score(deductions: Score['deductions']): Score {
  const deducted = deductions.reduce((sum, deduction) => sum + deduction.points, 0);
  return { total: 100 - deducted, deducted, deductions };
}

describe('describeDesignDiff', () => {
  it('違いが無ければ空配列を返す', () => {
    // Arrange
    const diffs: FragmentPlacementDiff[] = [];

    // Act
    const sentences = describeDesignDiff(diffs);

    // Assert
    expect(sentences).toEqual([]);
  });

  it('処理ごとに「処理」: あなた X / 解答例 Y の文にする', () => {
    // Arrange
    const diffs = [diff('送信履歴を記録する', 'storage', 'InvoiceStorage', 'InvoiceService')];

    // Act
    const sentences = describeDesignDiff(diffs);

    // Assert
    expect(sentences).toEqual(['「送信履歴を記録する」: あなた InvoiceStorage / 解答例 InvoiceService']);
  });

  it('責務とクラスの組が同じ処理は1文にまとめる', () => {
    // Arrange
    const diffs = [
      diff('送信履歴を記録する', 'storage', 'Archive', 'InvoiceService'),
      diff('監査ログを残す', 'storage', 'Archive', 'InvoiceService'),
      diff('PDFを保存する', 'storage', 'Archive', 'InvoiceStorage'),
    ];

    // Act
    const sentences = describeDesignDiff(diffs);

    // Assert
    expect(sentences).toEqual([
      '「送信履歴を記録する」「監査ログを残す」: あなた Archive / 解答例 InvoiceService',
      '「PDFを保存する」: あなた Archive / 解答例 InvoiceStorage',
    ]);
  });

  it('責務が違えばクラスの組が同じでも別の文にする', () => {
    // Arrange
    const diffs = [diff('A', 'storage', 'X', 'Y'), diff('B', 'pricing', 'X', 'Y')];

    // Act
    const groups = groupDesignDiff(diffs);

    // Assert
    expect(groups.map((group) => group.fragmentLabels)).toEqual([['A'], ['B']]);
  });
});

describe('describeScoreGap', () => {
  it('減点が同じなら何も返さない', () => {
    // Arrange
    const same = score([{ rule: 'coupling', count: 1, points: 10 }]);

    // Act
    const facts = describeScoreGap(same, same);

    // Assert
    expect(facts).toEqual([]);
  });

  it('プレイヤーだけ減点のあるルールを「あなたの設計は <ルール名> で -N 点」にする', () => {
    // Arrange
    const player = score([{ rule: 'coupling', count: 1, points: 10 }]);
    const answer = score([]);

    // Act
    const facts = describeScoreGap(player, answer);

    // Assert
    expect(facts).toEqual(['あなたの設計は 結合度 で -10 点']);
  });

  it('解答例だけ減点のあるルールは解答例の事実として返す', () => {
    // Arrange
    const player = score([]);
    const answer = score([{ rule: 'cycle', count: 1, points: 10 }]);

    // Act
    const facts = describeScoreGap(player, answer);

    // Assert
    expect(facts).toEqual(['解答例は 循環依存 で -10 点']);
  });
});
