import { describe, expect, it } from 'vitest';
import type { CodeClass, Codebase, Field, Fragment, Method } from '../codebase/Codebase';
import { sampleCodebase } from '../codebase/testFixtures';
import { findEncapsulationViolations, findFeatureEnvy, findOpenSetters } from './fieldAccess';

function field(id: string, name: string, visibility: Field['visibility'] = 'public'): Field {
  return { id, name, visibility };
}

type ClassOptions = {
  readonly fields?: readonly Field[];
  readonly fragments?: readonly Fragment[];
  readonly superclassId?: string;
  readonly interfaceIds?: readonly string[];
};

function classOf(id: string, name: string, options: ClassOptions = {}): CodeClass {
  const { fields = [], fragments = [], superclassId, interfaceIds } = options;
  return {
    id,
    name,
    fields,
    superclassId,
    interfaceIds,
    methods: fragments.length === 0 ? [] : [{ id: `method-${id}`, name: 'run', visibility: 'public', fragments }],
  };
}

function codebaseOf(classes: readonly CodeClass[]): Codebase {
  return { files: [{ id: 'file', path: 'src/all.ts', classes }] };
}

describe('findFeatureEnvy', () => {
  it('自クラスのフィールド1つ・他クラスBのフィールド3つを触るメソッド → Feature Envy', () => {
    // Arrange
    const codebase = codebaseOf([
      classOf('class-A', 'A', {
        fields: [field('f-a1', 'a1')],
        fragments: [{ id: 'frag', label: 'do', lines: 1, responsibility: 'x', reads: ['f-a1', 'f-b1', 'f-b2', 'f-b3'] }],
      }),
      classOf('class-B', 'B', { fields: [field('f-b1', 'b1'), field('f-b2', 'b2'), field('f-b3', 'b3')] }),
    ]);

    // Act
    const envy = findFeatureEnvy(codebase);

    // Assert
    expect(envy).toEqual([{ methodId: 'method-class-A', enviedClassId: 'class-B' }]);
  });

  it('自クラス2つ・B2つ(同数) → 空', () => {
    // Arrange
    const codebase = codebaseOf([
      classOf('class-A', 'A', {
        fields: [field('f-a1', 'a1'), field('f-a2', 'a2')],
        fragments: [{ id: 'frag', label: 'do', lines: 1, responsibility: 'x', reads: ['f-a1', 'f-a2', 'f-b1', 'f-b2'] }],
      }),
      classOf('class-B', 'B', { fields: [field('f-b1', 'b1'), field('f-b2', 'b2')] }),
    ]);

    // Act
    const envy = findFeatureEnvy(codebase);

    // Assert
    expect(envy).toEqual([]);
  });

  it('自クラス0・B1つ(下限未満) → 空', () => {
    // Arrange
    const codebase = codebaseOf([
      classOf('class-A', 'A', { fragments: [{ id: 'frag', label: 'do', lines: 1, responsibility: 'x', reads: ['f-b1'] }] }),
      classOf('class-B', 'B', { fields: [field('f-b1', 'b1')] }),
    ]);

    // Act
    const envy = findFeatureEnvy(codebase);

    // Assert
    expect(envy).toEqual([]);
  });

  it('自クラス1・B2つ・C2つ → allClassesの並びで先のクラス', () => {
    // Arrange
    const codebase = codebaseOf([
      classOf('class-A', 'A', {
        fields: [field('f-a1', 'a1')],
        fragments: [{ id: 'frag', label: 'do', lines: 1, responsibility: 'x', reads: ['f-a1', 'f-b1', 'f-b2', 'f-c1', 'f-c2'] }],
      }),
      classOf('class-B', 'B', { fields: [field('f-b1', 'b1'), field('f-b2', 'b2')] }),
      classOf('class-C', 'C', { fields: [field('f-c1', 'c1'), field('f-c2', 'c2')] }),
    ]);

    // Act
    const envy = findFeatureEnvy(codebase);

    // Assert
    expect(envy).toEqual([{ methodId: 'method-class-A', enviedClassId: 'class-B' }]);
  });

  it('B1つ・C1つ・自クラス0(まとめ役) → 空', () => {
    // Arrange
    const codebase = codebaseOf([
      classOf('class-A', 'A', { fragments: [{ id: 'frag', label: 'do', lines: 1, responsibility: 'x', reads: ['f-b1', 'f-c1'] }] }),
      classOf('class-B', 'B', { fields: [field('f-b1', 'b1')] }),
      classOf('class-C', 'C', { fields: [field('f-c1', 'c1')] }),
    ]);

    // Act
    const envy = findFeatureEnvy(codebase);

    // Assert
    expect(envy).toEqual([]);
  });

  it('親クラス(extends)のフィールドを2つ触る子クラスのメソッド → 空(自分側)', () => {
    // Arrange
    const parent = classOf('class-Parent', 'Parent', { fields: [field('f-p1', 'p1'), field('f-p2', 'p2')] });
    const child = classOf('class-Child', 'Child', {
      fragments: [{ id: 'frag', label: 'do', lines: 1, responsibility: 'x', reads: ['f-p1', 'f-p2'] }],
      superclassId: 'class-Parent',
    });
    const codebase = codebaseOf([parent, child]);

    // Act
    const envy = findFeatureEnvy(codebase);

    // Assert
    expect(envy).toEqual([]);
  });

  it('実装しているインターフェース役のクラスのフィールドを2つ触る → Feature Envy(自分側に含めない)', () => {
    // Arrange
    const iface = classOf('class-I', 'I', { fields: [field('f-i1', 'i1'), field('f-i2', 'i2')] });
    const impl = classOf('class-Impl', 'Impl', {
      fragments: [{ id: 'frag', label: 'do', lines: 1, responsibility: 'x', reads: ['f-i1', 'f-i2'] }],
      interfaceIds: ['class-I'],
    });
    const codebase = codebaseOf([iface, impl]);

    // Act
    const envy = findFeatureEnvy(codebase);

    // Assert
    expect(envy).toEqual([{ methodId: 'method-class-Impl', enviedClassId: 'class-I' }]);
  });

  it('読む・書く・両方の混在でも同じに数える。同じフィールドを複数の処理で触っても1つ', () => {
    // Arrange
    const codebase = codebaseOf([
      classOf('class-A', 'A', {
        fragments: [
          { id: 'frag-1', label: 'read', lines: 1, responsibility: 'x', reads: ['f-b1', 'f-b2'] },
          { id: 'frag-2', label: 'write', lines: 1, responsibility: 'x', writes: ['f-b1'] },
        ],
      }),
      classOf('class-B', 'B', { fields: [field('f-b1', 'b1'), field('f-b2', 'b2')] }),
    ]);

    // Act
    const envy = findFeatureEnvy(codebase);

    // Assert
    expect(envy).toEqual([{ methodId: 'method-class-A', enviedClassId: 'class-B' }]);
  });

  it('存在しないフィールドIDは数えない', () => {
    // Arrange
    const codebase = codebaseOf([
      classOf('class-A', 'A', { fragments: [{ id: 'frag', label: 'do', lines: 1, responsibility: 'x', reads: ['f-missing-1', 'f-missing-2'] }] }),
    ]);

    // Act
    const envy = findFeatureEnvy(codebase);

    // Assert
    expect(envy).toEqual([]);
  });

  it('メソッド呼び出し(uses)は数えない', () => {
    // Arrange
    const codebase = codebaseOf([
      classOf('class-A', 'A', { fragments: [{ id: 'frag', label: 'do', lines: 1, responsibility: 'x', uses: ['method-class-B'] }] }),
      classOf('class-B', 'B', { fields: [field('f-b1', 'b1'), field('f-b2', 'b2')] }),
    ]);

    // Act
    const envy = findFeatureEnvy(codebase);

    // Assert
    expect(envy).toEqual([]);
  });

  it('フィールドのないCodebase → 空', () => {
    // Arrange
    const codebase = sampleCodebase();

    // Act
    const envy = findFeatureEnvy(codebase);

    // Assert
    expect(envy).toEqual([]);
  });
});

