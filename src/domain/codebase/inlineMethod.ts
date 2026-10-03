import { allClasses, findMethod, mapClasses, type Codebase, type Method } from './Codebase';
import { callFragmentId } from './extractMethod';
import { err, ok, type Result } from '../shared/Result';

export type InlineMethodError = 'method-not-found' | 'not-private' | 'call-not-found';

/** Extract Method で残った呼び出し行(`<id>:call`)を持つメソッドを探す。 */
export function findCallerOf(codebase: Codebase, methodId: string): Method | undefined {
  const callId = callFragmentId(methodId);
  return allClasses(codebase)
    .flatMap((codeClass) => codeClass.methods)
    .find((method) => method.fragments.some((fragment) => fragment.id === callId));
}

/**
 * Inline Method: privateメソッドの処理を、呼び出し元の呼び出し行の位置へ戻し、メソッド自体を消す。
 * Extract Method の逆操作。
 */
export function inlineMethod(codebase: Codebase, methodId: string): Result<Codebase, InlineMethodError> {
  const method = findMethod(codebase, methodId);
  if (method === undefined) return err('method-not-found');
  if (method.visibility !== 'private') return err('not-private');
  const caller = findCallerOf(codebase, methodId);
  if (caller === undefined) return err('call-not-found');

  const callId = callFragmentId(methodId);
  const inlinedCaller: Method = {
    ...caller,
    fragments: caller.fragments.flatMap((fragment) => (fragment.id === callId ? method.fragments : [fragment])),
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
