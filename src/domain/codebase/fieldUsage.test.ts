import { describe, expect, it } from 'vitest';
import type { Codebase } from './Codebase';
import { fieldUsage } from './fieldUsage';

describe('fieldUsage', () => {
  it('returns unique methods in class order with direct and accessor field access', () => {
    // Arrange
    const codebase: Codebase = { files: [{ id: 'file', path: 'x', classes: [{ id: 'class', name: 'Account', methods: [
      { id: 'getter', name: 'getBalance', visibility: 'public', fragments: [{ id: 'get', label: 'get', lines: 1, responsibility: 'accessor', accessor: true, reads: ['balance'] }] },
      { id: 'caller', name: 'spend', visibility: 'public', fragments: [
        { id: 'read', label: 'read', lines: 1, responsibility: 'x', uses: ['getter'], reads: ['balance'] },
        { id: 'write', label: 'write', lines: 1, responsibility: 'x', writes: ['balance'] },
      ] },
      { id: 'other', name: 'other', visibility: 'private', fragments: [{ id: 'other-fragment', label: 'other', lines: 1, responsibility: 'x', reads: ['elsewhere'] }] },
    ] }] }] };

    // Act
    const result = fieldUsage(codebase, 'balance');

    // Assert
    expect(result).toEqual([
      { method: codebase.files[0].classes[0].methods[0], access: 'read' },
      { method: codebase.files[0].classes[0].methods[1], access: 'read-write' },
    ]);
  });

  it('returns an empty list when no method uses the field', () => {
    // Arrange
    const codebase: Codebase = { files: [{ id: 'file', path: 'x', classes: [{ id: 'class', name: 'Empty', methods: [] }] }] };

    // Act
    const result = fieldUsage(codebase, 'missing');

    // Assert
    expect(result).toEqual([]);
  });

  it('includes caller methods that access the field only through getters and setters', () => {
    // Arrange
    const codebase: Codebase = { files: [{ id: 'file', path: 'x', classes: [{ id: 'class', name: 'Account', methods: [
      { id: 'read-accessor', name: 'getBalance', visibility: 'public', fragments: [{ id: 'get', label: 'get', lines: 1, responsibility: 'accessor', accessor: true, reads: ['balance'] }] },
      { id: 'write-accessor', name: 'setBalance', visibility: 'public', fragments: [{ id: 'set', label: 'set', lines: 1, responsibility: 'accessor', accessor: true, writes: ['balance'] }] },
      { id: 'reader', name: 'showBalance', visibility: 'public', fragments: [{ id: 'call-getter', label: 'get balance', lines: 1, responsibility: 'call', uses: ['read-accessor'] }] },
      { id: 'writer', name: 'updateBalance', visibility: 'public', fragments: [{ id: 'call-setter', label: 'set balance', lines: 1, responsibility: 'call', uses: ['write-accessor'] }] },
    ] }] }] };

    // Act
    const result = fieldUsage(codebase, 'balance');

    // Assert
    expect(result.map(({ method, access }) => [method.name, access])).toEqual([
      ['getBalance', 'read'],
      ['setBalance', 'write'],
      ['showBalance', 'read'],
      ['updateBalance', 'write'],
    ]);
  });
});
