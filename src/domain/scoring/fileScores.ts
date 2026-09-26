import type { Codebase } from "../codebase/Codebase";
import { classDependencies } from "../codebase/dependencies";
import type { Stage } from "../stage/Stage";
import { findEncapsulationViolations, findFeatureEnvy } from "./fieldAccess";
import { findContractViolations, findStubMethods } from "./interfaceContracts";
import { findEmptyContainers, findUnusedPrivateMethods } from "./leftovers";
import { findLineLimitViolations } from "./lineLimits";
import { findLoneSuperclasses } from "./loneSuperclass";
import { findResponsibilityViolations } from "./responsibilities";
import { findCouplingViolations, POINTS_PER_VIOLATION } from "./score";

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
 * ファイルごとの減点(点)。違反は持ち主のファイルに数え、結合度と循環依存は依存元のクラスがあるファイルに数える。
 * 全ファイルの合計は、アクセス制御を除いた `scoreCodebase` の減点の合計と一致する。
 */
export function fileDeductions(
  codebase: Codebase,
  stage: Pick<Stage, "limits" | "dependencyLimit" | "responsibilityLimit">,
): Map<string, number> {
  const dependencies = classDependencies(codebase);
  const violatingTargetIds = [
    ...findLineLimitViolations(codebase, stage.limits).map(
      (violation) => violation.targetId,
    ),
    ...findResponsibilityViolations(codebase, stage.responsibilityLimit).map(
      (violation) => violation.classId,
    ),
    ...findCouplingViolations(dependencies, stage.dependencyLimit),
    ...dependencies
      .filter((dependency) => dependency.cyclic)
      .map((dependency) => dependency.from),
    ...findEmptyContainers(codebase),
    ...findUnusedPrivateMethods(codebase),
    ...findLoneSuperclasses(codebase),
    ...findStubMethods(codebase),
    ...findContractViolations(codebase),
    ...findFeatureEnvy(codebase).map((violation) => violation.methodId),
    ...findEncapsulationViolations(codebase).map((violation) => violation.accessorClassId),
  ];
  const owners = fileIdByTargetId(codebase);
  const points = new Map(
    codebase.files.map((file): [string, number] => [file.id, 0]),
  );
  for (const targetId of violatingTargetIds) {
    const fileId = owners.get(targetId);
    if (fileId !== undefined)
      points.set(fileId, (points.get(fileId) ?? 0) + POINTS_PER_VIOLATION);
  }
  return points;
}

/** ファイルの減点がこの点数以上なら、エラーではなく危険として目立たせる。 */
export const DANGER_POINTS = 30;

export type FileSeverity = "ok" | "error" | "danger";

export function fileSeverity(points: number): FileSeverity {
  if (points >= DANGER_POINTS) return "danger";
  return points > 0 ? "error" : "ok";
}