describe('findEncapsulationViolations', () => {
  it('Aの処理がBのpublicフィールドを書き換える → 1件', () => {
    // Arrange
    const codebase = codebaseOf([
      classOf('class-A', 'A', { fragments: [{ id: 'frag', label: 'do', lines: 1, responsibility: 'x', writes: ['f-b1'] }] }),
      classOf('class-B', 'B', { fields: [field('f-b1', 'b1', 'public')] }),
    ]);

    // Act
    const violations = findEncapsulationViolations(codebase);

    // Assert
    expect(violations).toEqual([{ fieldId: 'f-b1', accessorClassId: 'class-A' }]);
  });

  it('Aの処理がBのpublicフィールドを読むだけ → 空', () => {
    // Arrange
    const codebase = codebaseOf([
      classOf('class-A', 'A', { fragments: [{ id: 'frag', label: 'do', lines: 1, responsibility: 'x', reads: ['f-b1'] }] }),
      classOf('class-B', 'B', { fields: [field('f-b1', 'b1', 'public')] }),
    ]);

    // Act
    const violations = findEncapsulationViolations(codebase);

    // Assert
    expect(violations).toEqual([]);
  });

  it('Aの処理がBのprivate/protectedフィールドを読む → 1件ずつ', () => {
    // Arrange
    const codebase = codebaseOf([
      classOf('class-A', 'A', {
        fragments: [
          { id: 'frag-1', label: 'read-private', lines: 1, responsibility: 'x', reads: ['f-b1'] },
          { id: 'frag-2', label: 'read-protected', lines: 1, responsibility: 'x', reads: ['f-b2'] },
        ],
      }),
      classOf('class-B', 'B', { fields: [field('f-b1', 'b1', 'private'), field('f-b2', 'b2', 'protected')] }),
    ]);

    // Act
    const violations = findEncapsulationViolations(codebase);

    // Assert
    expect(violations).toEqual([
      { fieldId: 'f-b1', accessorClassId: 'class-A' },
      { fieldId: 'f-b2', accessorClassId: 'class-A' },
    ]);
  });

  it('Aの2つの処理がBの同じフィールドを書き換える → 1件(組で重複なし)', () => {
    // Arrange
    const codebase = codebaseOf([
      classOf('class-A', 'A', {
        fragments: [
          { id: 'frag-1', label: 'write-1', lines: 1, responsibility: 'x', writes: ['f-b1'] },
          { id: 'frag-2', label: 'write-2', lines: 1, responsibility: 'x', writes: ['f-b1'] },
        ],
      }),
      classOf('class-B', 'B', { fields: [field('f-b1', 'b1', 'public')] }),
    ]);

    // Act
    const violations = findEncapsulationViolations(codebase);

    // Assert
    expect(violations).toEqual([{ fieldId: 'f-b1', accessorClassId: 'class-A' }]);
  });

  it('自クラスのprivateフィールドの読み書き → 空 / 親クラス(extends)のフィールドの書き換え → 空', () => {
    // Arrange
    const parent = classOf('class-Parent', 'Parent', { fields: [field('f-p1', 'p1', 'private')] });
    const child = classOf('class-Child', 'Child', {
      fields: [field('f-c1', 'c1', 'private')],
      fragments: [{ id: 'frag', label: 'do', lines: 1, responsibility: 'x', reads: ['f-c1'], writes: ['f-c1', 'f-p1'] }],
      superclassId: 'class-Parent',
    });
    const codebase = codebaseOf([parent, child]);

    // Act
    const violations = findEncapsulationViolations(codebase);

    // Assert
    expect(violations).toEqual([]);
  });

  it('存在しないフィールドID → 空', () => {
    // Arrange
    const codebase = codebaseOf([
      classOf('class-A', 'A', { fragments: [{ id: 'frag', label: 'do', lines: 1, responsibility: 'x', reads: ['f-missing'], writes: ['f-missing-2'] }] }),
    ]);

    // Act
    const violations = findEncapsulationViolations(codebase);

    // Assert
    expect(violations).toEqual([]);
  });
});

