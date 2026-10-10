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

  it('publicな横流しメソッドを別クラスから呼ぶ行へインラインできる', () => {
    // Arrange
    const extracted = extractedCodebase();
    const [file] = extracted.files;
    const [codeClass] = file.classes;
    const [originalCaller] = codeClass.methods;
    const caller = { ...originalCaller, fragments: originalCaller.fragments.map((fragment) => fragment.id === 'method-tax:call' ? { ...fragment, uses: ['middleman'] } : fragment) };
    const service = { id: 'service', name: 'Service', methods: [{ id: 'service-call', name: 'place', visibility: 'public' as const, fragments: [{ id: 'service-work', label: 'work', lines: 4, responsibility: 'business' }] }] };
    const manager = { id: 'manager', name: 'Manager', methods: [{ id: 'middleman', name: 'placeOrder', visibility: 'public' as const, fragments: [{ id: 'forward', label: 'forward', lines: 1, responsibility: 'call', uses: ['service-call'] }] }] };
    const codebase: Codebase = { files: [{ ...file, classes: [{ ...codeClass, methods: [caller] }, manager, service] }] };

    // Act
    const result = inlineMethod(codebase, 'middleman');

    // Assert
    if (!result.ok) throw new Error(result.error);
    expect(findMethod(result.value, 'middleman')).toBeUndefined();
    expect(findMethod(result.value, 'method-place')?.fragments.map((fragment) => fragment.id)).toContain('forward');
  });

  it('複数の呼び出し元がある場合は拒否する', () => {
    // Arrange
    const base = extractedCodebase();
    const order = base.files[0].classes[0];
    const caller = order.methods[0];
    const caller2 = { ...caller, id: 'other-caller', name: 'other', fragments: caller.fragments.map((fragment) => fragment.id === 'method-tax:call' ? { ...fragment, id: 'other-call' } : fragment) };
    const codebase: Codebase = { files: [{ ...base.files[0], classes: [{ ...order, methods: [caller, caller2, order.methods[1]] }] }, base.files[1]] };

    // Act
    const result = inlineMethod(codebase, 'method-tax');

    // Assert
    expect(result).toEqual({ ok: false, error: 'multiple-callers' });
  });

  it('1つの呼び出し元に複数の呼び出し行がある場合は拒否し、入力を変更しない', () => {
    // Arrange
    const base = extractedCodebase();
    const [file] = base.files;
    const [codeClass] = file.classes;
    const [caller, method] = codeClass.methods;
    const call = caller.fragments.find((fragment) => fragment.id === 'method-tax:call');
    if (call === undefined) throw new Error('呼び出し行が見つかりません');
    const callerWithTwoCalls = {
      ...caller,
      fragments: [...caller.fragments, { ...call, id: 'method-tax:call:second' }],
    };
    const codebase: Codebase = {
      files: [{ ...file, classes: [{ ...codeClass, methods: [callerWithTwoCalls, method] }] }, base.files[1]],
    };
    const original = structuredClone(codebase);

    // Act
    const result = inlineMethod(codebase, 'method-tax');

    // Assert
    expect(result).toEqual({ ok: false, error: 'multiple-callers' });
    expect(codebase).toEqual(original);
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
    ['publicメソッドに呼び出し行がない', extractedCodebase(), 'method-place', 'call-not-found'],
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

  it('responsibility=callかつusesが対象IDだけの処理をID規約なしで見つける', () => {
    // Arrange
    const base = extractedCodebase();
    const [file] = base.files;
    const [codeClass] = file.classes;
    const [caller, method] = codeClass.methods;
    const forwarding = { ...caller, fragments: [{ id: 'arbitrary-id', label: 'forward', lines: 1, responsibility: 'call', uses: [method.id] }] };
    const codebase: Codebase = { files: [{ ...file, classes: [{ ...codeClass, methods: [forwarding, method] }] }, base.files[1]] };

    // Act
    const result = findCallerOf(codebase, method.id);

    // Assert
    expect(result?.id).toBe(caller.id);
  });

  it('非callや複数usesは呼び出し行とみなさない', () => {
    // Arrange
    const base = extractedCodebase();
    const [file] = base.files;
    const [codeClass] = file.classes;
    const [caller, method] = codeClass.methods;
    const nonCall = { ...caller, fragments: [{ id: 'business', label: 'business', lines: 1, responsibility: 'business', uses: [method.id] }] };
    const multiCall = { ...caller, id: 'multi', fragments: [{ id: 'calls', label: 'calls', lines: 1, responsibility: 'call', uses: [method.id, 'other'] }] };
    const codebase: Codebase = { files: [{ ...file, classes: [{ ...codeClass, methods: [nonCall, multiCall, method] }] }, base.files[1]] };

    // Act
    const result = findCallerOf(codebase, method.id);

    // Assert
    expect(result).toBeUndefined();
  });
});
