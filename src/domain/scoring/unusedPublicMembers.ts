import { TRAY_FILE_ID } from '../blank/tray';
import { accessorFieldAccess, allClasses, extendsChainIds, fieldsOf, findClass, isAbstractLike, isInterfaceLike, touchedFieldIds, type CodeClass, type Codebase } from '../codebase/Codebase';
import { reachableParentIds } from './interfaceContracts';

export type UnusedPublicMember = { readonly kind: 'field' | 'method'; readonly id: string; readonly classId: string };

type Usage = { readonly fieldIds: Set<string>; readonly methodIds: Set<string> };

/** クラスごとに、そのクラスの処理が触るフィールドID(getter/setter越しを含む)と呼ぶメソッドIDを集める。 */
function usageByClass(codebase: Codebase): Map<string, Usage> {
  const usage = new Map<string, Usage>();
  for (const codeClass of allClasses(codebase)) {
    const fieldIds = new Set<string>();
    const methodIds = new Set<string>();
    for (const fragment of codeClass.methods.flatMap((method) => method.fragments)) {
      const { reads, writes } = accessorFieldAccess(codebase, fragment);
      for (const fieldId of [...touchedFieldIds(fragment), ...reads, ...writes]) fieldIds.add(fieldId);
      for (const methodId of fragment.uses ?? []) methodIds.add(methodId);
    }
    usage.set(codeClass.id, { fieldIds, methodIds });
  }
  return usage;
}

/** 持ち主とその子孫(extends)以外のクラスに、メンバーを触っているものがあるか。 */
function usedFromOutside(codebase: Codebase, usage: ReadonlyMap<string, Usage>, ownerId: string, kind: keyof Usage, memberId: string): boolean {
  return [...usage].some(([classId, used]) => !extendsChainIds(codebase, classId).has(ownerId) && used[kind].has(memberId));
}

/** 自分か先祖がインターフェース役・抽象クラス役で、その役が同名のメソッドを持つか。 */
function isContractMethod(codebase: Codebase, codeClass: CodeClass, name: string): boolean {
  const roles = [codeClass, ...[...reachableParentIds(codebase, codeClass.id)].flatMap((id) => findClass(codebase, id) ?? [])];
  return roles.some((role) => (isInterfaceLike(role) || isAbstractLike(role)) && role.methods.some((method) => method.name === name));
}

/**
 * 持ち主のクラスとその子孫以外のどこからも読まれていない・書かれていない・呼ばれていない、public のフィールドとメソッドを出現順に返す。
 * 入口のメソッド(entryPointIds)、インターフェース役・抽象クラス役のメソッドとそれを実装・上書きするメソッド、部品置き場は除く。
 * ponytail: 子孫の判定は extends だけ、契約の実装は名前の一致だけで見る。引数の型を持つようになったらシグネチャで見る
 */
export function findUnusedPublicMembers(codebase: Codebase, options: { readonly entryPointIds: readonly string[] }): UnusedPublicMember[] {
  const usage = usageByClass(codebase);
  const unused: UnusedPublicMember[] = [];
  for (const file of codebase.files.filter((candidate) => candidate.id !== TRAY_FILE_ID)) {
    for (const codeClass of file.classes) {
      const fields = fieldsOf(codeClass).filter((field) => field.visibility === 'public' && !usedFromOutside(codebase, usage, codeClass.id, 'fieldIds', field.id));
      const methods = codeClass.methods.filter((method) => method.visibility === 'public'
        && !options.entryPointIds.includes(method.id)
        && !isContractMethod(codebase, codeClass, method.name)
        && !usedFromOutside(codebase, usage, codeClass.id, 'methodIds', method.id));
      unused.push(
        ...fields.map((field) => ({ kind: 'field' as const, id: field.id, classId: codeClass.id })),
        ...methods.map((method) => ({ kind: 'method' as const, id: method.id, classId: codeClass.id })),
      );
    }
  }
  return unused;
}

/** どのクラスからも呼ばれていない public メソッドのID。ステージの初期コードに使うと、外の世界から呼ばれる入口になる。 */
export function entryPointMethodIds(codebase: Codebase): string[] {
  const methods = allClasses(codebase).flatMap((codeClass) => codeClass.methods);
  const called = new Set(methods.flatMap((method) => method.fragments).flatMap((fragment) => fragment.uses ?? []));
  return methods.filter((method) => method.visibility === 'public' && !called.has(method.id)).map((method) => method.id);
}
