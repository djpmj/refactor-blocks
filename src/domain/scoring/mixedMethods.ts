import { allClasses, type Codebase } from '../codebase/Codebase';
import { CALL_RESPONSIBILITY } from './responsibilities';

export function isInCohesiveGroup(responsibilities: ReadonlySet<string>, groups: readonly (readonly string[])[]): boolean {
  for (const group of groups) {
    let containsAll = true;
    for (const responsibility of responsibilities) {
      if (!group.includes(responsibility)) {
        containsAll = false;
        break;
      }
    }
    if (containsAll) return true;
  }
  return false;
}

function isMixedMethod(
  method: Codebase['files'][number]['classes'][number]['methods'][number],
  initialMethodIds: ReadonlySet<string>,
  cohesiveResponsibilities: readonly (readonly string[])[],
): boolean {
  if (initialMethodIds.has(method.id)) return false;
  const responsibilities = new Set(method.fragments
    .map((fragment) => fragment.responsibility)
    .filter((responsibility) => responsibility !== CALL_RESPONSIBILITY));
  return responsibilities.size > 1 && !isInCohesiveGroup(responsibilities, cohesiveResponsibilities);
}

/** 初期状態にない抽出メソッドのうち、複数の責務を含むものを返す。 */
export function findMixedMethods(
  codebase: Codebase,
  initial: Codebase,
  cohesiveResponsibilities: readonly (readonly string[])[] = [],
): string[] {
  const initialMethodIds = new Set(allClasses(initial).flatMap((codeClass) => codeClass.methods.map((method) => method.id)));
  return allClasses(codebase).flatMap((codeClass) => codeClass.methods
    .filter((method) => isMixedMethod(method, initialMethodIds, cohesiveResponsibilities))
    .map((method) => method.id));
}
