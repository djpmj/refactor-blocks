import { nextGhostMove } from '../../domain/stage/ghostMove';
import { sampleAnswerSteps } from '../../domain/stage/sampleAnswer';
import type { Stage } from '../../domain/stage/Stage';
import { useGameStore } from '../store/useGameStore';
import { ReasonButton } from '../ReasonButton';
import { ghostHintReason } from './disabledReasons';

export function GhostHintButton({ stage, score, investigating, unlocked, onPlay }: Readonly<{ stage: Stage; score: number; investigating: boolean; unlocked: boolean; onPlay?: () => void }>) {
  const codebase = useGameStore((state) => state.codebase);
  const ghost = useGameStore((state) => state.ghost);
  const manualFixing = useGameStore((state) => state.manualFix !== null);
  const playGhost = useGameStore((state) => state.playGhost);
  const recordAssist = useGameStore((state) => state.recordAssist);
  const move = nextGhostMove(codebase, sampleAnswerSteps[stage.id] ?? []);
  const disabledReason = ghostHintReason({ investigating, unlocked, manualFixing, playing: ghost !== null, hasMove: move !== undefined, perfect: score >= 100 });
  return (
    <ReasonButton
      className="ghost-hint-button"
      data-testid="ghost-hint"
      disabledReason={disabledReason}
      title="次に動かす手を、キャンバスの上で動きで見せます(答えが分かります)"
      onClick={() => {
        if (move === undefined) return;
        playGhost(move);
        recordAssist('ghost');
        onPlay?.();
      }}
    >
      動きで見る
    </ReasonButton>
  );
}
