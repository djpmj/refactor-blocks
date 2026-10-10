import { describe, expect, it } from 'vitest';
import { allClasses, type CodeClass, type Codebase } from '../codebase/Codebase';
import { extractMethod } from '../codebase/extractMethod';
import { moveMethod } from '../codebase/moveMethod';
import { sampleCodebase } from '../codebase/testFixtures';
import type { Result } from '../shared/Result';
import { scoreCodebase } from './score';

/** クラスAがクラスBのprivateメソッドを呼ぶだけの最小のコードベース。 */
function codebaseWithPrivateCallAcrossClasses(): Codebase {
  return {
    files: [
      {
        id: 'file',
        path: 'src/all.ts',
        classes: [
          {
            id: 'class-A',
            name: 'A',
            fields: [{ id: 'field-A', name: 'value', visibility: 'private' }],
            methods: [
              {
                id: 'method-A',
                name: 'run',
                visibility: 'public',
                fragments: [{ id: 'f-a', label: 'call', lines: 1, responsibility: 'call', uses: ['method-B'] }],
              },
            ],
          },
          {
            id: 'class-B',
            name: 'B',
            fields: [{ id: 'field-B', name: 'value', visibility: 'private' }],
            methods: [{ id: 'method-B', name: 'helper', visibility: 'private', fragments: [] }],
          },
        ],
      },
    ],
  };
}

function unwrap<T, E>(result: Result<T, E>): T {
  if (!result.ok) throw new Error(`操作に失敗しました: ${String(result.error)}`);
  return result.value;
}

const LOOSE = { limits: { method: 100, class: 100, file: 100 }, responsibilityLimit: 100 };

/** 各クラスに「uses だけを持つ1行の処理」を1つ置いたコードベース。 */
function codebaseOf(classes: Record<string, readonly string[]>): Codebase {
  const codeClasses: CodeClass[] = Object.entries(classes).map(([name, uses]) => ({
    id: `class-${name}`,
    name,
    fields: [{ id: `field-${name}`, name: 'value', visibility: 'private' }],
    methods: [
      {
        id: `method-${name}`,
        name: 'run',
        visibility: 'public',
        fragments: [{ id: `f-${name}`, label: name, lines: 1, responsibility: 'call', uses }],
      },
    ],
  }));
  return { files: [{ id: 'file', path: 'src/all.ts', classes: codeClasses }] };
}

