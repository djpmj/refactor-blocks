import { allClasses, findClass, mapClasses, parentIds, type CodeClass, type Codebase, type Method } from './Codebase';
import { err, ok, type Result } from '../shared/Result';

export type SetSuperclassError = 'class-not-found' | 'superclass-not-found' | 'self-inheritance' | 'inheritance-cycle' | 'already-related';
export type AddInterfaceError = 'class-not-found' | 'interface-not-found' | 'self-inheritance' | 'inheritance-cycle' | 'already-related';
export type RemoveInterfaceError = 'class-not-found' | 'interface-not-found';

/** parentIds を親から親へ辿って classId に戻れるかを見る。壊れたデータで輪になっていても無限ループしないよう訪問済みで止める(深さ優先)。 */
function reachesSelf(codebase: Codebase, fromClassId: string, classId: string): boolean {
  const visited = new Set<string>();
  const stack = [fromClassId];
  while (stack.length > 0) {
    const current = stack.pop();
    if (current === undefined || visited.has(current)) continue;
    if (current === classId) return true;
    visited.add(current);
    const codeClass = findClass(codebase, current);
    if (codeClass !== undefined) stack.push(...parentIds(codeClass));
  }
  return false;
}

/**
 * 新しく親になったクラスのprivateメソッドのうち、子クラス自身がすでに呼んでいるものをprotectedへ広げる。
 * Move Methodは可視性を変えないので、privateメソッドを先に親クラスへ移してから継承関係を結ぶと、
 * privateのままでは子クラスから届かない(実際のコードではコンパイルが通らない)状態が残ってしまう。
 * implementsは実装を継承しないので対象外。
 */
function promoteCalledPrivateMethods(codebase: Codebase, subclassId: string, superclassId: string): Codebase {
  const subclass = findClass(codebase, subclassId);
  if (subclass === undefined) return codebase;
  const calledMethodIds = new Set(subclass.methods.flatMap((method) => method.fragments).flatMap((fragment) => fragment.uses ?? []));
  return mapClasses(codebase, (codeClass) => {
    if (codeClass.id !== superclassId) return codeClass;
    return {
      ...codeClass,
      methods: codeClass.methods.map((method): Method =>
        method.visibility === 'private' && calledMethodIds.has(method.id) ? { ...method, visibility: 'protected' } : method,
      ),
    };
  });
}

function replaceSuperclass(codebase: Codebase, classId: string, superclassId: string | undefined): Codebase {
  return mapClasses(codebase, (codeClass) => (codeClass.id === classId ? { ...codeClass, superclassId } : codeClass));
}

/** クラスの継承元(extends)を設定・解除する。相手はIDではなくクラス名で指定する(名前の変更・追加と同じ規則)。 */
export function setSuperclass(codebase: Codebase, classId: string, superclassName: string | null): Result<Codebase, SetSuperclassError> {
  const target = findClass(codebase, classId);
  if (target === undefined) return err('class-not-found');

  const name = superclassName?.trim() ?? '';
  if (name === '') {
    if (target.superclassId === undefined) return ok(codebase);
    return ok(replaceSuperclass(codebase, classId, undefined));
  }

  const superclass = allClasses(codebase).find((codeClass) => codeClass.name === name);
  if (superclass === undefined) return err('superclass-not-found');
  if (superclass.id === classId) return err('self-inheritance');
  if (target.superclassId === superclass.id) return ok(codebase);
  if ((target.interfaceIds ?? []).includes(superclass.id)) return err('already-related');
  if (reachesSelf(codebase, superclass.id, classId)) return err('inheritance-cycle');

  const withSuperclass = replaceSuperclass(codebase, classId, superclass.id);
  return ok(promoteCalledPrivateMethods(withSuperclass, classId, superclass.id));
}

/** クラスに実装しているインターフェース(implements)を1つ追加する。すでに実装していれば何もしない。 */
export function addInterface(codebase: Codebase, classId: string, interfaceName: string): Result<Codebase, AddInterfaceError> {
  const target = findClass(codebase, classId);
  if (target === undefined) return err('class-not-found');

  const name = interfaceName.trim();
  const candidate = allClasses(codebase).find((codeClass) => codeClass.name === name);
  if (candidate === undefined) return err('interface-not-found');
  if (candidate.id === classId) return err('self-inheritance');
  if ((target.interfaceIds ?? []).includes(candidate.id)) return ok(codebase);
  if (target.superclassId === candidate.id) return err('already-related');
  if (reachesSelf(codebase, candidate.id, classId)) return err('inheritance-cycle');

  return ok(mapClasses(codebase, (codeClass) => (codeClass.id === classId ? { ...codeClass, interfaceIds: [...(codeClass.interfaceIds ?? []), candidate.id] } : codeClass)));
}

/** クラスから実装しているインターフェース(implements)を1つ外す。実装していなければ何もしない。 */
export function removeInterface(codebase: Codebase, classId: string, interfaceName: string): Result<Codebase, RemoveInterfaceError> {
  const target = findClass(codebase, classId);
  if (target === undefined) return err('class-not-found');

  const name = interfaceName.trim();
  const candidate = allClasses(codebase).find((codeClass) => codeClass.name === name);
  if (candidate === undefined) return err('interface-not-found');
  if (!(target.interfaceIds ?? []).includes(candidate.id)) return ok(codebase);

  return ok(
    mapClasses(codebase, (codeClass) => {
      if (codeClass.id !== classId) return codeClass;
      const remaining = (codeClass.interfaceIds ?? []).filter((id) => id !== candidate.id);
      return { ...codeClass, interfaceIds: remaining.length === 0 ? undefined : remaining };
    }),
  );
}

/** 継承元・実装先として選べるクラス一覧(自分自身・選ぶと輪になる相手を除く)。継承元・実装先どちらのサブメニューでも使う。 */
export function availableParents(codebase: Codebase, classId: string): CodeClass[] {
  return allClasses(codebase).filter((codeClass) => codeClass.id !== classId && !reachesSelf(codebase, codeClass.id, classId));
}
