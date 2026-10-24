import { describe, expect, it } from 'vitest';
import { findMethod, mapClasses, type CodeClass, type Codebase } from './Codebase';
import { addInterface, availableInterfaces, availableParents, implementableInterfaces, removeInterface, setSuperclass } from './setSuperclass';
import { fragment, sampleCodebase } from './testFixtures';

/** 継承・実装の関係を一切持たない3つのインターフェース役のクラス(X・Y・Z)。実装先(implements)だけの輪を組み立てるテストに使う。 */
function independentClasses(): Codebase {
  return {
    files: [
      {
        id: 'file-xyz',
        path: 'src/xyz.ts',
        classes: [
          interfaceClass('class-x', 'X'),
          interfaceClass('class-y', 'Y'),
          interfaceClass('class-z', 'Z'),
        ],
      },
    ],
  };
}

/** 中身の無い public メソッドだけを持つ = インターフェース役のクラス。 */
function interfaceClass(id: string, name: string, superclassId?: string): CodeClass {
  return { id, name, superclassId, methods: [{ id: `method-${id}`, name: 'run', visibility: 'public', fragments: [] }] };
}

/** 具象クラス(中身のある public メソッド)・インターフェース役・メソッドの無い空クラスが1つずつある。 */
function interfaceAndConcreteCodebase(): Codebase {
  return {
    files: [
      {
        id: 'file-mixed',
        path: 'src/mixed.ts',
        classes: [
          { id: 'class-concrete', name: 'Concrete', methods: [{ id: 'method-work', name: 'work', visibility: 'public', fragments: [fragment('f-work', 3)] }] },
          interfaceClass('class-iface', 'Runnable'),
          { id: 'class-empty', name: 'Empty', methods: [] },
          { id: 'class-impl', name: 'Impl', methods: [] },
        ],
      },
    ],
  };
}

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

/** sampleCodebase の TaxCalculator を、中身の無い public メソッドだけのインターフェース役にしたもの。 */
function taxAsInterfaceCodebase(): Codebase {
  const base = sampleCodebase();
  return { files: [base.files[0], { ...base.files[1], classes: [interfaceClass('class-tax', 'TaxCalculator')] }] };
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

  it('実装先(implements)になっている相手を継承元に指定すると already-related', () => {
    // Arrange
    const withInterface = addInterface(taxAsInterfaceCodebase(), 'class-order', 'TaxCalculator');
    if (!withInterface.ok) throw new Error(withInterface.error);

    // Act
    const result = setSuperclass(withInterface.value, 'class-order', 'TaxCalculator');

    // Assert
    expect(result).toEqual({ ok: false, error: 'already-related' });
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
  });
});

describe('addInterface', () => {
  it('実装するインターフェースを1つ追加する', () => {
    // Arrange
    const codebase = taxAsInterfaceCodebase();

    // Act
    const result = addInterface(codebase, 'class-order', 'TaxCalculator');

    // Assert
    if (!result.ok) throw new Error(result.error);
    expect(result.value.files[0].classes[0].interfaceIds).toEqual(['class-tax']);
  });

  it('2つ目を足すと、interfaceIdsが2要素(宣言順)になる', () => {
    // Arrange
    const codebase = independentClasses();

    // Act
    const first = addInterface(codebase, 'class-x', 'Y');
    if (!first.ok) throw new Error(first.error);
    const result = addInterface(first.value, 'class-x', 'Z');

    // Assert
    if (!result.ok) throw new Error(result.error);
    expect(result.value.files[0].classes[0].interfaceIds).toEqual(['class-y', 'class-z']);
  });

  it('同じものをもう一度追加しても変化しない', () => {
    // Arrange
    const withInterface = addInterface(taxAsInterfaceCodebase(), 'class-order', 'TaxCalculator');
    if (!withInterface.ok) throw new Error(withInterface.error);

    // Act
    const result = addInterface(withInterface.value, 'class-order', 'TaxCalculator');

    // Assert
    expect(result).toEqual({ ok: true, value: withInterface.value });
  });

  it('元のCodebaseは変更しない', () => {
    // Arrange
    const codebase = taxAsInterfaceCodebase();

    // Act
    addInterface(codebase, 'class-order', 'TaxCalculator');

    // Assert
    expect(codebase).toEqual(taxAsInterfaceCodebase());
  });

  it.each([
    ['継承元を指定する', 'class-b', 'A', 'already-related', (codebase: Codebase) => codebase],
    ['自分自身を指定する', 'class-a', 'A', 'self-inheritance', (codebase: Codebase) => codebase],
    ['名前なしを指定する', 'class-a', 'NoSuchClass', 'interface-not-found', (codebase: Codebase) => codebase],
  ])('%sときはエラーになる', (_label, classId, name, expected) => {
    // Arrange
    const codebase = threeClassCodebase();

    // Act
    const result = addInterface(codebase, classId, name);

    // Assert
    expect(result).toEqual({ ok: false, error: expected });
  });

  it('実装先経由の輪になるときは inheritance-cycle', () => {
    // Arrange: X implements Z(X→Z)、ZをXへimplementsさせようとすると輪になる
    const withInterface = addInterface(independentClasses(), 'class-x', 'Z');
    if (!withInterface.ok) throw new Error(withInterface.error);

    // Act
    const result = addInterface(withInterface.value, 'class-z', 'X');

    // Assert
    expect(result).toEqual({ ok: false, error: 'inheritance-cycle' });
  });
});

