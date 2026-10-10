import { findClass, findMethod, type Codebase } from '../codebase/Codebase';
import type { Stage } from '../stage/Stage';
import { violationTargets, type ViolationTarget } from './violationTargets';

type ScoringStage = Pick<Stage, 'limits' | 'dependencyLimit' | 'responsibilityLimit' | 'visibilityEnforced' | 'layers'>;

function combineTargets(targets: Record<string, ViolationTarget>): ViolationTarget {
  const combined = { fileIds: new Set<string>(), classIds: new Set<string>(), methodIds: new Set<string>() };
  for (const target of Object.values(targets)) {
    target.fileIds.forEach((id) => combined.fileIds.add(id));
    target.classIds.forEach((id) => combined.classIds.add(id));
    target.methodIds.forEach((id) => combined.methodIds.add(id));
  }
  return { fileIds: [...combined.fileIds], classIds: [...combined.classIds], methodIds: [...combined.methodIds] };
}

/** 操作前に違反対象で、操作後は違反対象でなくなった既存ブロックを返す。 */
export function resolvedTargets(before: Codebase, after: Codebase, stage: ScoringStage): ViolationTarget {
  const beforeTargets = violationTargets(before, stage);
  const afterTargets = violationTargets(after, stage);
  const beforeAll = combineTargets(beforeTargets);
  const afterAll = combineTargets(afterTargets);
  const afterFileIds = new Set(after.files.map((file) => file.id));
  const stillFlagged = { fileIds: new Set(afterAll.fileIds), classIds: new Set(afterAll.classIds), methodIds: new Set(afterAll.methodIds) };
  return {
    fileIds: beforeAll.fileIds.filter((id) => afterFileIds.has(id) && !stillFlagged.fileIds.has(id)),
    classIds: beforeAll.classIds.filter((id) => findClass(after, id) !== undefined && !stillFlagged.classIds.has(id)),
    methodIds: beforeAll.methodIds.filter((id) => findMethod(after, id) !== undefined && !stillFlagged.methodIds.has(id)),
  };
}
