import { describe, expect, it } from 'vitest';
import { allClasses, findClass, findClassOfMethod, type Codebase } from '../codebase/Codebase';
import { applySolutionSteps, sampleAnswerCodebase, solutionSnapshots, type SolutionStep } from './sampleAnswer';

/** クラスA(メソッドrunに処理2つ)とクラスBを持つ最小のコードベース。 */
function twoClassCodebase(): Codebase {
  return {
    files: [
      {
        id: 'file-a',
        path: 'src/a.ts',
        classes: [
          {
            id: 'class-a',
            name: 'A',
            methods: [
              {
                id: 'method-run',
                name: 'run',
                visibility: 'public',
                fragments: [
                  { id: 'f1', label: '前半', lines: 10, responsibility: 'x' },
                  { id: 'f2', label: '後半', lines: 10, responsibility: 'y' },
                ],
              },
            ],
          },
          { id: 'class-b', name: 'B', methods: [] },
        ],
      },
    ],
  };
}

function classNamed(codebase: Codebase, name: string) {
  const found = allClasses(codebase).find((codeClass) => codeClass.name === name);
  if (found === undefined) throw new Error(`クラス ${name} がありません`);
  return found;
}

/** 指定した名前のクラスのmethodsだけを置き換えたコードベースを返す。 */
function withMethodsOf(codebase: Codebase, className: string, methods: Codebase['files'][0]['classes'][0]['methods']): Codebase {
  return {
    files: codebase.files.map((file) => ({
      ...file,
      classes: file.classes.map((codeClass) => (codeClass.name === className ? { ...codeClass, methods } : codeClass)),
    })),
  };
}

/** 指定した名前のクラスのfieldsだけを置き換えたコードベースを返す。 */
function withFieldsOf(codebase: Codebase, className: string, fields: NonNullable<Codebase['files'][0]['classes'][0]['fields']>): Codebase {
  return {
    files: codebase.files.map((file) => ({
      ...file,
      classes: file.classes.map((codeClass) => (codeClass.name === className ? { ...codeClass, fields } : codeClass)),
    })),
  };
}

