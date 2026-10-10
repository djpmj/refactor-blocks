import { allClasses, type Codebase } from '../codebase/Codebase';
import type { ViolationTarget } from '../scoring/violationTargets';
import type { SolutionStep } from './sampleAnswer';

type MethodStep = Extract<
  SolutionStep,
  | { readonly extract: unknown }
  | { readonly move: unknown }
  | { readonly deleteMethod: unknown }
  | { readonly inline: unknown }
  | { readonly moveField: unknown }
  | { readonly changeVisibility: unknown }
  | { readonly merge: unknown }
>;

type StructuralStep = Exclude<SolutionStep, MethodStep>;
type FileStep = Extract<StructuralStep, { readonly addFile: unknown } | { readonly deleteFile: unknown } | { readonly addClass: unknown } | { readonly moveClass: unknown }>;
type RelationshipStep = Exclude<StructuralStep, FileStep>;

const EMPTY_TARGET: ViolationTarget = { fileIds: [], classIds: [], methodIds: [] };

function methodId(codebase: Codebase, name: string, ownerClassName?: string): string | undefined {
  return allClasses(codebase)
    .filter((codeClass) => ownerClassName === undefined || codeClass.name === ownerClassName)
    .flatMap((codeClass) => codeClass.methods)
    .find((method) => method.name === name)?.id;
}

function classId(codebase: Codebase, name: string): string | undefined {
  return allClasses(codebase).find((codeClass) => codeClass.name === name)?.id;
}

function fileId(codebase: Codebase, path: string): string | undefined {
  return codebase.files.find((file) => file.path === path)?.id;
}

function ids(values: readonly (string | undefined)[]): string[] {
  return [...new Set(values.filter((id): id is string => id !== undefined))];
}

function isMethodStep(step: SolutionStep): step is MethodStep {
  return 'extract' in step || 'move' in step || 'deleteMethod' in step || 'inline' in step || 'moveField' in step || 'changeVisibility' in step || 'merge' in step;
}

function isFileStep(step: StructuralStep): step is FileStep {
  return 'addFile' in step || 'deleteFile' in step || 'addClass' in step || 'moveClass' in step;
}

function targetMethodStep(codebase: Codebase, step: MethodStep): ViolationTarget {
  if ('extract' in step) return { ...EMPTY_TARGET, methodIds: ids([methodId(codebase, step.extract.from, step.extract.fromClass)]) };
  if ('move' in step) return {
    ...EMPTY_TARGET,
    classIds: ids([classId(codebase, step.move.toClass)]),
    methodIds: ids([methodId(codebase, step.move.method, step.move.fromClass)]),
  };
  if ('deleteMethod' in step) return { ...EMPTY_TARGET, methodIds: ids([methodId(codebase, step.deleteMethod.method, step.deleteMethod.fromClass)]) };
  if ('inline' in step) return { ...EMPTY_TARGET, methodIds: ids([methodId(codebase, step.inline.method, step.inline.fromClass)]) };
  if ('moveField' in step) return { ...EMPTY_TARGET, classIds: ids([classId(codebase, step.moveField.fromClass), classId(codebase, step.moveField.toClass)]) };
  if ('changeVisibility' in step) return { ...EMPTY_TARGET, methodIds: ids([methodId(codebase, step.changeVisibility.method, step.changeVisibility.class)]) };
  return {
    ...EMPTY_TARGET,
    methodIds: ids([
      methodId(codebase, step.merge.methodA, step.merge.methodAClass),
      methodId(codebase, step.merge.methodB, step.merge.methodBClass),
    ]),
  };
}

function targetFileStep(codebase: Codebase, step: FileStep): ViolationTarget {
  if ('addFile' in step) return EMPTY_TARGET;
  if ('deleteFile' in step) return { ...EMPTY_TARGET, fileIds: ids([fileId(codebase, step.deleteFile)]) };
  if ('addClass' in step) return { ...EMPTY_TARGET, fileIds: ids([fileId(codebase, step.addClass.file)]) };
  if ('moveClass' in step) return {
    ...EMPTY_TARGET,
    classIds: ids([classId(codebase, step.moveClass.name)]),
    fileIds: ids([fileId(codebase, step.moveClass.toFile)]),
  };
  const exhaustive: never = step;
  return exhaustive;
}

function targetRelationshipStep(codebase: Codebase, step: RelationshipStep): ViolationTarget {
  if ('setSuperclass' in step) return { ...EMPTY_TARGET, classIds: ids([classId(codebase, step.setSuperclass.class), step.setSuperclass.superclass === null ? undefined : classId(codebase, step.setSuperclass.superclass)]) };
  if ('addInterface' in step) return { ...EMPTY_TARGET, classIds: ids([classId(codebase, step.addInterface.class), classId(codebase, step.addInterface.interface)]) };
  if ('removeInterface' in step) return { ...EMPTY_TARGET, classIds: ids([classId(codebase, step.removeInterface.class), classId(codebase, step.removeInterface.interface)]) };
  if ('renameClass' in step) return { ...EMPTY_TARGET, classIds: ids([classId(codebase, step.renameClass.name)]) };
  const exhaustive: never = step;
  return exhaustive;
}

/** 模範解答の1手が触るブロックを、現在のCodebaseに存在するIDで返す。 */
export function stepTargets(codebase: Codebase, step: SolutionStep): ViolationTarget {
  if (isMethodStep(step)) return targetMethodStep(codebase, step);
  return isFileStep(step) ? targetFileStep(codebase, step) : targetRelationshipStep(codebase, step);
}
