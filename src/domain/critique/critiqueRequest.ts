import { fieldsOf, findInterfaces, findSuperclass, isStubMethod, type CodeClass, type Codebase, type Visibility } from '../codebase/Codebase';
import { classLines, fileLines, methodLines } from '../codebase/lineCount';
import { fileDeductions } from '../scoring/fileScores';
import type { Score } from '../scoring/score';
import type { Stage } from '../stage/Stage';

export type CritiqueMethodSummary = {
  readonly name: string;
  readonly visibility: Visibility;
  readonly lines: number;
  /** 空実装(未対応・何もしない)のメソッドのときだけ true にする。 */
  readonly stub?: true;
};

export type CritiqueFieldSummary = { readonly name: string; readonly visibility: Visibility };

export type CritiqueClassSummary = {
  readonly name: string;
  readonly lines: number;
  readonly methods: readonly CritiqueMethodSummary[];
  /** 継承元(extends)のクラス名。無ければ継承なし。 */
  readonly superclassName?: string;
  /** 実装しているインターフェース(implements)のクラス名。1つ以上あるときだけ含める。 */
  readonly interfaceNames?: readonly string[];
  /** クラスのフィールド。1つ以上あるときだけ含める。 */
  readonly fields?: readonly CritiqueFieldSummary[];
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

function interfaceNamesOf(codebase: Codebase, classId: string): readonly string[] | undefined {
  const names = findInterfaces(codebase, classId).map((codeClass) => codeClass.name);
  return names.length === 0 ? undefined : names;
}

function fieldSummariesOf(codeClass: CodeClass): readonly CritiqueFieldSummary[] | undefined {
  const fields = fieldsOf(codeClass).map((field) => ({ name: field.name, visibility: field.visibility }));
  return fields.length === 0 ? undefined : fields;
}

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
      classes: file.classes.map((codeClass): CritiqueClassSummary => {
        const fields = fieldSummariesOf(codeClass);
        return {
          name: codeClass.name,
          lines: classLines(codeClass),
          superclassName: findSuperclass(codebase, codeClass.id)?.name,
          interfaceNames: interfaceNamesOf(codebase, codeClass.id),
          ...(fields === undefined ? {} : { fields }),
          methods: codeClass.methods.map(
            (method): CritiqueMethodSummary => ({
              name: method.name,
              visibility: method.visibility,
              lines: methodLines(method),
              ...(isStubMethod(method) ? { stub: true } : {}),
            }),
          ),
        };
      }),
    }),
  );
  return { goal: stage.goal, score, files };
}
