import { describe, expect, it } from 'vitest';
import { addFile } from './addFile';
import { sampleCodebase } from './testFixtures';

describe('addFile', () => {
  it('クラスが空のファイルが末尾に追加される', () => {
    // Arrange
    const codebase = sampleCodebase();

    // Act
    const result = addFile(codebase, ' src/mail/Mailer.ts ', 'file-mail');

    // Assert
    if (!result.ok) throw new Error(result.error);
    expect(result.value.files.map((file) => file.path)).toEqual([
      'src/OrderService.ts',
      'src/TaxCalculator.ts',
      'src/mail/Mailer.ts',
    ]);
    expect(result.value.files[2]).toEqual({ id: 'file-mail', path: 'src/mail/Mailer.ts', classes: [] });
  });

  it('元のCodebaseは変更しない', () => {
    // Arrange
    const codebase = sampleCodebase();

    // Act
    addFile(codebase, 'src/mail/Mailer.ts', 'file-mail');

    // Assert
    expect(codebase).toEqual(sampleCodebase());
  });

  it.each([
    ['パスが空白だけ', '  ', 'empty-path'],
    ['同じパスのファイルがある', 'src/TaxCalculator.ts', 'duplicate-path'],
  ])('%sのときはエラーになる', (_label, path, expected) => {
    // Arrange
    const codebase = sampleCodebase();

    // Act
    const result = addFile(codebase, path, 'file-new');

    // Assert
    expect(result).toEqual({ ok: false, error: expected });
  });
});
