import type { MethodNaming } from '../codebase/suggestMethodName';
import type { Stage } from './Stage';
import { sampleAnswerSteps, type SolutionStep } from './sampleAnswer';

export function methodNamingOf(
  stage: Pick<Stage, 'id' | 'methodNames'>,
  steps: Partial<Record<string, readonly SolutionStep[]>> = sampleAnswerSteps,
): MethodNaming {
  const groups = (steps[stage.id] ?? []).flatMap((step) => {
    if (!('extract' in step)) return [];
    return [{ fragmentIds: step.extract.fragmentIds, name: step.extract.name }];
  });
  return { groups, byResponsibility: stage.methodNames ?? {} };
}
