import { describe, expect, it } from 'vitest';
import type { Codebase } from '../../domain/codebase/Codebase';
import type { SolutionStep } from '../../domain/stage/sampleAnswer';
import type { Stage, StageLevel } from '../../domain/stage/Stage';
import { stages } from './stageCatalog';
import { renderStageReport, stageReportRows } from './stageReport';

type Options = {
  readonly id: string;
  readonly level?: StageLevel;
  /** 行数超過のメソッドの数。1つにつき10点引かれる。 */
  readonly violations?: number;
  readonly kinds?: readonly ('modify' | 'extend')[];
  readonly title?: string;
};

/** メソッドが violations 個あるステージ。各メソッドが行数上限を超えるので、初期点は 100 - 10 * violations になる。 */
function makeStage({ id, level = 'beginner', violations = 1, kinds = ['modify'], title = id }: Options): Stage {
  const count = Math.max(violations, 1);
  const methods = Array.from({ length: count }, (_, index) => ({
    id: `${id}-m${index}`,
    name: `m${index}`,
    visibility: 'public' as const,
    fragments: [{ id: `${id}-f${index}`, label: 'f', lines: index < violations ? 30 : 1, responsibility: 'a' }],
  }));
  const codebase: Codebase = { files: [{ id: `${id}-file`, path: 'A.cs', classes: [{ id: `${id}-class`, name: 'A', methods }] }] };
  return {
    id,
    level,
    title,
    why: '',
    goal: '',
    description: '',
    learns: [],
    checks: [],
    limits: { method: 20, class: 10000, file: 10000 },
    dependencyLimit: 5,
    responsibilityLimit: 5,
    codebase,
    changeRequests: kinds.map((kind, index) => ({ id: `${id}-r${index}`, title: 't', description: 'd', responsibility: 'a', linesPerSite: 1, kind })),
  };
}

function stepsOf(count: number): readonly SolutionStep[] {
  return Array.from({ length: count }, () => ({ move: { method: 'm0', toClass: 'A' } }));
}

function warningsOf(stage: Stage, solutions: Record<string, readonly SolutionStep[]>): readonly string[] {
  return stageReportRows([stage], solutions)[0]?.warnings ?? [];
}