describe('applySolutionSteps', () => {
  it('inlineステップでfromClassを指定してメソッドを呼び出し元へ戻す', () => {
    // Arrange
    const codebase: Codebase = { files: [{ id: 'file', path: 'src/a.ts', classes: [
      { id: 'controller', name: 'Controller', methods: [{ id: 'caller', name: 'place', visibility: 'public', fragments: [{ id: 'call', label: 'delegate', lines: 1, responsibility: 'call', uses: ['middle'] }] }] },
      { id: 'manager', name: 'Manager', methods: [{ id: 'middle', name: 'place', visibility: 'public', fragments: [{ id: 'work', label: 'work', lines: 5, responsibility: 'business' }] }] },
    ] }] };
    const steps: SolutionStep[] = [{ inline: { method: 'place', fromClass: 'Manager' } }];

    // Act
    const result = applySolutionSteps(codebase, steps);

    // Assert
    expect(findClass(result, 'manager')?.methods).toEqual([]);
    expect(findClass(result, 'controller')?.methods[0].fragments.map(({ id }) => id)).toEqual(['work']);
  });

  it('extractステップで、選んだ処理を新しいメソッドとして抽出する', () => {
    // Arrange
    const codebase = twoClassCodebase();
    const steps: SolutionStep[] = [{ extract: { from: 'run', fragmentIds: ['f2'], name: 'doY' } }];

    // Act
    const result = applySolutionSteps(codebase, steps);

    // Assert
    const classA = classNamed(result, 'A');
    expect(classA.methods.map((method) => method.name)).toEqual(['run', 'doY']);
  });

  it('moveステップで、メソッドを別クラスへ移す', () => {
    // Arrange
    const codebase = twoClassCodebase();
    const steps: SolutionStep[] = [{ move: { method: 'run', toClass: 'B' } }];

    // Act
    const result = applySolutionSteps(codebase, steps);

    // Assert
    expect(classNamed(result, 'A').methods).toHaveLength(0);
    expect(classNamed(result, 'B').methods.map((method) => method.name)).toEqual(['run']);
  });

  it('moveステップにfromClassを指定すると、同名メソッドのうち指定クラスのものを移す', () => {
    // Arrange
    const withThirdClass: Codebase = {
      files: [...twoClassCodebase().files, { id: 'file-c', path: 'src/c.ts', classes: [{ id: 'class-c', name: 'C', methods: [] }] }],
    };
    const codebase = withMethodsOf(withThirdClass, 'B', [{ id: 'method-run-b', name: 'run', visibility: 'public', fragments: [] }]);
    const steps: SolutionStep[] = [{ move: { method: 'run', fromClass: 'B', toClass: 'C' } }];

    // Act
    const result = applySolutionSteps(codebase, steps);

    // Assert
    expect(classNamed(result, 'B').methods).toHaveLength(0);
    expect(classNamed(result, 'C').methods.map((method) => method.id)).toEqual(['method-run-b']);
  });

  it('moveFieldステップで、指定クラスのフィールドを別クラスへ移す', () => {
    // Arrange
    const codebase = withFieldsOf(twoClassCodebase(), 'A', [{ id: 'field-x', name: 'x', visibility: 'public' }]);
    const steps: SolutionStep[] = [{ moveField: { field: 'x', fromClass: 'A', toClass: 'B' } }];

    // Act
    const result = applySolutionSteps(codebase, steps);

    // Assert
    expect(classNamed(result, 'A').fields).toBeUndefined();
    expect(classNamed(result, 'B').fields?.map((field) => field.name)).toEqual(['x']);
  });

  it('moveFieldステップは別クラスの同名フィールドを動かさない', () => {
    // Arrange
    const withA = withFieldsOf(twoClassCodebase(), 'A', [{ id: 'field-a-x', name: 'x', visibility: 'public' }]);
    const codebase = withFieldsOf(withA, 'B', [{ id: 'field-b-x', name: 'x-unused', visibility: 'public' }]);
    const steps: SolutionStep[] = [{ moveField: { field: 'x', fromClass: 'A', toClass: 'B' } }];

    // Act
    const result = applySolutionSteps(codebase, steps);

    // Assert
    expect(classNamed(result, 'B').fields?.map((field) => field.id)).toEqual(['field-b-x', 'field-a-x']);
  });

  it('changeVisibilityステップで、指定クラスのメソッドだけ可視性を変える(別クラスの同名メソッドは変わらない)', () => {
    // Arrange
    const withA = withMethodsOf(twoClassCodebase(), 'A', [
      { id: 'method-a-run', name: 'run', visibility: 'private', fragments: [{ id: 'f-a', label: 'do', lines: 3, responsibility: 'x' }] },
    ]);
    const codebase: Codebase = {
      files: [
        ...withA.files,
        {
          id: 'file-c',
          path: 'src/c.ts',
          classes: [
            {
              id: 'class-c',
              name: 'C',
              methods: [
                { id: 'method-b-run', name: 'run', visibility: 'private', fragments: [{ id: 'f-c', label: 'do', lines: 3, responsibility: 'x' }] },
                { id: 'method-caller', name: 'caller', visibility: 'public', fragments: [{ id: 'f-caller', label: 'call', lines: 1, responsibility: 'x', uses: ['method-a-run'] }] },
              ],
            },
          ],
        },
      ],
    };
    const steps: SolutionStep[] = [{ changeVisibility: { method: 'run', class: 'A', visibility: 'public' } }];

    // Act
    const result = applySolutionSteps(codebase, steps);

    // Assert
    expect(classNamed(result, 'A').methods.find((method) => method.id === 'method-a-run')?.visibility).toBe('public');
    expect(classNamed(result, 'C').methods.find((method) => method.id === 'method-b-run')?.visibility).toBe('private');
  });

  it('deleteMethodステップで、指定クラスの空実装を削除する', () => {
    // Arrange
    const codebase = withMethodsOf(twoClassCodebase(), 'B', [
      { id: 'method-stub', name: 'stub', visibility: 'public', fragments: [{ id: 'f-stub', label: '未対応', lines: 2, responsibility: 'x', stub: true }] },
    ]);
    const steps: SolutionStep[] = [{ deleteMethod: { method: 'stub', fromClass: 'B' } }];

    // Act
    const result = applySolutionSteps(codebase, steps);

    // Assert
    expect(classNamed(result, 'B').methods).toHaveLength(0);
  });

  it('addFileステップで、新しいファイルを追加する', () => {
    // Arrange
    const codebase = twoClassCodebase();
    const steps: SolutionStep[] = [{ addFile: 'src/new.ts' }];

    // Act
    const result = applySolutionSteps(codebase, steps);

    // Assert
    expect(result.files.map((file) => file.path)).toContain('src/new.ts');
  });

  it('addClassステップで、指定したファイルに新しいクラスを追加する', () => {
    // Arrange
    const codebase = twoClassCodebase();
    const steps: SolutionStep[] = [{ addClass: { name: 'C', file: 'src/a.ts' } }];

    // Act
    const result = applySolutionSteps(codebase, steps);

    // Assert
    expect(allClasses(result).map((codeClass) => codeClass.name)).toContain('C');
  });

  it('moveClassステップで、クラスを別ファイルへ移す', () => {
    // Arrange
    const codebase = twoClassCodebase();
    const steps: SolutionStep[] = [{ addFile: 'src/b.ts' }, { moveClass: { name: 'B', toFile: 'src/b.ts' } }];

    // Act
    const result = applySolutionSteps(codebase, steps);

    // Assert
    const file = result.files.find((candidate) => candidate.path === 'src/b.ts');
    expect(file?.classes.map((codeClass) => codeClass.name)).toEqual(['B']);
  });

  it('deleteFileステップで、指定したパスのファイルを削除する', () => {
    // Arrange
    const codebase = twoClassCodebase();
    const steps: SolutionStep[] = [{ addFile: 'src/b.ts' }, { deleteFile: 'src/b.ts' }];

    // Act
    const result = applySolutionSteps(codebase, steps);

    // Assert
    expect(result.files.map((file) => file.path)).not.toContain('src/b.ts');
  });

  it('setSuperclassステップで、クラスの継承元を名前で設定する', () => {
    // Arrange
    const codebase = twoClassCodebase();
    const steps: SolutionStep[] = [{ setSuperclass: { class: 'A', superclass: 'B' } }];

    // Act
    const result = applySolutionSteps(codebase, steps);

    // Assert
    expect(classNamed(result, 'A').superclassId).toBe('class-b');
  });

  it('addInterfaceステップで、クラスの実装先にインターフェースを名前で追加する', () => {
    // Arrange
    const codebase = twoClassCodebase();
    const steps: SolutionStep[] = [{ addInterface: { class: 'A', interface: 'B' } }];

    // Act
    const result = applySolutionSteps(codebase, steps);

    // Assert
    expect(classNamed(result, 'A').interfaceIds).toEqual(['class-b']);
  });

  it('removeInterfaceステップで、クラスの実装先からインターフェースを外す', () => {
    // Arrange
    const codebase = twoClassCodebase();
    const steps: SolutionStep[] = [{ addInterface: { class: 'A', interface: 'B' } }, { removeInterface: { class: 'A', interface: 'B' } }];

    // Act
    const result = applySolutionSteps(codebase, steps);

    // Assert
    expect(classNamed(result, 'A').interfaceIds).toBeUndefined();
  });

  it('renameClassステップで、クラスの名前を付け替える', () => {
    // Arrange
    const codebase = twoClassCodebase();
    const steps: SolutionStep[] = [{ renameClass: { name: 'A', newName: 'Renamed' } }];

    // Act
    const result = applySolutionSteps(codebase, steps);

    // Assert
    expect(findClass(result, 'class-a')?.name).toBe('Renamed');
  });

  it('setSuperclassステップにsuperclass: nullを指定すると、継承を解除する', () => {
    // Arrange
    const codebase = twoClassCodebase();
    const steps: SolutionStep[] = [{ setSuperclass: { class: 'A', superclass: 'B' } }, { setSuperclass: { class: 'A', superclass: null } }];

    // Act
    const result = applySolutionSteps(codebase, steps);

    // Assert
    expect(classNamed(result, 'A').superclassId).toBeUndefined();
  });

  it('手順を順番に適用する(前の手順の結果に次の手順を重ねる)', () => {
    // Arrange
    const codebase = twoClassCodebase();
    const steps: SolutionStep[] = [
      { extract: { from: 'run', fragmentIds: ['f2'], name: 'doY' } },
      { move: { method: 'doY', toClass: 'B' } },
    ];

    // Act
    const result = applySolutionSteps(codebase, steps);

    // Assert
    expect(classNamed(result, 'A').methods.map((method) => method.name)).toEqual(['run']);
    expect(classNamed(result, 'B').methods.map((method) => method.name)).toEqual(['doY']);
  });
});

