import { useId, useRef } from 'react';
import type { Stage } from '../../domain/stage/Stage';
import { useGameStore } from '../store/useGameStore';
import { RumorList } from './RumorList';
import { rumorsOf } from './rumorsOf';
import { useFocusOnOpen, usePopoverDismiss } from './usePopoverDismiss';

/** ツールバーの「うわさ(N) ▾」。うわさの無いステージでは出さない。 */
export function RumorPopover({ stage, open, onOpenChange }: Readonly<{ stage: Stage; open: boolean; onOpenChange: (open: boolean) => void }>) {
  const investigating = useGameStore((state) => state.changeSession !== null);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const count = rumorsOf(stage).length;
  const shown = open && !investigating;
  usePopoverDismiss(shown, containerRef, buttonRef, () => onOpenChange(false));
  useFocusOnOpen(shown, panelRef);
  if (count === 0) return null;
  return (
    <div className="popover" ref={containerRef}>
      <button
        ref={buttonRef}
        type="button"
        data-testid="rumor-popover-button"
        aria-haspopup="dialog"
        aria-expanded={shown}
        aria-controls={panelId}
        disabled={investigating}
        onClick={() => onOpenChange(!shown)}
      >
        うわさ({count}) ▾
      </button>
      {shown && (
        <div ref={panelRef} id={panelId} className="popover__panel" role="dialog" aria-label="気になるうわさ" tabIndex={-1} data-testid="rumor-popover">
          <RumorList stage={stage} />
        </div>
      )}
    </div>
  );
}
