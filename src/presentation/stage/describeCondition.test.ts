import { describe, expect, it } from 'vitest';
import type { ClearCondition } from '../../domain/stage/clearConditions';
import { describeCondition } from './describeCondition';

const stage = {
  limits: { method: 50, class: 120, file: 300 },
  dependencyLimit: 0,
  responsibilityLimit: 2,
};

describe('describeCondition', () => {
  it('各条件にステージの上限を表示する', () => {
    // Arrange
    const condition: ClearCondition = { rule: 'line-limit', count: 0 };

    // Act
    const text = describeCondition(condition, stage, {});

    // Assert
    expect(text).toBe('行数: メソッド50行・クラス120行・ファイル300行以内');
    expect(describeCondition({ rule: 'coupling', count: 0 }, stage, {})).toBe('結合度: 依存先は0クラスまで');
    expect(describeCondition({ rule: 'responsibility', count: 0 }, stage, {})).toBe('責務の混在: 1クラス2種類まで');
  });

  it('違反中は実測値または件数を追加する', () => {
    // Arrange
    const condition: ClearCondition = { rule: 'line-limit', count: 2 };

    // Act
    const text = describeCondition(condition, stage, { method: 84, class: 200 });

    // Assert
    expect(text).toBe('行数: メソッド50行・クラス120行・ファイル300行以内 (今: メソッド最大84行・クラス最大200行)');
    expect(describeCondition({ rule: 'coupling', count: 1 }, stage, { dependencies: 3 })).toBe('結合度: 依存先は0クラスまで (今: 最大3クラス)');
    expect(describeCondition({ rule: 'responsibility', count: 1 }, stage, { responsibilities: 4 })).toBe('責務の混在: 1クラス2種類まで (今: 最大4種類)');
    expect(describeCondition({ rule: 'visibility', count: 2 }, stage, {})).toBe('アクセス制御: 0件にする (今2件)');
  });
});
