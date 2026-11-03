import { describe, expect, it } from 'vitest';
import type { CodeClass, Codebase, Fragment, Method } from './Codebase';
import { collaboratorsOf, compositionOrder, qualifyFragmentCode, qualifyForeignMembers, wiringOf } from './csharpWiring';

function fragment(id: string, extra: Partial<Fragment> = {}): Fragment {
  return { id, label: id, lines: 1, responsibility: 'x', ...extra };
}

function method(id: string, name: string, fragments: readonly Fragment[] = []): Method {
  return { id, name, visibility: 'public', fragments };
}

function klass(id: string, name: string, methods: readonly Method[], extra: Partial<CodeClass> = {}): CodeClass {
  return { id, name, methods, ...extra };
}

function codebaseOf(...classes: CodeClass[]): Codebase {
  return { files: [{ id: 'f', path: 'x', classes }] };
}

/** A.Run → B.Run → C.Run の鎖。 */
const chain = codebaseOf(
  klass('a', 'A', [method('a-run', 'Run', [fragment('fa', { uses: ['b-run'] })])]),
  klass('b', 'B', [method('b-run', 'Run', [fragment('fb', { uses: ['c-run'] })])]),
  klass('c', 'C', [method('c-run', 'Run', [fragment('fc')])]),
);

/** A.Run ⇄ B.Run の循環。 */
const cycle = codebaseOf(
  klass('a', 'A', [method('a-run', 'Run', [fragment('fa', { uses: ['b-run'] })])]),
  klass('b', 'B', [method('b-run', 'Run', [fragment('fb', { uses: ['a-run'] })])]),
);

describe('collaboratorsOf', () => {
  it('同じクラスのメソッドだけを呼ぶクラスは空', () => {
    // Arrange
    const codebase = codebaseOf(klass('a', 'A', [method('m1', 'One', [fragment('f', { uses: ['m2'] })]), method('m2', 'Two')]));
    // Act / Assert
    expect(collaboratorsOf(codebase, 'a')).toEqual([]);
  });

  it('別クラスのメソッドを呼ぶと1件入り、同じクラスを何度呼んでも1件', () => {
    // Arrange
    const codebase = codebaseOf(
      klass('a', 'OrderService', [method('m', 'Run', [fragment('f1', { uses: ['t1'] }), fragment('f2', { uses: ['t2'] })])]),
      klass('t', 'TaxCalculator', [method('t1', 'CalculateTax'), method('t2', 'Rate')]),
    );
    // Act
    const result = collaboratorsOf(codebase, 'a');
    // Assert
    expect(result).toEqual([{ classId: 't', typeName: 'TaxCalculator', fieldName: '_taxCalculator' }]);
  });

  it('別クラスのフィールドを読む・書く処理でも入り、使われた順に並ぶ', () => {
    // Arrange
    const codebase = codebaseOf(
      klass('a', 'A', [method('m', 'Run', [fragment('f1', { reads: ['fld-b'] }), fragment('f2', { writes: ['fld-c'] })])]),
      klass('b', 'B', [], { fields: [{ id: 'fld-b', name: 'x', visibility: 'public' }] }),
      klass('c', 'C', [], { fields: [{ id: 'fld-c', name: 'y', visibility: 'public' }] }),
    );
    // Act / Assert
    expect(collaboratorsOf(codebase, 'a').map((c) => c.classId)).toEqual(['b', 'c']);
  });

  it('インターフェースのメソッドを呼ぶと、型名がインターフェース名になる', () => {
    // Arrange
    const codebase = codebaseOf(
      klass('a', 'A', [method('m', 'Run', [fragment('f', { uses: ['i-do'] })])]),
      klass('i', 'IDiscountPolicy', [method('i-do', 'Apply')]),
    );
    // Act / Assert
    expect(collaboratorsOf(codebase, 'a')).toEqual([{ classId: 'i', typeName: 'IDiscountPolicy', fieldName: '_iDiscountPolicy' }]);
  });

  it('先祖クラスのメンバーは別クラスとして数えない', () => {
    // Arrange
    const codebase = codebaseOf(
      klass('base', 'Base', [method('b-do', 'Do', [fragment('fb')])]),
      klass('a', 'A', [method('m', 'Run', [fragment('f', { uses: ['b-do'] })])], { superclassId: 'base' }),
    );
    // Act / Assert
    expect(collaboratorsOf(codebase, 'a')).toEqual([]);
  });
});

