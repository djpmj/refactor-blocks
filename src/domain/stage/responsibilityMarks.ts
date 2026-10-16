import { allClasses, type Codebase } from '../codebase/Codebase';
import { CALL_RESPONSIBILITY } from '../scoring/responsibilities';

/** 初期コードの出現順、予約済み責務の辞書順、その他の現行責務の辞書順に番号を振る。 */
export function responsibilityMarks(
  initial: Codebase,
  current: Codebase,
  reservedResponsibilities: readonly string[] = [],
): ReadonlyMap<string, number> {
  const responsibilities = new Set<string>();
  const addFrom = (codebase: Codebase) => {
    for (const codeClass of allClasses(codebase)) {
      for (const method of codeClass.methods) {
        for (const fragment of method.fragments) {
          if (fragment.responsibility !== CALL_RESPONSIBILITY) responsibilities.add(fragment.responsibility);
        }
      }
    }
  };
  addFrom(initial);
  const reserved = new Set(reservedResponsibilities.filter((responsibility) => responsibility !== CALL_RESPONSIBILITY));
  const orderedReserved = [...reserved].filter((responsibility) => !responsibilities.has(responsibility)).sort((left, right) => left.localeCompare(right));
  for (const responsibility of orderedReserved) responsibilities.add(responsibility);
  const additionalResponsibilities = new Set<string>();
  for (const codeClass of allClasses(current)) {
    for (const method of codeClass.methods) {
      for (const fragment of method.fragments) {
        if (fragment.responsibility !== CALL_RESPONSIBILITY && !responsibilities.has(fragment.responsibility)) {
          additionalResponsibilities.add(fragment.responsibility);
        }
      }
    }
  }
  const ordered = [...responsibilities, ...[...additionalResponsibilities].sort((left, right) => left.localeCompare(right))];
  return new Map(ordered.map((responsibility, index) => [responsibility, index]));
}
