import { allClasses, fieldsOf, type Codebase } from '../codebase/Codebase';

/** メソッドもフィールドもないクラスと、クラスが1つもないファイルのIDを返す。分けすぎ・片付け忘れの跡。 */
export function findEmptyContainers(codebase: Codebase): string[] {
  const emptyClasses = allClasses(codebase).filter((codeClass) => codeClass.methods.length === 0 && fieldsOf(codeClass).length === 0);
  const emptyFiles = codebase.files.filter((file) => file.classes.length === 0);
  return [...emptyClasses, ...emptyFiles].map((container) => container.id);
}

/** 自分以外のどのメソッドからも呼ばれていない private メソッドのIDを返す。 */
export function findUnusedPrivateMethods(codebase: Codebase): string[] {
  const methods = allClasses(codebase).flatMap((codeClass) => codeClass.methods);
  const calledIds = new Set(
    methods.flatMap((caller) =>
      caller.fragments.flatMap((fragment) => fragment.uses ?? []).filter((calleeId) => calleeId !== caller.id),
    ),
  );
  return methods.filter((method) => method.visibility === 'private' && !calledIds.has(method.id)).map((method) => method.id);
}
