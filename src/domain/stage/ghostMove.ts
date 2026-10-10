import { allClasses, fieldsOf, type Codebase } from '../codebase/Codebase';
import type { SolutionStep } from './sampleAnswer';

export type GhostMove =
  | { readonly kind: 'method'; readonly methodId: string; readonly toClassId: string }
  | { readonly kind: 'field'; readonly fieldId: string; readonly toClassId: string }
  | { readonly kind: 'class'; readonly classId: string; readonly toFileId: string };

function nextMethodMove(codebase: Codebase, step: Extract<SolutionStep, { readonly move: unknown }>): GhostMove | undefined {
  const { method: name, fromClass, toClass } = step.move;
  const classes = allClasses(codebase);
  const source = classes
    .filter((codeClass) => fromClass === undefined || codeClass.name === fromClass)
    .flatMap((codeClass) => codeClass.methods.map((method) => ({ method, owner: codeClass })))
    .find(({ method }) => method.name === name);
  const destination = classes.find((codeClass) => codeClass.name === toClass);
  if (source === undefined || destination === undefined || source.owner.id === destination.id) return undefined;
  return { kind: 'method', methodId: source.method.id, toClassId: destination.id };
}

function nextFieldMove(codebase: Codebase, step: Extract<SolutionStep, { readonly moveField: unknown }>): GhostMove | undefined {
  const { field: name, fromClass, toClass } = step.moveField;
  const classes = allClasses(codebase);
  const source = classes.find((codeClass) => codeClass.name === fromClass);
  const field = source === undefined ? undefined : fieldsOf(source).find((item) => item.name === name);
  const destination = classes.find((codeClass) => codeClass.name === toClass);
  if (field === undefined || source === undefined || destination === undefined || source.id === destination.id) return undefined;
  return { kind: 'field', fieldId: field.id, toClassId: destination.id };
}

function nextClassMove(codebase: Codebase, step: Extract<SolutionStep, { readonly moveClass: unknown }>): GhostMove | undefined {
  const { name, toFile } = step.moveClass;
  const sourceFile = codebase.files.find((file) => file.classes.some((codeClass) => codeClass.name === name));
  const codeClass = sourceFile?.classes.find((item) => item.name === name);
  const destination = codebase.files.find((file) => file.path === toFile);
  if (codeClass === undefined || destination === undefined || sourceFile?.id === destination.id) return undefined;
  return { kind: 'class', classId: codeClass.id, toFileId: destination.id };
}

/** Selects the first remaining draggable sample-answer step without changing the codebase. */
export function nextGhostMove(codebase: Codebase, steps: readonly SolutionStep[]): GhostMove | undefined {
  for (const step of steps) {
    const move = ghostMoveForStep(codebase, step);
    if (move !== undefined) return move;
  }
  return undefined;
}

function ghostMoveForStep(codebase: Codebase, step: SolutionStep): GhostMove | undefined {
  if ('move' in step) return nextMethodMove(codebase, step);
  if ('moveField' in step) return nextFieldMove(codebase, step);
  if ('moveClass' in step) return nextClassMove(codebase, step);
  return undefined;
}
