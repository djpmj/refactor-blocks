import { extendsChainIds, findClass, findClassOfMethod, findMethod, type Codebase } from './Codebase';

/** 子孫の実装への参照を、呼び出し元が持つ抽象宣言経由として解決する。 */
export function resolvesToOwnDeclaration(codebase: Codebase, callerClassId: string, methodId: string): boolean {
  const method = findMethod(codebase, methodId);
  const owner = findClassOfMethod(codebase, methodId);
  const caller = findClass(codebase, callerClassId);
  if (method === undefined || owner === undefined || caller === undefined || method.visibility === 'private') return false;
  if (owner.id === caller.id || !extendsChainIds(codebase, owner.id).has(caller.id)) return false;
  // ponytail: 現在は引数の型を持たないので名前だけで判定する。シグネチャを導入するときに型の一致も調べる。
  return caller.methods.some((declaration) => declaration.name === method.name
    && declaration.visibility === 'protected' && declaration.fragments.length === 0);
}
