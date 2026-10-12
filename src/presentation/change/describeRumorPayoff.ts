import type { ChangeOutcome } from '../../application/ChangeRequestUseCases';
import { findClass, type Codebase } from '../../domain/codebase/Codebase';

/** 変更依頼の結果で、事前のうわさがどう回収されたかを説明する。 */
export function describeRumorPayoff(outcome: ChangeOutcome, codebase: Codebase): string | undefined {
  if (outcome.request.rumor === undefined) return undefined;
  const modifiedIds = outcome.placement.placement.modifiedClassIds;
  const names = modifiedIds.map((id) => findClass(codebase, id)?.name ?? id);
  if (outcome.placement.score.total === 100) {
    if (names.length === 0) return '✓ うわさに備えた設計だったので、既存のクラスを書き換えずに済みました';
    return `✓ うわさに備えた設計だったので、直したのは ${names[0]} だけで済みました`;
  }
  if (names.length >= 2) return `✗ うわさに備えきれず、既存の ${names.length} クラス(${names.join('・')})に手を入れることになりました`;
  return '✗ うわさに備えきれず、置き場所に無理が出ました。下の減点の理由を見てみよう';
}
