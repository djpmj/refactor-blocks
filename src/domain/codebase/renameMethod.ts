import { findClassOfMethod, findMethod, mapClasses, type Codebase } from './Codebase';
import { err, ok, type Result } from '../shared/Result';

export type RenameMethodError = 'method-not-found' | 'empty-method-name' | 'duplicate-method-name';

/** メソッド名を付け替える。今と同じ名前なら何も変えずに成功にする。重複は同じクラスの中だけで見る。 */
export function renameMethod(codebase: Codebase, methodId: string, newName: string): Result<Codebase, RenameMethodError> {
  const target = findMethod(codebase, methodId);
  const owner = findClassOfMethod(codebase, methodId);
  if (target === undefined || owner === undefined) return err('method-not-found');
  const name = newName.trim();
  if (name === target.name) return ok(codebase);
  if (name === '') return err('empty-method-name');
  if (owner.methods.some((method) => method.id !== methodId && method.name === name)) return err('duplicate-method-name');
  return ok(
    mapClasses(codebase, (codeClass) =>
      codeClass.id === owner.id
        ? { ...codeClass, methods: codeClass.methods.map((method) => (method.id === methodId ? { ...method, name } : method)) }
        : codeClass,
    ),
  );
}