describe('addInterface(インターフェース役だけ)', () => {
  it('具象クラスを指定すると not-interface になり、元のCodebaseは変わらない', () => {
    // Arrange
    const codebase = interfaceAndConcreteCodebase();

    // Act
    const result = addInterface(codebase, 'class-impl', 'Concrete');

    // Assert
    expect(result).toEqual({ ok: false, error: 'not-interface' });
    expect(codebase).toEqual(interfaceAndConcreteCodebase());
  });

  it('メソッドの無い空のクラスを指定しても not-interface になる', () => {
    // Arrange
    const codebase = interfaceAndConcreteCodebase();

    // Act
    const result = addInterface(codebase, 'class-impl', 'Empty');

    // Assert
    expect(result).toEqual({ ok: false, error: 'not-interface' });
  });

  it('インターフェース役を指定すると実装先に入る', () => {
    // Arrange
    const codebase = interfaceAndConcreteCodebase();

    // Act
    const result = addInterface(codebase, 'class-impl', 'Runnable');

    // Assert
    if (!result.ok) throw new Error(result.error);
    expect(result.value.files[0].classes[3].interfaceIds).toEqual(['class-iface']);
  });
});

describe('removeInterface', () => {
  it('2つのうち1つだけ外れる', () => {
    // Arrange
    const codebase = independentClasses();
    const withBoth = addInterface(codebase, 'class-x', 'Y');
    if (!withBoth.ok) throw new Error(withBoth.error);
    const withTwo = addInterface(withBoth.value, 'class-x', 'Z');
    if (!withTwo.ok) throw new Error(withTwo.error);

    // Act
    const result = removeInterface(withTwo.value, 'class-x', 'Y');

    // Assert
    if (!result.ok) throw new Error(result.error);
    expect(result.value.files[0].classes[0].interfaceIds).toEqual(['class-z']);
  });

  it('最後の1つを外すと、interfaceIdsプロパティがなくなる', () => {
    // Arrange
    const withInterface = addInterface(taxAsInterfaceCodebase(), 'class-order', 'TaxCalculator');
    if (!withInterface.ok) throw new Error(withInterface.error);

    // Act
    const result = removeInterface(withInterface.value, 'class-order', 'TaxCalculator');

    // Assert
    if (!result.ok) throw new Error(result.error);
    expect(result.value.files[0].classes[0].interfaceIds).toBeUndefined();
  });

  it('実装していない相手を指定しても変化しない', () => {
    // Arrange
    const codebase = sampleCodebase();

    // Act
    const result = removeInterface(codebase, 'class-order', 'TaxCalculator');

    // Assert
    expect(result).toEqual({ ok: true, value: codebase });
  });

  it('存在しないクラスを指定すると class-not-found', () => {
    // Arrange
    const codebase = sampleCodebase();

    // Act
    const result = removeInterface(codebase, 'class-none', 'TaxCalculator');

    // Assert
    expect(result).toEqual({ ok: false, error: 'class-not-found' });
  });

  it('存在しない名前を指定すると interface-not-found', () => {
    // Arrange
    const codebase = sampleCodebase();

    // Act
    const result = removeInterface(codebase, 'class-order', 'NoSuchClass');

    // Assert
    expect(result).toEqual({ ok: false, error: 'interface-not-found' });
  });
});