/** getter/setterの処理(accessor: true)。getterはreads、setterはwritesを持たせる。 */
function accessorMethod(id: string, opts: { readonly reads?: readonly string[]; readonly writes?: readonly string[] }, visibility: Method['visibility'] = 'public'): Method {
  return {
    id,
    name: id,
    visibility,
    fragments: [{ id: `${id}-f`, label: id, lines: 3, responsibility: 'accessor', accessor: true, reads: opts.reads, writes: opts.writes }],
  };
}

function classWithMethods(id: string, name: string, methods: readonly Method[], fields: readonly Field[] = []): CodeClass {
  return { id, name, methods, fields };
}

describe('findFeatureEnvy: getter/setter越しのアクセス(判断1)', () => {
  it('Bのgetterを2つ呼ぶ(自分側0) → Feature Envy', () => {
    // Arrange
    const classB = classWithMethods(
      'class-B',
      'B',
      [accessorMethod('method-get-1', { reads: ['f-b1'] }), accessorMethod('method-get-2', { reads: ['f-b2'] })],
      [field('f-b1', 'b1'), field('f-b2', 'b2')],
    );
    const classA = classWithMethods('class-A', 'A', [
      { id: 'method-a', name: 'run', visibility: 'public', fragments: [{ id: 'frag', label: 'do', lines: 1, responsibility: 'x', uses: ['method-get-1', 'method-get-2'] }] },
    ]);
    const codebase = codebaseOf([classA, classB]);

    // Act
    const envy = findFeatureEnvy(codebase);

    // Assert
    expect(envy).toEqual([{ methodId: 'method-a', enviedClassId: 'class-B' }]);
  });

  it('getter1つ + 直接の読み取り1つ → 2つとして数えFeature Envy', () => {
    // Arrange
    const classB = classWithMethods('class-B', 'B', [accessorMethod('method-get-1', { reads: ['f-b1'] })], [field('f-b1', 'b1'), field('f-b2', 'b2')]);
    const classA = classWithMethods('class-A', 'A', [
      {
        id: 'method-a',
        name: 'run',
        visibility: 'public',
        fragments: [{ id: 'frag', label: 'do', lines: 1, responsibility: 'x', reads: ['f-b2'], uses: ['method-get-1'] }],
      },
    ]);
    const codebase = codebaseOf([classA, classB]);

    // Act
    const envy = findFeatureEnvy(codebase);

    // Assert
    expect(envy).toEqual([{ methodId: 'method-a', enviedClassId: 'class-B' }]);
  });

  it('getter1つだけ(下限未満) → 空', () => {
    // Arrange
    const classB = classWithMethods('class-B', 'B', [accessorMethod('method-get-1', { reads: ['f-b1'] })], [field('f-b1', 'b1')]);
    const classA = classWithMethods('class-A', 'A', [
      { id: 'method-a', name: 'run', visibility: 'public', fragments: [{ id: 'frag', label: 'do', lines: 1, responsibility: 'x', uses: ['method-get-1'] }] },
    ]);
    const codebase = codebaseOf([classA, classB]);

    // Act
    const envy = findFeatureEnvy(codebase);

    // Assert
    expect(envy).toEqual([]);
  });

  it('Bのアクセサでない普通のメソッドを呼ぶ → 空', () => {
    // Arrange
    const classB = classWithMethods(
      'class-B',
      'B',
      [{ id: 'method-check', name: 'isInTrial', visibility: 'public', fragments: [{ id: 'f', label: 'do', lines: 1, responsibility: 'x', reads: ['f-b1', 'f-b2'] }] }],
      [field('f-b1', 'b1'), field('f-b2', 'b2')],
    );
    const classA = classWithMethods('class-A', 'A', [
      { id: 'method-a', name: 'run', visibility: 'public', fragments: [{ id: 'frag', label: 'do', lines: 1, responsibility: 'x', uses: ['method-check'] }] },
    ]);
    const codebase = codebaseOf([classA, classB]);

    // Act
    const envy = findFeatureEnvy(codebase);

    // Assert
    expect(envy).toEqual([]);
  });

  it('自クラスのgetterを呼ぶ → 自分側なのでFeature Envyにならない', () => {
    // Arrange
    const classA = classWithMethods(
      'class-A',
      'A',
      [
        accessorMethod('method-get-1', { reads: ['f-a1'] }),
        accessorMethod('method-get-2', { reads: ['f-a2'] }),
        { id: 'method-a', name: 'run', visibility: 'public', fragments: [{ id: 'frag', label: 'do', lines: 1, responsibility: 'x', uses: ['method-get-1', 'method-get-2'] }] },
      ],
      [field('f-a1', 'a1'), field('f-a2', 'a2')],
    );
    const codebase = codebaseOf([classA]);

    // Act
    const envy = findFeatureEnvy(codebase);

    // Assert
    expect(envy).toEqual([]);
  });
});

