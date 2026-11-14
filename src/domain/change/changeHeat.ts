import type { CodeClass } from '../codebase/Codebase';

/** このクラスのメソッドを変更箇所に含む依頼の数。 */
export function classChangeCount(codeClass: CodeClass, siteLists: readonly (readonly string[])[]): number {
  const methodIds = new Set(codeClass.methods.map((method) => method.id));
  return siteLists.filter((sites) => sites.some((id) => methodIds.has(id))).length;
}
