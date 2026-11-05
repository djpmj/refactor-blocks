import { allClasses, type Codebase, type Fragment } from '../codebase/Codebase';
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

/**
 * 処理の並びから、混ざっている責務(call を除き、出てくる順・重複なし)を返す。
 * 責務が1種類以下、または cohesiveResponsibilities のどれかの組に収まるときは [] を返す。
 */
export function mixedResponsibilities(
  fragments: readonly Pick<Fragment, 'responsibility'>[],
  cohesiveResponsibilities: readonly (readonly string[])[] = [],
): readonly string[] {
  const responsibilities = new Set(fragments
    .map((fragment) => fragment.responsibility)
    .filter((responsibility) => responsibility !== CALL_RESPONSIBILITY));
  return responsibilities.size > 1 && !isInCohesiveGroup(responsibilities, cohesiveResponsibilities)
    ? [...responsibilities]
    : [];
}

function isMixedMethod(
  method: Codebase['files'][number]['classes'][number]['methods'][number],
  initialMethodIds: ReadonlySet<string>,
  cohesiveResponsibilities: readonly (readonly string[])[],
): boolean {
  return !initialMethodIds.has(method.id) && mixedResponsibilities(method.fragments, cohesiveResponsibilities).length > 0;
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
