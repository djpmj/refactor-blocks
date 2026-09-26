import { fieldsOf, findClass, findClassOfMethod, type Codebase } from './Codebase';
import { findCallerOf, inlineMethod } from './inlineMethod';
import { err, ok, type Result } from '../shared/Result';

export type DeleteClassError = 'class-not-found' | 'has-fields';

/**
 * 削除するクラスの中に、Extract Methodで切り出されたメソッド(呼び出し元が見つかるメソッド)が
 * あれば、削除する前に呼び出し元へ戻す。呼び出し元も同じクラスの中にあるなら、そのまま消えるので何もしない。
 */
function inlineExtractedMethods(codebase: Codebase, classId: string): Codebase {
  const target = findClass(codebase, classId);
  if (target === undefined) return codebase;
  return target.methods.reduce((current, method) => {
    const caller = findCallerOf(current, method.id);
    if (caller === undefined || findClassOfMethod(current, caller.id)?.id === classId) return current;
    const inlined = inlineMethod(current, method.id);
    return inlined.ok ? inlined.value : current;
  }, codebase);
}

/** クラスを削除する。切り出し済みのメソッドは、消える前に呼び出し元の元のメソッドへ戻す。 */
export function deleteClass(codebase: Codebase, classId: string): Result<Codebase, DeleteClassError> {
  const target = findClass(codebase, classId);
  if (target === undefined) return err('class-not-found');
  if (fieldsOf(target).length > 0) return err('has-fields');
  const inlined = inlineExtractedMethods(codebase, classId);
  return ok({
    files: inlined.files.map((file) => ({ ...file, classes: file.classes.filter((codeClass) => codeClass.id !== classId) })),
  });
}

export { inlineExtractedMethods };
