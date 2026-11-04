import { mixedResponsibilities } from '../scoring/mixedMethods';
import type { Fragment } from './Codebase';

const FALLBACK_NAME = 'extractedMethod';

export type MethodNaming = {
  /** 模範解答の抽出手順の、処理IDの組と名前。 */
  readonly groups: readonly { readonly fragmentIds: readonly string[]; readonly name: string }[];
  /** 責務 → メソッド名。 */
  readonly byResponsibility: Readonly<Record<string, string>>;
  /** 一緒にあっても混在とみなさない責務の組(採点と同じ判定に使う)。 */
  readonly cohesiveResponsibilities?: readonly (readonly string[])[];
};

export const NO_METHOD_NAMING: MethodNaming = { groups: [], byResponsibility: {} };

/** camelCase の名前を、先頭の動詞(validate)と残り(Items)に分ける。 */
function splitVerb(name: string): { verb: string; rest: string } {
  const index = name.search(/[A-Z]/);
  return index === -1 ? { verb: name, rest: '' } : { verb: name.slice(0, index), rest: name.slice(index) };
}

function capitalize(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function combine(names: readonly string[]): string {
  const parts = names.map(splitVerb);
  const verb = parts[0].verb;
  if (parts.every((part) => part.verb === verb && part.rest !== '')) {
    return verb + parts.map((part) => part.rest).join('And');
  }
  return names.map((name, index) => (index === 0 ? name : capitalize(name))).join('And');
}

/**
 * 抽出しようとしている処理から、新しいメソッドの名前を考える。
 * 処理ごとの suggestedName を組み合わせ(動詞が同じなら validateItemsAndStock のようにまとめる)、
 * 同じクラスの既存メソッド名と重なるときは末尾に番号を付ける。
 */
function sameIds(first: readonly string[], second: readonly string[]): boolean {
  const firstIds = new Set(first);
  const secondIds = new Set(second);
  return firstIds.size === secondIds.size && [...firstIds].every((id) => secondIds.has(id));
}

/** 責務が混ざる選び方なら、責務ごとの名前を出てくる順につなぐ。表に無い責務があれば undefined。 */
function mixedName(fragments: readonly Fragment[], naming: MethodNaming): string | undefined {
  const mixed = mixedResponsibilities(fragments, naming.cohesiveResponsibilities ?? []);
  const names = mixed.flatMap((responsibility) => {
    return Object.hasOwn(naming.byResponsibility, responsibility) ? [naming.byResponsibility[responsibility]] : [];
  });
  return mixed.length > 0 && names.length === mixed.length ? combine(names) : undefined;
}

function responsibilityName(fragments: readonly Fragment[], naming: MethodNaming): string | undefined {
  const lineCounts = new Map<string, number>();
  const order: string[] = [];
  for (const fragment of fragments) {
    if (fragment.responsibility === 'call') continue;
    if (!lineCounts.has(fragment.responsibility)) order.push(fragment.responsibility);
    lineCounts.set(fragment.responsibility, (lineCounts.get(fragment.responsibility) ?? 0) + fragment.lines);
  }
  const selected = order.reduce<string | undefined>((winner, responsibility) =>
    winner === undefined || (lineCounts.get(responsibility) ?? 0) > (lineCounts.get(winner) ?? 0) ? responsibility : winner,
  undefined);
  return selected === undefined ? undefined : naming.byResponsibility[selected];
}

export function suggestMethodName(
  fragments: readonly Fragment[],
  existingNames: readonly string[],
  naming: MethodNaming = NO_METHOD_NAMING,
): string {
  if (fragments.length === 0) return '';
  const candidates = fragments.flatMap((fragment) => (fragment.suggestedName === undefined ? [] : [fragment.suggestedName]));
  const selectedIds = fragments.map((fragment) => fragment.id);
  const matchedGroup = naming.groups.find((group) => sameIds(group.fragmentIds, selectedIds));
  let base: string;
  if (matchedGroup !== undefined) {
    base = matchedGroup.name;
  } else if (fragments.length === 1) {
    base = fragments[0].suggestedName ?? FALLBACK_NAME;
  } else {
    const isMixed = mixedResponsibilities(fragments, naming.cohesiveResponsibilities ?? []).length > 0;
    const fallback = candidates.length === 0 ? FALLBACK_NAME : combine(candidates);
    base = (isMixed ? mixedName(fragments, naming) : responsibilityName(fragments, naming)) ?? fallback;
  }
  const taken = new Set(existingNames);
  let name = base;
  let suffix = 2;
  while (taken.has(name)) {
    name = `${base}${suffix}`;
    suffix++;
  }
  return name;
}
