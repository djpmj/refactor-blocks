import { allClasses, isAccessorMethod, isStubMethod, type Codebase } from '../codebase/Codebase';
import { fragmentLines } from '../codebase/lineCount';
import { CALL_RESPONSIBILITY } from './responsibilities';

export const TRIVIAL_METHOD_MAX_LINES = 2;

/** 1〜2行の実処理だけを持つ極小メソッドのIDを返す。 */
export function findTrivialMethods(codebase: Codebase): string[] {
  return allClasses(codebase).flatMap((codeClass) => codeClass.methods)
    .filter((method) => {
      const lines = method.fragments.reduce((total, fragment) => total + fragmentLines(fragment), 0);
      return method.fragments.length > 0
        && !isStubMethod(method)
        && !isAccessorMethod(method)
        && method.fragments.some((fragment) => fragment.responsibility !== CALL_RESPONSIBILITY)
        && lines <= TRIVIAL_METHOD_MAX_LINES;
    })
    .map((method) => method.id);
}

/** 極小メソッドだけを1つ持ち、フィールドを持たないクラスのIDを返す。 */
export function findThinClasses(codebase: Codebase): string[] {
  const trivialMethodIds = new Set(findTrivialMethods(codebase));
  return allClasses(codebase)
    .filter((codeClass) => codeClass.methods.length === 1
      && (codeClass.fields?.length ?? 0) === 0
      && trivialMethodIds.has(codeClass.methods[0].id))
    .map((codeClass) => codeClass.id);
}
