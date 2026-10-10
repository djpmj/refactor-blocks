import { allClasses, findMethod, mapClasses, type Codebase, type Fragment, type Method } from './Codebase';
import { CALL_RESPONSIBILITY } from '../scoring/responsibilities';
import { err, ok, type Result } from '../shared/Result';

/** multiple-callers は複数メソッドからの呼び出し、または同一メソッド内の複数呼び出し箇所を表す。 */
export type InlineMethodError = 'method-not-found' | 'call-not-found' | 'multiple-callers';

function isCallTo(fragment: Fragment, methodId: string): boolean {
  return fragment.responsibility === CALL_RESPONSIBILITY
    && fragment.uses?.length === 1
    && fragment.uses[0] === methodId;
}

/** responsibility と uses から呼び出し行を持つメソッドを探す。 */
export function findCallerOf(codebase: Codebase, methodId: string): Method | undefined {
  return allClasses(codebase)
    .flatMap((codeClass) => codeClass.methods)
    .find((method) => method.fragments.some((fragment) => isCallTo(fragment, methodId)));
}

/** Inline Method: 呼び出し元の呼び出し行を処理で置き換え、対象メソッドを消す。 */
export function inlineMethod(codebase: Codebase, methodId: string): Result<Codebase, InlineMethodError> {
  const method = findMethod(codebase, methodId);
  if (method === undefined) return err('method-not-found');
  const callers = allClasses(codebase)
    .flatMap((codeClass) => codeClass.methods)
    .filter((caller) => caller.fragments.some((fragment) => isCallTo(fragment, methodId)));
  if (callers.length === 0) return err('call-not-found');
  const callSiteCount = callers.reduce(
    (count, caller) => count + caller.fragments.filter((fragment) => isCallTo(fragment, methodId)).length,
    0,
  );
  if (callSiteCount > 1) return err('multiple-callers');

  const [caller] = callers;
  const inlinedCaller: Method = {
    ...caller,
    fragments: caller.fragments.flatMap((fragment) => (isCallTo(fragment, methodId) ? method.fragments : [fragment])),
  };
  return ok(
    mapClasses(codebase, (codeClass) => ({
      ...codeClass,
      methods: codeClass.methods
        .filter((existing) => existing.id !== methodId)
        .map((existing) => (existing.id === caller.id ? inlinedCaller : existing)),
    })),
  );
}
