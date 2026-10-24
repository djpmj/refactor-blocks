import { findClass, findClassOfMethod, findMethod, type Codebase } from '../../domain/codebase/Codebase';
import type { DependencyPair } from '../../domain/scoring/violationDependencies';
import type { ViolationTarget } from '../../domain/scoring/violationTargets';

/** 減点の内訳に並べる名前。押したときにキャンバスで選ぶ場所を target に持つ。 */
export type TargetName = { readonly label: string; readonly target: ViolationTarget };
export type DescribedTargets = { readonly names: readonly TargetName[]; /** 表示数の上限を超えて省いた件数。 */ readonly rest: number };

const MAX_NAMES = 5;
const NONE: ViolationTarget = { fileIds: [], classIds: [], methodIds: [] };

function limited(names: readonly TargetName[]): DescribedTargets {
  return { names: names.slice(0, MAX_NAMES), rest: Math.max(0, names.length - MAX_NAMES) };
}

function fileName(codebase: Codebase, fileId: string): TargetName | null {
  const file = codebase.files.find(({ id }) => id === fileId);
  if (file === undefined) return null;
  const names = file.classes.map(({ name }) => name);
  return { label: `${names.length > 0 ? names.join('・') : file.path} のファイル`, target: { ...NONE, fileIds: [fileId] } };
}

function className(codebase: Codebase, classId: string): TargetName | null {
  const codeClass = findClass(codebase, classId);
  return codeClass === undefined ? null : { label: codeClass.name, target: { ...NONE, classIds: [classId] } };
}

function methodName(codebase: Codebase, methodId: string): TargetName | null {
  const method = findMethod(codebase, methodId);
  const owner = findClassOfMethod(codebase, methodId);
  return method === undefined || owner === undefined ? null : { label: `${owner.name}.${method.name}()`, target: { ...NONE, methodIds: [methodId] } };
}

function present(names: readonly (TargetName | null)[]): TargetName[] {
  return names.filter((name) => name !== null);
}

/** 違反の対象のIDを、表示用の名前(Class.method()・Class・「〜 のファイル」)にする。存在しないIDは飛ばし、5件を超えたら残りは件数にする。 */
export function describeTargets(codebase: Codebase, target: ViolationTarget): DescribedTargets {
  return limited(present([
    ...target.methodIds.map((id) => methodName(codebase, id)),
    ...target.classIds.map((id) => className(codebase, id)),
    ...target.fileIds.map((id) => fileName(codebase, id)),
  ]));
}

/** 違反の依存を `From → To` にする。押すと両端のクラスを対象にする。どちらかのクラスが無い依存は飛ばす。 */
export function describeDependencies(codebase: Codebase, dependencies: readonly DependencyPair[]): DescribedTargets {
  return limited(dependencies.flatMap(({ from, to }): TargetName[] => {
    const fromClass = findClass(codebase, from);
    const toClass = findClass(codebase, to);
    if (fromClass === undefined || toClass === undefined) return [];
    return [{ label: `${fromClass.name} → ${toClass.name}`, target: { ...NONE, classIds: [from, to] } }];
  }));
}
