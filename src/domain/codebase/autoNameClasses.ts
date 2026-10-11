import { allClasses, type Codebase, type Fragment } from './Codebase';
import { fragmentLines } from './lineCount';
import { uniqueName } from './naming';

function fragmentsOf(codebase: Codebase, classId: string): Fragment[] {
  return allClasses(codebase).find((codeClass) => codeClass.id === classId)?.methods.flatMap((method) => method.fragments) ?? [];
}

function suggestedClassName(fragments: readonly Fragment[], codebase: Codebase, classNames: Readonly<Record<string, string>>): string {
  const weights = new Map<string, number>();
  const firstSeen: string[] = [];
  for (const fragment of fragments) {
    if (fragment.responsibility === 'call' || !Object.hasOwn(classNames, fragment.responsibility)) continue;
    if (!weights.has(fragment.responsibility)) firstSeen.push(fragment.responsibility);
    weights.set(fragment.responsibility, (weights.get(fragment.responsibility) ?? 0) + fragmentLines(fragment, codebase));
  }
  const highestWeight = Math.max(0, ...weights.values());
  const winner = firstSeen.find((responsibility) => weights.get(responsibility) === highestWeight);
  return winner === undefined ? 'NewClass' : classNames[winner] ?? 'NewClass';
}

/** 中身の責務に合わせて、自動命名対象クラスの名前を更新したCodebaseを返す。 */
export function autoNameClasses(codebase: Codebase, classNames: Readonly<Record<string, string>>): Codebase {
  const occupied = new Set(allClasses(codebase).filter((codeClass) => codeClass.autoNamed !== true).map((codeClass) => codeClass.name));
  const results = codebase.files.map((file) => {
    const classes = file.classes.map((codeClass) => {
        if (codeClass.autoNamed !== true) return codeClass;
        const baseName = suggestedClassName(fragmentsOf(codebase, codeClass.id), codebase, classNames);
        const name = uniqueName(baseName, (candidate) => occupied.has(candidate));
        occupied.add(name);
        if (name === codeClass.name) return codeClass;
        return { ...codeClass, name };
      });
    return { file: { ...file, classes }, changed: classes.some((codeClass, index) => codeClass !== file.classes[index]) };
  });
  return results.some((result) => result.changed) ? { files: results.map((result) => result.file) } : codebase;
}
