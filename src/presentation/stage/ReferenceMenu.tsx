import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type RefObject } from 'react';
import type { Codebase } from '../../domain/codebase/Codebase';
import { sampleAnswerCodebase, sampleAnswerSteps, type SolutionStep } from '../../domain/stage/sampleAnswer';
import type { Stage } from '../../domain/stage/Stage';
import { SampleAnswerReplayDialog } from './SampleAnswerReplayDialog';
import { CodebasePreviewDialog } from '../preview/CodebasePreviewDialog';
import type { AnswerComparison } from '../preview/ComparisonPanes';
import { scoreCodebase } from '../../domain/scoring/score';
import { designDiff } from '../../domain/stage/designDiff';
import { useGameStore } from '../store/useGameStore';
import { usePopoverDismiss } from './usePopoverDismiss';
import { describeScoreGap, groupDesignDiff } from './describeDesignDiff';

type AnswerKind = 'sample' | 'replay';
type PreviewKind = 'before' | 'sample' | null;
type PreviewCodebase = Stage['codebase'] | null;

function menuHasFocus(menuRef: RefObject<HTMLDivElement | null>): boolean {
  const menu = menuRef.current?.querySelector('[role="menu"]');
  return menu !== null && menu !== undefined && menu.contains(document.activeElement);
}

function previewCodebase(preview: PreviewKind, stage: Stage, hasSampleAnswer: boolean): PreviewCodebase {
  if (preview === 'before') return stage.codebase;
  if (preview === 'sample' && hasSampleAnswer) return sampleAnswerCodebase(stage);
  return null;
}

/** 解答例の図に並べる、プレイヤーの今の設計との違い。 */
function answerComparison(stage: Stage, player: Codebase, answer: Codebase): AnswerComparison {
  return { player, groups: groupDesignDiff(designDiff(player, answer)), scoreFacts: describeScoreGap(scoreCodebase(player, stage), scoreCodebase(answer, stage)) };
}

/** 開いている図のコードベースと、解答例の図のときだけ作るプレイヤーの今の設計との違い。 */
function usePreviewTarget(preview: PreviewKind, stage: Stage, hasSampleAnswer: boolean): { readonly codebase: PreviewCodebase; readonly comparison: AnswerComparison | undefined } {
  const codebase = useMemo(() => previewCodebase(preview, stage, hasSampleAnswer), [preview, stage, hasSampleAnswer]);
  const player = useGameStore((state) => state.codebase);
  const comparison = useMemo(() => (preview === 'sample' && codebase !== null ? answerComparison(stage, player, codebase) : undefined), [preview, stage, player, codebase]);
  return { codebase, comparison };
}

function closeMenuOnEscape(event: KeyboardEvent<HTMLDivElement>, buttonRef: RefObject<HTMLButtonElement | null>, closeMenu: () => void): boolean {
  if (event.key !== 'Escape') return false;
  event.preventDefault();
  closeMenu();
  buttonRef.current?.focus();
  return true;
}

function moveMenuItemFocus(event: KeyboardEvent<HTMLDivElement>, items: readonly HTMLButtonElement[], currentIndex: number): boolean {
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return false;
  event.preventDefault();
  const offset = event.key === 'ArrowDown' ? 1 : -1;
  items[(currentIndex + offset + items.length) % items.length]?.focus();
  return true;
}

function activateMenuItem(event: KeyboardEvent<HTMLDivElement>): void {
  if ((event.key === 'Enter' || event.key === ' ') && document.activeElement instanceof HTMLButtonElement) {
    event.preventDefault();
    document.activeElement.click();
  }
}

function moveMenuFocus(event: KeyboardEvent<HTMLDivElement>, menuRef: RefObject<HTMLDivElement | null>, buttonRef: RefObject<HTMLButtonElement | null>, closeMenu: () => void) {
  if (!menuHasFocus(menuRef)) return;
  const items = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not([aria-disabled="true"])') ?? []);
  const currentIndex = items.findIndex((item) => item === document.activeElement);
  if (closeMenuOnEscape(event, buttonRef, closeMenu)) return;
  if (moveMenuItemFocus(event, items, currentIndex)) return;
  activateMenuItem(event);
}

