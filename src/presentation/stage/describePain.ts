import { findClassOfMethod, type Codebase } from '../../domain/codebase/Codebase';
import { methodLines } from '../../domain/codebase/lineCount';
import type { PainSummary } from '../../domain/change/changePain';

export type PainDescription = {
  readonly locations: readonly string[];
  readonly additionalLocations: number;
};

/** 変更箇所のIDを「クラス.メソッド(N行)」の表示名にする。行数はメソッドチップと同じ `methodLines`。 */
export function describePain(codebase: Codebase, summary: PainSummary): PainDescription {
  const locations = summary.siteIds.flatMap((methodId) => {
    const owner = findClassOfMethod(codebase, methodId);
    const method = owner?.methods.find((candidate) => candidate.id === methodId);
    return owner === undefined || method === undefined ? [] : [`${owner.name}.${method.name}(${methodLines(method)}行)`];
  });
  return { locations: locations.slice(0, 6), additionalLocations: Math.max(0, locations.length - 6) };
}
