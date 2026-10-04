import { describe, expect, it } from 'vitest';
import type { Codebase } from './Codebase';
import { addNewFile } from './addNewFile';

describe('addNewFile', () => {
  it('空のコードベースに指定IDの空ファイルを追加する', () => {
    // Arrange
    const codebase: Codebase = { files: [] };

    // Act
    const result = addNewFile(codebase, 'new-file');

    // Assert
    expect(result.files).toEqual([{ id: 'new-file', path: 'src/NewFile.ts', classes: [] }]);
  });

  it('使用済みの名前は2から連番を付ける', () => {
    // Arrange
    const codebase: Codebase = { files: [
      { id: 'one', path: 'src/NewFile.ts', classes: [] },
      { id: 'two', path: 'src/NewFile2.ts', classes: [] },
    ] };

    // Act
    const result = addNewFile(codebase, 'three');

    // Assert
    expect(result.files[2]?.path).toBe('src/NewFile3.ts');
  });

  it('末尾へ追加し既存ファイルの内容と元コードベースを保つ', () => {
    // Arrange
    const original: Codebase = { files: [{
      id: 'one', path: 'src/One.ts', classes: [{ id: 'class-one', name: 'One', methods: [] }],
    }] };

    // Act
    const result = addNewFile(original, 'two');

    // Assert
    expect(result.files.map((file) => file.id)).toEqual(['one', 'two']);
    expect(result.files[0]).toEqual(original.files[0]);
    expect(original.files).toHaveLength(1);
    expect(result).not.toBe(original);
  });
});
