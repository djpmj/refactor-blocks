import { mapClasses, type Codebase } from './Codebase';
import { findVisibilityViolations } from '../scoring/visibility';

export type PublicizeCrossClassCallsResult = {
  readonly codebase: Codebase;
  readonly publicized: readonly string[];
};

/** 越境呼び出しを受ける private / protected メソッドを public にする。元の Codebase は変更しない。 */
export function publicizeCrossClassCalls(codebase: Codebase): PublicizeCrossClassCallsResult {
  const publicized = [...new Set(findVisibilityViolations(codebase).map(({ methodId }) => methodId))];
  if (publicized.length === 0) return { codebase, publicized };
  const ids = new Set(publicized);
  return {
    codebase: mapClasses(codebase, (codeClass) => ({
      ...codeClass,
      methods: codeClass.methods.map((method) => ids.has(method.id) ? { ...method, visibility: 'public' } : method),
    })),
    publicized,
  };
}
