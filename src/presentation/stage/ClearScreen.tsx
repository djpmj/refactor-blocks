import { useEffect, useRef } from 'react';
import { painRequestsOf } from '../../domain/change/changePain';
import { stageStep } from '../../domain/change/stageStep';
import { recommendNextStage } from '../../domain/progress/roadmap';
import { clearChoices, type ClearChoice } from '../../domain/stage/clearChoices';
import { useGameStore } from '../store/useGameStore';
import { useCountUp } from './useCountUp';

function choiceLabel(choice: ClearChoice, nextTitle: string | undefined): string {
  if (choice.kind === 'accept-change-request') return '変更依頼を受ける';
  if (choice.kind === 'closing-fix') return '同じ変更をもう一度手で直す';
  if (choice.kind === 'next-stage') return `次のステージへ(${nextTitle ?? ''})`;
  return '今の画面へ戻る';
}

export function ClearScreen() {
  const clearScreen = useGameStore((state) => state.clearScreen);
  if (clearScreen === null) return null;
  return <ClearScreenDialog key={clearScreen.stageId} />;
}

function ClearScreenDialog() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);
  const stage = useGameStore((state) => state.stage);
  const stages = useGameStore((state) => state.stages);
  const progress = useGameStore((state) => state.progress);
  const milestones = useGameStore((state) => state.milestones);
  const openingDone = useGameStore((state) => Object.hasOwn(state.openingFixes, state.stage.id));
  const closingSolved = useGameStore((state) => state.closingFixSolved);
  const celebration = useGameStore((state) => state.celebration);
  const dismiss = useGameStore((state) => state.dismissClearScreen);
  const startChangeRequests = useGameStore((state) => state.startChangeRequests);
  const startManualFix = useGameStore((state) => state.startManualFix);
  const selectStage = useGameStore((state) => state.selectStage);
  const next = recommendNextStage(stages.filter((candidate) => candidate.id !== stage.id), progress, milestones);
  const nextStageId = next?.id === stage.id ? undefined : next?.id;
  const step = stageStep({ score: 100, hasModifyRequest: painRequestsOf(stage).modify !== undefined, openingDone, closingSolved });
  const choices = clearChoices({ step, hasChangeRequests: stage.changeRequests.length > 0, nextStageId });
  const count = useCountUp(100, celebration?.seq ?? 0, 0, true);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog === null) return;
    dialog.showModal();
    primaryRef.current?.focus();
    return () => dialog.close();
  }, []);
  function choose(choice: ClearChoice) {
    dismiss();
    if (choice.kind === 'accept-change-request') startChangeRequests();
    if (choice.kind === 'closing-fix') startManualFix();
    if (choice.kind === 'next-stage') selectStage(choice.stageId);
  }
  return (
    <dialog ref={dialogRef} className="clear-screen" data-testid="clear-screen" aria-labelledby="clear-screen-title" onCancel={dismiss}>
      <div className="clear-screen__confetti-layer" aria-hidden="true">
        {Array.from({ length: 24 }, (_, index) => {
          const style = { '--i': index, color: 'inherit' };
          return <span key={index} className="clear-screen__confetti" style={style} />;
        })}
      </div>
      <div className="clear-screen__content">
        <p className="clear-screen__eyebrow">ステージクリア · {stage.title}</p>
        <h2 id="clear-screen-title" className="clear-screen__title">STAGE CLEAR!</h2>
        <div className={`clear-screen__ring${count.active ? '' : ' clear-screen__ring--complete'}`} style={{ background: `conic-gradient(var(--accent) ${String(count.value * 3.6)}deg, rgba(255,255,255,.25) 0)` }}>
          <span data-testid="clear-screen-score">{count.value}点</span>
        </div>
        <p className="clear-screen__perfect">減点なし</p>
        <div className="clear-screen__choices">
          {choices.map((choice, index) => (
            <button key={choice.kind} ref={index === 0 ? primaryRef : undefined} type="button"
              className={index === 0 ? 'button--primary clear-screen__primary' : ''}
              data-testid={index === 0 ? 'clear-choice-primary' : `clear-choice-${choice.kind}`}
              onClick={() => choose(choice)}><span data-testid={index === 0 ? `clear-choice-${choice.kind}` : undefined}>{choiceLabel(choice, next?.title)}</span></button>
          ))}
        </div>
      </div>
    </dialog>
  );
}
