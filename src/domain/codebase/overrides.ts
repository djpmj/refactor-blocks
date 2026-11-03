import { extendsChainIds, findClass, findClassOfMethod, findMethod, isAbstractMethod, type Codebase, type CodeClass, type Method } from './Codebase';

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

function parameterTypes(method: Method): string {
  return (method.parameters ?? []).map((parameter) => parameter.type).join(',');
}

/** 継承元のクラスにある、同じ名前・同じ引数で本体の無いメソッド(あればこのメソッドはその実装で、override になる)。 */
export function overriddenAbstract(codebase: Codebase, codeClass: CodeClass, method: Method): { readonly owner: CodeClass; readonly declaration: Method } | undefined {
  if (method.fragments.length === 0) return undefined;
  for (const id of extendsChainIds(codebase, codeClass.id)) {
    const owner = id === codeClass.id ? undefined : findClass(codebase, id);
    const declaration = owner?.methods.find((base) => isAbstractMethod(base) && base.name === method.name && parameterTypes(base) === parameterTypes(method));
    if (owner !== undefined && declaration !== undefined) return { owner, declaration };
  }
  return undefined;
}
