import { describe, expect, it } from 'vitest';
import { findMethod } from './Codebase';
import { extractMethod, type ExtractMethodRequest } from './extractMethod';
import { methodLines } from './lineCount';
import { sampleCodebase } from './testFixtures';

function request(overrides: Partial<ExtractMethodRequest> = {}): ExtractMethodRequest {
  return {
    sourceMethodId: 'method-place',
    fragmentIds: ['f-tax'],
    newMethodId: 'method-tax',
    newMethodName: 'calculateTax',
    ...overrides,
  };
}

describe('extractMethod', () => {
  it('選んだ処理が同じクラスの新しいprivateメソッドになり、元のメソッドの直後に並ぶ', () => {
    // Arrange
    const codebase = sampleCodebase();

    // Act
    const result = extractMethod(codebase, request());

    // Assert
    if (!result.ok) throw new Error(result.error);
    const methods = result.value.files[0].classes[0].methods;
    expect(methods.map((method) => method.name)).toEqual(['placeOrder', 'calculateTax']);
    expect(methods[1].visibility).toBe('private');
    expect(methods[1].fragments.map((fragment) => fragment.id)).toEqual(['f-tax']);
  });

  it('元のメソッドには抽出位置に呼び出し1行が残り、行数が減る', () => {
    // Arrange
    const codebase = sampleCodebase();

    // Act
    const result = extractMethod(codebase, request());

    // Assert
    if (!result.ok) throw new Error(result.error);
    const source = findMethod(result.value, 'method-place');
    expect(source?.fragments.map((fragment) => fragment.id)).toEqual(['f-validate', 'method-tax:call', 'f-save']);
    expect(source === undefined ? 0 : methodLines(source)).toBe(10 + 1 + 6 + 2);
  });

  it('離れた複数の処理を選ぶと、呼び出しは最初の位置に1つだけ残る', () => {
    // Arrange
    const codebase = sampleCodebase();

    // Act
    const result = extractMethod(codebase, request({ fragmentIds: ['f-save', 'f-validate'] }));

    // Assert
    if (!result.ok) throw new Error(result.error);
    const source = findMethod(result.value, 'method-place');
    expect(source?.fragments.map((fragment) => fragment.id)).toEqual(['method-tax:call', 'f-tax']);
    expect(findMethod(result.value, 'method-tax')?.fragments.map((fragment) => fragment.id)).toEqual([
      'f-validate',
      'f-save',
    ]);
  });

  it('元のCodebaseは変更しない', () => {
    // Arrange
    const codebase = sampleCodebase();

    // Act
    extractMethod(codebase, request());

    // Assert
    expect(codebase).toEqual(sampleCodebase());
  });

  it.each([
    ['存在しないメソッド', request({ sourceMethodId: 'missing' }), 'method-not-found'],
    ['処理を1つも選んでいない', request({ fragmentIds: [] }), 'no-fragments-selected'],
    ['別メソッドの処理を選んだ', request({ fragmentIds: ['unknown'] }), 'fragment-not-in-method'],
    ['全部の処理を選んだ', request({ fragmentIds: ['f-validate', 'f-tax', 'f-save'] }), 'cannot-extract-all-fragments'],
    ['名前が空白だけ', request({ newMethodName: '  ' }), 'empty-method-name'],
    ['同じクラスに同名メソッドがある', request({ newMethodName: 'placeOrder' }), 'duplicate-method-name'],
  ])('%sときはエラーになる', (_label, invalidRequest, expected) => {
    // Arrange
    const codebase = sampleCodebase();

    // Act
    const result = extractMethod(codebase, invalidRequest);

    // Assert
    expect(result).toEqual({ ok: false, error: expected });
  });
});
