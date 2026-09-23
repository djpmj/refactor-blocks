import { describe, expect, it } from 'vitest';
import { findMethod, type Codebase } from './Codebase';
import { availableSuperclasses, setSuperclass } from './setSuperclass';
import { sampleCodebase } from './testFixtures';

/** A → B → C の継承チェーンを組めるよう、3クラスを1ファイルに置く。 */
function threeClassCodebase(): Codebase {
  return {
    files: [
      {
        id: 'file-abc',
        path: 'src/abc.ts',
        classes: [
          { id: 'class-a', name: 'A', methods: [] },
          { id: 'class-b', name: 'B', methods: [], superclassId: 'class-a' },
          { id: 'class-c', name: 'C', methods: [], superclassId: 'class-b' },
        ],
      },
    ],
  };
}

describe('setSuperclass', () => {
  it('親クラス名を指定すると、そのクラスのIDがsuperclassIdに入る', () => {
    // Arrange
    const codebase = sampleCodebase();

    // Act
    const result = setSuperclass(codebase, 'class-order', 'TaxCalculator');

    // Assert
    if (!result.ok) throw new Error(result.error);
    const changed = result.value.files[0].classes[0];
    expect(changed.superclassId).toBe('class-tax');
  });

  it('元のCodebaseは変更しない', () => {
    // Arrange
    const codebase = sampleCodebase();

    // Act
    setSuperclass(codebase, 'class-order', 'TaxCalculator');

    // Assert
    expect(codebase).toEqual(sampleCodebase());
  });

  it('nullを指定すると継承を解除する', () => {
    // Arrange
    const codebase = threeClassCodebase();

    // Act
    const result = setSuperclass(codebase, 'class-b', null);

    // Assert
    if (!result.ok) throw new Error(result.error);
    expect(result.value.files[0].classes[1].superclassId).toBeUndefined();
  });

  it('空文字を指定しても継承を解除する', () => {
    // Arrange
    const codebase = threeClassCodebase();

    // Act
    const result = setSuperclass(codebase, 'class-b', '  ');

    // Assert
    if (!result.ok) throw new Error(result.error);
    expect(result.value.files[0].classes[1].superclassId).toBeUndefined();
  });

  it('今と同じ親クラスを指定すると、エラーにせず元のままにする', () => {
    // Arrange
    const codebase = threeClassCodebase();

    // Act
    const result = setSuperclass(codebase, 'class-b', 'A');

    // Assert
    expect(result).toEqual({ ok: true, value: codebase });
  });

  it('継承なしのクラスにnullを指定しても、エラーにせず元のままにする', () => {
    // Arrange
    const codebase = threeClassCodebase();

    // Act
    const result = setSuperclass(codebase, 'class-a', null);

    // Assert
    expect(result).toEqual({ ok: true, value: codebase });
  });

  it('kindにimplementsを指定すると、superclassKindに"implements"が入る', () => {
    // Arrange
    const codebase = sampleCodebase();

    // Act
    const result = setSuperclass(codebase, 'class-order', 'TaxCalculator', 'implements');

    // Assert
    if (!result.ok) throw new Error(result.error);
    const changed = result.value.files[0].classes[0];
    expect(changed.superclassKind).toBe('implements');
  });

  it('kindを省略すると、superclassKindは"extends"になる', () => {
    // Arrange
    const codebase = sampleCodebase();

    // Act
    const result = setSuperclass(codebase, 'class-order', 'TaxCalculator');

    // Assert
    if (!result.ok) throw new Error(result.error);
    const changed = result.value.files[0].classes[0];
    expect(changed.superclassKind).toBe('extends');
  });

  it('継承を解除すると、superclassKindも消える', () => {
    // Arrange
    const withInterface = setSuperclass(sampleCodebase(), 'class-order', 'TaxCalculator', 'implements');
    if (!withInterface.ok) throw new Error(withInterface.error);

    // Act
    const result = setSuperclass(withInterface.value, 'class-order', null);

    // Assert
    if (!result.ok) throw new Error(result.error);
    const changed = result.value.files[0].classes[0];
    expect(changed.superclassKind).toBeUndefined();
  });

  it('同じ親クラスでもkindを変えると更新する', () => {
    // Arrange
    const withExtends = setSuperclass(sampleCodebase(), 'class-order', 'TaxCalculator');
    if (!withExtends.ok) throw new Error(withExtends.error);

    // Act
    const result = setSuperclass(withExtends.value, 'class-order', 'TaxCalculator', 'implements');

    // Assert
    if (!result.ok) throw new Error(result.error);
    const changed = result.value.files[0].classes[0];
    expect(changed.superclassKind).toBe('implements');
  });

  it('同じ親クラス・同じkindを指定すると、エラーにせず元のままにする', () => {
    // Arrange
    const withInterface = setSuperclass(sampleCodebase(), 'class-order', 'TaxCalculator', 'implements');
    if (!withInterface.ok) throw new Error(withInterface.error);

    // Act
    const result = setSuperclass(withInterface.value, 'class-order', 'TaxCalculator', 'implements');

    // Assert
    expect(result).toEqual({ ok: true, value: withInterface.value });
  });

  it.each([
    ['存在しないクラスを変更しようとする', 'class-none', 'A', 'class-not-found'],
    ['存在しない名前を親に指定する', 'class-a', 'NoSuchClass', 'superclass-not-found'],
    ['自分自身を親に指定する', 'class-a', 'A', 'self-inheritance'],
    ['直接の循環になる(B→A→Bのところ、AをBの子にする)', 'class-a', 'B', 'inheritance-cycle'],
    ['間接の循環になる(A→B→Cのところ、AをCの子にする)', 'class-a', 'C', 'inheritance-cycle'],
  ])('%sときはエラーになる', (_label, classId, superclassName, expected) => {
    // Arrange
    const codebase = threeClassCodebase();

    // Act
    const result = setSuperclass(codebase, classId, superclassName);

    // Assert
    expect(result).toEqual({ ok: false, error: expected });
  });

  describe('継承元のprivateメソッドへの可視性の広がり', () => {
    /**
     * NotifierBase を Move Method で先に private メソッドを持たせておき、
     * EmailNotifier 側にその呼び出し(Fragment.uses)だけが残っている状態
     * (Extract Method → Move Method の直後、まだ継承関係を結ぶ前)を模す。
     */
    function codebaseWithMovedPrivateMethod(): Codebase {
      return {
        files: [
          {
            id: 'file',
            path: 'src/all.ts',
            classes: [
              {
                id: 'class-email',
                name: 'EmailNotifier',
                methods: [
                  {
                    id: 'method-notify',
                    name: 'notifyByEmail',
                    visibility: 'public',
                    fragments: [{ id: 'f-call', label: 'call', lines: 1, responsibility: 'call', uses: ['method-build-body'] }],
                  },
                ],
              },
              {
                id: 'class-base',
                name: 'NotifierBase',
                methods: [{ id: 'method-build-body', name: 'buildEmailBody', visibility: 'private', fragments: [] }],
              },
            ],
          },
        ],
      };
    }

    it('extendsを設定すると、子クラス自身が呼んでいる親のprivateメソッドはprotectedになる', () => {
      // Arrange
      const codebase = codebaseWithMovedPrivateMethod();

      // Act
      const result = setSuperclass(codebase, 'class-email', 'NotifierBase');

      // Assert
      if (!result.ok) throw new Error(result.error);
      expect(findMethod(result.value, 'method-build-body')?.visibility).toBe('protected');
    });

    it('子クラスが呼んでいないprivateメソッドは、extendsを設定してもprivateのまま', () => {
      // Arrange
      const codebase = codebaseWithMovedPrivateMethod();
      const withoutCall: Codebase = {
        files: [{ ...codebase.files[0], classes: [{ ...codebase.files[0].classes[0], methods: [] }, codebase.files[0].classes[1]] }],
      };

      // Act
      const result = setSuperclass(withoutCall, 'class-email', 'NotifierBase');

      // Assert
      if (!result.ok) throw new Error(result.error);
      expect(findMethod(result.value, 'method-build-body')?.visibility).toBe('private');
    });

    it('implementsを設定しても、privateメソッドの可視性は変えない(インターフェースに実装は乗らない)', () => {
      // Arrange
      const codebase = codebaseWithMovedPrivateMethod();

      // Act
      const result = setSuperclass(codebase, 'class-email', 'NotifierBase', 'implements');

      // Assert
      if (!result.ok) throw new Error(result.error);
      expect(findMethod(result.value, 'method-build-body')?.visibility).toBe('private');
    });
  });
});

