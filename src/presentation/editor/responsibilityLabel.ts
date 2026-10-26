import { responsibilityMarkLetter } from './responsibilityMarkLetter';

/** 印の番号と名前を `A 集計` にする。名前が無い(undefined・空文字)ときは `A` だけ。 */
export function responsibilityLabel(number: number, name: string | undefined): string {
  const letter = responsibilityMarkLetter(number);
  return name === undefined || name === '' ? letter : `${letter} ${name}`;
}

/** 責務ID → 画面に出す名前。Object.prototype のキー(toString など)は名前として拾わない。 */
export function responsibilityNameOf(names: Readonly<Record<string, string>>, responsibility: string): string | undefined {
  return Object.hasOwn(names, responsibility) ? names[responsibility] : undefined;
}

/** クラスの責務の内訳を `A 集計・B 表の組み立て・C 出力` にする。並びは responsibilities の順。 */
export function responsibilityBreakdown(
  responsibilities: readonly string[],
  marks: ReadonlyMap<string, number>,
  names: Readonly<Record<string, string>>,
): string {
  return responsibilities
    .map((responsibility) => responsibilityLabel(marks.get(responsibility) ?? 0, responsibilityNameOf(names, responsibility)))
    .join('・');
}
