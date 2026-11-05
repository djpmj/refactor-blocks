import { describe, expect, it } from 'vitest';
import type { Codebase } from '../codebase/Codebase';
import { findMixedMethods, mixedResponsibilities } from './mixedMethods';

describe('mixedResponsibilities', () => {
  const of = (...responsibilities: string[]) => responsibilities.map((responsibility) => ({ responsibility }));

  it('違う責務の2処理は出てくる順に返す', () => {
    // Arrange
    const fragments = of('persistence', 'notification');

    // Act
    const result = mixedResponsibilities(fragments);

    // Assert
    expect(result).toEqual(['persistence', 'notification']);
  });

  it('同じ責務だけなら空', () => {
    // Arrange
    const fragments = of('validation', 'validation');

    // Act
    const result = mixedResponsibilities(fragments);

    // Assert
    expect(result).toEqual([]);
  });

  it('call は数えない', () => {
    // Arrange
    const fragments = of('call', 'formatting');

    // Act
    const result = mixedResponsibilities(fragments);

    // Assert
    expect(result).toEqual([]);
  });

  it('重複は除く', () => {
    // Arrange
    const fragments = of('formatting', 'output', 'formatting');

    // Act
    const result = mixedResponsibilities(fragments);

    // Assert
    expect(result).toEqual(['formatting', 'output']);
  });

  it('1つの組に収まれば空、はみ出せば全責務を返す', () => {
    // Arrange
    const groups = [['a', 'b', 'c']];

    // Act
    const inside = mixedResponsibilities(of('a', 'b', 'c'), groups);
    const outside = mixedResponsibilities(of('a', 'b', 'd'), groups);

    // Assert
    expect(inside).toEqual([]);
    expect(outside).toEqual(['a', 'b', 'd']);
  });

  it('処理が0個なら空', () => {
    // Arrange

    // Act
    const result = mixedResponsibilities([]);

    // Assert
    expect(result).toEqual([]);
  });
});

function codebaseWithMethods(methods: readonly { id: string; responsibilities: readonly string[] }[]): Codebase {
  return {
    files: [{
      id: 'file',
      path: 'src/example.ts',
      classes: [{
        id: 'class',
        name: 'Example',
        methods: methods.map(({ id, responsibilities }) => ({
          id,
          name: id,
          visibility: 'public',
          fragments: responsibilities.map((responsibility, index) => ({
            id: `${id}-fragment-${index}`,
            label: responsibility,
            lines: 1,
            responsibility,
          })),
        })),
      }],
    }],
  };
}

describe('findMixedMethods', () => {
  it('新規メソッドで複数責務を含むものをコードベース内の順で返す', () => {
    // Arrange
    const codebase = codebaseWithMethods([
      { id: 'single', responsibilities: ['pricing'] },
      { id: 'mixed-a', responsibilities: ['pricing', 'payment'] },
      { id: 'mixed-b', responsibilities: ['inventory', 'pricing'] },
    ]);

    // Act
    const violations = findMixedMethods(codebase, codebaseWithMethods([]));

    // Assert
    expect(violations).toEqual(['mixed-a', 'mixed-b']);
  });

  it('call と1種類の責務は違反にしない', () => {
    // Arrange
    const codebase = codebaseWithMethods([{ id: 'method', responsibilities: ['call', 'payment'] }]);

    // Act
    const violations = findMixedMethods(codebase, codebaseWithMethods([]));

    // Assert
    expect(violations).toEqual([]);
  });

  it('初期状態にあるメソッドは移動後も違反にしない', () => {
    // Arrange
    const initialClass = codebaseWithMethods([{ id: 'existing', responsibilities: ['pricing', 'payment'] }]).files[0].classes[0];
    const currentClass = { ...initialClass, id: 'new-owner', name: 'NewOwner' };
    const codebase: Codebase = { files: [{ id: 'file', path: 'src/example.ts', classes: [currentClass] }] };
    const initial: Codebase = { files: [{ id: 'file', path: 'src/example.ts', classes: [initialClass] }] };

    // Act
    const violations = findMixedMethods(codebase, initial);

    // Assert
    expect(violations).toEqual([]);
  });

  it('責務が1つの許容グループ内だけなら違反にしない', () => {
    // Arrange
    const codebase = codebaseWithMethods([{ id: 'method', responsibilities: ['account-status', 'withdrawal-limit', 'balance'] }]);

    // Act
    const violations = findMixedMethods(codebase, codebaseWithMethods([]), [['account-status', 'withdrawal-limit', 'balance']]);

    // Assert
    expect(violations).toEqual([]);
  });

  it('許容グループ外の責務が混ざる場合は違反にする', () => {
    // Arrange
    const codebase = codebaseWithMethods([{ id: 'method', responsibilities: ['account-status', 'balance', 'payment'] }]);

    // Act
    const violations = findMixedMethods(codebase, codebaseWithMethods([]), [['account-status', 'withdrawal-limit', 'balance']]);

    // Assert
    expect(violations).toEqual(['method']);
  });

  it('複数の許容グループにまたがる責務は違反にする', () => {
    // Arrange
    const codebase = codebaseWithMethods([{ id: 'method', responsibilities: ['pricing', 'payment'] }]);

    // Act
    const violations = findMixedMethods(codebase, codebaseWithMethods([]), [['pricing', 'discount'], ['payment', 'history']]);

    // Assert
    expect(violations).toEqual(['method']);
  });

  it('許容グループを省略したときは複数責務を違反にする', () => {
    // Arrange
    const codebase = codebaseWithMethods([{ id: 'method', responsibilities: ['pricing', 'payment'] }]);

    // Act
    const violations = findMixedMethods(codebase, codebaseWithMethods([]));

    // Assert
    expect(violations).toEqual(['method']);
  });

  it('複数クラスを含むときも allClasses とメソッドの出現順で返す', () => {
    // Arrange
    const first = codebaseWithMethods([{ id: 'first', responsibilities: ['pricing', 'payment'] }]).files[0].classes[0];
    const second = codebaseWithMethods([{ id: 'second', responsibilities: ['inventory', 'history'] }]).files[0].classes[0];
    const codebase: Codebase = { files: [{ id: 'file', path: 'src/example.ts', classes: [first, second] }] };

    // Act
    const violations = findMixedMethods(codebase, codebaseWithMethods([]));

    // Assert
    expect(violations).toEqual(['first', 'second']);
  });
});
