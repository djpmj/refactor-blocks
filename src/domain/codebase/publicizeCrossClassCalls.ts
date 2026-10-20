import { extendsChainIds, findClassOfMethod, mapClasses, type Codebase, type Visibility } from './Codebase';
import { findVisibilityViolations } from '../scoring/visibility';

export type PublicizeCrossClassCallsResult = {
  readonly codebase: Codebase;
  readonly changed: readonly { readonly methodId: string; readonly visibility: 'public' | 'protected' }[];
};

function visibilityForCallers(codebase: Codebase, methodId: string, callerIds: readonly string[]): 'public' | 'protected' {
  const owner = findClassOfMethod(codebase, methodId);
  const callersAreDescendants = owner !== undefined && callerIds.every((callerId) => extendsChainIds(codebase, callerId).has(owner.id));
  return callersAreDescendants ? 'protected' : 'public';
}

function changedVisibilities(codebase: Codebase): { readonly methodId: string; readonly visibility: 'public' | 'protected' }[] {
  const callerIdsByMethod = new Map<string, string[]>();
  for (const { methodId, callerClassId } of findVisibilityViolations(codebase)) {
    const callers = callerIdsByMethod.get(methodId) ?? [];
    callerIdsByMethod.set(methodId, [...callers, callerClassId]);
  }
  return [...callerIdsByMethod].map(([methodId, callerIds]) => ({
    methodId,
    visibility: visibilityForCallers(codebase, methodId, callerIds),
  }));
}

/** 越境呼び出しを受ける private / protected メソッドの可視性を必要な範囲に広げる。元の Codebase は変更しない。 */
export function publicizeCrossClassCalls(codebase: Codebase): PublicizeCrossClassCallsResult {
  const changed = changedVisibilities(codebase);
  if (changed.length === 0) return { codebase, changed };
  const visibilityById = new Map(changed.map(({ methodId, visibility }) => [methodId, visibility]));
  return {
    codebase: mapClasses(codebase, (codeClass) => ({
      ...codeClass,
      methods: codeClass.methods.map((method) => {
        const visibility: Visibility | undefined = visibilityById.get(method.id);
        return visibility === undefined ? method : { ...method, visibility };
      }),
    })),
    changed,
  };
}
