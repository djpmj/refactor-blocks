import { useEffect, useId, useMemo, useRef } from 'react';
import type { Stage } from '../../domain/stage/Stage';
import { scoreCodebase } from '../../domain/scoring/score';
import { useGameStore } from '../store/useGameStore';
import type { OperationTone } from './describeOperationResult';
import { operationTimeline, type OperationTimelineEntry } from './operationTimeline';
import { useFocusOnOpen, usePopoverDismiss } from './usePopoverDismiss';

const TONE_MARK: Record<OperationTone, string> = { better: '↑', worse: '↓', mixed: '↕' };

function signed(diff: number): string {
  if (diff === 0) return '±0';
  return diff > 0 ? `+${diff}` : `${diff}`;
}

function entryClass(entry: OperationTimelineEntry, current: boolean): string {
  return ['operation-history__entry', entry.undone ? 'operation-history__entry--undone' : '', current ? 'operation-history__entry--current' : ''].filter(Boolean).join(' ');
}

function HistoryEntry({ entry, current }: Readonly<{ entry: OperationTimelineEntry; current: boolean }>) {
  return (
    <li data-testid="operation-history-entry" className={entryClass(entry, current)} aria-current={current ? 'step' : undefined}>
      <div className="operation-history__head">
        {entry.tone !== null && <span aria-hidden="true">{TONE_MARK[entry.tone]} </span>}
        <strong>{entry.step}. {entry.label}</strong> {entry.scoreBefore}点 → {entry.scoreAfter}点({signed(entry.scoreAfter - entry.scoreBefore)}){entry.undone && '(取り消し済み)'}
      </div>
      <ul className="operation-history__changes">
        {entry.changes.length === 0 ? <li>減点は変わりませんでした</li> : entry.changes.map((change) => <li key={change} data-testid="operation-history-change">{change}</li>)}
      </ul>
    </li>
  );
}

/** ツールバーの「操作の記録 ▾」。ステージを始めてからの操作ごとの点数の増減と、変わった減点を古い順に並べる。 */
export function OperationHistoryPopover({ stage, open, onOpenChange }: Readonly<{ stage: Stage; open: boolean; onOpenChange: (open: boolean) => void }>) {
  const investigating = useGameStore((state) => state.changeSession !== null);
  const history = useGameStore((state) => state.history);
  const codebase = useGameStore((state) => state.codebase);
  const operationLabels = useGameStore((state) => state.operationLabels);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const shown = open && !investigating;
  usePopoverDismiss(shown, containerRef, buttonRef, () => onOpenChange(false));
  useFocusOnOpen(shown, panelRef);
  const entries = useMemo(
    () => (shown ? operationTimeline(history, codebase, (c) => scoreCodebase(c, stage), (c) => operationLabels.get(c)) : []),
    [shown, history, codebase, stage, operationLabels],
  );
  useEffect(() => {
    if (shown) panelRef.current?.querySelector('[aria-current="step"]')?.scrollIntoView({ block: 'nearest' });
  }, [shown, history]);
  const currentStep = history.past.length;
  return (
    <div className="popover" ref={containerRef}>
      <button
        ref={buttonRef}
        type="button"
        data-testid="operation-history-button"
        aria-haspopup="dialog"
        aria-expanded={shown}
        aria-controls={panelId}
        disabled={investigating}
        onClick={() => onOpenChange(!shown)}
      >
        操作の記録 ▾
      </button>
      {shown && (
        <div ref={panelRef} id={panelId} className="popover__panel operation-history" role="dialog" aria-label="操作の記録" tabIndex={-1} data-testid="operation-history">
          {entries.length === 0 ? (
            <p>まだ操作していません。抽出や移動をすると、ここに点数の変化が残ります</p>
          ) : (
            <ol className="operation-history__list">
              {entries.map((entry) => <HistoryEntry key={entry.step} entry={entry} current={entry.step === currentStep} />)}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}
