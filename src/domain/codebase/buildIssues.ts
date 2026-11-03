import { allClasses, extendsChainIds, fieldsOf, type Codebase, type CodeClass, type Method, type Visibility } from './Codebase';
import { compositionOrder } from './csharpWiring';
import { fieldOwnerMap, methodOwnerMap } from './dependencies';
import { overriddenAbstract, resolvesToOwnDeclaration } from './overrides';

/** ゲームでは許されているが、C# ではビルドが通らない箇所。 */
export type BuildIssue = {
  readonly classId: string;
  readonly methodId: string;
  /** 使っている private メンバー(メソッド名またはフィールド名)。hook-not-declared では呼んでいる子のメソッド、narrow-override では実装しているメソッド。 */
  readonly memberName: string;
  /** そのメンバーの持ち主のクラスID。 */
  readonly ownerClassId: string;
  readonly reason: 'private-member' | 'ambiguous-binding' | 'hook-not-declared' | 'narrow-override';
};

/** コードベース全体から1回だけ作る索引。メソッドごとに作り直さない。 */
type Index = { readonly classes: readonly CodeClass[]; readonly methodOwners: ReadonlyMap<string, string>; readonly fieldOwners: ReadonlyMap<string, string> };

function memberIssues(index: Index, codeClass: CodeClass, method: Method): BuildIssue[] {
  const { classes, methodOwners, fieldOwners } = index;
  const privateMembers = method.fragments.flatMap((fragment) => [
    ...(fragment.uses ?? []).flatMap((id) => {
      const ownerId = methodOwners.get(id);
      const target = classes.find((c) => c.id === ownerId)?.methods.find((m) => m.id === id);
      return ownerId === undefined || target?.visibility !== 'private' ? [] : [{ ownerId, name: target.name }];
    }),
    ...[...(fragment.reads ?? []), ...(fragment.writes ?? [])].flatMap((id) => {
      const ownerId = fieldOwners.get(id);
      const target = classes.flatMap((c) => fieldsOf(c)).find((f) => f.id === id);
      return ownerId === undefined || target?.visibility !== 'private' ? [] : [{ ownerId, name: target.name }];
    }),
  ]);
  const others = privateMembers.filter((member) => member.ownerId !== codeClass.id);
  const unique = [...new Map(others.map((member) => [`${member.ownerId}.${member.name}`, member])).values()];
  return unique.map((member) => ({ classId: codeClass.id, methodId: method.id, memberName: member.name, ownerClassId: member.ownerId, reason: 'private-member' }));
}

/** 親が、子クラスのメソッドを呼んでいる(親に同じ名前の抽象メソッドの宣言が無い)箇所。C# では親から子のメンバーは見えない。 */
function hookIssues(codebase: Codebase, codeClass: CodeClass, method: Method, methodOwners: ReadonlyMap<string, string>): BuildIssue[] {
  const hooks = method.fragments.flatMap((fragment) => (fragment.uses ?? []).flatMap((id) => {
    const ownerId = methodOwners.get(id);
    const isDescendant = ownerId !== undefined && ownerId !== codeClass.id && extendsChainIds(codebase, ownerId).has(codeClass.id);
    const target = allClasses(codebase).find((c) => c.id === ownerId)?.methods.find((m) => m.id === id);
    return isDescendant && target !== undefined && !resolvesToOwnDeclaration(codebase, codeClass.id, id) ? [{ ownerId, name: target.name }] : [];
  }));
  const unique = [...new Map(hooks.map((hook) => [`${hook.ownerId}.${hook.name}`, hook])).values()];
  return unique.map((hook): BuildIssue => ({ classId: codeClass.id, methodId: method.id, memberName: hook.name, ownerClassId: hook.ownerId, reason: 'hook-not-declared' }));
}

const visibilityRank: Readonly<Record<Visibility, number>> = { private: 0, protected: 1, public: 2 };

/** 抽象メソッドの実装が、宣言より狭い可視性(protected の宣言を private で実装するなど)になっている箇所。 */
function narrowOverrideIssues(codebase: Codebase, codeClass: CodeClass, method: Method): BuildIssue[] {
  const overridden = overriddenAbstract(codebase, codeClass, method);
  if (overridden === undefined || visibilityRank[method.visibility] >= visibilityRank[overridden.declaration.visibility]) return [];
  return [{ classId: codeClass.id, methodId: method.id, memberName: method.name, ownerClassId: overridden.owner.id, reason: 'narrow-override' }];
}

/** 別クラスの private メンバー(メソッド・フィールド)を使っている箇所を、クラス・メソッドの順に返す。そのあとに、注入する実装が決められない箇所を続ける。 */
export function findBuildIssues(codebase: Codebase, bindings?: Readonly<Record<string, string>>): readonly BuildIssue[] {
  const classes = allClasses(codebase);
  const index: Index = { classes, methodOwners: methodOwnerMap(codebase), fieldOwners: fieldOwnerMap(codebase) };
  const privateIssues = classes.flatMap((codeClass) => codeClass.methods.flatMap((method) => memberIssues(index, codeClass, method)));
  const inheritanceIssues = classes.flatMap((codeClass) => codeClass.methods.flatMap((method) => [
    ...hookIssues(codebase, codeClass, method, index.methodOwners),
    ...narrowOverrideIssues(codebase, codeClass, method),
  ]));
  return [...privateIssues, ...inheritanceIssues, ...compositionOrder(codebase, bindings).issues];
}
