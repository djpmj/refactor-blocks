import { allClasses, type Codebase } from '../codebase/Codebase';
import type { ChangeRequest } from './ChangeRequest';

/** 依頼の責務を持つ処理を含むメソッドのID(変更が必要な場所)を、出現順に返す。 */
export function findChangeSites(codebase: Codebase, request: ChangeRequest): string[] {
  return allClasses(codebase)
    .flatMap((codeClass) => codeClass.methods)
    .filter((method) => method.fragments.some((fragment) => fragment.responsibility === request.responsibility))
    .map((method) => method.id);
}
