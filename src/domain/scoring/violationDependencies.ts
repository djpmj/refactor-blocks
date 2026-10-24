import type { Codebase } from '../codebase/Codebase';
import { classDependencies } from '../codebase/dependencies';
import type { Stage } from '../stage/Stage';
import { findLayerViolations } from './layers';
import { findCouplingViolations } from './score';

/** 違反になっている依存(from → to のクラスID)。 */
export type DependencyPair = { readonly from: string; readonly to: string };

export type ViolationDependencies = {
  readonly coupling: readonly DependencyPair[];
  readonly cycle: readonly DependencyPair[];
  readonly layer: readonly DependencyPair[];
};

/** 結合度・循環依存・層の依存の向きの違反を、どの依存(矢印)が原因かで返す。 */
export function violationDependencies(
  codebase: Codebase,
  stage: Pick<Stage, 'dependencyLimit' | 'layers'>,
): ViolationDependencies {
  const dependencies = classDependencies(codebase);
  const crowded = new Set(findCouplingViolations(dependencies, stage.dependencyLimit));
  return {
    coupling: dependencies.filter(({ from }) => crowded.has(from)).map(({ from, to }) => ({ from, to })),
    cycle: dependencies.filter(({ cyclic }) => cyclic).map(({ from, to }) => ({ from, to })),
    layer: findLayerViolations(codebase, stage.layers).map(({ fromClassId, toClassId }) => ({ from: fromClassId, to: toClassId })),
  };
}
