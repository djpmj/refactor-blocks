import { sampleAnswerSteps } from '../../domain/stage/sampleAnswer';
import type { SolutionStep } from '../../domain/stage/sampleAnswer';
import type { Stage } from '../../domain/stage/Stage';
import { describeSolutionStep } from './describeSolutionStep';

/** 模範解答の手順を1手ずつ日本語の文にして、先頭から revealedCount 個を返す。 */
export function useHints(stage: Stage, revealedCount: number): { hints: { text: string; step: SolutionStep }[]; total: number } {
  const steps = sampleAnswerSteps[stage.id] ?? [];
  const hints = steps.slice(0, revealedCount).map((step) => ({ text: describeSolutionStep(stage.codebase, step), step }));
  return { hints, total: steps.length };
}