function ReferenceMenuItems({ hasSampleAnswer, onBefore, onAnswer }: Readonly<{ hasSampleAnswer: boolean; onBefore: () => void; onAnswer: (answer: AnswerKind) => void }>) {
  const itemProps = { role: 'menuitem' as const, tabIndex: -1 };
  const unavailableTitle = hasSampleAnswer ? undefined : 'このステージには解答例が未登録です';
  return (
    <div className="reference-menu__items" role="menu" aria-label="参考・答え">
      <div className="reference-menu__group-label">参考</div>
      <button {...itemProps} type="button" data-testid="reference-before" onClick={onBefore}>変更前の図を見る</button>
      <div className="reference-menu__divider" role="separator" />
      <div className="reference-menu__group-label">答え <small>(ネタバレ)</small></div>
      <button {...itemProps} type="button" data-testid="reference-sample" aria-disabled={!hasSampleAnswer} title={unavailableTitle} onClick={() => onAnswer('sample')}>解答例の図を見る</button>
      <button {...itemProps} type="button" data-testid="reference-replay" aria-disabled={!hasSampleAnswer} title={unavailableTitle} onClick={() => onAnswer('replay')}>解答を再生</button>
    </div>
  );
}

function AnswerConfirmDialog({ open, remainingHints, onHint, onAnswer, onCancel }: Readonly<{ open: boolean; remainingHints: number; onHint: () => void; onAnswer: () => void; onCancel: () => void }>) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancel = () => { dialogRef.current?.close(); onCancel(); };
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog === null) return;
    if (open) {
      dialog.showModal();
      dialog.querySelector<HTMLButtonElement>('button')?.focus();
    } else if (dialog.open) dialog.close();
  }, [open]);
  return (
    <dialog ref={dialogRef} className="answer-confirm" data-testid="answer-confirm" onCancel={(event) => { event.preventDefault(); cancel(); }} onKeyDown={(event) => { if (event.key === 'Escape') { event.preventDefault(); cancel(); } }}>
      <h2>答えを見ますか?</h2>
      <p>答えを見ると、自分で気づく機会がなくなります。先にヒントを1つ見てみませんか?</p>
      {remainingHints > 0 && <p>ヒントはあと {remainingHints} 個あります</p>}
      <div className="answer-confirm__actions">
        {remainingHints > 0 && <button type="button" className="button--primary" onClick={onHint}>ヒントを見る</button>}
        <button type="button" onClick={onAnswer}>答えを見る</button>
        <button type="button" onClick={onCancel}>やめる</button>
      </div>
    </dialog>
  );
}

function ReferenceMenuPopups({ stage, preview, codebase, comparison, replaying, sampleSteps, pendingAnswer, remainingHints, onHint, onAnswer, onCancel, onReplayClose, onPreviewClose }: Readonly<{
  stage: Stage;
  preview: 'before' | 'sample' | null;
  codebase: PreviewCodebase;
  comparison: AnswerComparison | undefined;
  replaying: boolean;
  sampleSteps: readonly SolutionStep[] | undefined;
  pendingAnswer: AnswerKind | null;
  remainingHints: number;
  onHint: () => void;
  onAnswer: () => void;
  onCancel: () => void;
  onReplayClose: () => void;
  onPreviewClose: () => void;
}>) {
  return (
    <>
      <AnswerConfirmDialog open={pendingAnswer !== null} remainingHints={remainingHints} onHint={onHint} onAnswer={onAnswer} onCancel={onCancel} />
      {replaying && sampleSteps !== undefined && <SampleAnswerReplayDialog stage={stage} steps={sampleSteps} onClose={onReplayClose} />}
      <CodebasePreviewDialog title={preview === 'sample' ? '解答例の図' : '変更前の図'} codebase={codebase} methodLimit={stage.limits.method} comparison={comparison} onClose={onPreviewClose} />
    </>
  );
}

