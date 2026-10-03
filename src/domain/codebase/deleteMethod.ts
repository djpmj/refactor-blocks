import { findClassOfMethod, findMethod, isStubMethod, mapClasses, type Codebase } from './Codebase';
import { err, ok, type Result } from '../shared/Result';

export type DeleteMethodError = 'method-not-found' | 'not-stub';

/**
 * 空実装のメソッドを削除する。本物の処理を持つメソッド・契約メソッド(fragments: [])は削除できない
 * (行数・責務の減点を逃れる抜け道を塞ぐ)。
 */
export function deleteMethod(codebase: Codebase, methodId: string): Result<Codebase, DeleteMethodError> {
  const method = findMethod(codebase, methodId);
  const owner = findClassOfMethod(codebase, methodId);
  if (method === undefined || owner === undefined) return err('method-not-found');
  if (!isStubMethod(method)) return err('not-stub');

  return ok(
    mapClasses(codebase, (codeClass) =>
      codeClass.id === owner.id ? { ...codeClass, methods: codeClass.methods.filter((existing) => existing.id !== methodId) } : codeClass,
    ),
  );
}