describe('findEncapsulationViolations: setter越しの書き換え(判断1)', () => {
  it('Bのsetterを呼ぶ → 1件(呼ぶ側のクラス)', () => {
    // Arrange
    const classB = classWithMethods('class-B', 'B', [accessorMethod('method-set', { writes: ['f-b1'] })], [field('f-b1', 'b1', 'private')]);
    const classA = classWithMethods('class-A', 'A', [
      { id: 'method-a', name: 'run', visibility: 'public', fragments: [{ id: 'frag', label: 'do', lines: 1, responsibility: 'x', uses: ['method-set'] }] },
    ]);
    const codebase = codebaseOf([classA, classB]);

    // Act
    const violations = findEncapsulationViolations(codebase);

    // Assert
    expect(violations).toEqual([{ fieldId: 'f-b1', accessorClassId: 'class-A' }]);
  });

  it('Bのgetter(privateフィールド)を呼ぶ → 空', () => {
    // Arrange
    const classB = classWithMethods('class-B', 'B', [accessorMethod('method-get', { reads: ['f-b1'] })], [field('f-b1', 'b1', 'private')]);
    const classA = classWithMethods('class-A', 'A', [
      { id: 'method-a', name: 'run', visibility: 'public', fragments: [{ id: 'frag', label: 'do', lines: 1, responsibility: 'x', uses: ['method-get'] }] },
    ]);
    const codebase = codebaseOf([classA, classB]);

    // Act
    const violations = findEncapsulationViolations(codebase);

    // Assert
    expect(violations).toEqual([]);
  });

  it('setter越しと直接のwritesで同じフィールド → 1件(重複しない)', () => {
    // Arrange
    const classB = classWithMethods('class-B', 'B', [accessorMethod('method-set', { writes: ['f-b1'] })], [field('f-b1', 'b1', 'private')]);
    const classA = classWithMethods('class-A', 'A', [
      {
        id: 'method-a',
        name: 'run',
        visibility: 'public',
        fragments: [{ id: 'frag', label: 'do', lines: 1, responsibility: 'x', writes: ['f-b1'], uses: ['method-set'] }],
      },
    ]);
    const codebase = codebaseOf([classA, classB]);

    // Act
    const violations = findEncapsulationViolations(codebase);

    // Assert
    expect(violations).toEqual([{ fieldId: 'f-b1', accessorClassId: 'class-A' }]);
  });

  it('Bが自分のsetterを呼ぶ → 空', () => {
    // Arrange
    const classB = classWithMethods(
      'class-B',
      'B',
      [
        accessorMethod('method-set', { writes: ['f-b1'] }),
        { id: 'method-run', name: 'run', visibility: 'public', fragments: [{ id: 'frag', label: 'do', lines: 1, responsibility: 'x', uses: ['method-set'] }] },
      ],
      [field('f-b1', 'b1', 'private')],
    );
    const codebase = codebaseOf([classB]);

    // Act
    const violations = findEncapsulationViolations(codebase);

    // Assert
    expect(violations).toEqual([]);
  });

  it('Bの子クラスがBのsetterを呼ぶ → 空(自分側)', () => {
    // Arrange
    const classB = classWithMethods('class-B', 'B', [accessorMethod('method-set', { writes: ['f-b1'] })], [field('f-b1', 'b1', 'private')]);
    const classChild = { ...classWithMethods('class-Child', 'Child', [
      { id: 'method-run', name: 'run', visibility: 'public', fragments: [{ id: 'frag', label: 'do', lines: 1, responsibility: 'x', uses: ['method-set'] }] },
    ]), superclassId: 'class-B' };
    const codebase = codebaseOf([classB, classChild]);

    // Act
    const violations = findEncapsulationViolations(codebase);

    // Assert
    expect(violations).toEqual([]);
  });
});

