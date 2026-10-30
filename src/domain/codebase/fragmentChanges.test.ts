import { describe, expect, it } from 'vitest';
import { mapClasses, type Codebase, type Method } from './Codebase';
import { extractMethod } from './extractMethod';
import { fragmentChanges } from './fragmentChanges';
import { moveMethod } from './moveMethod';
import { renameMethod } from './renameMethod';
import { sampleCodebase } from './testFixtures';

function ok<T>(result: { ok: true; value: T } | { ok: false; error: unknown }): T {
  if (!result.ok) throw new Error('unexpected failure');
  return result.value;
}

describe('fragmentChanges', () => {
  it('同じコードベース同士なら空', () => {
    // Arrange
    const codebase = sampleCodebase();
    // Act
    const changes = fragmentChanges(codebase, codebase);
    // Assert
    expect(changes.size).toBe(0);
  });

  it('同じクラスの新しいメソッドへ抽出すると、処理はmoved・呼び出し行はaddedになり、残した処理は入らない', () => {
    // Arrange
    const before = sampleCodebase();
    const after = ok(extractMethod(before, { sourceMethodId: 'method-place', fragmentIds: ['f-tax'], newMethodId: 'method-tax', newMethodName: 'calculateTax' }));
    // Act
    const changes = fragmentChanges(before, after);
    // Assert
    expect([...changes.keys()].sort((a, b) => a.localeCompare(b))).toEqual(['f-tax', 'method-tax:call']);
    expect(changes.get('f-tax')).toEqual({
      kind: 'moved',
      from: { className: 'OrderService', methodName: 'placeOrder' },
      to: { className: 'OrderService', methodName: 'calculateTax' },
    });
    expect(changes.get('method-tax:call')).toEqual({ kind: 'added', to: { className: 'OrderService', methodName: 'placeOrder' } });
  });

  it('メソッドを別クラスへ移すと、そのメソッドの全処理がmovedになる', () => {
    // Arrange
    const before = sampleCodebase();
    const after = ok(moveMethod(before, 'method-place', 'class-tax'));
    // Act
    const changes = fragmentChanges(before, after);
    // Assert
    expect([...changes.keys()].sort((a, b) => a.localeCompare(b))).toEqual(['f-save', 'f-tax', 'f-validate']);
    expect(changes.get('f-tax')).toEqual({
      kind: 'moved',
      from: { className: 'OrderService', methodName: 'placeOrder' },
      to: { className: 'TaxCalculator', methodName: 'placeOrder' },
    });
  });

  it('メソッド名だけ変えても入らない', () => {
    // Arrange
    const before = sampleCodebase();
    const after = ok(renameMethod(before, 'method-place', 'submitOrder'));
    // Act
    const changes = fragmentChanges(before, after);
    // Assert
    expect(changes.size).toBe(0);
  });

  it('beforeにだけある処理はremoved', () => {
    // Arrange
    const before = sampleCodebase();
    const withoutSave = (method: Method): Method => ({ ...method, fragments: method.fragments.filter((fragment) => fragment.id !== 'f-save') });
    const after: Codebase = mapClasses(before, (codeClass) => ({ ...codeClass, methods: codeClass.methods.map(withoutSave) }));
    // Act
    const changes = fragmentChanges(before, after);
    // Assert
    expect([...changes.entries()]).toEqual([['f-save', { kind: 'removed', from: { className: 'OrderService', methodName: 'placeOrder' } }]]);
  });

  it('引数を変更しない', () => {
    // Arrange
    const before = sampleCodebase();
    const after = ok(moveMethod(before, 'method-place', 'class-tax'));
    const snapshot = JSON.stringify([before, after]);
    // Act
    fragmentChanges(before, after);
    // Assert
    expect(JSON.stringify([before, after])).toBe(snapshot);
  });
});
