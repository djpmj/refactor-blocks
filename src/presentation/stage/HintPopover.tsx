import { useId, useRef } from 'react';
import type { Codebase } from '../../domain/codebase/Codebase';
import type { Score } from '../../domain/scoring/score';
import type { SolutionStep } from '../../domain/stage/sampleAnswer';
import type { Stage } from '../../domain/stage/Stage';
import { useGameStore } from '../store/useGameStore';
import { GhostHintButton } from './GhostHintButton';
import { HintList } from './HintList';
import { HintButton } from './HintPanel';
import { ProblemHint } from './ProblemHint';
import { useIdle } from './useIdle';
import { useFocusOnOpen, usePopoverDismiss } from './usePopoverDismiss';

type HintPopoverProps = Readonly<{
  stage: Stage;
  codebase: Codebase;
  score: Score;
  investigating: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  revealedCount: number;
  hints: readonly { text: string; step: SolutionStep }[];
  total: number;
  problemRevealed: boolean;
  onRevealProblem: () => void;
  onReveal: () => void;
}>;

/** ツールバーの「ヒント ▾」。押したときだけ、3段階のヒントとヒント一覧をパネルで見せる。 */
export function HintPopover({ stage, codebase, score, investigating, open, onOpenChange, revealedCount, hints, total, problemRevealed, onRevealProblem, onReveal }: HintPopoverProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const stored = useGameStore((state) => state.codebase);
  const idle = useIdle(!investigating && !problemRevealed && score.total < 100, stored, stage.id);
  const shown = open && !investigating;
  usePopoverDismiss(shown, containerRef, buttonRef, () => onOpenChange(false));
  useFocusOnOpen(shown, panelRef);
  return (
    <div className="popover" ref={containerRef}>
      <button
        ref={buttonRef}
        type="button"
        className={idle && !shown ? 'ghost-hint-button--idle' : undefined}
        data-testid="hint-popover-button"
        aria-haspopup="dialog"
        aria-expanded={shown}
        aria-controls={panelId}
        disabled={investigating}
        onClick={() => onOpenChange(!open)}
      >
        ヒント ▾
      </button>
      {shown && (
        <div ref={panelRef} id={panelId} className="popover__panel" role="dialog" aria-label="ヒント" tabIndex={-1} data-testid="hint-popover">
          <div className="stage-panel__hint-steps">
            <ProblemHint score={score} revealed={problemRevealed} disabled={false} onReveal={onRevealProblem} />
            <HintButton revealed={revealedCount} total={total} disabled={!problemRevealed} onReveal={onReveal} />
            <div className="stage-panel__hint-step">
              <span className="stage-panel__hint-number" aria-hidden="true">3</span>
              <GhostHintButton stage={stage} score={score.total} investigating={false} unlocked={problemRevealed} onPlay={() => onOpenChange(false)} />
            </div>
          </div>
          <HintList hints={hints} codebase={codebase} onFocus={() => onOpenChange(false)} />
        </div>
      )}
    </div>
  );
}
