import { allClasses, findClass, mapClasses, type Codebase } from './Codebase';
import { err, ok, type Result } from '../shared/Result';

export type SetSuperclassError = 'class-not-found' | 'superclass-not-found' | 'self-inheritance' | 'inheritance-cycle';

/** superclassId を親から親へ辿って classId に戻れるかを見る。壊れたデータで輪になっていても無限ループしないよう訪問済みで止める。 */
function reachesSelf(codebase: Codebase, fromClassId: string, classId: string): boolean {
  const visited = new Set<string>();
  let current: string | undefined = fromClassId;
  while (current !== undefined && !visited.has(current)) {
    if (current === classId) return true;
    visited.add(current);
    current = findClass(codebase, current)?.superclassId;
  }
  return false;
}

/** クラスの親クラスを設定・解除する。相手はIDではなくクラス名で指定する(名前の変更・追加と同じ規則)。 */
export function setSuperclass(
  codebase: Codebase,
  classId: string,
  superclassName: string | null,
): Result<Codebase, SetSuperclassError> {
  const target = findClass(codebase, classId);
  if (target === undefined) return err('class-not-found');

  const name = superclassName?.trim() ?? '';
  if (name === '') {
    if (target.superclassId === undefined) return ok(codebase);
    return ok(replaceSuperclass(codebase, classId, undefined));
  }

  const superclass = allClasses(codebase).find((codeClass) => codeClass.name === name);
  if (superclass === undefined) return err('superclass-not-found');
  if (superclass.id === classId) return err('self-inheritance');
  if (target.superclassId === superclass.id) return ok(codebase);
  if (reachesSelf(codebase, superclass.id, classId)) return err('inheritance-cycle');

  return ok(replaceSuperclass(codebase, classId, superclass.id));
}

function replaceSuperclass(codebase: Codebase, classId: string, superclassId: string | undefined): Codebase {
  return mapClasses(codebase, (codeClass) => (codeClass.id === classId ? { ...codeClass, superclassId } : codeClass));
}
