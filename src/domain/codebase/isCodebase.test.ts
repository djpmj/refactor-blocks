import { describe, expect, it } from 'vitest';
import { stages } from '../../infrastructure/stages/stageCatalog';
import { isCodebase } from './isCodebase';

type Patch = { file?: object; codeClass?: object; method?: object; fragment?: object; field?: object };

function codebaseWith(patch: Patch): unknown {
  return {
    files: [
      {
        id: 'f',
        path: 'a.cs',
        classes: [
          {
            id: 'c',
            name: 'C',
            fields: [{ id: 'fd', name: 'x', visibility: 'private', ...patch.field }],
            methods: [
              {
                id: 'm',
                name: 'run',
                visibility: 'public',
                fragments: [{ id: 'fr', label: 'l', lines: 3, responsibility: 'r', ...patch.fragment }],
                ...patch.method,
              },
            ],
            ...patch.codeClass,
          },
        ],
        ...patch.file,
      },
    ],
  };
}

describe('isCodebase', () => {
  it('既存の全ステージの初期コードは true', () => {
    // Arrange
    const all = stages.map((stage) => stage.codebase);

    // Act
    const results = all.map((codebase) => isCodebase(codebase));

    // Assert
    expect(results.every(Boolean)).toBe(true);
  });

  it.each([null, [], 'text', 1, {}, { files: 'x' }])('Codebase でない値 %j は false', (value) => {
    // Arrange / Act / Assert
    expect(isCodebase(value)).toBe(false);
  });

  it('最小の正しい形は任意項目が無くても true', () => {
    // Arrange / Act / Assert
    expect(isCodebase(codebaseWith({}))).toBe(true);
  });

  it.each<[string, Patch]>([
    ['ファイルの path が無い', { file: { path: undefined } }],
    ['ファイルの classes が配列でない', { file: { classes: {} } }],
    ['クラスの name が数値', { codeClass: { name: 1 } }],
    ['クラスの methods が無い', { codeClass: { methods: undefined } }],
    ['superclassId が文字列でない', { codeClass: { superclassId: 1 } }],
    ['interfaceIds が文字列の配列でない', { codeClass: { interfaceIds: [1] } }],
    ['フィールドの形が違う', { field: { name: undefined } }],
    ['メソッドの visibility が不正', { method: { visibility: 'internal' } }],
    ['lines が負', { fragment: { lines: -1 } }],
    ['lines が小数', { fragment: { lines: 1.5 } }],
    ['responsibility が文字列でない', { fragment: { responsibility: 1 } }],
    ['uses が文字列の配列でない', { fragment: { uses: [1] } }],
    ['reads が配列でない', { fragment: { reads: 'a' } }],
    ['writes が文字列の配列でない', { fragment: { writes: [null] } }],
    ['stub が真偽値でない', { fragment: { stub: 'yes' } }],
    ['accessor が真偽値でない', { fragment: { accessor: 1 } }],
  ])('%s は false', (_name, patch) => {
    // Arrange
    const value = codebaseWith(patch);

    // Act
    const result = isCodebase(value);

    // Assert
    expect(result).toBe(false);
  });

  it('任意項目(code・suggestedName・duplicateGroup など)があっても true', () => {
    // Arrange
    const value = codebaseWith({
      fragment: { code: { csharp: 'x' }, suggestedName: 'n', duplicateGroup: 'g', uses: ['m'], reads: [], writes: [], stub: true, accessor: false },
      codeClass: { superclassId: 's', interfaceIds: ['i'] },
    });

    // Act
    const result = isCodebase(value);

    // Assert
    expect(result).toBe(true);
  });
});
