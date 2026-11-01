import { findMethod, type Codebase, type LocalVariable, type Method } from './Codebase';

export type ExtractedSignature = {
  readonly parameters: readonly LocalVariable[];
  readonly returns: readonly LocalVariable[];
};

/**
 * 選んだ処理を抽出したときの引数と戻り値を、処理の variables から決める。
 * 引数 = 選んだ処理が使う変数のうち、手前の処理(またはメソッドの引数)が作ったもの。
 * 戻り値 = 選んだ処理が作る変数のうち、後ろの処理が使うもの。どちらも宣言順。
 * ponytail: 1つの変数は1つの処理だけが作る前提(再代入は追わない)。再代入するステージを作るときに解析を足す
 */
export function inferExtractedSignature(source: Method, fragmentIds: readonly string[]): ExtractedSignature {
  const selected = new Set(fragmentIds);
  const indexes = source.fragments.flatMap((fragment, index) => (selected.has(fragment.id) ? [index] : []));
  const first = Math.min(...indexes);
  const last = Math.max(...indexes);
  const before = [
    ...(source.parameters ?? []).map((parameter): LocalVariable => ({ name: parameter.name, type: { csharp: parameter.type } })),
    ...source.fragments.slice(0, first).flatMap((fragment) => fragment.variables?.declares ?? []),
  ];
  const used = new Set(source.fragments.slice(first, last + 1).flatMap((fragment) => fragment.variables?.uses ?? []));
  const usedAfter = new Set(source.fragments.slice(last + 1).flatMap((fragment) => fragment.variables?.uses ?? []));
  const declaredInside = source.fragments.slice(first, last + 1).flatMap((fragment) => fragment.variables?.declares ?? []);
  return {
    parameters: before.filter((item) => used.has(item.name)),
    returns: declaredInside.filter((item) => usedAfter.has(item.name)),
  };
}

function containsAwait(method: Method): boolean {
  return method.fragments.some((fragment) => /\bawait\b/.test(fragment.code?.csharp ?? ''));
}

/** await を含む、または async なメソッドを呼ぶメソッドは async。呼び出しが循環していても訪問済みで止まる。 */
export function isAsyncMethod(codebase: Codebase, methodId: string): boolean {
  const visited = new Set<string>();
  const visit = (id: string): boolean => {
    if (visited.has(id)) return false;
    visited.add(id);
    const method = findMethod(codebase, id);
    if (method === undefined) return false;
    return containsAwait(method) || method.fragments.some((fragment) => (fragment.uses ?? []).some(visit));
  };
  return visit(methodId);
}
