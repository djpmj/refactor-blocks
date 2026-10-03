import { describe, expect, it } from 'vitest';
import { findClassOfMethod, type Codebase } from './Codebase';
import { moveMethod, moveMethodTargets } from './moveMethod';
import { sampleCodebase } from './testFixtures';

describe('moveMethod', () => {
  it('メソッドが移動先クラスの末尾に移り、移動元からは消える', () => {
    // Arrange
    const codebase = sampleCodebase();

    // Act
    const result = moveMethod(codebase, 'method-place', 'class-tax');

    // Assert
    if (!result.ok) throw new Error(result.error);
    expect(findClassOfMethod(result.value, 'method-place')?.id).toBe('class-tax');
    expect(result.value.files[0].classes[0].methods).toEqual([]);
  });

  it('元のCodebaseは変更しない', () => {
    // Arrange
    const codebase = sampleCodebase();

    // Act
    moveMethod(codebase, 'method-place', 'class-tax');

    // Assert
    expect(codebase).toEqual(sampleCodebase());
  });

  it('移動先に同名メソッドがあるときはエラーになる', () => {
    // Arrange
    const base = sampleCodebase();
    const taxFile = base.files[1];
    const codebase = {
      files: [
        base.files[0],
        {
          ...taxFile,
          classes: [{ ...taxFile.classes[0], methods: [{ ...base.files[0].classes[0].methods[0], id: 'other' }] }],
        },
      ],
    };

    // Act
    const result = moveMethod(codebase, 'method-place', 'class-tax');

    // Assert
    expect(result).toEqual({ ok: false, error: 'duplicate-method-name' });
  });

  it.each([
    ['存在しないメソッド', 'missing', 'class-tax', 'method-not-found'],
    ['存在しないクラス', 'method-place', 'missing', 'class-not-found'],
    ['同じクラス', 'method-place', 'class-order', 'same-class'],
  ])('%sを指定したときはエラーになる', (_label, methodId, classId, expected) => {
    // Arrange
    const codebase = sampleCodebase();

    // Act
    const result = moveMethod(codebase, methodId, classId);

    // Assert
    expect(result).toEqual({ ok: false, error: expected });
  });
});

describe('moveMethodTargets', () => {
  it('移動元と同名メンバーを除き、ファイル順・宣言順に返し、元を変更しない', () => {
    // Arrange
    const base = sampleCodebase();
    const source = base.files[0].classes[0];
    const first = { id: 'first', name: 'First', methods: [] };
    const contract: Codebase['files'][number]['classes'][number] = { id: 'contract', name: 'Contract', methods: [{ id: 'contract-run', name: 'contractRun', visibility: 'public', fragments: [] }] };
    const duplicate = { ...source, id: 'duplicate', methods: source.methods.map((member) => ({ ...member, id: member.id + '-copy' })) };
    const codebase: Codebase = {
      files: [
        { ...base.files[0], classes: [source, first, duplicate] },
        { id: 'second-file', path: 'second.ts', classes: [contract, { id: 'last', name: 'Last', methods: [] }] },
      ],
    };
    const before = structuredClone(codebase);

    // Act
    const targets = moveMethodTargets(codebase, 'method-place');

    // Assert
    expect(targets.map((target) => target.id)).toEqual(['first', 'contract', 'last']);
    expect(codebase).toEqual(before);
  });

  it.each(['method-place', 'missing'])('移動先がないかIDが存在しなければ空配列: %s', (memberId) => {
    // Arrange
    const base = sampleCodebase();
    const codebase = { files: [{ ...base.files[0], classes: [base.files[0].classes[0]] }] };

    // Act
    const targets = moveMethodTargets(memberId === 'missing' ? base : codebase, memberId);

    // Assert
    expect(targets).toEqual([]);
  });
});
