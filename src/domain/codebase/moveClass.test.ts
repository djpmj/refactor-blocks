import { describe, expect, it } from 'vitest';
import { moveClass, moveClassTargets } from './moveClass';
import { sampleCodebase } from './testFixtures';

describe('moveClass', () => {
  it('クラスが移動先ファイルの末尾に移り、移動元からは消える', () => {
    // Arrange
    const codebase = sampleCodebase();

    // Act
    const result = moveClass(codebase, 'class-tax', 'file-order');

    // Assert
    if (!result.ok) throw new Error(result.error);
    expect(result.value.files[0].classes.map((codeClass) => codeClass.id)).toEqual(['class-order', 'class-tax']);
    expect(result.value.files[1].classes).toEqual([]);
  });

  it('元のCodebaseは変更しない', () => {
    // Arrange
    const codebase = sampleCodebase();

    // Act
    moveClass(codebase, 'class-tax', 'file-order');

    // Assert
    expect(codebase).toEqual(sampleCodebase());
  });

  it.each([
    ['存在しないクラス', 'missing', 'file-order', 'class-not-found'],
    ['存在しないファイル', 'class-tax', 'missing', 'file-not-found'],
    ['今と同じファイル', 'class-tax', 'file-tax', 'same-file'],
  ])('%sを指定したときはエラーになる', (_label, classId, fileId, expected) => {
    // Arrange
    const codebase = sampleCodebase();

    // Act
    const result = moveClass(codebase, classId, fileId);

    // Assert
    expect(result).toEqual({ ok: false, error: expected });
  });
});

describe('moveClassTargets', () => {
  it('現在のファイルを除き、空のファイルも含めてファイル順に返す', () => {
    // Arrange
    const original = sampleCodebase();
    const codebase = { files: [...original.files, { id: 'file-empty', path: 'src/Empty.ts', classes: [] }] };

    // Act
    const targets = moveClassTargets(codebase, 'class-tax');

    // Assert
    expect(targets.map((file) => file.id)).toEqual(['file-order', 'file-empty']);
  });

  it('ファイルが1つだけなら候補を返さない', () => {
    // Arrange
    const original = sampleCodebase();
    const codebase = { files: [original.files[0]] };

    // Act
    const targets = moveClassTargets(codebase, 'class-order');

    // Assert
    expect(targets).toEqual([]);
  });

  it('存在しないクラスIDなら候補を返さない', () => {
    // Arrange
    const codebase = sampleCodebase();

    // Act
    const targets = moveClassTargets(codebase, 'missing');

    // Assert
    expect(targets).toEqual([]);
  });

  it('元のCodebaseを変更しない', () => {
    // Arrange
    const codebase = sampleCodebase();
    const original = sampleCodebase();

    // Act
    moveClassTargets(codebase, 'class-tax');

    // Assert
    expect(codebase).toEqual(original);
  });
});
