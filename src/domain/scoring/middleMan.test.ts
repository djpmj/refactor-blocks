import { describe, expect, it } from 'vitest';
import type { Codebase, Method } from '../codebase/Codebase';
import { findMiddleManClasses } from './middleMan';

function middleManCodebase(methods: readonly Method[] = [{ id: 'forward', name: 'forward', visibility: 'public', fragments: [{ id: 'call', label: 'delegate', lines: 1, responsibility: 'call', uses: ['target'] }] }]): Codebase {
  return { files: [{ id: 'file', path: 'src/a.ts', classes: [
    { id: 'manager', name: 'Manager', methods },
    { id: 'service', name: 'Service', methods: [{ id: 'target', name: 'target', visibility: 'public', fragments: [{ id: 'work', label: 'work', lines: 5, responsibility: 'business' }] }] },
  ] }] };
}

describe('findMiddleManClasses', () => {
  it('別クラスへの単一呼び出しだけを持つクラスを返す', () => {
    // Arrange
    const codebase = middleManCodebase();

    // Act
    const result = findMiddleManClasses(codebase);

    // Assert
    expect(result).toEqual(['manager']);
  });

  it('中継メソッドが複数あっても全て中継なら返す', () => {
    // Arrange
    const codebase = middleManCodebase([
      { id: 'one', name: 'one', visibility: 'public', fragments: [{ id: 'c1', label: 'delegate', lines: 1, responsibility: 'call', uses: ['target'] }] },
      { id: 'two', name: 'two', visibility: 'public', fragments: [{ id: 'c2', label: 'delegate', lines: 1, responsibility: 'call', uses: ['target'] }] },
    ]);

    // Act
    const result = findMiddleManClasses(codebase);

    // Assert
    expect(result).toContain('manager');
  });

  it.each([
    ['実処理もある', [{ id: 'forward', name: 'forward', visibility: 'public' as const, fragments: [{ id: 'call', label: 'delegate', lines: 1, responsibility: 'call', uses: ['target'] }] }, { id: 'work', name: 'work', visibility: 'public' as const, fragments: [{ id: 'work', label: 'work', lines: 5, responsibility: 'business' }] }]],
    ['空の契約', [{ id: 'forward', name: 'forward', visibility: 'public' as const, fragments: [] }]],
    ['複数呼び出しをまとめる', [{ id: 'forward', name: 'forward', visibility: 'public' as const, fragments: [{ id: 'a', label: 'a', lines: 1, responsibility: 'call', uses: ['target'] }, { id: 'b', label: 'b', lines: 1, responsibility: 'call', uses: ['target'] }] }]],
    ['usesが複数', [{ id: 'forward', name: 'forward', visibility: 'public' as const, fragments: [{ id: 'call', label: 'delegate', lines: 1, responsibility: 'call', uses: ['target', 'other'] }] }]],
    ['usesが空', [{ id: 'forward', name: 'forward', visibility: 'public' as const, fragments: [{ id: 'call', label: 'delegate', lines: 1, responsibility: 'call' }] }]],
  ])('%sなら対象外', (_label, methods) => {
    // Arrange
    const codebase = middleManCodebase(methods);

    // Act
    const result = findMiddleManClasses(codebase);

    // Assert
    expect(result).not.toContain('manager');
  });

  it('フィールドを持つクラス・空クラス・同じクラスへの呼び出しは対象外', () => {
    // Arrange
    const base = middleManCodebase();
    const manager = base.files[0].classes[0];
    const selfForwarder = { ...manager, methods: [{ ...manager.methods[0], fragments: [{ id: 'self', label: 'self', lines: 1, responsibility: 'call', uses: ['forward'] }] }] };
    const codebase: Codebase = { files: [{ ...base.files[0], classes: [
      { ...manager, fields: [{ id: 'field', name: 'value', visibility: 'private' }] },
      { ...manager, id: 'empty', methods: [] },
      selfForwarder,
      base.files[0].classes[1],
    ] }] };

    // Act
    const result = findMiddleManClasses(codebase);

    // Assert
    expect(result).toEqual([]);
  });
});
