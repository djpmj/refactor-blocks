import { findMethod, type CodeLanguage, type Codebase, type Fragment } from './Codebase';
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

  return calledMethods.map((method, index) => `${method.name}(${fragment.callArguments?.[index] ?? ''});`).join('\n');
}
