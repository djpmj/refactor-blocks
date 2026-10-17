import { describe, expect, it } from 'vitest';
import type { Codebase } from './Codebase';
import { fieldAccessors } from './fieldAccessors';

describe('fieldAccessors', () => {
  it('returns an owner read as an internal read', () => {
    // Arrange
    const codebase: Codebase = { files: [{ id: 'file', path: 'x', classes: [{
      id: 'owner', name: 'Subscription', fields: [{ id: 'status', name: 'status', visibility: 'public' }],
      methods: [{ id: 'renew', name: 'renew', visibility: 'public', fragments: [
        { id: 'read', label: 'read', lines: 1, responsibility: 'x', reads: ['status'] },
      ] }],
    }] }] };

    // Act
    const result = fieldAccessors(codebase, 'status');

    // Assert
    expect(result).toEqual([{ methodId: 'renew', methodName: 'renew', className: 'Subscription', access: 'read', outside: false }]);
  });

  it('combines repeated reads and writes from an outside method', () => {
    // Arrange
    const codebase: Codebase = { files: [{ id: 'file', path: 'x', classes: [
      { id: 'owner', name: 'Subscription', fields: [{ id: 'status', name: 'status', visibility: 'public' }], methods: [] },
      { id: 'service', name: 'BillingService', methods: [{ id: 'cancel', name: 'cancelSubscription', visibility: 'public', fragments: [
        { id: 'read', label: 'read', lines: 1, responsibility: 'x', reads: ['status'] },
        { id: 'write', label: 'write', lines: 1, responsibility: 'x', writes: ['status'] },
      ] }] },
    ] }] };

    // Act
    const result = fieldAccessors(codebase, 'status');

    // Assert
    expect(result).toEqual([{ methodId: 'cancel', methodName: 'cancelSubscription', className: 'BillingService', access: 'read-write', outside: true }]);
  });

  it('returns no accessors for an unused field', () => {
    // Arrange
    const codebase: Codebase = { files: [{ id: 'file', path: 'x', classes: [{
      id: 'owner', name: 'Subscription', fields: [{ id: 'status', name: 'status', visibility: 'public' }], methods: [],
    }] }] };

    // Act
    const result = fieldAccessors(codebase, 'status');

    // Assert
    expect(result).toEqual([]);
  });

  it('combines duplicate field references from fragments in one method', () => {
    // Arrange
    const codebase: Codebase = { files: [{ id: 'file', path: 'x', classes: [{
      id: 'owner', name: 'Subscription', fields: [{ id: 'status', name: 'status', visibility: 'public' }],
      methods: [{ id: 'change', name: 'change', visibility: 'public', fragments: [
        { id: 'read-a', label: 'read', lines: 1, responsibility: 'x', reads: ['status'] },
        { id: 'read-b', label: 'read again', lines: 1, responsibility: 'x', reads: ['status'] },
        { id: 'write', label: 'write', lines: 1, responsibility: 'x', writes: ['status'] },
      ] }],
    }] }] };

    // Act
    const result = fieldAccessors(codebase, 'status');

    // Assert
    expect(result).toHaveLength(1);
    expect(result[0]?.access).toBe('read-write');
  });
});
