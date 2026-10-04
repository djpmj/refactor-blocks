import { findClassOfMethod, type Codebase } from '../../domain/codebase/Codebase';
import type { PainSummary } from '../../domain/change/changePain';

export type PainDescription = {
  readonly locations: readonly string[];
  readonly additionalLocations: number;
};

/** 変更箇所のIDを「クラス.メソッド」の表示名にする。 */
export function describePain(codebase: Codebase, summary: PainSummary): PainDescription {
  const locations = summary.siteIds.flatMap((methodId) => {
    const owner = findClassOfMethod(codebase, methodId);
    return owner === undefined ? [] : [`${owner.name}.${owner.methods.find((method) => method.id === methodId)?.name ?? ''}`];
  });
  return { locations: locations.slice(0, 6), additionalLocations: Math.max(0, locations.length - 6) };
}
