import { fieldsOf, findClass, findClassOfMethod, isStubMethod, type Codebase } from './Codebase';
import { findCallerOf, inlineMethod } from './inlineMethod';
import { err, ok, type Result } from '../shared/Result';

export type DeleteClassError = 'class-not-found' | 'has-fields' | 'has-code';

/** 削除前に呼び出し元へ戻したメソッドの名前。 */
export type InlinedBeforeDelete = {
  readonly className: string;
  readonly methodName: string;
  readonly callerClassName: string;
  readonly callerMethodName: string;
};

export type DeleteResult = { readonly codebase: Codebase; readonly inlined: readonly InlinedBeforeDelete[] };

/**
 * 削除するクラスの中に、Extract Methodで切り出されたメソッド(呼び出し元が見つかるメソッド)が
 * あれば、削除する前に呼び出し元へ戻す。呼び出し元も削除対象のクラス内なら、そのまま残して後続の判定で拒否する。
 */
export function inlineBeforeDelete(codebase: Codebase, classIds: readonly string[]): Result<DeleteResult, 'has-code'> {
  const result = classIds.reduce<{ codebase: Codebase; inlined: InlinedBeforeDelete[] }>((current, classId) => {
    const target = findClass(current.codebase, classId);
    if (target === undefined) return current;
    return target.methods.reduce((next, method) => {
      const caller = findCallerOf(next.codebase, method.id);
      const callerClass = caller === undefined ? undefined : findClassOfMethod(next.codebase, caller.id);
      if (caller === undefined || callerClass === undefined || classIds.includes(callerClass.id)) return next;
      const targetClass = findClass(next.codebase, classId);
      if (targetClass === undefined) return next;
      const inlined = inlineMethod(next.codebase, method.id);
      return inlined.ok
        ? { codebase: inlined.value, inlined: [...next.inlined, { className: targetClass.name, methodName: method.name, callerClassName: callerClass.name, callerMethodName: caller.name }] }
        : next;
    }, current);
  }, { codebase, inlined: [] });
  return classIds.every((classId) => findClass(result.codebase, classId)?.methods.every(isStubMethod) === true)
    ? ok({ codebase: result.codebase, inlined: result.inlined })
    : err('has-code');
}

/** クラスを削除する。切り出し済みのメソッドは、消える前に呼び出し元の元のメソッドへ戻す。 */
export function deleteClass(codebase: Codebase, classId: string): Result<DeleteResult, DeleteClassError> {
  const target = findClass(codebase, classId);
  if (target === undefined) return err('class-not-found');
  if (fieldsOf(target).length > 0) return err('has-fields');
  const inlined = inlineBeforeDelete(codebase, [classId]);
  if (!inlined.ok) return inlined;
  return ok({
    codebase: { files: inlined.value.codebase.files.map((file) => ({ ...file, classes: file.classes.filter((codeClass) => codeClass.id !== classId) })) },
    inlined: inlined.value.inlined,
  });
}