describe('findOpenSetters', () => {
  it('他クラスから呼ばれていないpublicのsetter → そのID', () => {
    // Arrange
    const classB = classWithMethods('class-B', 'B', [accessorMethod('method-set', { writes: ['f-b1'] })], [field('f-b1', 'b1', 'private')]);
    const codebase = codebaseOf([classB]);

    // Act
    const result = findOpenSetters(codebase);

    // Assert
    expect(result).toEqual(['method-set']);
  });

  it('privateのsetter → 空', () => {
    // Arrange
    const classB = classWithMethods('class-B', 'B', [accessorMethod('method-set', { writes: ['f-b1'] }, 'private')], [field('f-b1', 'b1', 'private')]);
    const codebase = codebaseOf([classB]);

    // Act
    const result = findOpenSetters(codebase);

    // Assert
    expect(result).toEqual([]);
  });

  it('他クラスから呼ばれているpublicのsetter → 空(書き換えの側で数える)', () => {
    // Arrange
    const classB = classWithMethods('class-B', 'B', [accessorMethod('method-set', { writes: ['f-b1'] })], [field('f-b1', 'b1', 'private')]);
    const classA = classWithMethods('class-A', 'A', [
      { id: 'method-a', name: 'run', visibility: 'public', fragments: [{ id: 'frag', label: 'do', lines: 1, responsibility: 'x', uses: ['method-set'] }] },
    ]);
    const codebase = codebaseOf([classA, classB]);

    // Act
    const result = findOpenSetters(codebase);

    // Assert
    expect(result).toEqual([]);
  });

  it('自クラスからだけ呼ばれるpublicのsetter → そのID', () => {
    // Arrange
    const classB = classWithMethods(
      'class-B',
      'B',
      [
        accessorMethod('method-set', { writes: ['f-b1'] }),
        { id: 'method-run', name: 'run', visibility: 'public', fragments: [{ id: 'frag', label: 'do', lines: 1, responsibility: 'x', uses: ['method-set'] }] },
      ],
      [field('f-b1', 'b1', 'private')],
    );
    const codebase = codebaseOf([classB]);

    // Act
    const result = findOpenSetters(codebase);

    // Assert
    expect(result).toEqual(['method-set']);
  });

  it('他クラスから呼ばれていないprotectedのsetter → そのID', () => {
    // Arrange
    const classB = classWithMethods('class-B', 'B', [accessorMethod('method-set', { writes: ['f-b1'] }, 'protected')], [field('f-b1', 'b1', 'private')]);
    const codebase = codebaseOf([classB]);

    // Act
    const result = findOpenSetters(codebase);

    // Assert
    expect(result).toEqual(['method-set']);
  });

  it('子クラスからだけ呼ばれるprotectedのsetter → 空', () => {
    // Arrange
    const classB = classWithMethods('class-B', 'B', [accessorMethod('method-set', { writes: ['f-b1'] }, 'protected')], [field('f-b1', 'b1', 'private')]);
    const classChild = { ...classWithMethods('class-Child', 'Child', [
      { id: 'method-run', name: 'run', visibility: 'public', fragments: [{ id: 'frag', label: 'do', lines: 1, responsibility: 'x', uses: ['method-set'] }] },
    ]), superclassId: 'class-B' };
    const codebase = codebaseOf([classB, classChild]);

    // Act
    const result = findOpenSetters(codebase);

    // Assert
    expect(result).toEqual([]);
  });

  it('他クラスから呼ばれていないpublicのgetter → 空', () => {
    // Arrange
    const classB = classWithMethods('class-B', 'B', [accessorMethod('method-get', { reads: ['f-b1'] })], [field('f-b1', 'b1', 'private')]);
    const codebase = codebaseOf([classB]);

    // Act
    const result = findOpenSetters(codebase);

    // Assert
    expect(result).toEqual([]);
  });
});
