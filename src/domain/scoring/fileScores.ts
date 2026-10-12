import type { Codebase } from "../codebase/Codebase";
import { classDependencies } from "../codebase/dependencies";
import type { Stage } from "../stage/Stage";
import type { ScoreRule } from './score';
import { findLowCohesionClasses } from "./cohesion";
import { findMiddleManClasses } from "./middleMan";
import { findEncapsulationViolations, findFeatureEnvy, findOpenSetters } from "./fieldAccess";
import { findContractViolations, findStubMethods } from "./interfaceContracts";
import { findEmptyContainers, findUnusedPrivateMethods } from "./leftovers";
import { findLineLimitViolations } from "./lineLimits";
import { findLoneSuperclasses } from "./loneSuperclass";
import { findResponsibilityViolations } from "./responsibilities";
import { findThinClasses, findTrivialMethods } from "./overExtraction";
import { findCouplingViolations, POINTS_PER_VIOLATION } from "./score";
import { countedVisibilityViolations } from "./visibility";

/** メソッド・クラス・ファイルのIDから、それが属するファイルのIDを引く。 */
function fileIdByTargetId(codebase: Codebase): Map<string, string> {
  const owners = new Map<string, string>();
  for (const file of codebase.files) {
    owners.set(file.id, file.id);
    for (const codeClass of file.classes) {
      owners.set(codeClass.id, file.id);
      for (const method of codeClass.methods) owners.set(method.id, file.id);
    }
  }
  return owners;
}

/**
 * ファイルごとの減点(点)。違反は持ち主のファイルに数え、結合度と循環依存は依存元のクラスがあるファイルに数え、
 * アクセス制御の違反は呼んでいる側のクラスのファイルに数える。全ファイルの合計は `scoreCodebase` の減点の合計と一致する。
 */
export function fileDeductions(
  codebase: Codebase,
  stage: Pick<Stage, "limits" | "dependencyLimit" | "responsibilityLimit" | "visibilityEnforced">,
): Map<string, number> {
  const reasons = fileDeductionReasons(codebase, stage);
  return new Map([...reasons].map(([fileId, items]) => [fileId, items.reduce((sum, item) => sum + item.points, 0)]));
}

export type FileDeductionReason = {
  readonly rule: ScoreRule;
  readonly targetId: string;
  readonly points: number;
};

export function fileDeductionReasons(
  codebase: Codebase,
  stage: Pick<Stage, "limits" | "dependencyLimit" | "responsibilityLimit" | "visibilityEnforced">,
): Map<string, readonly FileDeductionReason[]> {
  const dependencies = classDependencies(codebase);
  const violations: readonly (readonly [ScoreRule, readonly string[]])[] = [
    ['line-limit', findLineLimitViolations(codebase, stage.limits).map((violation) => violation.targetId)],
    ['responsibility', findResponsibilityViolations(codebase, stage.responsibilityLimit).map((violation) => violation.classId)],
    ['coupling', findCouplingViolations(dependencies, stage.dependencyLimit)],
    ['cycle', dependencies.filter((dependency) => dependency.cyclic).map((dependency) => dependency.from)],
    ['empty', findEmptyContainers(codebase)],
    ['unused', findUnusedPrivateMethods(codebase)],
    ['lone-superclass', findLoneSuperclasses(codebase)],
    ['stub', findStubMethods(codebase)],
    ['contract', findContractViolations(codebase)],
    ['feature-envy', findFeatureEnvy(codebase).map((violation) => violation.methodId)],
    ['encapsulation', [
      ...findEncapsulationViolations(codebase).map((violation) => violation.accessorClassId),
      ...findOpenSetters(codebase),
    ]],
    ['visibility', countedVisibilityViolations(codebase, stage.visibilityEnforced).map((violation) => violation.callerClassId)],
    ['cohesion', findLowCohesionClasses(codebase).map((violation) => violation.classId)],
    ['trivial-method', findTrivialMethods(codebase)],
    ['thin-class', findThinClasses(codebase)],
    ['middle-man', findMiddleManClasses(codebase)],
  ];
  const owners = fileIdByTargetId(codebase);
  const reasons = new Map(
    codebase.files.map((file): [string, FileDeductionReason[]] => [file.id, []]),
  );
  for (const [rule, targetIds] of violations) {
    for (const targetId of targetIds) {
      const fileId = owners.get(targetId);
      if (fileId !== undefined) reasons.get(fileId)?.push({ rule, targetId, points: POINTS_PER_VIOLATION });
    }
  }
  return reasons;
}

/** ファイルの減点がこの点数以上なら、エラーではなく危険として目立たせる。 */
export const DANGER_POINTS = 30;

export type FileSeverity = "ok" | "error" | "danger";

export function fileSeverity(points: number): FileSeverity {
  if (points >= DANGER_POINTS) return "danger";
  return points > 0 ? "error" : "ok";
}
