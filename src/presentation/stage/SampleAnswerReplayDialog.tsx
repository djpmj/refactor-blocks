import { useEffect, useMemo, useRef, useState } from 'react';
import { scoreCodebase } from '../../domain/scoring/score';
import { solutionSnapshots, type SolutionStep } from '../../domain/stage/sampleAnswer';
import type { Stage } from '../../domain/stage/Stage';
import { CodebasePreviewCanvas } from '../preview/CodebasePreviewCanvas';
import { describeSolutionStep } from './describeSolutionStep';

const TITLE_ID = 'sample-replay-title';
const INITIAL_DESCRIPTION = '最初の状態です。『次へ』で1手ずつ進めます';

type SampleAnswerReplayDialogProps = {
  readonly stage: Stage;
  readonly steps: readonly SolutionStep[];
  readonly onClose: () => void;
};

/** 模範解答の手順を1手ずつ図で再生する読み取り専用のダイアログ。表示するたびに作り直し、0手目から始める。 */
export function SampleAnswerReplayDialog({ stage, steps, onClose }: SampleAnswerReplayDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const [position, setPosition] = useState(0);
  const snapshots = useMemo(() => solutionSnapshots(stage.codebase, steps), [stage, steps]);
  const totals = useMemo(() => snapshots.map((snapshot) => scoreCodebase(snapshot, stage).total), [snapshots, stage]);
  useEffect(() => {
    const dialog = ref.current;
    if (dialog !== null && !dialog.open) dialog.showModal();
  }, []);
  const last = steps.length;
  const goTo = (next: number) => setPosition(Math.max(0, Math.min(last, next)));
  // ボタンが disabled になるとフォーカスが body へ戻りダイアログの keydown に届かないので、window で受ける(モーダルなので他の操作とは競合しない)
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') setPosition((current) => Math.max(0, current - 1));
      if (event.key === 'ArrowRight') setPosition((current) => Math.min(steps.length, current + 1));
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [steps.length]);
  const total = totals[position];
  const gain = position > 0 ? total - totals[position - 1] : 0;
  const description = position === 0 ? INITIAL_DESCRIPTION : describeSolutionStep(stage.codebase, steps[position - 1]);
  return (
    <dialog ref={ref} className="codebase-preview sample-replay" aria-labelledby={TITLE_ID} onClose={onClose} data-testid="sample-replay">
      <div className="codebase-preview__header">
        <h2 className="codebase-preview__title" id={TITLE_ID}>
          解答の再生
        </h2>
        <button type="button" onClick={onClose} aria-label="閉じる">
          ✕
        </button>
      </div>
      <div className="sample-replay__status">
        <span data-testid="sample-replay-position">
          {position} / {last} 手
        </span>
        <span data-testid="sample-replay-score">
          {total}点{gain > 0 ? ` (+${String(gain)})` : ''}
        </span>
      </div>
      <p className="sample-replay__description" data-testid="sample-replay-description">
        {description}
      </p>
      {total >= 100 && <p className="sample-replay__perfect">ここまでで100点です</p>}
      <div className="codebase-preview__canvas">
        <CodebasePreviewCanvas codebase={snapshots[position]} methodLimit={stage.limits.method} />
      </div>
      <ReplayControls position={position} last={last} goTo={goTo} />
    </dialog>
  );
}

function ReplayControls({ position, last, goTo }: Readonly<{ position: number; last: number; goTo: (next: number) => void }>) {
  return (
    <div className="sample-replay__controls">
      <button type="button" onClick={() => goTo(0)} disabled={position === 0}>
        最初へ
      </button>
      <button type="button" onClick={() => goTo(position - 1)} disabled={position === 0}>
        ◀ 前へ
      </button>
      <button type="button" onClick={() => goTo(position + 1)} disabled={position === last}>
        次へ ▶
      </button>
      <button type="button" onClick={() => goTo(last)} disabled={position === last}>
        最後へ
      </button>
    </div>
  );
}
