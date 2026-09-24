import { describe, expect, it } from 'vitest';
import type { CodeClass, Codebase } from '../codebase/Codebase';
import { findLoneSuperclasses } from './loneSuperclass';

function classOf(id: string, superclassId?: string, interfaceIds?: readonly string[]): CodeClass {
  return { id, name: id, methods: [], superclassId, interfaceIds };
}

function codebaseOf(...classes: CodeClass[]): Codebase {
  return { files: [{ id: 'file', path: 'src/all.ts', classes }] };
}

describe('findLoneSuperclasses', () => {
  it('extends の子が1つだけの基底クラスを返す', () => {
    // Arrange
    const codebase = codebaseOf(classOf('Base'), classOf('Child', 'Base'));

    // Act
    const lone = findLoneSuperclasses(codebase);

    // Assert
    expect(lone).toEqual(['Base']);
  });

  it('extends の子が2つある基底クラスは返さない', () => {
    // Arrange
    const codebase = codebaseOf(classOf('Base'), classOf('ChildA', 'Base'), classOf('ChildB', 'Base'));

    // Act
    const lone = findLoneSuperclasses(codebase);

    // Assert
    expect(lone).toEqual([]);
  });

  it('implements の子が1つだけのクラス(インターフェース)は返さない', () => {
    // Arrange
    const codebase = codebaseOf(classOf('Gateway'), classOf('StripeGateway', undefined, ['Gateway']));

    // Act
    const lone = findLoneSuperclasses(codebase);

    // Assert
    expect(lone).toEqual([]);
  });

  it('extends の子1つと implements の子1つを持つクラスは、extends の子だけを数えて返す', () => {
    // Arrange
    const codebase = codebaseOf(classOf('Base'), classOf('Child', 'Base'), classOf('Impl', undefined, ['Base']));

    // Act
    const lone = findLoneSuperclasses(codebase);

    // Assert
    expect(lone).toEqual(['Base']);
  });

  it('子が1つもないクラスは返さない', () => {
    // Arrange
    const codebase = codebaseOf(classOf('Base'), classOf('Other'));

    // Act
    const lone = findLoneSuperclasses(codebase);

    // Assert
    expect(lone).toEqual([]);
  });

  it('削除済みで存在しないクラスを親に指している子があっても、そのIDは返さない', () => {
    // Arrange
    const codebase = codebaseOf(classOf('Child', 'DeletedBase'));

    // Act
    const lone = findLoneSuperclasses(codebase);

    // Assert
    expect(lone).toEqual([]);
  });
});
