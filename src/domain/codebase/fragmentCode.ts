import { findMethod, type CodeLanguage, type LocalVariable, type Codebase, type Fragment } from './Codebase';
import { isAsyncMethod } from './methodSignature';
import { CALL_RESPONSIBILITY } from '../scoring/responsibilities';

/** Returns explicit or inferred source code for a fragment, if it has any. receiverOf は呼ぶメソッドの受け手(別クラスなら `_taxCalculator` など)。 */
export function fragmentCode(codebase: Codebase, fragment: Fragment, language: CodeLanguage, receiverOf?: (methodId: string) => string | undefined): string | undefined {
  const explicitCode = fragment.code?.[language];
  if (explicitCode !== undefined) return explicitCode;

  if (fragment.responsibility !== CALL_RESPONSIBILITY) return undefined;
  const calledMethods = (fragment.uses ?? [])
    .map((methodId) => findMethod(codebase, methodId))
    .filter((method) => method !== undefined);
  if (calledMethods.length === 0) return undefined;

  // 統合で、子クラスごとのフック(同じ名前の parse など)が1つの呼び出しにまとまることがある。同じ名前の呼び出しは1回だけにし、自分のクラスのメソッド(受け手なし)を先に選ぶ
  const calls = calledMethods.map((method, index) => ({ method, index, receiver: receiverOf?.(method.id) }));
  const ownFirst = [...calls].sort((a, b) => Number(a.receiver !== undefined) - Number(b.receiver !== undefined));
  const seen = new Set<string>();
  return ownFirst
    .filter(({ method }) => !seen.has(method.name) && seen.add(method.name))
    .sort((a, b) => a.index - b.index)
    .map(({ method, index, receiver }) => {
      const prefix = receiver === undefined ? '' : receiver + '.';
      const call = `${prefix}${method.name}(${fragment.callArguments?.[index] ?? ''})`;
      const awaited = isAsyncMethod(codebase, method.id) ? 'await ' : '';
      return `${returnPrefix(method.returns ?? [])}${awaited}${call};`;
    })
    .join('\n');
}

/** 戻り値の数に応じた受け取り方。0個なら無し、1個なら `var x = `、2個以上なら `var (x, y) = `。 */
function returnPrefix(returns: readonly LocalVariable[]): string {
  if (returns.length === 0) return '';
  const names = returns.map((item) => item.name);
  return returns.length === 1 ? `var ${names[0]} = ` : `var (${names.join(', ')}) = `;
}
