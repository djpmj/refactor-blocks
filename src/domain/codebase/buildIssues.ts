import { allClasses, fieldsOf, type Codebase, type CodeClass, type Method } from './Codebase';
import { compositionOrder } from './csharpWiring';
import { fieldOwnerMap, methodOwnerMap } from './dependencies';

/** ゲームでは許されているが、C# ではビルドが通らない箇所。 */
export type BuildIssue = {
  readonly classId: string;
  readonly methodId: string;
  /** 使っている private メンバー(メソッド名またはフィールド名)。 */
  readonly memberName: string;
  /** そのメンバーの持ち主のクラスID。 */
  readonly ownerClassId: string;
  readonly reason: 'private-member' | 'ambiguous-binding';
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

/** 別クラスの private メンバー(メソッド・フィールド)を使っている箇所を、クラス・メソッドの順に返す。そのあとに、注入する実装が決められない箇所を続ける。 */
export function findBuildIssues(codebase: Codebase, bindings?: Readonly<Record<string, string>>): readonly BuildIssue[] {
  const classes = allClasses(codebase);
  const index: Index = { classes, methodOwners: methodOwnerMap(codebase), fieldOwners: fieldOwnerMap(codebase) };
  const privateIssues = classes.flatMap((codeClass) => codeClass.methods.flatMap((method) => memberIssues(index, codeClass, method)));
  return [...privateIssues, ...compositionOrder(codebase, bindings).issues];
}
