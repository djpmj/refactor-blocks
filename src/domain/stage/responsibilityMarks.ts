import { allClasses, type Codebase } from '../codebase/Codebase';
import { CALL_RESPONSIBILITY } from '../scoring/responsibilities';

/** 0始まりの印番号を A, B, ..., Z, AA ... の英字にする。 */
export function responsibilityMarkLetter(number: number): string {
  let remainder = number + 1;
  let letter = '';
  while (remainder > 0) {
    remainder -= 1;
    letter = String.fromCharCode(65 + (remainder % 26)) + letter;
    remainder = Math.floor(remainder / 26);
  }
  return letter;
}

/** 初期コードの出現順に番号を振り、今だけある責務は辞書順で後ろに続ける。 */
export function responsibilityMarks(initial: Codebase, current: Codebase): ReadonlyMap<string, number> {
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
