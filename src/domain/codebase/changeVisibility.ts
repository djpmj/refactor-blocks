import { resolvesToOwnDeclaration } from './overrides';
import { allClasses, extendsChainIds, findClassOfMethod, findMethod, mapClasses, type Codebase, type Visibility } from './Codebase';
import { err, ok, type Result } from '../shared/Result';

export type ChangeVisibilityError = 'method-not-found' | 'same-visibility' | 'contract-method' | 'widening-not-needed' | 'narrowing-breaks-callers';

const VISIBILITY_RANK: Record<Visibility, number> = { private: 0, protected: 1, public: 2 };

/** メソッドを uses で呼んでいるクラスのIDを、持ち主を除いて重複なく返す。 */
function callerClassIdsOf(codebase: Codebase, methodId: string, ownerClassId: string): string[] {
  const callers = allClasses(codebase).filter(
    (codeClass) =>
      codeClass.id !== ownerClassId &&
      codeClass.methods.flatMap((method) => method.fragments).some((fragment) => (fragment.uses ?? []).includes(methodId)),
  );
  return callers.map((codeClass) => codeClass.id);
}

/** その可視性なら、持ち主以外のcallerClassIdから呼べるか(publicは常に届く、protectedは子孫のみ、privateは届かない)。 */
function isReachable(codebase: Codebase, visibility: Visibility, ownerClassId: string, callerClassId: string): boolean {
  if (visibility === 'public') return true;
  if (visibility === 'protected') return extendsChainIds(codebase, callerClassId).has(ownerClassId);
  return false;
}

/** 広げるときは、広げた可視性でないと届かない呼び出し元が1つ以上あることを求める。 */
function checkWidening(codebase: Codebase, visibility: Visibility, ownerClassId: string, callerClassIds: readonly string[]): ChangeVisibilityError | undefined {
  const hasNeededCaller = callerClassIds.some((callerClassId) => isReachable(codebase, visibility, ownerClassId, callerClassId));
  return hasNeededCaller ? undefined : 'widening-not-needed';
}

/** 狭めるときは、狭めた後の可視性では届かない呼び出し元が1つもないことを求める。 */
function checkNarrowing(codebase: Codebase, visibility: Visibility, ownerClassId: string, callerClassIds: readonly string[]): ChangeVisibilityError | undefined {
  const breaksCaller = callerClassIds.some((callerClassId) => !isReachable(codebase, visibility, ownerClassId, callerClassId));
  return breaksCaller ? 'narrowing-breaks-callers' : undefined;
}

/** 変更後の可視性で、抽象宣言経由の呼び出しも考慮して前提条件を調べる。 */
function visibilityError(codebase: Codebase, methodId: string, ownerClassId: string, widening: boolean): ChangeVisibilityError | undefined {
  const visibility = findMethod(codebase, methodId)?.visibility;
  if (visibility === undefined) return 'method-not-found';
  const callers = callerClassIdsOf(codebase, methodId, ownerClassId);
  if (widening) {
    const implementsDeclaration = allClasses(codebase).some((owner) => resolvesToOwnDeclaration(codebase, owner.id, methodId));
    return implementsDeclaration ? undefined : checkWidening(codebase, visibility, ownerClassId, callers);
  }
  const directCallers = callers.filter((id) => !resolvesToOwnDeclaration(codebase, id, methodId));
  return checkNarrowing(codebase, visibility, ownerClassId, directCallers);
}

/**
 * メソッドの可視性を変える。元の Codebase は変更しない。
 * 中身のない(fragments: [])メソッドは変えない。広げる(private → protected → public の向き)ときは、
 * public なら持ち主以外のクラスから、protected なら持ち主の子孫クラスから呼ばれていることを求める。
 * 親の抽象宣言を実装するときも可視性を広げられる。抽象宣言経由の呼び出しは変更後の可視性で解決する。
 * 狭めるときは、狭めた後の可視性では届かない呼び出し元(持ち主以外 / 子孫以外)が1つもないことを求める。
 */
export function changeVisibility(codebase: Codebase, methodId: string, visibility: Visibility): Result<Codebase, ChangeVisibilityError> {
  const method = findMethod(codebase, methodId);
  const ownerClass = findClassOfMethod(codebase, methodId);
  if (method === undefined || ownerClass === undefined) return err('method-not-found');
  if (method.visibility === visibility) return err('same-visibility');
  if (method.fragments.length === 0) return err('contract-method');

  const updated = mapClasses(codebase, (codeClass) => ({
    ...codeClass,
    methods: codeClass.methods.map((candidate) => (candidate.id === methodId ? { ...candidate, visibility } : candidate)),
  }));
  const widening = VISIBILITY_RANK[visibility] > VISIBILITY_RANK[method.visibility];
  const error = visibilityError(updated, methodId, ownerClass.id, widening);
  return error === undefined ? ok(updated) : err(error);
}
