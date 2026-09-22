import { describe, expect, it } from 'vitest';
import { findSuperclass } from './Codebase';
import { sampleCodebase } from './testFixtures';

describe('findSuperclass', () => {
  it('superclassIdが指すクラスを返す', () => {
    // Arrange
    const codebase = {
      files: sampleCodebase().files.map((file, index) =>
        index === 0
          ? { ...file, classes: [{ ...file.classes[0], superclassId: 'class-tax' }] }
          : file,
      ),
    };

    // Act
    const superclass = findSuperclass(codebase, 'class-order');

    // Assert
    expect(superclass?.id).toBe('class-tax');
  });

  it('superclassIdを持たないクラスはundefinedを返す', () => {
    // Arrange
    const codebase = sampleCodebase();

    // Act
    const superclass = findSuperclass(codebase, 'class-order');

    // Assert
    expect(superclass).toBeUndefined();
  });

  it('superclassIdが指すクラスが存在しない(削除済み)ときはundefinedを返す', () => {
    // Arrange
    const codebase = {
      files: sampleCodebase().files.map((file, index) =>
        index === 0
          ? { ...file, classes: [{ ...file.classes[0], superclassId: 'class-deleted' }] }
          : file,
      ),
    };

    // Act
    const superclass = findSuperclass(codebase, 'class-order');

    // Assert
    expect(superclass).toBeUndefined();
  });

  it('存在しないクラスIDを指定するとundefinedを返す', () => {
    // Arrange
    const codebase = sampleCodebase();

    // Act
    const superclass = findSuperclass(codebase, 'class-none');

    // Assert
    expect(superclass).toBeUndefined();
  });
});
