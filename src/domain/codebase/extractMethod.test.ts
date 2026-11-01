import { describe, expect, it } from 'vitest';
import { findMethod, mapClasses, type Codebase, type Method } from './Codebase';
import { extractMethod, type ExtractMethodRequest } from './extractMethod';
import { inlineMethod } from './inlineMethod';
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

/** place のメソッドの末尾に4つ目の処理を足す。 */
function withExtraFragment(codebase: Codebase): Codebase {
  const addFragment = (method: Method): Method => ({ ...method, fragments: [...method.fragments, { ...method.fragments[0], id: 'f-extra' }] });
  return mapClasses(codebase, (codeClass) => ({ ...codeClass, methods: codeClass.methods.map(addFragment) }));
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
    expect(source === undefined ? 0 : methodLines(source)).toBe(10 + 1 + 6 + 3 + 2);
  });

  it('呼び出し行は抽出した新メソッドを uses に持つ', () => {
    // Arrange
    const codebase = sampleCodebase();

    // Act
    const result = extractMethod(codebase, request());

    // Assert
    if (!result.ok) throw new Error(result.error);
    const call = findMethod(result.value, 'method-place')?.fragments.find((fragment) => fragment.id === 'method-tax:call');
    expect(call?.uses).toEqual(['method-tax']);
  });

  it.each([
    ['先頭の連続', ['f-validate', 'f-tax'], ['f-validate', 'f-tax']],
    ['末尾の連続', ['f-tax', 'f-save'], ['f-tax', 'f-save']],
    ['選ぶ順が逆でも並びで連続している', ['f-tax', 'f-validate'], ['f-validate', 'f-tax']],
  ])('連続した複数の処理(%s)を選ぶと、呼び出しは元の位置に1つ残る', (_label, fragmentIds, extractedIds) => {
    // Arrange
    const codebase = sampleCodebase();

    // Act
    const result = extractMethod(codebase, request({ fragmentIds }));

    // Assert
    if (!result.ok) throw new Error(result.error);
    expect(findMethod(result.value, 'method-tax')?.fragments.map((fragment) => fragment.id)).toEqual(extractedIds);
    expect(findMethod(result.value, 'method-place')?.fragments.filter((fragment) => fragment.id === 'method-tax:call')).toHaveLength(1);
  });

  it('4つの処理の途中の連続(b, c)は抽出できる', () => {
    // Arrange
    const withFour = withExtraFragment(sampleCodebase());

    // Act
    const result = extractMethod(withFour, request({ fragmentIds: ['f-tax', 'f-save'] }));

    // Assert
    if (!result.ok) throw new Error(result.error);
    expect(findMethod(result.value, 'method-place')?.fragments.map((fragment) => fragment.id)).toEqual(['f-validate', 'method-tax:call', 'f-extra']);
  });

  it('離れた処理(間に別の処理がある)を選ぶとエラーになる', () => {
    // Arrange
    const codebase = sampleCodebase();

    // Act
    const result = extractMethod(codebase, request({ fragmentIds: ['f-save', 'f-validate'] }));

    // Assert
    expect(result).toEqual({ ok: false, error: 'non-contiguous-fragments' });
  });

  it('連続の検証より、選択なしのエラーが先に返る', () => {
    // Arrange
    const codebase = sampleCodebase();

    // Act
    const result = extractMethod(codebase, request({ fragmentIds: [] }));

    // Assert
    expect(result).toEqual({ ok: false, error: 'no-fragments-selected' });
  });

  it('連続の検証は名前の検証より先に行う', () => {
    // Arrange
    const codebase = sampleCodebase();

    // Act
    const result = extractMethod(codebase, request({ fragmentIds: ['f-validate', 'f-save'], newMethodName: '' }));

    // Assert
    expect(result).toEqual({ ok: false, error: 'non-contiguous-fragments' });
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

describe('extractMethod のデータの受け渡し', () => {
  const vars = (declares: { name: string; type: string }[], uses: string[]) => ({
    declares: declares.map((item) => ({ name: item.name, type: { csharp: item.type } })),
    uses,
  });
  function dataflowCodebase(): Codebase {
    return {
      files: [{ id: 'f', path: 'a.cs', classes: [{ id: 'c', name: 'C', methods: [{
        id: 'm', name: 'run', visibility: 'public', parameters: [{ type: 'decimal', name: 'price' }],
        fragments: [
          { id: 'a', label: 'a', lines: 1, responsibility: 'x', variables: vars([{ name: 'subtotal', type: 'decimal' }], ['price']) },
          { id: 'b', label: 'b', lines: 1, responsibility: 'y', variables: vars([{ name: 'taxAmount', type: 'decimal' }], ['subtotal']) },
          { id: 'c', label: 'c', lines: 1, responsibility: 'z', variables: vars([], ['taxAmount']) },
        ],
      }] }] }],
    };
  }

  it('抽出したメソッドに parameters / returns が付き、呼び出し処理の callArguments・variables が対応する', () => {
    // Arrange
    const codebase = dataflowCodebase();
    // Act
    const result = extractMethod(codebase, { sourceMethodId: 'm', fragmentIds: ['b'], newMethodId: 'm2', newMethodName: 'calculateTax' });
    // Assert
    if (!result.ok) throw new Error(result.error);
    const extracted = findMethod(result.value, 'm2');
    const call = findMethod(result.value, 'm')?.fragments[1];
    expect(extracted?.parameters).toEqual([{ type: 'decimal', name: 'subtotal' }]);
    expect(extracted?.returns).toEqual([{ name: 'taxAmount', type: { csharp: 'decimal' } }]);
    expect(call?.callArguments).toEqual(['subtotal']);
    expect(call?.variables).toEqual(vars([{ name: 'taxAmount', type: 'decimal' }], ['subtotal']));
  });

  it('variables の無い処理を抽出しても、parameters / returns / variables は付かない', () => {
    // Arrange / Act
    const result = extractMethod(sampleCodebase(), request());
    // Assert
    if (!result.ok) throw new Error(result.error);
    expect(findMethod(result.value, 'method-tax')?.parameters).toBeUndefined();
    expect(findMethod(result.value, 'method-tax')?.returns).toBeUndefined();
    expect(findMethod(result.value, 'method-place')?.fragments[1].variables).toBeUndefined();
  });

  it('抽出したあとに Inline すると、元の処理の並び・variables に戻る', () => {
    // Arrange
    const codebase = dataflowCodebase();
    const extracted = extractMethod(codebase, { sourceMethodId: 'm', fragmentIds: ['b'], newMethodId: 'm2', newMethodName: 'calculateTax' });
    if (!extracted.ok) throw new Error(extracted.error);
    // Act
    const inlined = inlineMethod(extracted.value, 'm2');
    // Assert
    if (!inlined.ok) throw new Error(inlined.error);
    expect(findMethod(inlined.value, 'm')).toEqual(findMethod(codebase, 'm'));
  });
});
