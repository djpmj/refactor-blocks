import { findClassOfMethod, findMethod, type Codebase } from '../codebase/Codebase';
import type { ChangeRequest } from './ChangeRequest';
import { findChangeSites } from './findChangeSites';

export type ManualFixResult = {
  /** 変更箇所なのに印が無い(直し忘れ)メソッドのID。 */
  readonly missed: readonly string[];
  /** 変更箇所ではないのに印があるメソッドのID(コードに存在するものだけ)。 */
  readonly extra: readonly string[];
  /** 変更箇所の数。 */
  readonly sites: number;
  /** 変更箇所が属するクラスID。重複なし、変更箇所順。 */
  readonly siteClassIds: readonly string[];
};

/** 直し忘れも、関係のないメソッドへの印も無ければ正解。 */
export function isManualFixSolved(result: ManualFixResult): boolean {
  return result.missed.length === 0 && result.extra.length === 0;
}

/** プレイヤーが「直した」と印を付けたメソッドを、今のコードの変更箇所と照合する。存在しないIDは無視し、重複は1つとして扱う。 */
export function checkManualFix(codebase: Codebase, request: ChangeRequest, fixedIds: readonly string[]): ManualFixResult {
  const sites = [...new Set(findChangeSites(codebase, request))];
  const fixed = new Set(fixedIds);
  return {
    missed: sites.filter((id) => !fixed.has(id)),
    extra: [...fixed].filter((id) => !sites.includes(id) && findMethod(codebase, id) !== undefined),
    sites: sites.length,
    siteClassIds: [...new Set(sites.flatMap((id) => {
      const owner = findClassOfMethod(codebase, id);
      return owner === undefined ? [] : [owner.id];
    }))],
  };
}
