import { describe, expect, it } from 'vitest';
import type { Codebase } from '../../domain/codebase/Codebase';
import { sampleCodebase } from '../../domain/codebase/testFixtures';
import { dropTargetIds } from './dropTargets';

describe('dropTargetIds', () => {
  it('メソッドは移動元と同名メソッドのあるクラスを除いたクラスを返す', () => {
    // Arrange
    const base = sampleCodebase();
    const duplicateClass = {
      ...base.files[1].classes[0],
      id: 'class-duplicate',
      methods: [{ ...base.files[0].classes[0].methods[0], id: 'method-duplicate' }],
    };
    const codebase: Codebase = {
      files: [
        base.files[0],
        { ...base.files[1], classes: [...base.files[1].classes, duplicateClass] },
      ],
    };

    // Act
    const targets = dropTargetIds(codebase, { kind: 'method', id: 'method-place' });

    // Assert
    expect(targets.classIds).toEqual(new Set(['class-tax']));
    expect(targets.fileIds).toEqual(new Set());
  });

  it('フィールドは移動元を除く移動可能なクラスを返す', () => {
    // Arrange
    const base = sampleCodebase();
    const source = { ...base.files[0].classes[0], fields: [{ id: 'field-source', name: 'value', visibility: 'private' as const }] };
    const codebase: Codebase = {
      files: [{ ...base.files[0], classes: [source] }, base.files[1]],
    };

    // Act
    const targets = dropTargetIds(codebase, { kind: 'field', id: 'field-source' });

    // Assert
    expect(targets.classIds).toEqual(new Set(['class-tax']));
    expect(targets.fileIds).toEqual(new Set());
  });

  it('クラスは現在のファイルを除く移動可能なファイルを返す', () => {
    // Arrange
    const codebase = sampleCodebase();

    // Act
    const targets = dropTargetIds(codebase, { kind: 'class', id: 'class-order' });

    // Assert
    expect(targets.classIds).toEqual(new Set());
    expect(targets.fileIds).toEqual(new Set(['file-tax']));
  });

  it.each([
    { kind: 'method', id: 'missing' },
    { kind: 'field', id: 'missing' },
    { kind: 'class', id: 'missing' },
  ] as const)('存在しないIDなら空の対象集合を返す: $kind', (dragging) => {
    // Arrange
    const codebase = sampleCodebase();

    // Act
    const targets = dropTargetIds(codebase, dragging);

    // Assert
    expect(targets.classIds).toEqual(new Set());
    expect(targets.fileIds).toEqual(new Set());
  });
});
