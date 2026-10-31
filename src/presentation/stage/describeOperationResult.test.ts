import { describe, expect, it } from 'vitest';
import type { Score, ScoreDeduction } from '../../domain/scoring/score';
import type { Codebase, Fragment, Method } from '../../domain/codebase/Codebase';
import { TRAY_FILE_ID } from '../../domain/blank/tray';
import { describeNoEffect, describeOperationResult, describeRuleChanges } from './describeOperationResult';

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

describe('describeRuleChanges', () => {
  it('増えたルールを1文にする', () => {
    // Arrange
    const before = scoreOf([d('mixed-method', 0)]);
    const after = scoreOf([d('mixed-method', 1)]);
    // Act
    const sentences = describeRuleChanges(before, after);
    // Assert
    expect(sentences).toEqual(['「責務の混ざったメソッド」の減点が1件増えました(-10)']);
  });

  it('変わったルールが3つあっても切り詰めずすべて返し、増えたものが先', () => {
    // Arrange
    const before = scoreOf([d('cycle', 0), d('coupling', 0), d('line-limit', 1)]);
    const after = scoreOf([d('cycle', 1), d('coupling', 2), d('line-limit', 0)]);
    // Act
    const sentences = describeRuleChanges(before, after);
    // Assert
    expect(sentences).toEqual(['「結合度」の減点が2件増えました(-20)', '「循環依存」の減点が1件増えました(-10)', '「行数」の減点が1件消えました(+10)']);
  });

  it('変化がなければ空配列', () => {
    // Arrange
    const score = scoreOf([d('line-limit', 1)]);
    // Act
    const sentences = describeRuleChanges(score, score);
    // Assert
    expect(sentences).toEqual([]);
  });
});

