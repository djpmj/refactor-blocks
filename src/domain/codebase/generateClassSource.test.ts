import { describe, expect, it } from 'vitest';
import type { Codebase } from './Codebase';
import { extractMethod } from './extractMethod';
import { generateClassSource } from './generateClassSource';
import { renameMethod } from './renameMethod';

describe('generateClassSource', () => {
  it('renders the class, method, and fragment code in order', () => {
    // Arrange
    const codebase: Codebase = { files: [{ id: 'f', path: 'x', classes: [{ id: 'c', name: 'Report', methods: [{ id: 'm', name: 'run', visibility: 'public', fragments: [{ id: 'a', label: 'a', lines: 1, responsibility: 'x', code: { csharp: 'var x = 1;' } }, { id: 'b', label: 'b', lines: 1, responsibility: 'x', code: { csharp: 'print(x);' } }] }] }] }] };
    // Act
    const source = generateClassSource(codebase, 'c', 'csharp');
    // Assert
    const classIndex = source.indexOf('public class Report');
    const methodIndex = source.indexOf('public void run() {');
    const firstFragmentIndex = source.indexOf('var x = 1;');
    const secondFragmentIndex = source.indexOf('print(x);');
    expect(classIndex).toBeGreaterThanOrEqual(0);
    expect(methodIndex).toBeGreaterThan(classIndex);
    expect(firstFragmentIndex).toBeGreaterThan(methodIndex);
    expect(secondFragmentIndex).toBeGreaterThan(firstFragmentIndex);
  });

  it('renders a placeholder only where fragment code is missing', () => {
    // Arrange
    const codebase: Codebase = { files: [{ id: 'f', path: 'x', classes: [{ id: 'c', name: 'Thing', methods: [
      { id: 'm', name: 'run', visibility: 'protected', fragments: [{ id: 'a', label: '未実装処理', lines: 1, responsibility: 'x' }] },
    ] }] }] };
    // Act
    const source = generateClassSource(codebase, 'c', 'csharp');
    // Assert
    expect(source).toContain('// 未入力: 未実装処理');
  });

  it('renders calls for call fragments using the current names of referenced methods', () => {
    // Arrange
    const codebase: Codebase = { files: [{ id: 'f', path: 'x', classes: [{ id: 'c', name: 'Thing', methods: [
      { id: 'caller', name: 'run', visibility: 'public', fragments: [{ id: 'call', label: 'old label', lines: 1, responsibility: 'call', uses: ['target'] }] },
      { id: 'target', name: 'work', visibility: 'private', fragments: [] },
    ] }] }] };
    // Act
    const source = generateClassSource(codebase, 'c', 'csharp');
    // Assert
    expect(source).toContain('work();');
    expect(source).not.toContain('未入力');
  });

  it('renders multiple calls in uses order', () => {
    // Arrange
    const codebase: Codebase = { files: [{ id: 'f', path: 'x', classes: [{ id: 'c', name: 'Thing', methods: [
      { id: 'caller', name: 'run', visibility: 'public', fragments: [{ id: 'call', label: 'calls', lines: 1, responsibility: 'call', uses: ['a', 'b'] }] },
      { id: 'a', name: 'a', visibility: 'private', fragments: [] },
      { id: 'b', name: 'b', visibility: 'private', fragments: [] },
    ] }] }] };
    // Act
    const source = generateClassSource(codebase, 'c', 'csharp');
    // Assert
    expect(source.indexOf('a();')).toBeLessThan(source.indexOf('b();'));
    expect(source).toContain('        a();\n        b();');
  });

  it('prefers explicit code on call fragments', () => {
    // Arrange
    const codebase: Codebase = { files: [{ id: 'f', path: 'x', classes: [{ id: 'c', name: 'Thing', methods: [
      { id: 'caller', name: 'run', visibility: 'public', fragments: [{ id: 'call', label: 'calls', lines: 1, responsibility: 'call', uses: ['target'], code: { csharp: 'customCall();' } }] },
      { id: 'target', name: 'target', visibility: 'private', fragments: [] },
    ] }] }] };
    // Act
    const source = generateClassSource(codebase, 'c', 'csharp');
    // Assert
    expect(source).toContain('customCall();');
    expect(source).not.toContain('        target();');
  });

  it('keeps the placeholder for call fragments with empty or unresolved uses', () => {
    // Arrange
    const codebase: Codebase = { files: [{ id: 'f', path: 'x', classes: [{ id: 'c', name: 'Thing', methods: [
      { id: 'caller', name: 'run', visibility: 'public', fragments: [
        { id: 'empty', label: 'empty target', lines: 1, responsibility: 'call', uses: [] },
        { id: 'missing', label: 'missing target', lines: 1, responsibility: 'call', uses: ['gone'] },
      ] },
    ] }] }] };
    // Act
    const source = generateClassSource(codebase, 'c', 'csharp');
    // Assert
    expect(source).toContain('// 未入力: empty target');
    expect(source).toContain('// 未入力: missing target');
  });

  it('renders renamed extracted methods through their call fragments', () => {
    // Arrange
    const original: Codebase = { files: [{ id: 'f', path: 'x', classes: [{ id: 'c', name: 'Thing', methods: [
      { id: 'source', name: 'run', visibility: 'public', fragments: [
        { id: 'before', label: 'before', lines: 1, responsibility: 'x', code: { csharp: 'before();' } },
        { id: 'selected', label: 'selected', lines: 1, responsibility: 'x', code: { csharp: 'selected();' } },
      ] },
    ] }] }] };
    const extracted = extractMethod(original, { sourceMethodId: 'source', fragmentIds: ['selected'], newMethodId: 'new', newMethodName: 'oldName' });
    if (!extracted.ok) throw new Error('extract should succeed');
    const renamed = renameMethod(extracted.value, 'new', 'newName');
    if (!renamed.ok) throw new Error('rename should succeed');
    // Act
    const source = generateClassSource(renamed.value, 'c', 'csharp');
    // Assert
    expect(source).toContain('newName();');
    expect(source).not.toContain('oldName();');
  });

  it('does not infer calls for non-call fragments even when uses resolve', () => {
    // Arrange
    const codebase: Codebase = { files: [{ id: 'f', path: 'x', classes: [{ id: 'c', name: 'Thing', methods: [
      { id: 'caller', name: 'run', visibility: 'public', fragments: [{ id: 'work', label: 'work', lines: 1, responsibility: 'x', uses: ['target'] }] },
      { id: 'target', name: 'target', visibility: 'private', fragments: [] },
    ] }] }] };
    // Act
    const source = generateClassSource(codebase, 'c', 'csharp');
    // Assert
    expect(source).toContain('// 未入力: work');
    expect(source).not.toContain('        target();');
  });

  it('renders fields in declaration order', () => {
    // Arrange
    const codebase: Codebase = { files: [{ id: 'f', path: 'x', classes: [{ id: 'c', name: 'Thing', fields: [
      { id: 'first', name: 'value', visibility: 'private' },
      { id: 'second', name: 'title', visibility: 'public' },
    ], methods: [] }] }] };
    // Act
    const source = generateClassSource(codebase, 'c', 'csharp');
    // Assert
    expect(source).toContain('private object value;');
    expect(source).toContain('public object title;');
    expect(source.indexOf('private object value;')).toBeLessThan(source.indexOf('public object title;'));
  });

  it('renders the superclass and interfaces in order and ignores missing parent IDs', () => {
    // Arrange
    const codebase: Codebase = { files: [{ id: 'f', path: 'x', classes: [
      { id: 'parent', name: 'Base', methods: [] }, { id: 'iface', name: 'IThing', methods: [] },
      { id: 'c', name: 'Thing', superclassId: 'parent', interfaceIds: ['iface', 'gone'], methods: [] },
    ] }] };
    // Act
    const source = generateClassSource(codebase, 'c', 'csharp');
    // Assert
    expect(source).toContain('public class Thing : Base, IThing');
    expect(source).not.toContain('gone');
  });

  it('renders contract methods without a body', () => {
    // Arrange
    const codebase: Codebase = { files: [{ id: 'f', path: 'x', classes: [{ id: 'c', name: 'Thing', methods: [
      { id: 'contract', name: 'contract', visibility: 'public', fragments: [] },
    ] }] }] };
    // Act
    const source = generateClassSource(codebase, 'c', 'csharp');
    // Assert
    expect(source).toContain('public void contract();');
    expect(source).not.toContain('public void contract() {');
  });

  it('returns empty string for an unknown class', () => {
    // Arrange
    const codebase: Codebase = { files: [] };
    // Act
    const source = generateClassSource(codebase, 'missing', 'csharp');
    // Assert
    expect(source).toBe('');
  });
});
