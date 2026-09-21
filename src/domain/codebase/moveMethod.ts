import { findClass, findClassOfMethod, findMethod, mapClasses, type Codebase } from './Codebase';
import { err, ok, type Result } from '../shared/Result';

export type MoveMethodError = 'method-not-found' | 'class-not-found' | 'same-class' | 'duplicate-method-name';

/** Move Method: メソッドを別のクラスへ移動する。移動先クラスの末尾に追加される。 */
export function moveMethod(
  codebase: Codebase,
  methodId: string,
  targetClassId: string,
): Result<Codebase, MoveMethodError> {
  const method = findMethod(codebase, methodId);
  const sourceClass = findClassOfMethod(codebase, methodId);
  if (method === undefined || sourceClass === undefined) return err('method-not-found');
  const targetClass = findClass(codebase, targetClassId);
  if (targetClass === undefined) return err('class-not-found');
  if (sourceClass.id === targetClass.id) return err('same-class');
  if (targetClass.methods.some((existing) => existing.name === method.name)) return err('duplicate-method-name');

  return ok(
    mapClasses(codebase, (codeClass) => {
      if (codeClass.id === sourceClass.id) {
        return { ...codeClass, methods: codeClass.methods.filter((existing) => existing.id !== methodId) };
      }
      if (codeClass.id === targetClass.id) {
        return { ...codeClass, methods: [...codeClass.methods, method] };
      }
      return codeClass;
    }),
  );
}
