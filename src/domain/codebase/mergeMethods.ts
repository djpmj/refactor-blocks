import {
  allClasses,
  findClassOfMethod,
  findMethod,
  mapClasses,
  type CodeClass,
  type Codebase,
  type Fragment,
  type Method,
} from './Codebase';
import { err, ok, type Result } from '../shared/Result';

export type MergeMethodsRequest = {
  readonly methodAId: string;
  readonly methodBId: string;
  readonly newMethodId: string;
  readonly newMethodName: string;
};

export type MergeMethodsError =
  | 'method-not-found'
  | 'same-method'
  | 'same-class'
  | 'not-private'
  | 'shape-mismatch'
  | 'empty-method-name'
  | 'duplicate-method-name';

export type MergeCandidate = {
  readonly method: Method;
  readonly ownerClassId: string;
};

/** 処理の形(duplicateGroupの並び)が完全に一致するかどうか。片方だけ未設定・値違いは不一致。 */
function sameShape(methodA: Method, methodB: Method): boolean {
  if (methodA.fragments.length !== methodB.fragments.length) return false;
  return methodA.fragments.every((fragmentA, index) => {
    const group = fragmentA.duplicateGroup;
    return group !== undefined && group === methodB.fragments[index].duplicateGroup;
  });
}

type Validated = { readonly methodA: Method; readonly ownerA: CodeClass; readonly methodB: Method; readonly ownerB: CodeClass };

function validate(codebase: Codebase, request: MergeMethodsRequest): Result<Validated, MergeMethodsError> {
  const methodA = findMethod(codebase, request.methodAId);
  const ownerA = findClassOfMethod(codebase, request.methodAId);
  const methodB = findMethod(codebase, request.methodBId);
  const ownerB = findClassOfMethod(codebase, request.methodBId);
  if (methodA === undefined || ownerA === undefined || methodB === undefined || ownerB === undefined) return err('method-not-found');
  if (request.methodAId === request.methodBId) return err('same-method');
  if (ownerA.id === ownerB.id) return err('same-class');
  if (methodA.visibility !== 'private' || methodB.visibility !== 'private') return err('not-private');
  if (!sameShape(methodA, methodB)) return err('shape-mismatch');
  const name = request.newMethodName.trim();
  if (name === '') return err('empty-method-name');
  if (ownerA.methods.some((method) => method.id !== methodA.id && method.name === name)) return err('duplicate-method-name');
  return ok({ methodA, ownerA, methodB, ownerB });
}

/** 統合後のFragmentを1つ組み立てる。大きいほうの行数に合わせ、uses は和集合、duplicateGroupは引き継がない。 */
function mergeFragment(newMethodId: string, index: number, fragmentA: Fragment, fragmentB: Fragment): Fragment {
  const uses = [...new Set([...(fragmentA.uses ?? []), ...(fragmentB.uses ?? [])])];
  const reads = [...new Set([...(fragmentA.reads ?? []), ...(fragmentB.reads ?? [])])];
  const writes = [...new Set([...(fragmentA.writes ?? []), ...(fragmentB.writes ?? [])])];
  return {
    id: `${newMethodId}:merge${index}`,
    label: fragmentA.label,
    responsibility: fragmentA.responsibility,
    lines: Math.max(fragmentA.lines, fragmentB.lines),
    ...(fragmentA.suggestedName === undefined ? {} : { suggestedName: fragmentA.suggestedName }),
    ...(uses.length === 0 ? {} : { uses }),
    ...(reads.length === 0 ? {} : { reads }),
    ...(writes.length === 0 ? {} : { writes }),
  };
}

/** 1つの処理のusesを、methodAId・methodBId から newMethodId へ書き換える。対象がなければそのまま返す。 */
function rewireFragment(fragment: Fragment, methodAId: string, methodBId: string, newMethodId: string): Fragment {
  const isTarget = (id: string) => id === methodAId || id === methodBId;
  if (!fragment.uses?.some(isTarget)) return fragment;
  const uses = fragment.uses.map((id) => (isTarget(id) ? newMethodId : id));
  return { ...fragment, uses: [...new Set(uses)] };
}

/** methodAId・methodBId を uses に含む処理を newMethodId へ書き換える(呼び出し元の付け替え)。 */
function rewireCallers(codebase: Codebase, methodAId: string, methodBId: string, newMethodId: string): Codebase {
  return mapClasses(codebase, (codeClass) => ({
    ...codeClass,
    methods: codeClass.methods.map((method) => ({
      ...method,
      fragments: method.fragments.map((fragment) => rewireFragment(fragment, methodAId, methodBId, newMethodId)),
    })),
  }));
}

/** メソッドAの位置に統合結果を置き換え、メソッドBを取り除く。 */
function replaceMethods(codebase: Codebase, validated: Validated, merged: Method): Codebase {
  const { methodA, ownerA, methodB, ownerB } = validated;
  return mapClasses(codebase, (codeClass) => {
    if (codeClass.id === ownerA.id) {
      const index = codeClass.methods.findIndex((method) => method.id === methodA.id);
      const methods = [...codeClass.methods];
      methods.splice(index, 1, merged);
      return { ...codeClass, methods };
    }
    if (codeClass.id === ownerB.id) {
      return { ...codeClass, methods: codeClass.methods.filter((method) => method.id !== methodB.id) };
    }
    return codeClass;
  });
}

/**
 * Merge Methods: 別クラスにある、形が完全に一致した2つのprivateメソッドを1つに統合する。
 * 統合結果は常にメソッドAの所属クラスに、Aがあった位置で置き換わる(統合先クラスは選ばせない)。
 */
export function mergeMethods(codebase: Codebase, request: MergeMethodsRequest): Result<Codebase, MergeMethodsError> {
  const validated = validate(codebase, request);
  if (!validated.ok) return validated;
  const { methodA, methodB } = validated.value;
  const merged: Method = {
    id: request.newMethodId,
    name: request.newMethodName.trim(),
    visibility: 'private',
    fragments: methodA.fragments.map((fragmentA, index) => mergeFragment(request.newMethodId, index, fragmentA, methodB.fragments[index])),
  };
  const replaced = replaceMethods(codebase, validated.value, merged);
  return ok(rewireCallers(replaced, methodA.id, methodB.id, request.newMethodId));
}

/** 選んだメソッドと処理の形(duplicateGroupの並び)が一致する、別クラスのprivateメソッドを列挙する。 */
export function findMergeCandidates(codebase: Codebase, methodId: string): MergeCandidate[] {
  const method = findMethod(codebase, methodId);
  const owner = findClassOfMethod(codebase, methodId);
  if (method === undefined || owner === undefined) return [];
  return allClasses(codebase).flatMap((codeClass) => {
    if (codeClass.id === owner.id) return [];
    return codeClass.methods
      .filter((candidate) => candidate.visibility === 'private' && sameShape(method, candidate))
      .map((candidate) => ({ method: candidate, ownerClassId: codeClass.id }));
  });
}
