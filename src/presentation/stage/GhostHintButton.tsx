import { nextGhostMove } from '../../domain/stage/ghostMove';
import { sampleAnswerSteps } from '../../domain/stage/sampleAnswer';
import type { Stage } from '../../domain/stage/Stage';
import { useGameStore } from '../store/useGameStore';

function ghostHintTitle(unlocked: boolean, hasMove: boolean): string {
  if (!unlocked) return '先に「どこが問題?」を見てみよう';
  return hasMove
    ? '次に動かす手を、キャンバスの上で動きで見せます(答えが分かります)'
    : 'ドラッグで動かす手は残っていません';
}

export function GhostHintButton({ stage, score, investigating, unlocked, onPlay }: Readonly<{ stage: Stage; score: number; investigating: boolean; unlocked: boolean; onPlay?: () => void }>) {
  const codebase = useGameStore((state) => state.codebase);
  const ghost = useGameStore((state) => state.ghost);
  const manualFixing = useGameStore((state) => state.manualFix !== null);
  const playGhost = useGameStore((state) => state.playGhost);
  const recordAssist = useGameStore((state) => state.recordAssist);
  const move = nextGhostMove(codebase, sampleAnswerSteps[stage.id] ?? []);
  const disabled = investigating || manualFixing || ghost !== null || move === undefined || score >= 100;
  const title = ghostHintTitle(unlocked, move !== undefined);
  return (
    <button
      type="button"
      className="ghost-hint-button"
      data-testid="ghost-hint"
      disabled={disabled || !unlocked}
      title={title}
      onClick={() => {
        if (move === undefined) return;
        playGhost(move);
        recordAssist('ghost');
        onPlay?.();
      }}
    >
      動きで見る
    </button>
  );
}