function useReferenceAnswer(setMenuOpen: (open: boolean) => void, setPreview: (preview: PreviewKind) => void, setReplaying: (replaying: boolean) => void) {
  const [confirmed, setConfirmed] = useState(false);
  const [pendingAnswer, setPendingAnswer] = useState<AnswerKind | null>(null);
  const closeConfirmation = (restoreFocus: boolean, buttonRef: RefObject<HTMLButtonElement | null>) => {
    setPendingAnswer(null);
    if (restoreFocus) requestAnimationFrame(() => buttonRef.current?.focus());
  };
  const openAnswer = (answer: AnswerKind) => {
    setMenuOpen(false);
    if (confirmed) {
      if (answer === 'sample') setPreview('sample');
      else setReplaying(true);
    } else setPendingAnswer(answer);
  };
  const chooseAnswer = () => {
    const answer = pendingAnswer;
    setConfirmed(true);
    setPendingAnswer(null);
    requestAnimationFrame(() => {
      if (answer === 'sample') setPreview('sample');
      if (answer === 'replay') setReplaying(true);
    });
  };
  return { pendingAnswer, openAnswer, closeConfirmation, chooseAnswer };
}

/** 変更前の図と解答例をメニューにまとめ、初回だけヒントを勧める。 */
export function ReferenceMenu({ stage, disabled, menuOpen, onMenuOpenChange, revealedCount, onRevealHint, onOpenHints }: Readonly<{
  stage: Stage;
  disabled: boolean;
  menuOpen: boolean;
  onMenuOpenChange: (open: boolean) => void;
  revealedCount: number;
  onRevealHint: () => void;
  onOpenHints: () => void;
}>) {
  const [preview, setPreview] = useState<PreviewKind>(null);
  const [replaying, setReplaying] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const { pendingAnswer, openAnswer, closeConfirmation, chooseAnswer } = useReferenceAnswer(onMenuOpenChange, setPreview, setReplaying);
  const sampleSteps = sampleAnswerSteps[stage.id];
  const hasSampleAnswer = sampleSteps !== undefined;
  const remainingHints = Math.max(0, (sampleSteps?.length ?? 0) - revealedCount);
  const { codebase, comparison } = usePreviewTarget(preview, stage, hasSampleAnswer);

  useEffect(() => {
    if (menuOpen) menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]:not([aria-disabled="true"])')?.focus();
  }, [menuOpen]);

  const closeMenu = () => onMenuOpenChange(false);
  usePopoverDismiss(menuOpen, menuRef, buttonRef, closeMenu);

  return (
    <div className="reference-menu" ref={menuRef} onKeyDown={(event) => moveMenuFocus(event, menuRef, buttonRef, closeMenu)}>
      <button
        ref={buttonRef}
        type="button"
        data-testid="reference-menu-button"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        disabled={disabled}
        onClick={() => onMenuOpenChange(!menuOpen)}
      >
        参考・答え ▾
      </button>
      {menuOpen && <ReferenceMenuItems hasSampleAnswer={hasSampleAnswer} onBefore={() => { onMenuOpenChange(false); setPreview('before'); }} onAnswer={(answer) => { if (hasSampleAnswer) openAnswer(answer); }} />}
      <ReferenceMenuPopups
        stage={stage}
        preview={preview}
        codebase={codebase}
        comparison={comparison}
        replaying={replaying}
        sampleSteps={sampleSteps}
        pendingAnswer={pendingAnswer}
        remainingHints={remainingHints}
        onHint={() => { closeConfirmation(false, buttonRef); onOpenHints(); onRevealHint(); }}
        onAnswer={chooseAnswer}
        onCancel={() => closeConfirmation(true, buttonRef)}
        onReplayClose={() => setReplaying(false)}
        onPreviewClose={() => setPreview(null)}
      />
    </div>
  );
}
