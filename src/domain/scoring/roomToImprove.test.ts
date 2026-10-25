import { describe, expect, it } from 'vitest';
import type { Codebase } from '../codebase/Codebase';
import { findRoomToImprove, ROOM_TO_IMPROVE_LIMIT } from './roomToImprove';

type MethodSpec = { id: string; fragments: readonly (string | readonly [string, string])[] };
type ClassSpec = { id: string; methods: readonly MethodSpec[] };

/** fragments は責務名、または [責務名, ラベル]。 */
function build(classes: readonly ClassSpec[]): Codebase {
  return {
    files: [{
      id: 'file',
      path: 'src/example.ts',
      classes: classes.map((spec) => ({
        id: spec.id,
        name: spec.id,
        methods: spec.methods.map((method) => ({
          id: method.id,
          name: method.id,
          visibility: 'public' as const,
          fragments: method.fragments.map((item, index) => {
            const [responsibility, label] = typeof item === 'string' ? [item, `${method.id}-${item}-${index}`] : item;
            return { id: `${method.id}-f${index}`, label, lines: 1, responsibility };
          }),
        })),
      })),
    }],
  };
}

const stage = { responsibilityLimit: 3, cohesiveResponsibilities: undefined };
const split = build([{ id: 'Split', methods: [{ id: 'x', fragments: ['b'] }, { id: 'y', fragments: ['c'] }] }]);

describe('findRoomToImprove: mixed-method', () => {
  it('責務 b・c が残るメソッドを、各責務で最初の処理のラベルつきで返す', () => {
    // Arrange
    const codebase = build([{ id: 'A', methods: [{ id: 'm', fragments: [['b', 'ヘッダー'], ['b', '行'], ['c', '出力']] }] }]);

    // Act
    const result = findRoomToImprove(codebase, split, stage);

    // Assert
    expect(result).toEqual([{
      kind: 'mixed-method', methodId: 'm', classId: 'A', responsibilities: ['b', 'c'], fragmentLabels: ['ヘッダー', '出力'],
    }]);
  });

  it('抽出で作ったメソッドにも混在があれば対象にする', () => {
    // Arrange
    const codebase = build([{ id: 'A', methods: [{ id: 'extracted-new', fragments: ['b', 'call', 'c'] }] }]);

    // Act
    const result = findRoomToImprove(codebase, split, stage);

    // Assert
    expect(result.map((item) => item.kind === 'mixed-method' && item.methodId)).toEqual(['extracted-new']);
  });

  it('call + 1種類の責務は対象外', () => {
    // Arrange
    const codebase = build([{ id: 'A', methods: [{ id: 'm', fragments: ['call', 'b'] }] }]);

    // Act / Assert
    expect(findRoomToImprove(codebase, split, stage)).toEqual([]);
  });

  it('責務が全部ひとつの cohesive 組に入るなら対象外、組の外が混ざれば対象', () => {
    // Arrange
    const inside = build([{ id: 'A', methods: [{ id: 'm', fragments: ['b', 'c'] }] }]);
    const outside = build([{ id: 'A', methods: [{ id: 'm', fragments: ['b', 'c', 'd'] }] }]);
    const cohesive = { responsibilityLimit: 4, cohesiveResponsibilities: [['b', 'c']] };

    // Act / Assert
    expect(findRoomToImprove(inside, split, cohesive)).toEqual([]);
    expect(findRoomToImprove(outside, split, cohesive)).toHaveLength(1);
  });

  it('解答例のメソッドが同じ責務を全部含むなら対象外', () => {
    // Arrange
    const codebase = build([{ id: 'A', methods: [{ id: 'm', fragments: ['b', 'c'] }] }]);
    const reference = build([{ id: 'R', methods: [{ id: 'r', fragments: ['b', 'c', 'd'] }] }]);

    // Act / Assert
    expect(findRoomToImprove(codebase, reference, stage)).toEqual([]);
  });
});

describe('findRoomToImprove: crowded-class', () => {
  const crowded = build([
    { id: 'C', methods: [{ id: 'p', fragments: ['a'] }, { id: 'q', fragments: ['b'] }, { id: 'r', fragments: ['c'] }] },
  ]);

  it('責務の種類数が上限ちょうどで、解答例では分かれているクラスを返す', () => {
    // Act
    const result = findRoomToImprove(crowded, split, stage);

    // Assert
    expect(result).toEqual([{ kind: 'crowded-class', classId: 'C', responsibilities: ['a', 'b', 'c'] }]);
  });

  it('上限未満・上限超過は対象外', () => {
    // Act / Assert
    expect(findRoomToImprove(crowded, split, { ...stage, responsibilityLimit: 4 })).toEqual([]);
    expect(findRoomToImprove(crowded, split, { ...stage, responsibilityLimit: 2 })).toEqual([]);
  });

  it('上限1で責務1種類は対象外', () => {
    // Arrange
    const codebase = build([{ id: 'C', methods: [{ id: 'p', fragments: ['a'] }] }]);

    // Act / Assert
    expect(findRoomToImprove(codebase, split, { ...stage, responsibilityLimit: 1 })).toEqual([]);
  });

  it('解答例のクラスが同じ責務を全部含むなら対象外', () => {
    // Act / Assert
    expect(findRoomToImprove(crowded, crowded, stage)).toEqual([]);
  });
});

describe('findRoomToImprove: 並びと上限', () => {
  it('mixed-method が crowded-class より先で、元の順に並ぶ', () => {
    // Arrange
    const codebase = build([
      { id: 'C1', methods: [{ id: 'p', fragments: ['a'] }, { id: 'q', fragments: ['b'] }, { id: 'r', fragments: ['c'] }] },
      { id: 'C2', methods: [{ id: 'm1', fragments: ['b', 'c'] }, { id: 'm2', fragments: ['b', 'd'] }] },
    ]);

    // Act
    const result = findRoomToImprove(codebase, split, { ...stage, responsibilityLimit: 3 });

    // Assert
    expect(result.map((item) => item.kind === 'mixed-method' ? item.methodId : item.classId)).toEqual(['m1', 'm2', 'C1']);
  });

  it('候補が多くても先頭 ROOM_TO_IMPROVE_LIMIT 件だけ返す', () => {
    // Arrange
    const methods = ['m1', 'm2', 'm3', 'm4', 'm5'].map((id) => ({ id, fragments: ['b', 'c'] }));
    const codebase = build([{ id: 'A', methods }]);

    // Act
    const result = findRoomToImprove(codebase, split, stage);

    // Assert
    expect(result).toHaveLength(ROOM_TO_IMPROVE_LIMIT);
    expect(result.map((item) => item.kind === 'mixed-method' && item.methodId)).toEqual(['m1', 'm2', 'm3']);
  });

  it('codebase と reference が同じなら空', () => {
    // Arrange
    const codebase = build([{ id: 'A', methods: [{ id: 'm', fragments: ['b', 'c'] }] }]);

    // Act / Assert
    expect(findRoomToImprove(codebase, codebase, stage)).toEqual([]);
  });
});