describe('compositionOrder', () => {
  it('A → B → C の依存なら C・B・A の順に組み立て、A のコンストラクタに B が渡る', () => {
    // Arrange / Act
    const plan = compositionOrder(chain);
    // Assert
    expect(plan.steps.map((step) => step.className)).toEqual(['C', 'B', 'A']);
    expect(plan.steps.find((step) => step.className === 'A')?.args).toEqual(['b']);
    expect(plan.lateAssignments).toEqual([]);
  });

  it('A ⇄ B の循環があると片方の辺が lateAssignments に入り、全クラスが組み立てられる', () => {
    // Arrange / Act
    const plan = compositionOrder(cycle);
    // Assert
    expect(plan.steps.map((step) => step.className)).toEqual(['B', 'A']);
    expect(plan.lateAssignments).toEqual([{ variable: 'b', property: 'A', value: 'a' }]);
    expect(plan.steps.find((step) => step.className === 'A')?.args).toEqual(['b']);
    expect(plan.steps.find((step) => step.className === 'B')?.args).toEqual([]);
  });

  const withPolicies = (implementers: number): Codebase => codebaseOf(
    klass('a', 'A', [method('m', 'Run', [fragment('f', { uses: ['i-do'] })])]),
    klass('i', 'IDiscountPolicy', [method('i-do', 'Apply')]),
    ...['Vip', 'Normal'].slice(0, implementers).map((name) => klass(`impl-${name}`, `${name}Policy`, [method(`${name}-do`, 'Apply', [fragment(`f-${name}`)])], { interfaceIds: ['i'] })),
  );

  it('実装が1つのインターフェースには、その実装が渡る', () => {
    // Arrange / Act
    const plan = compositionOrder(withPolicies(1));
    // Assert
    expect(plan.steps.map((step) => step.className)).toEqual(['VipPolicy', 'A']);
    expect(plan.steps[1].args).toEqual(['vipPolicy']);
    expect(plan.issues).toEqual([]);
  });

  it('実装が複数で bindings があれば従い、無ければ ambiguous-binding の問題として返る', () => {
    // Arrange
    const codebase = withPolicies(2);
    // Act
    const bound = compositionOrder(codebase, { IDiscountPolicy: 'NormalPolicy' });
    const unbound = compositionOrder(codebase);
    // Assert
    expect(bound.steps.find((step) => step.className === 'A')?.args).toEqual(['normalPolicy']);
    expect(bound.issues).toEqual([]);
    expect(unbound.issues).toEqual([{ classId: 'a', methodId: 'm', memberName: 'IDiscountPolicy', ownerClassId: 'i', reason: 'ambiguous-binding' }]);
    expect(unbound.steps.find((step) => step.className === 'A')?.args).toEqual(['null']);
  });
});

describe('compositionOrder: 抽象クラス', () => {
  /** A が抽象クラス Base(本体の無い protected メソッドを持つ)のメソッドを呼び、Child がそれを継承する。 */
  const withAbstractBase = codebaseOf(
    klass('a', 'A', [method('a-run', 'Run', [fragment('fa', { uses: ['base-run'] })])]),
    klass('base', 'Base', [{ id: 'base-hook', name: 'Hook', visibility: 'protected', fragments: [] }, method('base-run', 'Run', [fragment('fb')])]),
    klass('child', 'Child', [{ id: 'child-hook', name: 'Hook', visibility: 'protected', fragments: [fragment('fc')] }], { superclassId: 'base' }),
  );

  it('抽象クラスは new せず、継承した具象クラスを渡す', () => {
    // Arrange / Act
    const plan = compositionOrder(withAbstractBase);
    // Assert
    expect(plan.steps.map((step) => step.className)).toEqual(['Child', 'A']);
    expect(plan.steps[1].args).toEqual(['child']);
    expect(plan.issues).toEqual([]);
  });
});

