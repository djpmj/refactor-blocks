import { describe, expect, it } from 'vitest';
import { fragment, sampleCodebase } from '../codebase/testFixtures';
import type { Codebase } from '../codebase/Codebase';
import type { ChangeRequest } from './ChangeRequest';
import { checkManualFix } from './checkManualFix';

const taxRequest: ChangeRequest = { id: 'req-tax', title: '軽減税率', description: '', responsibility: 'tax', linesPerSite: 8 };

/** tax の処理を持つメソッドが3つ(method-a / method-b / method-c)、持たないメソッドが1つ(method-other)ある。 */
function taxCodebase(): Codebase {
  const method = (id: string, responsibility: string) => ({ id, name: id, visibility: 'public' as const, fragments: [fragment(`f-${id}`, 5, responsibility)] });
  return {
    files: [
      {
        id: 'file-x',
        path: 'src/X.ts',
        classes: [
          { id: 'class-x', name: 'X', methods: [method('method-a', 'tax'), method('method-b', 'tax'), method('method-c', 'tax'), method('method-other', 'ordering')] },
        ],
      },
    ],
  };
}

describe('checkManualFix', () => {
  it('変更箇所すべてに印があれば、missed も extra も空', () => {
    // Arrange
    const codebase = taxCodebase();

    // Act
    const result = checkManualFix(codebase, taxRequest, ['method-a', 'method-b', 'method-c']);

    // Assert
    expect(result).toEqual({ missed: [], extra: [], sites: 3 });
  });

  it('一部にしか印が無ければ、印の無い変更箇所を出現順に missed へ入れる', () => {
    // Arrange
    const codebase = taxCodebase();

    // Act
    const result = checkManualFix(codebase, taxRequest, ['method-b']);

    // Assert
    expect(result.missed).toEqual(['method-a', 'method-c']);
  });

  it('印が1つも無ければ、missed が全変更箇所になる', () => {
    // Arrange
    const codebase = taxCodebase();

    // Act
    const result = checkManualFix(codebase, taxRequest, []);

    // Assert
    expect(result.missed).toEqual(['method-a', 'method-b', 'method-c']);
  });

  it('変更箇所でないメソッドの印は extra に入り、missed には影響しない', () => {
    // Arrange
    const codebase = taxCodebase();

    // Act
    const result = checkManualFix(codebase, taxRequest, ['method-a', 'method-other']);

    // Assert
    expect(result.extra).toEqual(['method-other']);
    expect(result.missed).toEqual(['method-b', 'method-c']);
  });

  it('コードに存在しないIDの印は無視する', () => {
    // Arrange
    const codebase = taxCodebase();

    // Act
    const result = checkManualFix(codebase, taxRequest, ['method-gone', 'method-a', 'method-b', 'method-c']);

    // Assert
    expect(result).toEqual({ missed: [], extra: [], sites: 3 });
  });

  it('同じIDが重複していても1つとして扱う', () => {
    // Arrange
    const codebase = taxCodebase();

    // Act
    const result = checkManualFix(codebase, taxRequest, ['method-other', 'method-other', 'method-a']);

    // Assert
    expect(result.extra).toEqual(['method-other']);
    expect(result.missed).toEqual(['method-b', 'method-c']);
  });

  it('依頼の責務の処理が1つも無ければ sites が 0 で missed は空', () => {
    // Arrange
    const codebase = sampleCodebase();
    const request = { ...taxRequest, responsibility: 'nothing' };

    // Act
    const result = checkManualFix(codebase, request, []);

    // Assert
    expect(result).toEqual({ missed: [], extra: [], sites: 0 });
  });

  it('変更箇所が減ったコードでは、そのときの変更箇所で照合する', () => {
    // Arrange
    const [file] = taxCodebase().files;
    const [codeClass] = file.classes;
    const merged: Codebase = { files: [{ ...file, classes: [{ ...codeClass, methods: codeClass.methods.filter((m) => m.id !== 'method-b' && m.id !== 'method-c') }] }] };

    // Act
    const result = checkManualFix(merged, taxRequest, ['method-a']);

    // Assert
    expect(result).toEqual({ missed: [], extra: [], sites: 1 });
  });
});
