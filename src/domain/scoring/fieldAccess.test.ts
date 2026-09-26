import { describe, expect, it } from 'vitest';
import type { CodeClass, Codebase, Field, Fragment } from '../codebase/Codebase';
import { sampleCodebase } from '../codebase/testFixtures';
import { findEncapsulationViolations, findFeatureEnvy } from './fieldAccess';

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