describe('wiringOf', () => {
  it('注入する相手のフィールドとコンストラクタを宣言し、受け手を返す', () => {
    // Arrange / Act
    const wiring = wiringOf(chain, 'a');
    // Assert
    expect(wiring.declarations).toEqual(['    private readonly B _b;', '', '    public A(B b)', '    {', '        _b = b;', '    }']);
    expect(wiring.receivers.get('b')).toBe('_b');
  });

  it('循環の辺はプロパティで受ける', () => {
    // Arrange / Act
    const wiring = wiringOf(cycle, 'b');
    // Assert
    expect(wiring.declarations).toEqual(['    public A A { private get; set; }']);
    expect(wiring.receivers.get('a')).toBe('A');
  });
});

describe('qualifyForeignMembers', () => {
  const replacements = new Map([['_repository', '_orderService._repository']]);

  it('識別子を受け手付きに置き換える', () => {
    // Act / Assert
    expect(qualifyForeignMembers('_repository.SaveAsync(order)', replacements)).toBe('_orderService._repository.SaveAsync(order)');
  });

  it('名前の一部だけが一致する識別子は置き換えない', () => {
    // Act / Assert
    expect(qualifyForeignMembers('_repositoryCache.Clear(); x_repository = 1;', replacements)).toBe('_repositoryCache.Clear(); x_repository = 1;');
  });

  it('文字列リテラルの中は置き換えない', () => {
    // Act / Assert
    expect(qualifyForeignMembers('Log("_repository"); _repository.Save();', replacements)).toBe('Log("_repository"); _orderService._repository.Save();');
  });
});

describe('qualifyFragmentCode', () => {
  it('処理が使う別クラスのメソッドの呼び出しに、受け手を付ける', () => {
    // Arrange
    const caller = fragment('fa', { uses: ['b-run'], code: { csharp: 'var x = Run(1);' } });
    const codebase = codebaseOf(klass('a', 'A', [method('a-run', 'Go', [caller])]), klass('b', 'B', [method('b-run', 'Run', [fragment('fb')])]));
    // Act
    const code = qualifyFragmentCode(codebase, new Map([['b', '_b']]), caller, 'var x = Run(1);');
    // Assert
    expect(code).toBe('var x = _b.Run(1);');
  });

  it('同じクラスのメソッドの呼び出しは、そのままにする', () => {
    // Arrange
    const caller = fragment('fa', { uses: ['a-run'] });
    const codebase = codebaseOf(klass('a', 'A', [method('a-run', 'Run', [fragment('fb')]), method('a-go', 'Go', [caller])]));
    // Act
    const code = qualifyFragmentCode(codebase, new Map(), caller, 'Run(1);');
    // Assert
    expect(code).toBe('Run(1);');
  });

  it('同じ名前のメソッドを自分のクラスと別クラスの両方から使う処理は、自分のクラスのメソッドとして呼ぶ', () => {
    // Arrange
    const caller = fragment('fa', { uses: ['a-run', 'b-run'] });
    const codebase = codebaseOf(klass('a', 'A', [method('a-run', 'Run', [fragment('fa2')]), method('a-go', 'Go', [caller])]), klass('b', 'B', [method('b-run', 'Run', [fragment('fb')])]));
    // Act
    const code = qualifyFragmentCode(codebase, new Map([['b', '_b']]), caller, 'Run(1);');
    // Assert
    expect(code).toBe('Run(1);');
  });
});
