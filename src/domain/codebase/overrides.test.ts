import { describe, expect, it } from 'vitest';
import { type Codebase, type CodeClass, type Visibility } from './Codebase';
import { resolvesToOwnDeclaration } from './overrides';
import { classDependencies } from './dependencies';
import { findVisibilityViolations } from '../scoring/visibility';

function fixture(visibility: Visibility = 'protected', parent: Partial<CodeClass> = {}, child: Partial<CodeClass> = {}): Codebase {
  return { files: [{ id: 'file', path: 'src/Import.ts', classes: [
    { id: 'p', name: 'Parent', methods: [
      { id: 'declaration', name: 'parse', visibility: 'protected', fragments: [] },
      { id: 'run', name: 'run', visibility: 'public', fragments: [{ id: 'call', label: 'parse', responsibility: 'call', lines: 1, uses: ['parse'] }] },
    ], ...parent },
    { id: 'c', name: 'Child', superclassId: 'p', methods: [{ id: 'parse', name: 'parse', visibility, fragments: [] }], ...child },
    { id: 'b', name: 'Between', superclassId: 'p', methods: [] },
  ] }] };
}

describe('resolvesToOwnDeclaration', () => {
  it.each<Visibility>(['protected', 'public'])('%s の子の実装は自分の宣言経由になる', (visibility) => {
    // Arrange
    const base = fixture(visibility);
    // Act / Assert
    expect(resolvesToOwnDeclaration(base, 'p', 'parse')).toBe(true);
    expect(classDependencies(base)).toEqual([]);
    expect(findVisibilityViolations(base)).toEqual([]);
  });

  it.each([
    ['private', fixture('private'), 'p', 'parse'],
    ['宣言なし', fixture('protected', { methods: [{ id: 'run', name: 'run', visibility: 'public', fragments: [{ id: 'call', label: 'parse', responsibility: 'call', lines: 1, uses: ['parse'] }] }] }), 'p', 'parse'],
    ['継承なし', fixture('protected', {}, { superclassId: undefined }), 'p', 'parse'],
    ['implementsのみ', fixture('protected', {}, { superclassId: undefined, interfaceIds: ['p'] }), 'p', 'parse'],
    ['クラスなし', fixture(), 'missing', 'parse'],
    ['メソッドなし', fixture(), 'p', 'missing'],
    ['自分自身', fixture(), 'c', 'parse'],
    ['具象フック', fixture('protected', { methods: [{ id: 'declaration', name: 'parse', visibility: 'protected', fragments: [{ id: 'body', label: '既定処理', responsibility: 'parse', lines: 1 }] }] }), 'p', 'parse'],
    ['private宣言', fixture('protected', { methods: [{ id: 'declaration', name: 'parse', visibility: 'private', fragments: [] }] }), 'p', 'parse'],
  ] as const)('%s は宣言経由にしない', (_label, base, caller, target) => {
    // Arrange / Act / Assert
    expect(resolvesToOwnDeclaration(base, caller, target)).toBe(false);
  });

  it('孫の実装も解決する', () => {
    // Arrange
    const base = fixture('protected', {}, { superclassId: 'b' });
    // Act / Assert
    expect(resolvesToOwnDeclaration(base, 'p', 'parse')).toBe(true);
  });

  it.each<Visibility>(['private', 'protected'])('宣言がない親からの %s 呼び出しは依存と違反を残す', (visibility) => {
    // Arrange
    const original = fixture(visibility);
    const parent = original.files[0].classes[0];
    const base = fixture(visibility, { methods: parent.methods.filter((method) => method.id !== 'declaration') });
    // Act / Assert
    expect(classDependencies(base)).toEqual([{ from: 'p', to: 'c', cyclic: false }]);
    expect(findVisibilityViolations(base)).toEqual([{ methodId: 'parse', callerClassId: 'p', kind: visibility }]);
  });

  it('宣言があっても private の実装は依存と違反を残す', () => {
    // Arrange
    const base = fixture('private');
    // Act / Assert
    expect(classDependencies(base)).toEqual([{ from: 'p', to: 'c', cyclic: false }]);
    expect(findVisibilityViolations(base)).toEqual([{ methodId: 'parse', callerClassId: 'p', kind: 'private' }]);
  });
});
