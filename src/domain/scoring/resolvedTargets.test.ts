import { describe, expect, it } from 'vitest';
import { resolvedTargets } from './resolvedTargets';
import { violationTargets } from './violationTargets';

describe('resolvedTargets', () => {
  it('違反がなくなったメソッドを返し、残る違反のクラスは返さない', () => {
    // Arrange
    const stage = { limits: { method: 7, class: 100, file: 100 }, dependencyLimit: 100, responsibilityLimit: 100, visibilityEnforced: false, layers: [] };
    const before = { files: [{ id: 'file', path: 'sample.ts', classes: [{ id: 'class', name: 'Sample', methods: [{ id: 'method', name: 'run', visibility: 'public' as const, fragments: [{ id: 'fragment-1', label: 'validate input', lines: 4, responsibility: 'validation' }, { id: 'fragment-2', label: 'write output', lines: 4, responsibility: 'io' }] }] }] }] };
    const [file] = before.files;
    const [codeClass] = file.classes;
    const [method] = codeClass.methods;
    const after = { files: [{ ...file, classes: [{ ...codeClass, methods: [{ ...method, fragments: method.fragments.map((fragment) => ({ ...fragment, lines: 2 })) }] }] }] };

    // Act
    const resolved = resolvedTargets(before, after, stage);

    // Assert
    expect(violationTargets(before, stage)['line-limit'].methodIds).toContain('method');
    expect(violationTargets(after, stage)['line-limit'].methodIds).not.toContain('method');
    expect(resolved.methodIds).toContain('method');
    expect(resolved.classIds).not.toContain('class');
    expect(before.files[0].classes[0].methods[0].fragments[0].lines).toBe(4);
  });

  it('削除された対象や新しく違反になった対象を含めず、変化がなければ空を返す', () => {
    // Arrange
    const stage = { limits: { method: 7, class: 100, file: 100 }, dependencyLimit: 100, responsibilityLimit: 100, visibilityEnforced: false, layers: [] };
    const codebase = { files: [{ id: 'file', path: 'sample.ts', classes: [{ id: 'class', name: 'Sample', methods: [{ id: 'method', name: 'run', visibility: 'public' as const, fragments: [{ id: 'fragment', label: 'work', lines: 8, responsibility: 'work' }] }] }] }] };
    const removed = { ...codebase, files: codebase.files.slice(1) };

    // Act
    const resolved = resolvedTargets(codebase, removed, stage);
    const unchanged = resolvedTargets(codebase, codebase, stage);

    // Assert
    expect(resolved.fileIds).not.toContain(codebase.files[0].id);
    expect(resolved.methodIds).not.toContain('method');
    expect(unchanged).toEqual({ fileIds: [], classIds: [], methodIds: [] });
    expect(resolvedTargets({ files: [] }, codebase, stage)).toEqual({ fileIds: [], classIds: [], methodIds: [] });
  });

  it('同じメソッドが別ルールの違反対象に残る場合は解決済みにしない', () => {
    // Arrange
    const stage = { limits: { method: 7, class: 100, file: 100 }, dependencyLimit: 100, responsibilityLimit: 100, visibilityEnforced: false, layers: [] };
    const method = { id: 'method', name: 'run', visibility: 'private' as const, fragments: [
      { id: 'fragment-1', label: 'validate input', lines: 4, responsibility: 'validation' },
      { id: 'fragment-2', label: 'write output', lines: 4, responsibility: 'io' },
    ] };
    const before = { files: [{ id: 'file', path: 'sample.ts', classes: [{ id: 'class', name: 'Sample', methods: [method] }] }] };
    const after = { files: [{ id: 'file', path: 'sample.ts', classes: [{ id: 'class', name: 'Sample', methods: [{ ...method, fragments: method.fragments.map((fragment) => ({ ...fragment, lines: 2 })) }] }] }] };

    // Act
    const resolved = resolvedTargets(before, after, stage);

    // Assert
    expect(resolved.methodIds).not.toContain('method');
  });

  it('循環依存が解消すると対象だったクラスを返す', () => {
    // Arrange
    const stage = { limits: { method: 100, class: 100, file: 100 }, dependencyLimit: 0, responsibilityLimit: 100, visibilityEnforced: false, layers: [] };
    const before = { files: [{ id: 'file', path: 'sample.ts', classes: [
      { id: 'class-a', name: 'A', methods: [{ id: 'method-a', name: 'run', visibility: 'public' as const, fragments: [{ id: 'fragment-a', label: 'call B', lines: 1, responsibility: 'call', uses: ['method-b'] }] }] },
      { id: 'class-b', name: 'B', methods: [{ id: 'method-b', name: 'run', visibility: 'public' as const, fragments: [{ id: 'fragment-b', label: 'call A', lines: 1, responsibility: 'call', uses: ['method-a'] }] }] },
    ] }] };
    const [cycleFile] = before.files;
    const [classA, classB] = cycleFile.classes;
    const [methodA] = classA.methods;
    const [methodB] = classB.methods;
    const [fragmentA] = methodA.fragments;
    const [fragmentB] = methodB.fragments;
    const after = { files: [{ ...cycleFile, classes: [
      { ...classA, methods: [{ ...methodA, fragments: [{ ...fragmentA, uses: [] }] }] },
      { ...classB, methods: [{ ...methodB, fragments: [{ ...fragmentB, uses: [] }] }] },
    ] }] };

    // Act
    const resolved = resolvedTargets(before, after, stage);

    // Assert
    expect(resolved.classIds).toEqual(['class-a', 'class-b']);
    expect(new Set(resolved.classIds).size).toBe(resolved.classIds.length);
  });

  it('越境メソッドを呼び出し元へ移すと可視性違反だったメソッドを返す', () => {
    // Arrange
    const stage = { limits: { method: 100, class: 100, file: 100 }, dependencyLimit: 100, responsibilityLimit: 100, visibilityEnforced: true, layers: [] };
    const caller = { id: 'method-caller', name: 'run', visibility: 'public' as const, fragments: [{ id: 'fragment-call', label: 'call target', lines: 1, responsibility: 'call', uses: ['method-target'] }] };
    const target = { id: 'method-target', name: 'hidden', visibility: 'private' as const, fragments: [{ id: 'fragment-work', label: 'work', lines: 4, responsibility: 'work' }] };
    const before = { files: [{ id: 'file', path: 'sample.ts', classes: [
      { id: 'class-caller', name: 'Caller', methods: [caller] },
      { id: 'class-owner', name: 'Owner', methods: [target] },
    ] }] };
    const after = { files: [{ id: 'file', path: 'sample.ts', classes: [
      { id: 'class-caller', name: 'Caller', methods: [caller, target] },
      { id: 'class-owner', name: 'Owner', methods: [] },
    ] }] };

    // Act
    const resolved = resolvedTargets(before, after, stage);

    // Assert
    expect(resolved.methodIds).toContain('method-target');
  });
});
