import type { Codebase, Visibility } from '../codebase/Codebase';
import { classLines, fileLines, methodLines } from '../codebase/lineCount';
import { fileDeductions } from '../scoring/fileScores';
import type { Score } from '../scoring/score';
import type { Stage } from '../stage/Stage';

export type CritiqueMethodSummary = {
  readonly name: string;
  readonly visibility: Visibility;
  readonly lines: number;
};

export type CritiqueClassSummary = {
  readonly name: string;
  readonly lines: number;
  readonly methods: readonly CritiqueMethodSummary[];
};

export type CritiqueFileSummary = {
  readonly path: string;
  readonly lines: number;
  readonly deductionPoints: number;
  readonly classes: readonly CritiqueClassSummary[];
};

/** AI講評に渡す入力データ。メソッドの中の処理(Fragmentの中身)は含めず、構造だけを渡す。 */
export type CritiqueRequest = {
  readonly goal: string;
  readonly score: Score;
  readonly files: readonly CritiqueFileSummary[];
};

/** ファイル・クラス・メソッドの構成と採点結果を、AI講評に渡せる形にまとめる。 */
export function buildCritiqueRequest(
  codebase: Codebase,
  stage: Pick<Stage, 'goal' | 'limits' | 'dependencyLimit' | 'responsibilityLimit'>,
  score: Score,
): CritiqueRequest {
  const deductionsByFile = fileDeductions(codebase, stage);
  const files = codebase.files.map(
    (file): CritiqueFileSummary => ({
      path: file.path,
      lines: fileLines(file),
      deductionPoints: deductionsByFile.get(file.id) ?? 0,
      classes: file.classes.map(
        (codeClass): CritiqueClassSummary => ({
          name: codeClass.name,
          lines: classLines(codeClass),
          methods: codeClass.methods.map(
            (method): CritiqueMethodSummary => ({
              name: method.name,
              visibility: method.visibility,
              lines: methodLines(method),
            }),
          ),
        }),
      ),
    }),
  );
  return { goal: stage.goal, score, files };
}
