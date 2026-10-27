import { useEffect, useMemo } from 'react';
import { movesSince } from '../../domain/codebase/history';
import { sampleMovesToPerfect } from '../../domain/stage/sampleAnswer';
import type { Stage } from '../../domain/stage/Stage';
import { useGameStore } from '../store/useGameStore';
import { describeMoveCount } from './describeMoveCount';

/** 100点のときだけ出す、自分の手数と模範解答の手数の1行。点数とクリア条件は変えない。 */
export function MoveCountNote({ stage }: Readonly<{ stage: Stage }>) {
  const history = useGameStore((state) => state.history);
  const codebase = useGameStore((state) => state.codebase);
  const best = useGameStore((state) => state.moveBests[stage.id]);
  const recordMoveBest = useGameStore((state) => state.recordMoveBest);
  const sample = useMemo(() => sampleMovesToPerfect(stage), [stage]);
  const moves = movesSince(history, codebase, stage.codebase);
  useEffect(() => {
    if (moves !== undefined) recordMoveBest(stage.id, moves);
  }, [stage.id, moves, recordMoveBest]);
  return <p className="move-count" data-testid="move-count">{describeMoveCount({ moves, sample, best })}</p>;
}