describe('availableParents', () => {
  it('関係がなければ、自分以外の全クラスを返す', () => {
    // Arrange
    const codebase = sampleCodebase();

    // Act
    const result = availableParents(codebase, 'class-order');

    // Assert
    expect(result.map((codeClass) => codeClass.name)).toEqual(['TaxCalculator']);
  });

  it('循環になる相手は候補から除く(A→B→Cのとき、AにはB・Cとも選べない)', () => {
    // Arrange
    const codebase = threeClassCodebase();

    // Act
    const result = availableParents(codebase, 'class-a');

    // Assert
    expect(result).toEqual([]);
  });

  it('間接の循環になる相手だけを除く(A→B→CのBには、循環しないAだけ選べる)', () => {
    // Arrange
    const codebase = threeClassCodebase();

    // Act
    const result = availableParents(codebase, 'class-b');

    // Assert
    expect(result.map((codeClass) => codeClass.name)).toEqual(['A']);
  });

  it('循環にならない相手はすべて選べる(A→B→CのCには、A・Bとも選べる)', () => {
    // Arrange
    const codebase = threeClassCodebase();

    // Act
    const result = availableParents(codebase, 'class-c');

    // Assert
    expect(result.map((codeClass) => codeClass.name)).toEqual(['A', 'B']);
  });

  it('実装先経由で輪になる候補を除く', () => {
    // Arrange: X implements Z(X→Z)なので、Zの候補にXを選ぶと輪になる
    const withInterface = addInterface(independentClasses(), 'class-x', 'Z');
    if (!withInterface.ok) throw new Error(withInterface.error);

    // Act
    const result = availableParents(withInterface.value, 'class-z');

    // Assert
    expect(result.map((codeClass) => codeClass.name)).not.toContain('X');
  });
});

describe('availableInterfaces', () => {
  it('インターフェース役のクラスだけを返す(具象クラス・空のクラスは含まない)', () => {
    // Arrange
    const codebase = interfaceAndConcreteCodebase();

    // Act
    const result = availableInterfaces(codebase, 'class-impl');

    // Assert
    expect(result.map((codeClass) => codeClass.name)).toEqual(['Runnable']);
  });

  it('自分自身は含まない', () => {
    // Arrange
    const codebase = interfaceAndConcreteCodebase();

    // Act
    const result = availableInterfaces(codebase, 'class-iface');

    // Assert
    expect(result).toEqual([]);
  });

  it('自分の子孫(自分を継承・実装しているインターフェース役)は含まない', () => {
    // Arrange
    const codebase: Codebase = { files: [{ id: 'file', path: 'src/a.ts', classes: [interfaceClass('class-base', 'Base'), interfaceClass('class-sub', 'Sub', 'class-base')] }] };

    // Act
    const result = availableInterfaces(codebase, 'class-base');

    // Assert
    expect(result).toEqual([]);
  });
});

describe('implementableInterfaces', () => {
  it('すでに実装している相手が後から具象化しても、候補に残る(外せる)', () => {
    // Arrange
    const withInterface = addInterface(interfaceAndConcreteCodebase(), 'class-impl', 'Runnable');
    if (!withInterface.ok) throw new Error(withInterface.error);
    const concretized = mapClasses(withInterface.value, (codeClass) =>
      codeClass.id === 'class-iface' ? { ...codeClass, methods: [...codeClass.methods, { id: 'method-body', name: 'body', visibility: 'public', fragments: [fragment('f-body', 2)] }] } : codeClass,
    );

    // Act
    const result = implementableInterfaces(concretized, 'class-impl');
    const removed = removeInterface(concretized, 'class-impl', 'Runnable');

    // Assert
    expect(availableInterfaces(concretized, 'class-impl')).toEqual([]);
    expect(result.map((codeClass) => codeClass.name)).toEqual(['Runnable']);
    expect(removed.ok).toBe(true);
  });

  it('実装していない具象クラスは候補に出さない', () => {
    // Arrange
    const codebase = interfaceAndConcreteCodebase();

    // Act
    const result = implementableInterfaces(codebase, 'class-impl');

    // Assert
    expect(result.map((codeClass) => codeClass.name)).toEqual(['Runnable']);
  });
});
