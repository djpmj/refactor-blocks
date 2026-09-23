import { describe, expect, it } from 'vitest';
import type { Codebase, Method } from '../codebase/Codebase';
import { findUnplacedParts, TRAY_FILE_ID, trayCodebase, withoutTray } from './tray';

const partA: Method = {
  id: 'method-a',
  name: 'partA',
  visibility: 'public',
  fragments: [{ id: 'frag-a', label: 'A', lines: 10, responsibility: 'resp-a', uses: ['method-b'] }],
};
const partB: Method = {
  id: 'method-b',
  name: 'partB',
  visibility: 'public',
  fragments: [{ id: 'frag-b', label: 'B', lines: 10, responsibility: 'resp-b' }],
};
const partC: Method = {
  id: 'method-c',
  name: 'partC',
  visibility: 'public',
  fragments: [
    { id: 'frag-c1', label: 'C1', lines: 5, responsibility: 'resp-c' },
    { id: 'frag-c2', label: 'C2', lines: 5, responsibility: 'resp-c' },
  ],
};
const parts = [partA, partB, partC];

describe('trayCodebase', () => {
  it('ファイルが1つ、その中にクラスが1つの部品置き場ができる', () => {
    // Arrange & Act
    const codebase = trayCodebase(parts);

    // Assert
    expect(codebase.files).toHaveLength(1);
    expect(codebase.files[0].id).toBe(TRAY_FILE_ID);
    expect(codebase.files[0].classes).toHaveLength(1);
    expect(codebase.files[0].classes[0].name).toBe('部品置き場');
    expect(codebase.files[0].classes[0].methods).toEqual(parts);
  });
});

describe('withoutTray', () => {
  it('部品置き場のファイルだけが消え、ほかのファイルはそのまま残る', () => {
    // Arrange
    const other = { id: 'file-other', path: 'src/Other.ts', classes: [] };
    const codebase: Codebase = { files: [...trayCodebase(parts).files, other] };

    // Act
    const result = withoutTray(codebase);

    // Assert
    expect(result.files).toEqual([other]);
  });

  it('部品置き場のファイルがないコードベースなら、同じ内容を返す', () => {
    // Arrange
    const codebase: Codebase = { files: [{ id: 'file-other', path: 'src/Other.ts', classes: [] }] };

    // Act & Assert
    expect(withoutTray(codebase)).toEqual(codebase);
  });
});

describe('findUnplacedParts', () => {
  it('初期状態なら全部品の名前を返す', () => {
    // Arrange
    const initial = trayCodebase(parts);

    // Act & Assert
    expect(findUnplacedParts(initial, initial)).toEqual(['partA', 'partB', 'partC']);
  });

  it('1つを別ファイルのクラスへ移すと、残りの部品の名前だけを返す', () => {
    // Arrange
    const initial = trayCodebase(parts);
    const current: Codebase = {
      files: [
        { id: 'file-out', path: 'src/Out.ts', classes: [{ id: 'class-out', name: 'Out', methods: [partA] }] },
        { id: TRAY_FILE_ID, path: '部品置き場', classes: [{ id: 'class-blank-tray', name: '部品置き場', methods: [partB, partC] }] },
      ],
    };

    // Act & Assert
    expect(findUnplacedParts(initial, current)).toEqual(['partB', 'partC']);
  });

  it('全部品を移すと空配列を返す(部品置き場の空のクラス・ファイルが残っていてもよい)', () => {
    // Arrange
    const initial = trayCodebase(parts);
    const current: Codebase = {
      files: [
        { id: 'file-out', path: 'src/Out.ts', classes: [{ id: 'class-out', name: 'Out', methods: parts }] },
        { id: TRAY_FILE_ID, path: '部品置き場', classes: [{ id: 'class-blank-tray', name: '部品置き場', methods: [] }] },
      ],
    };

    // Act & Assert
    expect(findUnplacedParts(initial, current)).toEqual([]);
  });

  it('部品を移したクラスを削除すると、その部品が未配置に戻る', () => {
    // Arrange: partB・partCは外(class-out)に配置済み。partAも一度は配置したが、その入れ物ごと削除した(どこにも存在しない)
    const initial = trayCodebase(parts);
    const current: Codebase = {
      files: [{ id: 'file-out', path: 'src/Out.ts', classes: [{ id: 'class-out', name: 'Out', methods: [partB, partC] }] }],
    };

    // Act & Assert
    expect(findUnplacedParts(initial, current)).toEqual(['partA']);
  });

  it('部品置き場のファイルに足したクラスへ部品を移しても、未配置のまま', () => {
    // Arrange: partB・partCは外(class-out)に配置済み。partAは部品置き場のファイルの中に足した別クラスへ移した
    const initial = trayCodebase(parts);
    const current: Codebase = {
      files: [
        { id: 'file-out', path: 'src/Out.ts', classes: [{ id: 'class-out', name: 'Out', methods: [partB, partC] }] },
        { id: TRAY_FILE_ID, path: '部品置き場', classes: [{ id: 'class-new-in-tray', name: 'NewClass', methods: [partA] }] },
      ],
    };

    // Act & Assert
    expect(findUnplacedParts(initial, current)).toEqual(['partA']);
  });

  it('配置済みの部品から Extract Method しても、配置済みのまま(Fragment が複数ある部品で確かめる)', () => {
    // Arrange
    const initial = trayCodebase(parts);
    const remainder: Method = { id: 'method-c', name: 'partC', visibility: 'public', fragments: [partC.fragments[0]] };
    const extracted: Method = { id: 'method-c-extracted', name: 'partC2', visibility: 'public', fragments: [partC.fragments[1]] };
    const current: Codebase = {
      files: [
        { id: 'file-out', path: 'src/Out.ts', classes: [{ id: 'class-out', name: 'Out', methods: [remainder, extracted] }] },
        { id: TRAY_FILE_ID, path: '部品置き場', classes: [{ id: 'class-blank-tray', name: '部品置き場', methods: [partA, partB] }] },
      ],
    };

    // Act & Assert
    expect(findUnplacedParts(initial, current)).toEqual(['partA', 'partB']);
  });
});
