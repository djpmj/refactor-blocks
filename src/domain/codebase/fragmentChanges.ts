import { allClasses, type Codebase } from './Codebase';

export type MethodLocation = { readonly className: string; readonly methodName: string };
export type FragmentChange =
  | { readonly kind: 'moved'; readonly from: MethodLocation; readonly to: MethodLocation }
  | { readonly kind: 'added'; readonly to: MethodLocation }
  | { readonly kind: 'removed'; readonly from: MethodLocation };

type Placement = MethodLocation & { readonly classId: string; readonly methodId: string };

function placements(codebase: Codebase): Map<string, Placement> {
  const result = new Map<string, Placement>();
  for (const codeClass of allClasses(codebase)) {
    for (const method of codeClass.methods) {
      for (const fragment of method.fragments) {
        result.set(fragment.id, { classId: codeClass.id, methodId: method.id, className: codeClass.name, methodName: method.name });
      }
    }
  }
  return result;
}

function location({ className, methodName }: Placement): MethodLocation {
  return { className, methodName };
}

/** 処理(Fragment.id)ごとに、2つのコードベースで置き場所が変わったものを求める。置き場所が同じ処理は入れない。 */
export function fragmentChanges(before: Codebase, after: Codebase): ReadonlyMap<string, FragmentChange> {
  const beforePlacements = placements(before);
  const afterPlacements = placements(after);
  const changes = new Map<string, FragmentChange>();
  for (const [id, to] of afterPlacements) {
    const from = beforePlacements.get(id);
    if (from === undefined) changes.set(id, { kind: 'added', to: location(to) });
    else if (from.methodId !== to.methodId || from.classId !== to.classId) changes.set(id, { kind: 'moved', from: location(from), to: location(to) });
  }
  for (const [id, from] of beforePlacements) {
    if (!afterPlacements.has(id)) changes.set(id, { kind: 'removed', from: location(from) });
  }
  return changes;
}
