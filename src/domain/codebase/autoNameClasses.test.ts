import { describe, expect, it } from 'vitest';
import { autoNameClasses } from './autoNameClasses';
import type { Codebase } from './Codebase';

function codebaseWith(fragments: Codebase['files'][number]['classes'][number]['methods'][number]['fragments']): Codebase {
  return { files: [{ id: 'f', path: 'src/f.ts', classes: [{ id: 'auto', name: 'NewClass', autoNamed: true, methods: [{ id: 'm', name: 'work', visibility: 'public', fragments }] }] }] };
}

describe('autoNameClasses', () => {
  it('単一責務のクラスを対応する名前にする', () => {
    // Arrange
    const codebase = codebaseWith([{ id: 'draw', label: 'draw', lines: 5, responsibility: 'rendering' }]);

    // Act
    const result = autoNameClasses(codebase, { rendering: 'InvoicePdfRenderer' });

    // Assert
    expect(result.files[0].classes[0].name).toBe('InvoicePdfRenderer');
  });

  it('責務ごとの行数が最大の名前を選び、同数なら先に出る責務を選ぶ', () => {
    // Arrange
    const codebase = codebaseWith([
      { id: 'notify', label: 'notify', lines: 6, responsibility: 'notification' },
      { id: 'store', label: 'store', lines: 3, responsibility: 'storage' },
    ]);

    // Act
    const result = autoNameClasses(codebase, { notification: 'InvoiceMailer', storage: 'InvoiceStorage' });

    // Assert
    expect(result.files[0].classes[0].name).toBe('InvoiceMailer');
    const tied = autoNameClasses(codebaseWith([
      { id: 'store', label: 'store', lines: 3, responsibility: 'storage' },
      { id: 'notify', label: 'notify', lines: 3, responsibility: 'notification' },
    ]), { notification: 'InvoiceMailer', storage: 'InvoiceStorage' });
    expect(tied.files[0].classes[0].name).toBe('InvoiceStorage');
  });

  it.each([
    ['空', []],
    ['callだけ', [{ id: 'call', label: 'call', lines: 5, responsibility: 'call' }]],
    ['未知責務だけ', [{ id: 'misc', label: 'misc', lines: 5, responsibility: 'unknown' }]],
  ])('%sなら既定名を使う', (_label, fragments) => {
    // Arrange
    const codebase = codebaseWith(fragments);

    // Act
    const result = autoNameClasses(codebase, { rendering: 'Renderer' });

    // Assert
    expect(result.files[0].classes[0].name).toBe('NewClass');
  });

  it('名前の重複を避け、自動名以外のクラスを変えず、元の値を変更しない', () => {
    // Arrange
    const codebase: Codebase = { files: [{ id: 'f', path: 'f', classes: [
      { id: 'manual', name: 'Renderer', methods: [] },
      { id: 'a', name: 'NewClass', autoNamed: true, methods: [{ id: 'ma', name: 'a', visibility: 'public', fragments: [{ id: 'fa', label: 'draw', lines: 3, responsibility: 'rendering' }] }] },
      { id: 'b', name: 'NewClass2', autoNamed: true, methods: [{ id: 'mb', name: 'b', visibility: 'public', fragments: [{ id: 'fb', label: 'draw', lines: 3, responsibility: 'rendering' }] }] },
    ] }] };

    // Act
    const result = autoNameClasses(codebase, { rendering: 'Renderer' });

    // Assert
    expect(result.files[0].classes.map((item) => item.name)).toEqual(['Renderer', 'Renderer2', 'Renderer3']);
    expect(result).not.toBe(codebase);
    expect(codebase.files[0].classes[1].name).toBe('NewClass');
  });

  it('自動命名の対象が変わらなければ元のCodebaseを返す', () => {
    // Arrange
    const codebase: Codebase = { files: [{ id: 'f', path: 'f', classes: [{ id: 'manual', name: 'Manual', methods: [] }] }] };

    // Act / Assert
    expect(autoNameClasses(codebase, { rendering: 'Renderer' })).toBe(codebase);
  });

  it('既存クラスや複数の自動命名クラスと重なると連番を付ける', () => {
    // Arrange
    const codebase: Codebase = { files: [{ id: 'f', path: 'f', classes: [
      { id: 'manual', name: 'Renderer', methods: [] },
      { id: 'a', name: 'NewClass', autoNamed: true, methods: [{ id: 'ma', name: 'a', visibility: 'public', fragments: [{ id: 'fa', label: 'draw', lines: 3, responsibility: 'rendering' }] }] },
      { id: 'b', name: 'NewClass2', autoNamed: true, methods: [{ id: 'mb', name: 'b', visibility: 'public', fragments: [{ id: 'fb', label: 'draw', lines: 3, responsibility: 'rendering' }] }] },
    ] }] };

    // Act
    const result = autoNameClasses(codebase, { rendering: 'Renderer' });

    // Assert
    expect(result.files[0].classes.map((item) => item.name)).toEqual(['Renderer', 'Renderer2', 'Renderer3']);
  });
});
