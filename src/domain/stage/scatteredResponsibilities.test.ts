import { describe, expect, it } from 'vitest';
import type { CodeClass, Codebase, Fragment, Method } from '../codebase/Codebase';
import { findScatteredResponsibilities } from './scatteredResponsibilities';

function fragment(id: string, responsibility: string): Fragment {
  return { id, label: id, lines: 1, responsibility };
}

function method(id: string, ...fragments: Fragment[]): Method {
  return { id, name: id, visibility: 'public', fragments };
}

function codeClass(id: string, methods: Method[], rest: Partial<CodeClass> = {}): CodeClass {
  return { id, name: id, methods, ...rest };
}

function codebaseOf(...classes: CodeClass[]): Codebase {
  return { files: [{ id: 'file', path: 'a.ts', classes }] };
}

describe('findScatteredResponsibilities', () => {
  it('同じ責務の処理が2つのクラスにあると、その責務とクラスを返す', () => {
    // Arrange
    const codebase = codebaseOf(
      codeClass('storage', [method('storePdf', fragment('f1', 'storage'))]),
      codeClass('service', [method('send', fragment('f2', 'storage'), fragment('f3', 'mail'))]),
    );

    // Act
    const scattered = findScatteredResponsibilities(codebase);

    // Assert
    expect(scattered).toEqual([{ responsibility: 'storage', classIds: ['storage', 'service'] }]);
  });

  it('同じ責務が1クラスだけなら空', () => {
    // Arrange
    const codebase = codebaseOf(
      codeClass('a', [method('m1', fragment('f1', 'storage'), fragment('f2', 'storage'))]),
      codeClass('b', [method('m2', fragment('f3', 'mail'))]),
    );

    // Act
    const scattered = findScatteredResponsibilities(codebase);

    // Assert
    expect(scattered).toEqual([]);
  });

  it('同じインターフェースを実装する兄弟のクラスが同じ責務を持っても数えない', () => {
    // Arrange
    const codebase = codebaseOf(
      codeClass('Strategy', [{ id: 'calc', name: 'calc', visibility: 'public', fragments: [] }]),
      codeClass('A', [method('a', fragment('f1', 'discount'))], { interfaceIds: ['Strategy'] }),
      codeClass('B', [method('b', fragment('f2', 'discount'))], { interfaceIds: ['Strategy'] }),
    );

    // Act
    const scattered = findScatteredResponsibilities(codebase);

    // Assert
    expect(scattered).toEqual([]);
  });

  it('親と子が同じ責務を持っても数えない(継承関係にあるクラスどうし)', () => {
    // Arrange
    const codebase = codebaseOf(
      codeClass('Base', [method('base', fragment('f1', 'log'))]),
      codeClass('Child', [method('child', fragment('f2', 'log'))], { superclassId: 'Base' }),
    );

    // Act
    const scattered = findScatteredResponsibilities(codebase);

    // Assert
    expect(scattered).toEqual([]);
  });

  it('同じ親を継ぐ兄弟のクラスが同じ責務を持っても数えない', () => {
    // Arrange
    const codebase = codebaseOf(
      codeClass('Base', [method('base', fragment('f0', 'flow'))]),
      codeClass('A', [method('a', fragment('f1', 'parse'))], { superclassId: 'Base' }),
      codeClass('B', [method('b', fragment('f2', 'parse'))], { superclassId: 'Base' }),
    );

    // Act
    const scattered = findScatteredResponsibilities(codebase);

    // Assert
    expect(scattered).toEqual([]);
  });

  it('インターフェース役・抽象クラス役のクラスは数えない', () => {
    // Arrange
    const codebase = codebaseOf(
      codeClass('Abstract', [
        { id: 'hook', name: 'hook', visibility: 'protected', fragments: [] },
        method('template', fragment('f0', 'storage')),
      ]),
      codeClass('Impl', [method('impl', fragment('f1', 'storage'))]),
    );

    // Act
    const scattered = findScatteredResponsibilities(codebase);

    // Assert
    expect(scattered).toEqual([]);
  });

  it('呼び出し行(call)だけが別クラスにあっても数えない', () => {
    // Arrange
    const codebase = codebaseOf(
      codeClass('storage', [method('storePdf', fragment('f1', 'storage'))]),
      codeClass('service', [method('send', fragment('f2', 'call'))]),
    );

    // Act
    const scattered = findScatteredResponsibilities(codebase);

    // Assert
    expect(scattered).toEqual([]);
  });
});
