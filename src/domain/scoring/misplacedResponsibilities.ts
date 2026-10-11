import { allClasses, type Codebase, type Fragment } from '../codebase/Codebase';
import { CALL_RESPONSIBILITY } from './responsibilities';

export type MisplacedResponsibility = {
  readonly classId: string;
  readonly fragments: readonly Pick<Fragment, 'id' | 'label'>[];
};

/** 用意されたクラスに、指定された役割以外の処理があるクラスを列挙する。 */
export function findMisplacedResponsibilities(codebase: Codebase): MisplacedResponsibility[] {
  return allClasses(codebase).flatMap((codeClass) => {
    const roles = codeClass.roleResponsibilities;
    if (roles === undefined) return [];
    const fragments = codeClass.methods.flatMap((method) => method.fragments)
      .filter((fragment) => fragment.responsibility !== CALL_RESPONSIBILITY && !roles.includes(fragment.responsibility))
      .map(({ id, label }) => ({ id, label }));
    return fragments.length === 0 ? [] : [{ classId: codeClass.id, fragments }];
  });
}
