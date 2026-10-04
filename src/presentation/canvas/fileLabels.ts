import type { Codebase } from '../../domain/codebase/Codebase';

/** クラス名で移動先を見分ける。重複するラベルには表示順に番号を付ける。 */
export function fileLabels(codebase: Codebase): readonly { readonly id: string; readonly label: string }[] {
  const counts = new Map<string, number>();
  return codebase.files.map((file) => {
    const base = file.classes.length === 0 ? '空のファイル' : file.classes.map((codeClass) => codeClass.name).join('・');
    const count = (counts.get(base) ?? 0) + 1;
    counts.set(base, count);
    return { id: file.id, label: count === 1 ? base : `${base} (${String(count)})` };
  });
}