describe('sampleAnswerCodebase', () => {
  it('ステージIDに登録された手順を、ステージの初期コードベースに適用する', () => {
    // Arrange
    const stage = { id: 'stage-x', codebase: twoClassCodebase() };
    const steps: Partial<Record<string, readonly SolutionStep[]>> = {
      'stage-x': [{ move: { method: 'run', toClass: 'B' } }],
    };

    // Act
    const result = sampleAnswerCodebase(stage, steps);

    // Assert
    expect(findClass(result, 'class-b')?.methods.map((method) => method.name)).toEqual(['run']);
    expect(findClassOfMethod(result, 'method-run')?.name).toBe('B');
  });

  it('手順が登録されていないステージIDを渡すと例外を投げる', () => {
    // Arrange
    const stage = { id: 'unknown-stage', codebase: twoClassCodebase() };

    // Act
    const act = () => sampleAnswerCodebase(stage, {});

    // Assert
    expect(act).toThrow();
  });
});

describe('solutionSnapshots', () => {
  const steps: SolutionStep[] = [
    { extract: { from: 'run', fragmentIds: ['f2'], name: 'doY' } },
    { move: { method: 'doY', toClass: 'B' } },
  ];

  it('手順が空なら、元のcodebaseだけを返す', () => {
    // Arrange
    const codebase = twoClassCodebase();

    // Act
    const result = solutionSnapshots(codebase, []);

    // Assert
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(codebase);
  });

  it('長さは手順の数+1で、先頭は元のcodebaseそのもの', () => {
    // Arrange
    const codebase = twoClassCodebase();

    // Act
    const result = solutionSnapshots(codebase, steps);

    // Assert
    expect(result).toHaveLength(3);
    expect(result[0]).toBe(codebase);
  });

  it('添字iの要素は、先頭からi手を適用した結果と同じ', () => {
    // Arrange
    const codebase = twoClassCodebase();

    // Act
    const result = solutionSnapshots(codebase, steps);

    // Assert
    expect(result[1]).toEqual(applySolutionSteps(codebase, steps.slice(0, 1)));
    expect(result[2]).toEqual(applySolutionSteps(codebase, steps));
  });

  it('元のcodebaseを変更しない', () => {
    // Arrange
    const codebase = twoClassCodebase();
    const before = structuredClone(codebase);

    // Act
    solutionSnapshots(codebase, steps);

    // Assert
    expect(codebase).toEqual(before);
  });
});
