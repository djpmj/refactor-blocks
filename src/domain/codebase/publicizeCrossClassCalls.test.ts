import { describe, expect, it } from 'vitest';
import { findMethod, type Codebase } from './Codebase';
import { publicizeCrossClassCalls } from './publicizeCrossClassCalls';
import { findVisibilityViolations } from '../scoring/visibility';

const fragment = (id: string, uses: string[] = []) => ({ id, label: id, lines: 1, responsibility: 'misc', uses });

function sample(): Codebase {
  return {
    files: [{ id: 'file', path: 'sample.ts', classes: [
      { id: 'order', name: 'OrderService', methods: [
        { id: 'run', name: 'run', visibility: 'public', fragments: [fragment('call-tax', ['tax']), fragment('call-save', ['save'])] },
        { id: 'same-class', name: 'sameClass', visibility: 'public', fragments: [fragment('call-private', ['private-helper'])] },
        { id: 'private-helper', name: 'privateHelper', visibility: 'private', fragments: [fragment('helper-body')] },
      ] },
      { id: 'tax-class', name: 'TaxCalculator', methods: [{ id: 'tax', name: 'calculateTax', visibility: 'private', fragments: [fragment('tax-body')] }] },
      { id: 'repository', name: 'OrderRepository', methods: [{ id: 'save', name: 'saveOrder', visibility: 'protected', fragments: [fragment('save-body')] }] },
    ] }],
  };
}

describe('publicizeCrossClassCalls', () => {
  it('越境違反の受け手を public にし、呼び出し元側も違反なら順序どおり重複なく返す', () => {
    // Arrange
    const codebase = sample();

    // Act
    const result = publicizeCrossClassCalls(codebase);

    // Assert
    expect(result.publicized).toEqual(['tax', 'save']);
    expect(findMethod(result.codebase, 'tax')?.visibility).toBe('public');
    expect(findMethod(result.codebase, 'save')?.visibility).toBe('public');
    expect(findMethod(result.codebase, 'run')?.visibility).toBe('public');
    expect(findMethod(result.codebase, 'private-helper')?.visibility).toBe('private');
  });

  it('違反がなければ同じ Codebase を返し、protected 子孫からの呼び出しは維持する', () => {
    // Arrange
    const base = sample();
    const codebase: Codebase = { files: [{ ...base.files[0], classes: [
      { id: 'parent', name: 'Parent', methods: [{ id: 'hook', name: 'hook', visibility: 'protected', fragments: [fragment('hook-body')] }] },
      { id: 'child', name: 'Child', superclassId: 'parent', methods: [{ id: 'child-run', name: 'run', visibility: 'public', fragments: [fragment('child-call', ['hook'])] }] },
    ] }] };

    // Act
    const result = publicizeCrossClassCalls(codebase);

    // Assert
    expect(findVisibilityViolations(codebase)).toEqual([]);
    expect(result.codebase).toBe(codebase);
    expect(result.publicized).toEqual([]);
  });

  it('違反に出るメソッドだけを変更し、元を変更しない', () => {
    // Arrange
    const codebase = sample();
    const before = structuredClone(codebase);

    // Act
    publicizeCrossClassCalls(codebase);

    // Assert
    expect(codebase).toEqual(before);
  });
  it('deduplicates a receiver called by multiple classes', () => {
    const base = sample();
    const codebase: Codebase = { files: [{ ...base.files[0], classes: [
      ...base.files[0].classes,
      { id: 'admin', name: 'AdminService', methods: [{ id: 'admin-call', name: 'run', visibility: 'public', fragments: [fragment('admin-tax', ['tax'])] }] },
    ] }] };

    const result = publicizeCrossClassCalls(codebase);

    expect(findVisibilityViolations(codebase).filter(({ methodId }) => methodId === 'tax')).toHaveLength(2);
    expect(result.publicized.filter((id) => id === 'tax')).toHaveLength(1);
  });
});
