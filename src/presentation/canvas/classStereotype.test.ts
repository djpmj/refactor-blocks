import { describe, expect, it } from 'vitest';
import type { CodeClass } from '../../domain/codebase/Codebase';
import { classStereotype } from './classStereotype';

describe('classStereotype', () => {
  it('全publicで中身なしならinterfaceを返す', () => {
    // Arrange
    const codeClass: CodeClass = { id: 'contract', name: 'Contract', methods: [{ id: 'm', name: 'run', visibility: 'public', fragments: [] }] };
    // Act
    const result = classStereotype(codeClass);
    // Assert
    expect(result).toBe('interface');
  });

  it('interfaceでない抽象役ならabstractを返す', () => {
    // Arrange
    const codeClass: CodeClass = { id: 'base', name: 'Base', methods: [{ id: 'm', name: 'run', visibility: 'protected', fragments: [] }] };
    // Act
    const result = classStereotype(codeClass);
    // Assert
    expect(result).toBe('abstract');
  });

  it('空クラスと実装のあるクラスは印を返さない', () => {
    // Arrange
    const empty: CodeClass = { id: 'empty', name: 'Empty', methods: [] };
    const concrete: CodeClass = { id: 'concrete', name: 'Concrete', methods: [{ id: 'm', name: 'run', visibility: 'public', fragments: [{ id: 'f', label: 'work', lines: 1, responsibility: 'work' }] }] };
    // Act / Assert
    expect(classStereotype(empty)).toBeNull();
    expect(classStereotype(concrete)).toBeNull();
  });
});