describe('scoreCodebase', () => {
  it('違反がなければ100点で、全ルールとも減点0件を返す', () => {
    // Arrange
    const codebase = codebaseOf({ A: ['method-B'], B: [] });

    // Act
    const score = scoreCodebase(codebase, { ...LOOSE, dependencyLimit: 1 });

    // Assert
    expect(score).toEqual({
      total: 100,
      deductions: [
        { rule: 'line-limit', count: 0, points: 0 },
        { rule: 'coupling', count: 0, points: 0 },
        { rule: 'cycle', count: 0, points: 0 },
        { rule: 'responsibility', count: 0, points: 0 },
        { rule: 'visibility', count: 0, points: 0 },
        { rule: 'empty', count: 0, points: 0 },
        { rule: 'unused', count: 0, points: 0 },
        { rule: 'lone-superclass', count: 0, points: 0 },
        { rule: 'stub', count: 0, points: 0 },
        { rule: 'contract', count: 0, points: 0 },
        { rule: 'feature-envy', count: 0, points: 0 },
        { rule: 'encapsulation', count: 0, points: 0 },
        { rule: 'cohesion', count: 0, points: 0 },
        { rule: 'trivial-method', count: 0, points: 0 },
        { rule: 'thin-class', count: 0, points: 0 },
        { rule: 'middle-man', count: 0, points: 0 },
        { rule: 'layer', count: 0, points: 0 },
      ],
    });
  });

  it('横流しだけのクラス1つにつき10点減点する', () => {
    // Arrange
    const codebase: Codebase = { files: [{ id: 'file', path: 'src/a.ts', classes: [
      { id: 'manager', name: 'Manager', methods: [{ id: 'forward', name: 'forward', visibility: 'public', fragments: [{ id: 'call', label: 'delegate', lines: 1, responsibility: 'call', uses: ['work'] }] }] },
      { id: 'service', name: 'Service', methods: [{ id: 'work', name: 'work', visibility: 'public', fragments: [{ id: 'business', label: 'work', lines: 5, responsibility: 'business' }] }] },
    ] }] };

    // Act
    const score = scoreCodebase(codebase, { ...LOOSE, dependencyLimit: 10 });

    // Assert
    expect(score.total).toBe(90);
    expect(score.deductions.find(({ rule }) => rule === 'middle-man')).toEqual({ rule: 'middle-man', count: 1, points: 10 });
  });

  it('行数の上限違反1件につき10点減点する', () => {
    // Arrange
    const codebase = sampleCodebase();

    // Act
    const score = scoreCodebase(codebase, { ...LOOSE, limits: { method: 20, class: 100, file: 27 }, dependencyLimit: 1 });

    // Assert(空の TaxCalculator の10点も引かれる)
    expect(score.total).toBe(70);
    expect(score.deductions[0]).toEqual({ rule: 'line-limit', count: 2, points: 20 });
  });

  it('依存先クラス数が上限を超えたクラス1つにつき10点減点する', () => {
    // Arrange
    const codebase = codebaseOf({ A: ['method-B', 'method-C'], B: [], C: [] });

    // Act
    const score = scoreCodebase(codebase, { ...LOOSE, dependencyLimit: 1 });

    // Assert
    expect(score.total).toBe(90);
    expect(score.deductions[1]).toEqual({ rule: 'coupling', count: 1, points: 10 });
  });

  it('依存先クラス数がちょうど上限なら減点しない', () => {
    // Arrange
    const codebase = codebaseOf({ A: ['method-B'], B: [] });

    // Act
    const score = scoreCodebase(codebase, { ...LOOSE, dependencyLimit: 1 });

    // Assert
    expect(score.deductions[1]).toEqual({ rule: 'coupling', count: 0, points: 0 });
  });

  it('循環している依存1本につき10点減点する', () => {
    // Arrange
    const codebase = codebaseOf({ A: ['method-B'], B: ['method-A'] });

    // Act
    const score = scoreCodebase(codebase, { ...LOOSE, dependencyLimit: 1 });

    // Assert
    expect(score.total).toBe(80);
    expect(score.deductions[2]).toEqual({ rule: 'cycle', count: 2, points: 20 });
  });

  it('責務の種類数が上限を超えたクラス1つにつき10点減点する', () => {
    // Arrange
    const codebase = sampleCodebase();

    // Act
    const score = scoreCodebase(codebase, { ...LOOSE, dependencyLimit: 1, responsibilityLimit: 2 });

    // Assert(空の TaxCalculator の10点も引かれる)
    expect(score.total).toBe(80);
    expect(score.deductions[3]).toEqual({ rule: 'responsibility', count: 1, points: 10 });
  });

  it('visibilityEnforced が未指定なら、越境した private メソッド呼び出しがあっても減点しない', () => {
    // Arrange
    const codebase = codebaseWithPrivateCallAcrossClasses();

    // Act
    const score = scoreCodebase(codebase, { ...LOOSE, dependencyLimit: 1 });

    // Assert
    expect(score.deductions[4]).toEqual({ rule: 'visibility', count: 0, points: 0 });
  });

  it('visibilityEnforced: true のとき、越境した private メソッド呼び出し1件につき10点減点する', () => {
    // Arrange
    const codebase = codebaseWithPrivateCallAcrossClasses();

    // Act
    const score = scoreCodebase(codebase, { ...LOOSE, dependencyLimit: 1, visibilityEnforced: true });

    // Assert
    expect(score.total).toBe(90);
    expect(score.deductions[4]).toEqual({ rule: 'visibility', count: 1, points: 10 });
  });

  it('Extract Method で作った private メソッドを Move Method で別クラスへ移すと、越境呼び出しとして検出される', () => {
    // Arrange
    const codebase: Codebase = {
      files: [
        {
          id: 'file',
          path: 'src/all.ts',
          classes: [
            {
              id: 'class-A',
              name: 'A',
              methods: [
                {
                  id: 'method-A',
                  name: 'run',
                  visibility: 'public',
                  fragments: [
                    { id: 'f-a', label: 'do', lines: 1, responsibility: 'work' },
                    { id: 'f-b', label: 'other', lines: 1, responsibility: 'other' },
                  ],
                },
              ],
            },
            { id: 'class-B', name: 'B', methods: [] },
          ],
        },
      ],
    };
    const extracted = unwrap(
      extractMethod(codebase, { sourceMethodId: 'method-A', fragmentIds: ['f-a'], newMethodId: 'method-extracted', newMethodName: 'helper' }),
    );
    const moved = unwrap(moveMethod(extracted, 'method-extracted', 'class-B'));

    // Act
    const score = scoreCodebase(moved, { ...LOOSE, dependencyLimit: 1, visibilityEnforced: true });

    // Assert
    expect(score.deductions[4]).toEqual({ rule: 'visibility', count: 1, points: 10 });
  });

  it('メソッドのないクラス・クラスのないファイル1つにつき10点減点する', () => {
    // Arrange
    const codebase: Codebase = {
      files: [
        { id: 'file', path: 'src/all.ts', classes: [{ id: 'class-empty', name: 'Empty', methods: [] }] },
        { id: 'file-empty', path: 'src/empty.ts', classes: [] },
      ],
    };

    // Act
    const score = scoreCodebase(codebase, { ...LOOSE, dependencyLimit: 1 });

    // Assert
    expect(score.total).toBe(80);
    expect(score.deductions[5]).toEqual({ rule: 'empty', count: 2, points: 20 });
  });

  it('どこからも呼ばれていない private メソッド1つにつき10点減点する', () => {
    // Arrange
    const codebase: Codebase = {
      files: [
        {
          id: 'file',
          path: 'src/all.ts',
          classes: [
            {
              id: 'class-A',
              name: 'A',
              methods: [
                { id: 'method-run', name: 'run', visibility: 'public', fragments: [{ id: 'f-run', label: 'do', lines: 3, responsibility: 'x' }] },
                { id: 'method-dead', name: 'dead', visibility: 'private', fragments: [] },
              ],
            },
          ],
        },
      ],
    };

    // Act
    const score = scoreCodebase(codebase, { ...LOOSE, dependencyLimit: 1 });

    // Assert
    expect(score.total).toBe(90);
    expect(score.deductions[6]).toEqual({ rule: 'unused', count: 1, points: 10 });
  });

  it('extends の子が1つだけの基底クラス1つにつき10点減点する', () => {
    // Arrange
    const [base, child] = allClasses(codebaseOf({ Base: [], Child: [] }));
    const codebase: Codebase = { files: [{ id: 'file', path: 'src/all.ts', classes: [base, { ...child, superclassId: base.id }] }] };

    // Act
    const score = scoreCodebase(codebase, { ...LOOSE, dependencyLimit: 1 });

    // Assert
    expect(score.total).toBe(90);
    expect(score.deductions[7]).toEqual({ rule: 'lone-superclass', count: 1, points: 10 });
  });

  it('空実装のメソッド1つにつき10点減点する', () => {
    // Arrange
    const codebase: Codebase = {
      files: [
        {
          id: 'file',
          path: 'src/all.ts',
          classes: [
            {
              id: 'class-a',
              name: 'A',
              methods: [{ id: 'method-a', name: 'run', visibility: 'public', fragments: [{ id: 'f-a', label: '未対応', lines: 2, responsibility: 'x', stub: true }] }],
            },
          ],
        },
      ],
    };

    // Act
    const score = scoreCodebase(codebase, { ...LOOSE, dependencyLimit: 1 });

    // Assert
    expect(score.total).toBe(90);
    expect(score.deductions[8]).toEqual({ rule: 'stub', count: 1, points: 10 });
  });

  it('約束違反(実装漏れ)1件につき10点減点する', () => {
    // Arrange
    const codebase: Codebase = {
      files: [
        {
          id: 'file',
          path: 'src/all.ts',
          classes: [
            { id: 'class-i', name: 'I', methods: [{ id: 'method-i-run', name: 'run', visibility: 'public', fragments: [] }] },
            {
              id: 'class-c',
              name: 'C',
              interfaceIds: ['class-i'],
              methods: [{ id: 'method-other', name: 'other', visibility: 'public', fragments: [{ id: 'f-other', label: 'do', lines: 3, responsibility: 'x' }] }],
            },
          ],
        },
      ],
    };

    // Act
    const score = scoreCodebase(codebase, { ...LOOSE, dependencyLimit: 1 });

    // Assert
    expect(score.total).toBe(90);
    expect(score.deductions[9]).toEqual({ rule: 'contract', count: 1, points: 10 });
  });

  it('Feature Envy 1件につき10点減点する', () => {
    // Arrange
    const codebase: Codebase = {
      files: [
        {
          id: 'file',
          path: 'src/all.ts',
          classes: [
            {
              id: 'class-a',
              name: 'A',
              methods: [
                {
                  id: 'method-a',
                  name: 'run',
                  visibility: 'public',
                  fragments: [{ id: 'f-a', label: 'do', lines: 3, responsibility: 'x', reads: ['field-b1', 'field-b2'] }],
                },
              ],
            },
            {
              id: 'class-b',
              name: 'B',
              methods: [],
              fields: [
                { id: 'field-b1', name: 'b1', visibility: 'public' },
                { id: 'field-b2', name: 'b2', visibility: 'public' },
              ],
            },
          ],
        },
      ],
    };

    // Act
    const score = scoreCodebase(codebase, { ...LOOSE, dependencyLimit: 1 });

    // Assert
    expect(score.total).toBe(90);
    expect(score.deductions[10]).toEqual({ rule: 'feature-envy', count: 1, points: 10 });
  });

  it('外からのフィールド書き換え1件につき10点減点する', () => {
    // Arrange
    const codebase: Codebase = {
      files: [
        {
          id: 'file',
          path: 'src/all.ts',
          classes: [
            {
              id: 'class-a',
              name: 'A',
              methods: [
                {
                  id: 'method-a',
                  name: 'run',
                  visibility: 'public',
                  fragments: [{ id: 'f-a', label: 'do', lines: 3, responsibility: 'x', writes: ['field-b1'] }],
                },
              ],
            },
            { id: 'class-b', name: 'B', methods: [], fields: [{ id: 'field-b1', name: 'b1', visibility: 'public' }] },
          ],
        },
      ],
    };

    // Act
    const score = scoreCodebase(codebase, { ...LOOSE, dependencyLimit: 1 });

    // Assert
    expect(score.total).toBe(90);
    expect(score.deductions[11]).toEqual({ rule: 'encapsulation', count: 1, points: 10 });
  });

  it('公開されたsetter1つにつき10点減点する(encapsulationに数える)', () => {
    // Arrange
    const codebase: Codebase = {
      files: [
        {
          id: 'file',
          path: 'src/all.ts',
          classes: [
            {
              id: 'class-a',
              name: 'A',
              fields: [{ id: 'field-a1', name: 'a1', visibility: 'private' }],
              methods: [
                {
                  id: 'method-set',
                  name: 'setA1',
                  visibility: 'public',
                  fragments: [{ id: 'f-set', label: 'set', lines: 1, responsibility: 'accessor', accessor: true, writes: ['field-a1'] }],
                },
              ],
            },
          ],
        },
      ],
    };

    // Act
    const score = scoreCodebase(codebase, { ...LOOSE, dependencyLimit: 1 });

    // Assert
    expect(score.total).toBe(90);
    expect(score.deductions[11]).toEqual({ rule: 'encapsulation', count: 1, points: 10 });
  });

  it('フィールドを共有しないメソッドの塊が同居するクラス1つにつき10点減点する(cohesion)', () => {
    // Arrange
    const codebase: Codebase = {
      files: [
        {
          id: 'file',
          path: 'src/all.ts',
          classes: [
            {
              id: 'class-a',
              name: 'A',
              fields: [
                { id: 'field-pay', name: 'pay', visibility: 'private' },
                { id: 'field-city', name: 'city', visibility: 'private' },
              ],
              methods: [
                { id: 'method-pay', name: 'calcPay', visibility: 'public', fragments: [{ id: 'f-pay', label: 'pay', lines: 3, responsibility: 'a', reads: ['field-pay'] }] },
                { id: 'method-city', name: 'formatCity', visibility: 'public', fragments: [{ id: 'f-city', label: 'city', lines: 3, responsibility: 'a', reads: ['field-city'] }] },
              ],
            },
          ],
        },
      ],
    };

    // Act
    const score = scoreCodebase(codebase, { ...LOOSE, dependencyLimit: 1 });

    // Assert
    expect(score.total).toBe(90);
    expect(score.deductions.find((deduction) => deduction.rule === 'cohesion')).toEqual({ rule: 'cohesion', count: 1, points: 10 });
  });

  it('減点の合計が100点を超えても0点で止まる', () => {
    // Arrange
    const codebase = codebaseOf({ A: ['method-B'], B: ['method-C'], C: ['method-A'] });

    // Act
    const score = scoreCodebase(codebase, { limits: { method: 0, class: 0, file: 0 }, dependencyLimit: 0, responsibilityLimit: 0 });

    // Assert
    expect(score.total).toBe(0);
  });

  it('極小メソッドと役割の薄い極小クラスを別々に10点減点する', () => {
    // Arrange
    const codebase: Codebase = {
      files: [{ id: 'file', path: 'src/file.ts', classes: [{
        id: 'class', name: 'Tiny', methods: [{
          id: 'method', name: 'run', visibility: 'public',
          fragments: [{ id: 'fragment', label: 'work', lines: 1, responsibility: 'work' }],
        }],
      }] }],
    };

    // Act
    const score = scoreCodebase(codebase, { ...LOOSE, dependencyLimit: 1 });

    // Assert
    expect(score.total).toBe(80);
    expect(score.deductions.filter(({ rule }) => rule === 'trivial-method' || rule === 'thin-class')).toEqual([
      { rule: 'trivial-method', count: 1, points: 10 },
      { rule: 'thin-class', count: 1, points: 10 },
    ]);
  });

  it('layers があるステージで層を飛ばす依存が1件なら、layer を10点減点する', () => {
    // Arrange
    const codebase: Codebase = {
      files: [{ id: 'file', path: 'src/all.ts', classes: [
        { id: 'class-c', name: 'C', methods: [{ id: 'method-c', name: 'run', visibility: 'public',
          fragments: [{ id: 'f-c', label: 'c', lines: 1, responsibility: 'http', uses: ['method-r'] }] }] },
        { id: 'class-r', name: 'R', methods: [{ id: 'method-r', name: 'save', visibility: 'public',
          fragments: [{ id: 'f-r', label: 'r', lines: 1, responsibility: 'persistence' }] }] },
      ] }],
    };
    const layers = [
      { name: 'Controller', responsibilities: ['http'] },
      { name: 'Service', responsibilities: ['rule'] },
      { name: 'Repository', responsibilities: ['persistence'] },
    ];

    // Act
    const withLayers = scoreCodebase(codebase, { ...LOOSE, dependencyLimit: 5, layers });
    const withoutLayers = scoreCodebase(codebase, { ...LOOSE, dependencyLimit: 5 });

    // Assert
    expect(withLayers.deductions.at(-1)).toEqual({ rule: 'layer', count: 1, points: 10 });
    expect(withLayers.total).toBe(withoutLayers.total - 10);
  });
});
