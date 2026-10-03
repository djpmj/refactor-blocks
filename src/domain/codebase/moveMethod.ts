import { allClasses, type CodeClass, type Method, findClass, findClassOfMethod, findMethod, mapClasses, type Codebase } from './Codebase';
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
  const error = targetError(sourceClass, method, targetClass);
  if (error !== null) return err(error);

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

function targetError(sourceClass: CodeClass, method: Method, targetClass: CodeClass): MoveMethodError | null {
  if (sourceClass.id === targetClass.id) return 'same-class';
  if (targetClass.methods.some((existing) => existing.name === method.name)) return 'duplicate-method-name';
  return null;
}

/** 移動できるクラスをファイル順・宣言順で返す。 */
export function moveMethodTargets(codebase: Codebase, methodId: string): CodeClass[] {
  const method = findMethod(codebase, methodId);
  const sourceClass = findClassOfMethod(codebase, methodId);
  if (method === undefined || sourceClass === undefined) return [];
  return allClasses(codebase).filter((target) => targetError(sourceClass, method, target) === null);
}
