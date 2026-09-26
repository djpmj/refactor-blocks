import { describe, expect, it } from 'vitest';
import { findClassOfField, type Codebase } from './Codebase';
import { moveField, moveFieldTargets } from './moveField';

/** class-a に field-a1・field-a2、class-b にフィールドなしを持つ最小のコードベース。 */
function codebaseWithFields(): Codebase {
  return {
    files: [
      {
        id: 'file',
        path: 'src/all.ts',
        classes: [
          {
            id: 'class-a',
            name: 'A',
            methods: [{ id: 'method-a', name: 'run', visibility: 'public', fragments: [{ id: 'f-a', label: 'f-a', lines: 1, responsibility: 'x', reads: ['field-a1'] }] }],
            fields: [
              { id: 'field-a1', name: 'status', visibility: 'public' },
              { id: 'field-a2', name: 'startedAt', visibility: 'public' },
            ],
          },
          { id: 'class-b', name: 'B', methods: [], fields: [{ id: 'field-b1', name: 'status', visibility: 'public' }] },
        ],
      },
    ],
  };
}

describe('moveField', () => {
  it('移動先の末尾に入り、移動元から消える。処理のreads/writesは変わらない', () => {
    // Arrange
    const codebase = codebaseWithFields();

    // Act
    const result = moveField(codebase, 'field-a2', 'class-b');

    // Assert
    if (!result.ok) throw new Error(result.error);
    expect(findClassOfField(result.value, 'field-a2')?.id).toBe('class-b');
    const classA = result.value.files[0].classes[0];
    expect(classA.fields?.map((field) => field.id)).toEqual(['field-a1']);
    const classB = result.value.files[0].classes[1];
    expect(classB.fields?.map((field) => field.id)).toEqual(['field-b1', 'field-a2']);
    expect(classA.methods[0].fragments[0].reads).toEqual(['field-a1']);
  });

  it('移動元の最後のフィールドを移すと、移動元のfieldsプロパティがなくなる', () => {
    // Arrange
    const codebase: Codebase = {
      files: [
        {
          id: 'file',
          path: 'src/all.ts',
          classes: [
            { id: 'class-a', name: 'A', methods: [], fields: [{ id: 'field-a1', name: 'status', visibility: 'public' }] },
            { id: 'class-b', name: 'B', methods: [], fields: [] },
          ],
        },
      ],
    };

    // Act
    const result = moveField(codebase, 'field-a1', 'class-b');

    // Assert
    if (!result.ok) throw new Error(result.error);
    expect(result.value.files[0].classes[0].fields).toBeUndefined();
  });

  it('元のCodebaseは変更しない', () => {
    // Arrange
    const codebase = codebaseWithFields();

    // Act
    moveField(codebase, 'field-a2', 'class-b');

    // Assert
    expect(codebase).toEqual(codebaseWithFields());
  });

  it.each([
    ['存在しないフィールド', 'missing', 'class-b', 'field-not-found'],
    ['存在しないクラス', 'field-a1', 'missing', 'class-not-found'],
    ['同じクラス', 'field-a1', 'class-a', 'same-class'],
    ['同名フィールド', 'field-a1', 'class-b', 'duplicate-field-name'],
  ])('%sを指定したときはエラーになる', (_label, fieldId, classId, expected) => {
    // Arrange
    const codebase = codebaseWithFields();

    // Act
    const result = moveField(codebase, fieldId, classId);

    // Assert
    expect(result).toEqual({ ok: false, error: expected });
  });
});

describe('moveFieldTargets', () => {
  it('移動元と同名メンバーを除き、ファイル順・宣言順に返し、元を変更しない', () => {
    // Arrange
    const base = codebaseWithFields();
    const source = base.files[0].classes[0];
    const first = { id: 'first', name: 'First', methods: [] };
    const contract: Codebase['files'][number]['classes'][number] = { id: 'contract', name: 'Contract', methods: [{ id: 'contract-run', name: 'contractRun', visibility: 'public', fragments: [] }] };
    const duplicate = { ...source, id: 'duplicate', fields: (source.fields ?? []).map((member) => ({ ...member, id: member.id + '-copy' })) };
    const codebase: Codebase = {
      files: [
        { ...base.files[0], classes: [source, first, duplicate] },
        { id: 'second-file', path: 'second.ts', classes: [contract, { id: 'last', name: 'Last', methods: [] }] },
      ],
    };
    const before = structuredClone(codebase);

    // Act
    const targets = moveFieldTargets(codebase, 'field-a2');

    // Assert
    expect(targets.map((target) => target.id)).toEqual(['first', 'contract', 'last']);
    expect(codebase).toEqual(before);
  });

  it.each(['field-a2', 'missing'])('移動先がないかIDが存在しなければ空配列: %s', (memberId) => {
    // Arrange
    const base = codebaseWithFields();
    const codebase = { files: [{ ...base.files[0], classes: [base.files[0].classes[0]] }] };

    // Act
    const targets = moveFieldTargets(memberId === 'missing' ? base : codebase, memberId);

    // Assert
    expect(targets).toEqual([]);
  });
});
