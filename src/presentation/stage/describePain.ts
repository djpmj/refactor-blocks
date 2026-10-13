import { findClass, findClassOfMethod, type Codebase } from '../../domain/codebase/Codebase';
import { methodLines } from '../../domain/codebase/lineCount';
import type { ChangePain, ExtendPain, PainSummary } from '../../domain/change/changePain';

export type PainDescription = {
  readonly locations: readonly string[];
  readonly additionalLocations: number;
};

export function describePainTrend(pain: Pick<ChangePain, 'initial' | 'current'>): string | undefined {
  if (pain.current.siteIds.length > pain.initial.siteIds.length) {
    return `途中の状態です。同じ変更に関わる処理が、今は ${pain.current.siteIds.length} か所に分かれています。1か所にまとめると、直す場所も読む量も減ります`;
  }
  if (pain.current.readLines > pain.initial.readLines) {
    return '途中の状態です。分けたメソッドの宣言と呼び出しの分、読む量が少し増えています。関係のない処理を外すと減ります';
  }
  return undefined;
}

export function summarizePain(
  pain: Pick<PainSummary, 'siteIds' | 'readLines'> | undefined,
  extendPain: Pick<ExtendPain, 'currentModified'> | undefined,
): string {
  if (pain !== undefined) return `${pain.siteIds.length}か所・${pain.readLines}行を読む`;
  if (extendPain === undefined || extendPain.currentModified.length === 0) return '新しいクラスを足すだけ';
  return `既存の${extendPain.currentModified.length}クラスを書き換える`;
}

/** 変更箇所のIDを「クラス.メソッド(N行)」の表示名にする。行数はメソッドチップと同じ `methodLines`。 */
export function describePain(codebase: Codebase, summary: PainSummary): PainDescription {
  const locations = summary.siteIds.flatMap((methodId) => {
    const owner = findClassOfMethod(codebase, methodId);
    const method = owner?.methods.find((candidate) => candidate.id === methodId);
    return owner === undefined || method === undefined ? [] : [`${owner.name}.${method.name}(${methodLines(method, codebase)}行)`];
  });
  return { locations: locations.slice(0, 6), additionalLocations: Math.max(0, locations.length - 6) };
}

/** 書き換えるクラスのIDを、クラス名の一覧にする(最大6件)。コードに無いIDは飛ばす。 */
export function describeClasses(codebase: Codebase, classIds: readonly string[]): PainDescription {
  const names = classIds.flatMap((id) => findClass(codebase, id)?.name ?? []);
  return { locations: names.slice(0, 6), additionalLocations: Math.max(0, names.length - 6) };
}
