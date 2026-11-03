/// <reference types="node" />
// node の型をこのテストだけで読み込む(tsconfig.app.json のアプリ全体の types は広げない)。
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { sampleAnswerSteps, solutionSnapshots } from '../stage/sampleAnswer';
import { stages } from '../../infrastructure/stages/stageCatalog';
import { csharpProjectName, expectedBindingLines, generateCSharpProject } from './csharpProject';

/**
 * Vitestで動くエクスポーター。環境変数 CSHARP_EXPORT_DIR があるときだけ、runtime を持つ全ステージのプロジェクトを
 * `<dir>/<stageId>/<00-initial|01|02|…|final>/` に書き出す(通常の `npm test` では何もしない)。
 * scripts/verify-csharp.sh がこの出力をビルド・実行して確かめる。
 *
 * 模範解答の途中・完成形(01…final)は CSHARP_EXPORT_STEPS=1 のときだけ出す。
 * ponytail: 抽出したメソッドの引数・戻り値はまだ付けていないので、途中の形は C# でビルドが通らない。2本目(csharp-extract-dataflow)で常に出すようにする。
 */
const exportDir = process.env.CSHARP_EXPORT_DIR;
const withSteps = process.env.CSHARP_EXPORT_STEPS === '1';
/** 指定があれば、カンマ区切りのステージIDだけを書き出す(開発中に1ステージずつ確かめる用)。 */
const onlyStages = process.env.CSHARP_EXPORT_STAGES?.split(',');

function writeProject(directory: string, files: ReturnType<typeof generateCSharpProject>): void {
  for (const file of files) {
    const target = join(directory, file.path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, file.content, 'utf8');
  }
}

describe.skipIf(exportDir === undefined)('C# プロジェクトの書き出し', () => {
  it('runtime を持つ全ステージの初期状態(と、指定があれば模範解答の各手順)を書き出す', () => {
    // Arrange
    const root = exportDir ?? '';
    rmSync(root, { recursive: true, force: true });
    // Act
    for (const stage of stages) {
      const { runtime } = stage;
      if (runtime === undefined || (onlyStages !== undefined && !onlyStages.includes(stage.id))) continue;
      const solution = sampleAnswerSteps[stage.id] ?? [];
      const snapshots = withSteps ? solutionSnapshots(stage.codebase, solution, { visibilityEnforced: stage.visibilityEnforced }) : [stage.codebase];
      mkdirSync(join(root, stage.id), { recursive: true });
      writeFileSync(join(root, stage.id, 'runtime.json'), JSON.stringify({ expectedBuildFailures: runtime.expectedBuildFailures ?? [], expectedBindings: expectedBindingLines(snapshots[snapshots.length - 1], runtime) }), 'utf8');
      snapshots.forEach((codebase, index) => {
        const name = index === 0 ? '00-initial' : String(index).padStart(2, '0');
        writeProject(join(root, stage.id, name), generateCSharpProject(codebase, runtime, csharpProjectName));
      });
      if (snapshots.length > 1) writeProject(join(root, stage.id, 'final'), generateCSharpProject(snapshots[snapshots.length - 1], runtime, csharpProjectName));
    }
    // Assert: ビルドと実行の検証は scripts/verify-csharp.sh が行う。ここでは書き出せたことだけ確かめる
    expect(existsSync(root)).toBe(true);
  });
});
