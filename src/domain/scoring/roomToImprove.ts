import { allClasses, type Codebase, type Method } from '../codebase/Codebase';
import type { Stage } from '../stage/Stage';
import { isInCohesiveGroup } from './mixedMethods';
import { CALL_RESPONSIBILITY, classResponsibilities } from './responsibilities';

export type RoomToImprove =
  | {
      /** 1つのメソッドに、別々の責務の処理がまだ一緒に入っている。 */
      readonly kind: 'mixed-method';
      readonly methodId: string;
      readonly classId: string;
      /** メソッドの中の責務(call を除く)。処理の出現順、重複なし。 */
      readonly responsibilities: readonly string[];
      /** 責務ごとの代表の処理名(その責務で最初に出てくる Fragment の label)。responsibilities と同じ順・同じ長さ。 */
      readonly fragmentLabels: readonly string[];
    }
  | {
      /** クラスの責務の種類数が、上限ちょうど(減点にならない最大)。 */
      readonly kind: 'crowded-class';
      readonly classId: string;
      readonly responsibilities: readonly string[];
    };

/** カードに出す件数の上限。 */
export const ROOM_TO_IMPROVE_LIMIT = 3;

function containsAll(owned: readonly string[], required: readonly string[]): boolean {
  return required.every((responsibility) => owned.includes(responsibility));
}

function methodResponsibilities(method: Method): string[] {
  return [...new Set(method.fragments.map((fragment) => fragment.responsibility).filter((responsibility) => responsibility !== CALL_RESPONSIBILITY))];
}

function mixedMethods(
  codebase: Codebase,
  referenceMethodResponsibilities: readonly (readonly string[])[],
  cohesive: readonly (readonly string[])[],
): RoomToImprove[] {
  const items: RoomToImprove[] = [];
  for (const codeClass of allClasses(codebase)) {
    for (const method of codeClass.methods) {
      const responsibilities = methodResponsibilities(method);
      if (responsibilities.length < 2) continue;
      if (isInCohesiveGroup(new Set(responsibilities), cohesive)) continue;
      if (referenceMethodResponsibilities.some((owned) => containsAll(owned, responsibilities))) continue;
      const fragmentLabels = responsibilities.map((responsibility) => method.fragments.find((fragment) => fragment.responsibility === responsibility)?.label ?? responsibility);
      items.push({ kind: 'mixed-method', methodId: method.id, classId: codeClass.id, responsibilities, fragmentLabels });
    }
  }
  return items;
}

function crowdedClasses(codebase: Codebase, reference: Codebase, limit: number): RoomToImprove[] {
  const referenceClasses = allClasses(reference).map((codeClass) => classResponsibilities(codeClass));
  return allClasses(codebase).flatMap((codeClass): RoomToImprove[] => {
    const responsibilities = classResponsibilities(codeClass);
    if (responsibilities.length < 2 || responsibilities.length !== limit) return [];
    if (referenceClasses.some((owned) => containsAll(owned, responsibilities))) return [];
    return [{ kind: 'crowded-class', classId: codeClass.id, responsibilities }];
  });
}

/**
 * 100点のあとに知らせる「さらに良くできるところ」。解答例でも同じ形で残しているものは意図的とみなして出さない。
 * メソッド内の混在を先、続けて上限ちょうどのクラス。先頭 ROOM_TO_IMPROVE_LIMIT 件だけ返す。
 */
export function findRoomToImprove(
  codebase: Codebase,
  reference: Codebase,
  stage: Pick<Stage, 'responsibilityLimit' | 'cohesiveResponsibilities'>,
): RoomToImprove[] {
  const referenceMethods = allClasses(reference).flatMap((codeClass) => codeClass.methods.map(methodResponsibilities));
  return [
    ...mixedMethods(codebase, referenceMethods, stage.cohesiveResponsibilities ?? []),
    ...crowdedClasses(codebase, reference, stage.responsibilityLimit),
  ].slice(0, ROOM_TO_IMPROVE_LIMIT);
}
