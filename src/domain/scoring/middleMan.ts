import { allClasses, findClassOfMethod, type Codebase } from '../codebase/Codebase';
import { CALL_RESPONSIBILITY } from './responsibilities';

/** 別クラスのメソッドへ処理を横流しするだけのクラスIDを返す。 */
export function findMiddleManClasses(codebase: Codebase): string[] {
  return allClasses(codebase)
    .filter((codeClass) => codeClass.methods.length > 0
      && (codeClass.fields?.length ?? 0) === 0
      && codeClass.methods.every((method) => {
        if (method.fragments.length !== 1) return false;
        const [fragment] = method.fragments;
        if (fragment.responsibility !== CALL_RESPONSIBILITY || fragment.uses?.length !== 1) return false;
        const owner = findClassOfMethod(codebase, fragment.uses[0]);
        return owner !== undefined && owner.id !== codeClass.id;
      }))
    .map((codeClass) => codeClass.id);
}
