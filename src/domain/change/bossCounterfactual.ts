import { allClasses } from '../codebase/Codebase';
import { classLines } from '../codebase/lineCount';
import type { Stage } from '../stage/Stage';
import type { ChangeRequest } from './ChangeRequest';
import { measurePlacement } from './measurePlacement';
import { sampleImplementation } from './sampleImplementation';

/** ボスを組み替える前のコードに入れていたら。解答例(最善の置き方)で測る。 */
export type BossCounterfactual = {
  /** 組み替える前のコードでの、最善の置き方の点数(sampleImplementation の score)。 */
  readonly score: number;
  /** その置き方で書き換わる既存クラスの名前。 */
  readonly modifiedClassNames: readonly string[];
  /** その置き方のあとで、クラスの行数の上限(stage.limits.class)を超えるクラスの名前。 */
  readonly overLimitClassNames: readonly string[];
};

/** request が boss でない、または組み替える前のコードに置き先が無ければ undefined。 */
export function bossCounterfactual(stage: Pick<Stage, 'codebase' | 'limits'>, request: ChangeRequest): BossCounterfactual | undefined {
  if (request.boss !== true) return undefined;
  const sample = sampleImplementation(stage.codebase, request);
  if (sample === undefined) return undefined;
  const placement = measurePlacement(stage.codebase, sample.codebase, request);
  if (!placement.ok) return undefined;
  const modified = new Set(placement.value.modifiedClassIds);
  return {
    score: sample.score,
    modifiedClassNames: allClasses(stage.codebase).filter((codeClass) => modified.has(codeClass.id)).map((codeClass) => codeClass.name),
    overLimitClassNames: allClasses(sample.codebase)
      .filter((codeClass) => classLines(codeClass, sample.codebase) > stage.limits.class)
      .map((codeClass) => codeClass.name),
  };
}
