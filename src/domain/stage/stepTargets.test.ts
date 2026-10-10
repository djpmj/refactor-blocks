import { describe, expect, it } from 'vitest';
import type { Codebase } from '../codebase/Codebase';
import type { SolutionStep } from './sampleAnswer';
import { stepTargets } from './stepTargets';

const codebase: Codebase = {
  files: [
    {
      id: 'file-a',
      path: 'src/a.ts',
      classes: [
        {
          id: 'class-a',
          name: 'A',
          methods: [
            { id: 'method-one', name: 'one', visibility: 'public', fragments: [] },
            { id: 'method-two', name: 'two', visibility: 'public', fragments: [] },
          ],
          fields: [{ id: 'field-a', name: 'value', visibility: 'private' }],
        },
        { id: 'class-b', name: 'B', methods: [{ id: 'method-one-b', name: 'one', visibility: 'public', fragments: [] }] },
      ],
    },
    { id: 'file-b', path: 'src/b.ts', classes: [{ id: 'class-c', name: 'C', methods: [] }] },
  ],
};

describe('stepTargets', () => {
  it('moveではメソッドと移動先クラスを返す', () => {
    // Arrange
    const step: SolutionStep = { move: { method: 'two', toClass: 'C' } };

    // Act
    const targets = stepTargets(codebase, step);

    // Assert
    expect(targets).toEqual({ fileIds: [], classIds: ['class-c'], methodIds: ['method-two'] });
  });

  it('extractのfromClassで同名メソッドを絞り込み、mergeは両方を返す', () => {
    // Arrange
    const extract: SolutionStep = { extract: { from: 'one', fromClass: 'B', fragmentIds: [], name: 'newOne' } };
    const merge: SolutionStep = { merge: { methodA: 'one', methodB: 'two', methodBClass: 'A', name: 'combined' } };

    // Act
    const extractTargets = stepTargets(codebase, extract);
    const mergeTargets = stepTargets(codebase, merge);

    // Assert
    expect(extractTargets.methodIds).toEqual(['method-one-b']);
    expect(mergeTargets.methodIds).toEqual(['method-one', 'method-two']);
  });

  it('moveFieldは両クラス、file/class操作は対象ファイルも返す', () => {
    // Arrange
    const moveField: SolutionStep = { moveField: { field: 'value', fromClass: 'A', toClass: 'C' } };
    const moveClass: SolutionStep = { moveClass: { name: 'A', toFile: 'src/b.ts' } };
    const addClass: SolutionStep = { addClass: { name: 'New', file: 'src/a.ts' } };
    const deleteFile: SolutionStep = { deleteFile: 'src/a.ts' };

    // Act
    const fieldTargets = stepTargets(codebase, moveField);
    const moveClassTargets = stepTargets(codebase, moveClass);
    const addClassTargets = stepTargets(codebase, addClass);
    const deleteFileTargets = stepTargets(codebase, deleteFile);

    // Assert
    expect(fieldTargets.classIds).toEqual(['class-a', 'class-c']);
    expect(moveClassTargets).toEqual({ fileIds: ['file-b'], classIds: ['class-a'], methodIds: [] });
    expect(addClassTargets.fileIds).toEqual(['file-a']);
    expect(deleteFileTargets.fileIds).toEqual(['file-a']);
  });

  it('addFileや未作成の名前は空にし、nullの継承元は対象クラスだけ返す', () => {
    // Arrange
    const steps: SolutionStep[] = [
      { addFile: 'src/new.ts' },
      { extract: { from: 'futureMethod', fragmentIds: [], name: 'next' } },
      { setSuperclass: { class: 'A', superclass: null } },
    ];

    // Act
    const targets = steps.map((step) => stepTargets(codebase, step));

    // Assert
    expect(targets[0]).toEqual({ fileIds: [], classIds: [], methodIds: [] });
    expect(targets[1]).toEqual({ fileIds: [], classIds: [], methodIds: [] });
    expect(targets[2]?.classIds).toEqual(['class-a']);
  });

  it('見つからない対象を飛ばし、重複IDを除いて元のCodebaseを変更しない', () => {
    // Arrange
    const before = structuredClone(codebase);
    const step: SolutionStep = {
      addInterface: { class: 'A', interface: 'A' },
    };

    // Act
    const targets = stepTargets(codebase, step);

    // Assert
    expect(targets.classIds).toEqual(['class-a']);
    expect(codebase).toEqual(before);
  });
});
