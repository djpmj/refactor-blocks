import { describe, expect, it } from 'vitest';
import { findMethod, type Codebase } from './Codebase';
import { extractMethod } from './extractMethod';
import { findCallerOf, inlineMethod } from './inlineMethod';
import { sampleCodebase } from './testFixtures';

/** placeOrder から f-tax を calculateTax(method-tax)として抽出済みのCodebase。 */
function extractedCodebase(): Codebase {
  const result = extractMethod(sampleCodebase(), {
    sourceMethodId: 'method-place',
    fragmentIds: ['f-tax'],
    newMethodId: 'method-tax',
    newMethodName: 'calculateTax',
  });
  if (!result.ok) throw new Error(result.error);
  return result.value;
}

describe('inlineMethod', () => {
  it('privateメソッドの処理が呼び出し行の位置に戻り、メソッド自体は消える', () => {
    // Arrange
    const codebase = extractedCodebase();

    // Act
    const result = inlineMethod(codebase, 'method-tax');

    // Assert
    if (!result.ok) throw new Error(result.error);
    expect(findMethod(result.value, 'method-tax')).toBeUndefined();
    expect(findMethod(result.value, 'method-place')?.fragments.map((fragment) => fragment.id)).toEqual([
      'f-validate',
      'f-tax',
      'f-save',
    ]);
  });

  it('抽出してから戻すと元のCodebaseと同じになる', () => {
    // Arrange
    const codebase = extractedCodebase();

    // Act
    const result = inlineMethod(codebase, 'method-tax');

    // Assert
    expect(result).toEqual({ ok: true, value: sampleCodebase() });
  });

  it('メソッドを別クラスへ移したあとでも、呼び出し元のクラスへ戻せる', () => {
    // Arrange
    const extracted = extractedCodebase();
    const codebase: Codebase = {
      files: [
        {
          ...extracted.files[0],
          classes: [{ ...extracted.files[0].classes[0], methods: [extracted.files[0].classes[0].methods[0]] }],
        },
        {
          ...extracted.files[1],
          classes: [{ ...extracted.files[1].classes[0], methods: [extracted.files[0].classes[0].methods[1]] }],
        },
      ],
    };

    // Act
    const result = inlineMethod(codebase, 'method-tax');

    // Assert
    if (!result.ok) throw new Error(result.error);
    expect(result.value.files[1].classes[0].methods).toEqual([]);
    expect(findMethod(result.value, 'method-place')?.fragments.map((fragment) => fragment.id)).toContain('f-tax');
  });

  it('元のCodebaseは変更しない', () => {
    // Arrange
    const codebase = extractedCodebase();

    // Act
    inlineMethod(codebase, 'method-tax');

    // Assert
    expect(codebase).toEqual(extractedCodebase());
  });

  it.each([
    ['存在しないメソッド', extractedCodebase(), 'missing', 'method-not-found'],
    ['publicメソッド', extractedCodebase(), 'method-place', 'not-private'],
  ])('%sを指定したときはエラーになる', (_label, codebase, methodId, expected) => {
    // Arrange (it.each の引数)

    // Act
    const result = inlineMethod(codebase, methodId);

    // Assert
    expect(result).toEqual({ ok: false, error: expected });
  });

  it('呼び出し行が見つからないときはエラーになる', () => {
    // Arrange
    const extracted = extractedCodebase();
    const place = extracted.files[0].classes[0].methods[0];
    const codebase: Codebase = {
      ...extracted,
      files: [
        {
          ...extracted.files[0],
          classes: [
            {
              ...extracted.files[0].classes[0],
              methods: [
                { ...place, fragments: place.fragments.filter((fragment) => fragment.id !== 'method-tax:call') },
                extracted.files[0].classes[0].methods[1],
              ],
            },
          ],
        },
        extracted.files[1],
      ],
    };

    // Act
    const result = inlineMethod(codebase, 'method-tax');

    // Assert
    expect(result).toEqual({ ok: false, error: 'call-not-found' });
  });
});

describe('findCallerOf', () => {
  it('呼び出し行を持つメソッドを返す', () => {
    // Arrange
    const codebase = extractedCodebase();

    // Act
    const caller = findCallerOf(codebase, 'method-tax');

    // Assert
    expect(caller?.id).toBe('method-place');
  });
});
