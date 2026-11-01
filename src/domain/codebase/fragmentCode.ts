import { findMethod, type CodeLanguage, type LocalVariable, type Codebase, type Fragment } from './Codebase';
import { isAsyncMethod } from './methodSignature';
import { CALL_RESPONSIBILITY } from '../scoring/responsibilities';

/** Returns explicit or inferred source code for a fragment, if it has any. */
export function fragmentCode(codebase: Codebase, fragment: Fragment, language: CodeLanguage): string | undefined {
  const explicitCode = fragment.code?.[language];
  if (explicitCode !== undefined) return explicitCode;

  if (fragment.responsibility !== CALL_RESPONSIBILITY) return undefined;
  const calledMethods = (fragment.uses ?? [])
    .map((methodId) => findMethod(codebase, methodId))
    .filter((method) => method !== undefined);
  if (calledMethods.length === 0) return undefined;

  return calledMethods
    .map((method, index) => {
      const call = `${method.name}(${fragment.callArguments?.[index] ?? ''})`;
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
