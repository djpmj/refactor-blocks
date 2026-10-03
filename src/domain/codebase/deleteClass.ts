import { fieldsOf, findClass, findClassOfMethod, isStubMethod, type Codebase } from './Codebase';
import { findCallerOf, inlineMethod } from './inlineMethod';
import { err, ok, type Result } from '../shared/Result';

export type DeleteClassError = 'class-not-found' | 'has-fields' | 'has-code';

/**
 * 削除するクラスの中に、Extract Methodで切り出されたメソッド(呼び出し元が見つかるメソッド)が
 * あれば、削除する前に呼び出し元へ戻す。呼び出し元も削除対象のクラス内なら、そのまま残して後続の判定で拒否する。
 */
export function inlineBeforeDelete(codebase: Codebase, classIds: readonly string[]): Result<Codebase, 'has-code'> {
  const inlined = classIds.reduce((current, classId) => {
    const target = findClass(current, classId);
    if (target === undefined) return current;
    return target.methods.reduce((next, method) => {
      const caller = findCallerOf(next, method.id);
      if (caller === undefined || classIds.includes(findClassOfMethod(next, caller.id)?.id ?? '')) return next;
      const result = inlineMethod(next, method.id);
      return result.ok ? result.value : next;
    }, current);
  }, codebase);
  return classIds.every((classId) => findClass(inlined, classId)?.methods.every(isStubMethod) === true)
    ? ok(inlined)
    : err('has-code');
}

/** クラスを削除する。切り出し済みのメソッドは、消える前に呼び出し元の元のメソッドへ戻す。 */
export function deleteClass(codebase: Codebase, classId: string): Result<Codebase, DeleteClassError> {
  const target = findClass(codebase, classId);
  if (target === undefined) return err('class-not-found');
  if (fieldsOf(target).length > 0) return err('has-fields');
  const inlined = inlineBeforeDelete(codebase, [classId]);
  if (!inlined.ok) return inlined;
  return ok({
    files: inlined.value.files.map((file) => ({ ...file, classes: file.classes.filter((codeClass) => codeClass.id !== classId) })),
  });
}
