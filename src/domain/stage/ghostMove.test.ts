import { describe, expect, it } from 'vitest';
import type { Codebase } from '../codebase/Codebase';
import type { SolutionStep } from './sampleAnswer';
import { nextGhostMove } from './ghostMove';

const codebase: Codebase = { files: [
  { id: 'f1', path: 'one.cs', classes: [
    { id: 'c1', name: 'One', methods: [
      { id: 'm1', name: 'moveMe', visibility: 'public', fragments: [] },
      { id: 'm2', name: 'same', visibility: 'public', fragments: [] },
    ], fields: [{ id: 'field1', name: 'count', visibility: 'private' }] },
    { id: 'c2', name: 'Two', methods: [{ id: 'm3', name: 'same', visibility: 'public', fragments: [] }] },
  ] },
  { id: 'f2', path: 'two.cs', classes: [{ id: 'c3', name: 'Three', methods: [], fields: [] }] },
] };

describe('nextGhostMove', () => {
  it('returns the first available method move after non-drag steps', () => {
    // Arrange
    const steps: SolutionStep[] = [
      { extract: { from: 'One.moveMe', fragmentIds: [], name: 'newMethod' } },
      { move: { method: 'moveMe', fromClass: 'One', toClass: 'Three' } },
    ];
    // Act
    const result = nextGhostMove(codebase, steps);
    // Assert
    expect(result).toEqual({ kind: 'method', methodId: 'm1', toClassId: 'c3' });
  });

  it('skips a completed move and a missing source, then returns the next field or class move', () => {
    // Arrange
    const steps: SolutionStep[] = [
      { move: { method: 'same', fromClass: 'Two', toClass: 'Two' } },
      { move: { method: 'notCreatedYet', toClass: 'Three' } },
      { moveField: { field: 'count', fromClass: 'One', toClass: 'Three' } },
    ];
    // Act
    const result = nextGhostMove(codebase, steps);
    // Assert
    expect(result).toEqual({ kind: 'field', fieldId: 'field1', toClassId: 'c3' });
  });

  it('returns class moves and scopes duplicate method names to fromClass', () => {
    // Arrange
    const classMove: SolutionStep[] = [{ moveClass: { name: 'One', toFile: 'two.cs' } }];
    const methodMove: SolutionStep[] = [{ move: { method: 'same', fromClass: 'Two', toClass: 'One' } }];
    // Act / Assert
    expect(nextGhostMove(codebase, classMove)).toEqual({ kind: 'class', classId: 'c1', toFileId: 'f2' });
    expect(nextGhostMove(codebase, methodMove)).toEqual({ kind: 'method', methodId: 'm3', toClassId: 'c1' });
  });

  it('returns undefined when no draggable step remains and never mutates the codebase', () => {
    // Arrange
    const before = structuredClone(codebase);
    const steps: SolutionStep[] = [
      { move: { method: 'same', fromClass: 'One', toClass: 'One' } },
      { move: { method: 'missing', toClass: 'Three' } },
    ];
    // Act
    const result = nextGhostMove(codebase, steps);
    // Assert
    expect(result).toBeUndefined();
    expect(codebase).toEqual(before);
    expect(nextGhostMove(codebase, [])).toBeUndefined();
  });
});
