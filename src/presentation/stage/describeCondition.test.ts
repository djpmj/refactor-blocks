import { describe, expect, it } from 'vitest';
import type { ClearCondition } from '../../domain/stage/clearConditions';
import { describeCondition } from './describeCondition';
import type { Codebase } from '../../domain/codebase/Codebase';

const stage = {
  limits: { method: 50, class: 120, file: 300 },
  dependencyLimit: 0,
  responsibilityLimit: 2,
};

describe('describeCondition', () => {
  it('循環依存の目標と現在の輪をクラス名・依存方向で表示する', () => {
    // Arrange
    const codebase: Codebase = { files: [{ id: 'file', path: 'cycle.ts', classes: [
      { id: 'a', name: 'A', methods: [{ id: 'method-a', name: 'run', visibility: 'public', fragments: [{ id: 'a-call', label: 'call', lines: 1, responsibility: 'call', uses: ['method-b'] }] }] },
      { id: 'b', name: 'B', methods: [{ id: 'method-b', name: 'run', visibility: 'public', fragments: [{ id: 'b-call', label: 'call', lines: 1, responsibility: 'call', uses: ['method-c'] }] }] },
      { id: 'c', name: 'C', methods: [{ id: 'method-c', name: 'run', visibility: 'public', fragments: [{ id: 'c-call', label: 'call', lines: 1, responsibility: 'call', uses: ['method-a'] }] }] },
    ] }] };

    // Act
    const description = describeCondition({ rule: 'cycle', count: 3 }, stage, { cycles: [['a', 'b', 'c']] }, codebase);

    // Assert
    expect(description).toEqual({ goal: '循環依存: 輪を0組にする', current: '今: 1組(A → B → C → A)' });
    expect(describeCondition({ rule: 'cycle', count: 0 }, stage, {}, codebase)).toEqual({ goal: '循環依存: 輪を0組にする', current: null });
  });

  it('各条件にステージの上限を表示する', () => {
    // Arrange
    const condition: ClearCondition = { rule: 'line-limit', count: 0 };

    // Act
    const description = describeCondition(condition, stage, {});

    // Assert
    expect(description).toEqual({ goal: '行数: メソッド50行・クラス120行・ファイル300行以内', current: null });
    expect(describeCondition({ rule: 'coupling', count: 0 }, stage, {})).toEqual({ goal: '結合度: 依存先は0クラスまで', current: null });
    expect(describeCondition({ rule: 'responsibility', count: 0 }, stage, {})).toEqual({ goal: '責務の混在: 1クラス2種類まで', current: null });
  });

  it('違反中は実測値または件数を追加する', () => {
    // Arrange
    const condition: ClearCondition = { rule: 'line-limit', count: 2 };

    // Act
    const description = describeCondition(condition, stage, { method: 84, class: 200 });

    // Assert
    expect(description).toEqual({
      goal: '行数: メソッド50行・クラス120行・ファイル300行以内',
      current: '今: メソッド最大84行・クラス最大200行',
    });
    expect(describeCondition({ rule: 'coupling', count: 1 }, stage, { dependencies: 3 })).toEqual({
      goal: '結合度: 依存先は0クラスまで', current: '今: 最大3クラス',
    });
    expect(describeCondition({ rule: 'responsibility', count: 1 }, stage, { responsibilities: 4 })).toEqual({
      goal: '責務の混在: 1クラス2種類まで', current: '今: 最大4種類',
    });
    expect(describeCondition({ rule: 'visibility', count: 2 }, stage, {})).toEqual({
      goal: 'アクセス制御: 0件にする', current: '今: 2件',
    });
  });
});
