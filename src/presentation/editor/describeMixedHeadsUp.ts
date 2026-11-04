import { responsibilityBreakdown } from './responsibilityLabel';

/** 抽出しようとしている処理の責務が混ざるとき、印と名前で伝える。混ざらなければ undefined。 */
export function describeMixedHeadsUp(
  responsibilities: readonly string[],
  marks: ReadonlyMap<string, number>,
  names: Readonly<Record<string, string>>,
): string | undefined {
  if (responsibilities.length === 0) return undefined;
  return `責務が混ざります(${responsibilityBreakdown(responsibilities, marks, names)})。責務ごとに分けて抽出すると「責務の混ざったメソッド」の減点を避けられます`;
}
