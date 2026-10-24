import { sampleAnswerSteps } from '../../domain/stage/sampleAnswer';
import type { SolutionStep } from '../../domain/stage/sampleAnswer';
import { phaseOfStep, type SolutionPhase } from '../../domain/stage/solutionPhases';
import type { Stage } from '../../domain/stage/Stage';
import { solutionPhaseTable } from '../../infrastructure/stages/solutionPhaseTable';
import { describeSolutionStep } from './describeSolutionStep';

/** phaseStart は、この手順が方針の最初の手順のときだけ、その方針を持つ(見出しを出す印)。 */
export type StepHint = { text: string; step: SolutionStep; phaseStart?: SolutionPhase };

/** 模範解答の手順を1手ずつ日本語の文にして、先頭から revealedCount 個を返す。 */
export function useHints(stage: Stage, revealedCount: number): { hints: StepHint[]; total: number } {
  const steps = sampleAnswerSteps[stage.id] ?? [];
  const phases = solutionPhaseTable[stage.id] ?? [];
  const hints = steps.slice(0, revealedCount).map((step, index) => {
    const phase = phaseOfStep(phases, index);
    return { text: describeSolutionStep(stage.codebase, step), step, phaseStart: phase?.from === index ? phase : undefined };
  });
  return { hints, total: steps.length };
}
