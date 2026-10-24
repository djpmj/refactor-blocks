import { allClasses, findClass, isAbstractLike, isInterfaceLike, parentIds, type CodeClass, type Codebase } from '../codebase/Codebase';
import { classResponsibilities } from '../scoring/responsibilities';

export type ScatteredResponsibility = { readonly responsibility: string; readonly classIds: readonly string[] };

/** クラス自身と、extends / implements をたどった先祖のID。輪になっていても訪問済みで止まる。 */
function lineageIds(codebase: Codebase, codeClass: CodeClass): Set<string> {
  const ids = new Set<string>();
  const pending = [codeClass.id];
  for (let id = pending.pop(); id !== undefined; id = pending.pop()) {
    if (ids.has(id)) continue;
    ids.add(id);
    const found = findClass(codebase, id);
    if (found !== undefined) pending.push(...parentIds(found));
  }
  return ids;
}

function areRelated(left: ReadonlySet<string>, right: ReadonlySet<string>): boolean {
  return [...left].some((id) => right.has(id));
}

/**
 * 同じ責務(call を除く)の処理を持つクラスが、継承関係にない形で2つ以上ある責務を列挙する。
 * インターフェース役・抽象クラス役のクラスは数えない。親子・兄弟(同じ先祖を共有するクラス)の間で同じ責務を持つのは、Template Method・Strategy の正しい形として数えない。
 * 責務の出現順。classIds は、継承関係にない相手がいるクラスだけ、コード上の並び順。
 */
export function findScatteredResponsibilities(codebase: Codebase): ScatteredResponsibility[] {
  const counted = allClasses(codebase)
    .filter((codeClass) => !isInterfaceLike(codeClass) && !isAbstractLike(codeClass))
    .map((codeClass) => ({ codeClass, lineage: lineageIds(codebase, codeClass), responsibilities: classResponsibilities(codeClass) }));
  const responsibilities = [...new Set(counted.flatMap((entry) => entry.responsibilities))];
  return responsibilities.flatMap((responsibility) => {
    const holders = counted.filter((entry) => entry.responsibilities.includes(responsibility));
    const scattered = holders.filter((entry) => holders.some((other) => other !== entry && !areRelated(entry.lineage, other.lineage)));
    return scattered.length === 0 ? [] : [{ responsibility, classIds: scattered.map((entry) => entry.codeClass.id) }];
  });
}
