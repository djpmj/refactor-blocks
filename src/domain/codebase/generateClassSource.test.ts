import { describe, expect, it } from 'vitest';
import type { Codebase } from './Codebase';
import { generateClassSource } from './generateClassSource';

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