describe('describeNoEffect', () => {
  const limits = { method: 28, class: 100, file: 100 };
  const fragment = (id: string, lines: number): Fragment => ({ id, label: id, lines, responsibility: 'x' });
  const method = (id: string, lineList: readonly number[]): Method => ({
    id, name: id, visibility: 'public', fragments: lineList.map((lines, index) => fragment(`${id}-f${index}`, lines)),
  });
  const codebaseOf = (classes: readonly { id: string; methods: readonly Method[] }[]): Codebase => ({
    files: [{ id: 'file-1', path: 'A.cs', classes: classes.map(({ id, methods }) => ({ id, name: id, methods })) }],
  });
  // メソッドの行数 = 処理の合計 + 3(宣言分)
  const none = (args: { before: Codebase; after: Codebase; score: Score }) => describeNoEffect({ ...args, limits });

  it('上限を超えたまま短くなったメソッドを「何行→何行、上限をまだ何行超え」にする', () => {
    // Arrange
    const before = codebaseOf([{ id: 'Svc', methods: [method("run", [20, 20])] }]); // 44行
    const after = codebaseOf([{ id: 'Svc', methods: [method('run', [28]), method('sub', [12])] }]); // 31行 + 15行
    // Act
    const result = none({ before, after, score: scoreOf([d('line-limit', 1)]) });
    // Assert
    expect(result).toEqual({ tone: 'unchanged', lines: ['効いていません: Svc.run() は44行→31行に減りましたが、上限28行をまだ3行超えています'] });
  });

  it('減った行数がいちばん多い対象を選ぶ', () => {
    // Arrange
    const before = codebaseOf([{ id: 'Svc', methods: [method('a', [40]), method('b', [40])] }]); // 43, 43
    const after = codebaseOf([{ id: 'Svc', methods: [method('a', [35]), method('b', [30]), method('c', [])] }]); // 38, 33(新しいメソッドで配置が変わる)
    // Act
    const result = none({ before, after, score: scoreOf([d('line-limit', 2)]) });
    // Assert
    expect(result?.lines[0]).toContain('Svc.b() は43行→33行');
  });

  it('同じ行数だけ減ったときは、メソッドをクラスより先にする', () => {
    // Arrange
    const small = { method: 28, class: 40, file: 1000 };
    const before = codebaseOf([{ id: 'Svc', methods: [method('a', [40])] }]); // メソッド43・クラス46
    const after = codebaseOf([{ id: 'Svc', methods: [method('a', [35]), method('c', [])] }]); // メソッド38・クラス41前後
    // Act
    const result = describeNoEffect({ before, after, limits: small, score: scoreOf([d('line-limit', 2)]) });
    // Assert
    expect(result?.lines[0]).toContain('Svc.a() は43行→38行');
  });

  it('行数が減った対象がなければ、残っている減点を出す', () => {
    // Arrange
    const before = codebaseOf([{ id: 'A', methods: [method('run', [40])] }, { id: 'B', methods: [] }]);
    const after = codebaseOf([{ id: 'A', methods: [] }, { id: 'B', methods: [method('run', [40])] }]);
    // Act
    const result = none({ before, after, score: scoreOf([d('line-limit', 1)]) });
    // Assert
    expect(result).toEqual({ tone: 'unchanged', lines: ['効いていません: 残っている減点(「行数」1件)は、この一手では減りませんでした'] });
  });

  it('残っている減点が3つ以上なら、2つまで出して「ほかN項目」を付ける', () => {
    // Arrange
    const before = codebaseOf([{ id: 'A', methods: [method('run', [5])] }, { id: 'B', methods: [] }]);
    const after = codebaseOf([{ id: 'A', methods: [] }, { id: 'B', methods: [method('run', [5])] }]);
    // Act
    const result = none({ before, after, score: scoreOf([d('line-limit', 1), d('coupling', 1), d('cycle', 1), d('responsibility', 0)]) });
    // Assert
    expect(result?.lines[0]).toBe('効いていません: 残っている減点(「行数」1件・「結合度」1件・ほか1項目)は、この一手では減りませんでした');
  });

  it('操作の後に上限内に収まった対象は、行数の候補にしない', () => {
    // Arrange
    const before = codebaseOf([{ id: 'Svc', methods: [method('run', [40])] }]); // 43行
    const after = codebaseOf([{ id: 'Svc', methods: [method('run', [20]), method('sub', [20])] }]); // 23行(上限内)
    // Act
    const result = none({ before, after, score: scoreOf([d('line-limit', 1)]) });
    // Assert
    expect(result?.lines[0]).toContain('残っている減点');
  });

  it('配置が同じ(名前だけ違う)ときは null', () => {
    // Arrange
    const before = codebaseOf([{ id: 'Svc', methods: [method('run', [40])] }]);
    const after: Codebase = { files: [{ ...before.files[0], classes: [{ ...before.files[0].classes[0], name: 'Renamed' }] }] };
    // Act
    const result = none({ before, after, score: scoreOf([d('line-limit', 1)]) });
    // Assert
    expect(result).toBeNull();
  });

  it('白紙設計(部品置き場がある)では、部品を置くたびに出さず null', () => {
    // Arrange
    const before = codebaseOf([{ id: 'A', methods: [method('run', [5])] }, { id: 'B', methods: [] }]);
    const after = codebaseOf([{ id: 'A', methods: [] }, { id: 'B', methods: [method('run', [5])] }]);
    const withTray: Codebase = { files: [...before.files, { id: TRAY_FILE_ID, path: '部品置き場', classes: [] }] };
    // Act
    const result = none({ before: withTray, after, score: scoreOf([d('line-limit', 1)]) });
    // Assert
    expect(result).toBeNull();
  });

  it('減点が0のときは null', () => {
    // Arrange
    const before = codebaseOf([{ id: 'A', methods: [method('run', [5])] }, { id: 'B', methods: [] }]);
    const after = codebaseOf([{ id: 'A', methods: [] }, { id: 'B', methods: [method('run', [5])] }]);
    // Act
    const result = none({ before, after, score: scoreOf([]) });
    // Assert
    expect(result).toBeNull();
  });

  it('引数を変更しない', () => {
    // Arrange
    const before = codebaseOf([{ id: 'Svc', methods: [method('run', [20, 20])] }]);
    const after = codebaseOf([{ id: 'Svc', methods: [method('run', [28])] }]);
    const score = scoreOf([d('line-limit', 1)]);
    const snapshot = JSON.stringify([before, after, score]);
    // Act
    none({ before, after, score });
    // Assert
    expect(JSON.stringify([before, after, score])).toBe(snapshot);
  });
});
