import { nextGhostMove } from '../../domain/stage/ghostMove';
import { sampleAnswerSteps } from '../../domain/stage/sampleAnswer';
import type { Stage } from '../../domain/stage/Stage';
import { useGameStore } from '../store/useGameStore';
import { useIdle } from './useIdle';

export function GhostHintButton({ stage, score, investigating }: Readonly<{ stage: Stage; score: number; investigating: boolean }>) {
  const codebase = useGameStore((state) => state.codebase);
  const ghost = useGameStore((state) => state.ghost);
  const manualFixing = useGameStore((state) => state.manualFix !== null);
  const playGhost = useGameStore((state) => state.playGhost);
  const move = nextGhostMove(codebase, sampleAnswerSteps[stage.id] ?? []);
  const disabled = investigating || manualFixing || ghost !== null || move === undefined || score >= 100;
  const idle = useIdle(!investigating && !manualFixing && score < 100, codebase, manualFixing);
  return (
    <button
      type="button"
      className={`ghost-hint-button${idle && !disabled ? ' ghost-hint-button--idle' : ''}`}
      data-testid="ghost-hint"
      disabled={disabled}
      title={move === undefined ? 'ドラッグで動かす手は残っていません' : undefined}
      onClick={() => { if (move !== undefined) playGhost(move); }}
    >
      少しだけヒント
    </button>
  );
}
