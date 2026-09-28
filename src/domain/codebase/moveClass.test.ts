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
  it('元のファイルを除き、空ファイルも含めてfilesの順で返す', () => {
    // Arrange
    const sample = sampleCodebase();
    const codebase = { files: [
      { id: 'empty-before', path: 'src/before.ts', classes: [] },
      ...sample.files,
      { id: 'empty-after', path: 'src/after.ts', classes: [] },
    ] };
    const before = structuredClone(codebase);

    // Act
    const targets = moveClassTargets(codebase, 'class-order');

    // Assert
    expect(targets).toEqual([codebase.files[0], codebase.files[2], codebase.files[3]]);
    expect(targets).toEqual(codebase.files.filter((file) => moveClass(codebase, 'class-order', file.id).ok));
    expect(codebase).toEqual(before);
  });

  it('ファイルが1つだけなら候補はない', () => {
    // Arrange
    const codebase = { files: [sampleCodebase().files[0]] };

    // Act
    const targets = moveClassTargets(codebase, 'class-order');

    // Assert
    expect(targets).toEqual([]);
  });

  it('存在しないクラスIDなら候補はない', () => {
    // Arrange
    const codebase = sampleCodebase();

    // Act
    const targets = moveClassTargets(codebase, 'missing');

    // Assert
    expect(targets).toEqual([]);
    expect(codebase).toEqual(sampleCodebase());
  });
});
