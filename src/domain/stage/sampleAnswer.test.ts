import { describe, expect, it } from 'vitest';
import { allClasses, findClass, findClassOfMethod, type Codebase } from '../codebase/Codebase';
import { applySolutionSteps, sampleAnswerCodebase, type SolutionStep } from './sampleAnswer';

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

describe('applySolutionSteps', () => {
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

  it('setSuperclassステップで、クラスの継承元を名前で設定する', () => {
    // Arrange
    const codebase = twoClassCodebase();
    const steps: SolutionStep[] = [{ setSuperclass: { class: 'A', superclass: 'B' } }];

    // Act
    const result = applySolutionSteps(codebase, steps);

    // Assert
    expect(classNamed(result, 'A').superclassId).toBe('class-b');
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