describe('stageReportRows', () => {
  it('初期点・規模・最長メソッドの行数を初期コードから計算する', () => {
    // Arrange
    const stage = makeStage({ id: 's', violations: 2, kinds: ['modify', 'modify', 'extend'] });

    // Act
    const [row] = stageReportRows([stage], {});

    // Assert
    expect(row).toMatchObject({
      stageId: 's',
      initialScore: 80,
      files: 1,
      classes: 1,
      methods: 2,
      longestMethodLines: 32,
      modifyRequests: 2,
      extendRequests: 1,
    });
  });

  it('主な減点は点数の大きい順に最大3つ', () => {
    // Arrange
    const base = makeStage({ id: 's', violations: 3 });
    const mixed: Stage = {
      ...base,
      responsibilityLimit: 1,
      codebase: {
        files: [
          {
            id: 'f',
            path: 'B.cs',
            classes: [
              {
                id: 'c',
                name: 'B',
                methods: [
                  {
                    id: 'bm',
                    name: 'bm',
                    visibility: 'public',
                    fragments: [
                      { id: 'x1', label: 'x', lines: 30, responsibility: 'p' },
                      { id: 'x2', label: 'x', lines: 1, responsibility: 'q' },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    };

    // Act
    const rows = stageReportRows([base, mixed], {});

    // Assert
    expect(rows[0].topDeductions).toEqual(['行数 -30']);
    expect(rows[1].topDeductions).toEqual(['行数 -10', '責務の混在 -10']);
  });

  it('減点が4種類以上あっても3つまでにする', () => {
    // Arrange
    const base = makeStage({ id: 's', violations: 1 });
    const method = (id: string) => ({
      id,
      name: id,
      visibility: 'private' as const,
      fragments: [
        { id: `${id}-1`, label: 'x', lines: 30, responsibility: 'p' },
        { id: `${id}-2`, label: 'x', lines: 1, responsibility: 'q' },
      ],
    });
    const stage: Stage = {
      ...base,
      responsibilityLimit: 1,
      codebase: {
        files: [
          { id: 'f', path: 'B.cs', classes: [{ id: 'c', name: 'B', methods: [method('u1'), method('u2')] }] },
          { id: 'g', path: 'C.cs', classes: [{ id: 'd', name: 'C', methods: [] }] },
        ],
      },
    };

    // Act
    const [row] = stageReportRows([stage], {});

    // Assert
    expect(row.topDeductions).toHaveLength(3);
  });

  it('手数と使う操作は渡した手順から出て、操作は重複なく出てくる順', () => {
    // Arrange
    const stage = makeStage({ id: 's' });
    const steps: readonly SolutionStep[] = [
      { extract: { from: 'm0', fragmentIds: ['s-f0'], name: 'n' } },
      { move: { method: 'n', toClass: 'B' } },
      { extract: { from: 'm0', fragmentIds: ['s-f0'], name: 'o' } },
      { setSuperclass: { class: 'B', superclass: 'A' } },
    ];

    // Act
    const [row] = stageReportRows([stage], { s: steps });

    // Assert
    expect(row.steps).toBe(4);
    expect(row.operations).toEqual(['抽出', '移動', '継承']);
  });

  it('手順が無いステージは steps が undefined で「解答が未登録」になる', () => {
    // Arrange
    const stage = makeStage({ id: 's' });

    // Act
    const [row] = stageReportRows([stage], {});

    // Assert
    expect(row.steps).toBeUndefined();
    expect(row.warnings).toContain('解答が未登録');
  });

  it('初期点が80以上で「初期点が高い」が付き、70では付かない', () => {
    // Arrange
    const high = makeStage({ id: 'high', violations: 2 });
    const low = makeStage({ id: 'low', violations: 3 });

    // Act
    const highWarnings = warningsOf(high, { high: stepsOf(1) });
    const lowWarnings = warningsOf(low, { low: stepsOf(1) });

    // Assert
    expect(highWarnings).toContain('初期点が高い');
    expect(lowWarnings).not.toContain('初期点が高い');
  });

  it('手数の上限をレベルごとに判定する(初級は8手まで、チュートリアルは3手まで)', () => {
    // Arrange
    const nine = makeStage({ id: 'nine', violations: 3 });
    const eight = makeStage({ id: 'eight', violations: 3 });
    const tutorial = makeStage({ id: 'tut', level: 'tutorial', violations: 3 });

    // Act
    const nineWarnings = warningsOf(nine, { nine: stepsOf(9) });
    const eightWarnings = warningsOf(eight, { eight: stepsOf(8) });
    const tutorialWarnings = warningsOf(tutorial, { tut: stepsOf(4) });

    // Assert
    expect(nineWarnings).toContain('手数が多い');
    expect(eightWarnings).not.toContain('手数が多い');
    expect(tutorialWarnings).toContain('手数が多い');
  });

  it('レベルの手数の中央値が前のレベルより小さいとき、そのレベルの先頭のステージにだけ注意が付く', () => {
    // Arrange
    const list = [
      makeStage({ id: 'b1', level: 'beginner', violations: 3 }),
      makeStage({ id: 'i1', level: 'intermediate', violations: 3 }),
      makeStage({ id: 'i2', level: 'intermediate', violations: 3 }),
    ];
    const solutions = { b1: stepsOf(5), i1: stepsOf(2), i2: stepsOf(3) };
    const message = 'レベルの中央値の手数が前のレベルより少ない';

    // Act
    const rows = stageReportRows(list, solutions);

    // Assert
    expect(rows.map((row) => row.warnings.includes(message))).toEqual([false, true, false]);
  });

  it('中央値が前のレベル以上なら注意は付かない', () => {
    // Arrange
    const list = [makeStage({ id: 'b1', violations: 3 }), makeStage({ id: 'i1', level: 'intermediate', violations: 3 })];

    // Act
    const rows = stageReportRows(list, { b1: stepsOf(3), i1: stepsOf(3) });

    // Assert
    expect(rows.flatMap((row) => row.warnings)).toEqual([]);
  });

  it('modify の依頼が0件なら「依頼が機能追加だけ」が付く', () => {
    // Arrange
    const stage = makeStage({ id: 's', violations: 3, kinds: ['extend'] });

    // Act
    const warnings = warningsOf(stage, { s: stepsOf(1) });

    // Assert
    expect(warnings).toEqual(['依頼が機能追加だけ']);
  });
});

describe('renderStageReport', () => {
  const list = [makeStage({ id: 'a', violations: 3, title: 'A | B' }), makeStage({ id: 'b', level: 'advanced', violations: 3 })];
  const solutions = { a: stepsOf(1), b: stepsOf(2) };
  const output = renderStageReport(stageReportRows(list, solutions));

  it('先頭に生成の注記と見出しがある', () => {
    // Arrange
    const expected = '<!-- このファイルは npm run stage-report で生成する。手で編集しない -->\n\n# ステージ一覧表\n';

    // Act
    const head = output.slice(0, expected.length);

    // Assert
    expect(head).toBe(expected);
  });

  it('1ステージ1行で、列は表の順に並び、セル内の | はエスケープする', () => {
    // Arrange
    const lines = output.split('\n');

    // Act
    const header = lines.find((line) => line.startsWith('| ステージ'));
    const bodyRows = lines.filter((line) => line.startsWith('| A') || line.startsWith('| b'));

    // Assert
    expect(header).toBe('| ステージ | レベル | 初期点 | 主な減点 | 手数 | 使う操作 | 規模 | 最長メソッド | 依頼 | 注意 |');
    expect(bodyRows).toEqual([
      '| A \\| B | 初級 | 70 | 行数 -30 | 1 | 移動 | 1ファイル / 1クラス / 3メソッド | 32 | ルール変更 1 / 機能追加 0 |  |',
      '| b | 上級 | 70 | 行数 -30 | 2 | 移動 | 1ファイル / 1クラス / 3メソッド | 32 | ルール変更 1 / 機能追加 0 |  |',
    ]);
  });

  it('レベルごとの集計の表がある', () => {
    // Arrange
    const expected = ['| レベル | ステージ数 | 手数の中央値 | 初期点の平均 |', '| 初級 | 1 | 1 | 70 |', '| 上級 | 1 | 2 | 70 |'];

    // Act
    const lines = output.split('\n');

    // Assert
    for (const line of expected) expect(lines).toContain(line);
  });

  it('同じ入力なら同じ出力になる(日時を含まない)', () => {
    // Arrange
    const rows = stageReportRows(list, solutions);

    // Act
    const again = renderStageReport(rows);

    // Assert
    expect(again).toBe(output);
  });
});

describe('docs/stages/report.md', () => {
  it('ステージ定義から生成した表と一致する(古ければ npm run stage-report で更新する)', async () => {
    // Arrange
    const report = renderStageReport(stageReportRows(stages));

    // Act / Assert
    await expect(report).toMatchFileSnapshot('../../../docs/stages/report.md');
  });
});