describe('availableSuperclasses', () => {
  it('関係がなければ、自分以外の全クラスを返す', () => {
    // Arrange
    const codebase = sampleCodebase();

    // Act
    const result = availableSuperclasses(codebase, 'class-order');

    // Assert
    expect(result.map((codeClass) => codeClass.name)).toEqual(['TaxCalculator']);
  });

  it('循環になる相手は候補から除く(A→B→Cのとき、AにはB・Cとも選べない)', () => {
    // Arrange
    const codebase = threeClassCodebase();

    // Act
    const result = availableSuperclasses(codebase, 'class-a');

    // Assert
    expect(result).toEqual([]);
  });

  it('間接の循環になる相手だけを除く(A→B→CのBには、循環しないAだけ選べる)', () => {
    // Arrange
    const codebase = threeClassCodebase();

    // Act
    const result = availableSuperclasses(codebase, 'class-b');

    // Assert
    expect(result.map((codeClass) => codeClass.name)).toEqual(['A']);
  });

  it('循環にならない相手はすべて選べる(A→B→CのCには、A・Bとも選べる)', () => {
    // Arrange
    const codebase = threeClassCodebase();

    // Act
    const result = availableSuperclasses(codebase, 'class-c');

    // Assert
    expect(result.map((codeClass) => codeClass.name)).toEqual(['A', 'B']);
  });
});
