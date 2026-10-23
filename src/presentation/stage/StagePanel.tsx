import { forwardRef, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react';
import type { Codebase } from '../../domain/codebase/Codebase';
import { scoreCodebase, type Score } from '../../domain/scoring/score';
import { biggestProblem } from '../../domain/scoring/biggestProblem';
import type { SolutionStep } from '../../domain/stage/sampleAnswer';
import type { Stage } from '../../domain/stage/Stage';
import { CritiqueButton, CritiqueResult } from '../critique/CritiquePanel';
import { ReferenceMenu } from './ReferenceMenu';
import { OperationGuideDialog } from '../guide/OperationGuideDialog';
import { useGuideShortcut } from '../guide/useGuideShortcut';
import { useGameStore } from '../store/useGameStore';
import { describeScore } from './describeScore';
import { ScoreBreakdown } from './ScoreBreakdown';
import { HintList } from './HintList';
import { HintButton } from './HintPanel';
import { ConceptCheckPanel } from './ConceptCheckPanel';
import { ChangePainCard } from './ChangePainCard';
import { StoryIntro } from './StoryIntro';
import { StoryOutro } from './StoryOutro';
import { ManualFixPanel } from './ManualFixPanel';
import { SpotlightTour } from '../tour/SpotlightTour';
import { TOUR_STAGE_ID } from '../tour/tourSteps';
import { StageRoadmapDialog } from './StageRoadmapDialog';
import { TestStatus } from './TestStatus';
import { useHints } from './useHints';
import { useStageSidebar } from './useStageSidebar';
import { useCountUp } from './useCountUp';
import { useResizableSidebarWidth } from '../useResizableSidebarWidth';
import { ClearConditionList } from './ClearConditionList';
import { RumorList } from './RumorList';
import { GhostHintButton } from './GhostHintButton';
import { ProblemHint } from './ProblemHint';
import { painRequestsOf } from '../../domain/change/changePain';
import { stageStep } from '../../domain/change/stageStep';
import type { StageStep } from '../../domain/change/stageStep';
import { useNarrowScreen } from '../useNarrowScreen';

/** ステージ一覧のダイアログを開くボタン。 */
function RoadmapButton() {
  const [open, setOpen] = useState(false);
  const openerRef = useRef<HTMLButtonElement>(null);
  const investigating = useGameStore((state) => state.changeSession !== null);
  return (
    <>
      <button ref={openerRef} type="button" data-testid="roadmap-open" disabled={investigating} onClick={() => setOpen(true)}>
        ステージ一覧
      </button>
      <StageRoadmapDialog open={open} onClose={() => { setOpen(false); openerRef.current?.focus(); }} />
    </>
  );
}

/** 章の導入・結びを出すかどうかの切り替え。 */
function StoryToggle() {
  const enabled = useGameStore((state) => state.storyEnabled);
  const setStoryEnabled = useGameStore((state) => state.setStoryEnabled);
  return (
    <button type="button" data-testid="story-toggle" aria-pressed={enabled} onClick={() => setStoryEnabled(!enabled)}>
      ストーリー
    </button>
  );
}

/** ヘッダーの左側: ステージ一覧・ストーリーの切り替え。 */
function StageNavigation() {
  return (
    <>
      <RoadmapButton />
      <StoryToggle />
    </>
  );
}

function useStageSidebarWidth() {
  const { width, handleProps } = useResizableSidebarWidth({
    side: 'left', defaultWidth: 260, minWidth: 200, maxWidth: 480, ariaLabel: '課題とヒントの幅を変更',
  });
  const style: CSSProperties & { readonly '--sidebar-width': string } = { '--sidebar-width': `${width}px` };
  return { handleProps, style };
}

function useOpenSidebarForManualFix(active: boolean, setSidebarOpen: (open: boolean) => void): void {
  const wasActive = useRef(active);
  useEffect(() => {
    if (!wasActive.current && active && window.innerWidth < 1400) setSidebarOpen(true);
    wasActive.current = active;
  }, [active, setSidebarOpen]);
}

function ManualFixSidebarOpener({ setSidebarOpen }: Readonly<{ setSidebarOpen: (open: boolean) => void }>) {
  const manualFix = useGameStore((state) => state.manualFix);
  useOpenSidebarForManualFix(manualFix !== null, setSidebarOpen);
  return null;
}

const StageSidebarToggle = forwardRef<HTMLButtonElement, Readonly<{ open: boolean; onToggle: () => void }>>(function StageSidebarToggle({ open, onToggle }, ref) {
  const label = open ? 'サイドバーを閉じる' : 'サイドバーを開く';
  return <button ref={ref} type="button" className="sidebar-toggle" aria-expanded={open} aria-controls="stage-sidebar" aria-label={label} title={label} onClick={onToggle}>{open ? '«' : '»'}</button>;
});

function useSidebarDrawer(open: boolean, setOpen: (open: boolean) => void, toggleRef: RefObject<HTMLButtonElement | null>) {
  useEffect(() => {
    if (!open && window.matchMedia('(max-width: 700px)').matches) toggleRef.current?.focus();
  }, [open, toggleRef]);
  useEffect(() => {
    if (!open) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape' && window.matchMedia('(max-width: 700px)').matches) setOpen(false);
    }
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [open, setOpen]);
}

type ScoreCelebration = { readonly scoreAfter: number; readonly deductedBefore: number; readonly deductedAfter: number } | null;

function advancedStep(previous: StageStep, next: StageStep): boolean {
  return (previous === 'opening-fix' && next === 'refactor')
    || (previous === 'refactor' && next === 'closing-fix')
    || (previous === 'closing-fix' && next === 'change-request');
}

function scrollToStepCard(sidebar: HTMLElement, step: StageStep) {
  const card = sidebar.querySelector<HTMLElement>('.change-pain');
  if (card === null) return;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  card.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: step === 'change-request' ? 'start' : 'nearest' });
}

function useSidebarFlowVisibility(stageId: string, step: StageStep, manualFix: boolean) {
  const sidebarRef = useRef<HTMLElement>(null);
  const previous = useRef<{ stageId: string; step: StageStep } | null>(null);
  const pendingStep = useRef<StageStep | null>(null);
  useEffect(() => {
    const before = previous.current;
    previous.current = { stageId, step };
    if (before === null) return;
    if (before.stageId !== stageId) {
      pendingStep.current = null;
      if (sidebarRef.current !== null) sidebarRef.current.scrollTop = 0;
      return;
    }
    if (advancedStep(before.step, step)) pendingStep.current = step;
    else if (before.step !== step) pendingStep.current = null;
    if (manualFix || pendingStep.current === null || sidebarRef.current === null) return;
    scrollToStepCard(sidebarRef.current, pendingStep.current);
    pendingStep.current = null;
  }, [manualFix, stageId, step]);
  return sidebarRef;
}

function useStageFlow(stage: Stage, score: number) {
  const manualFix = useGameStore((state) => state.manualFix !== null);
  const openingDone = useGameStore((state) => Object.prototype.hasOwnProperty.call(state.openingFixes, stage.id));
  const closingSolved = useGameStore((state) => state.closingFixSolved);
  const step = stageStep({ score, hasModifyRequest: painRequestsOf(stage).modify !== undefined, openingDone, closingSolved });
  return { step, sidebarRef: useSidebarFlowVisibility(stage.id, step, manualFix) };
}

function isFloorProgress(score: Score, celebration: ScoreCelebration): boolean {
  return celebration !== null && celebration.scoreAfter === 0 && score.total === 0 && score.deducted === celebration.deductedAfter && celebration.deductedAfter < celebration.deductedBefore;
}

/** 点数を丸いゲージで見せる。詳細(減点の内訳)は隣のテキストに出す。 */
function ScoreBadge({ score, codebase }: Readonly<{ score: Score; codebase: Codebase }>) {
  const celebration = useGameStore((state) => state.celebration);
  const rising = celebration !== null && celebration.scoreAfter === score.total && celebration.scoreAfter > celebration.scoreBefore;
  const floorProgress = isFloorProgress(score, celebration);
  const animation = useCountUp(score.total, rising ? celebration.seq : null, rising ? celebration.scoreBefore : score.total, rising);
  const degrees = Math.max(0, Math.min(100, animation.value)) * 3.6;
  const celebrating = animation.active || floorProgress;
  const ringClass = ['score-badge__ring', celebrating ? 'score-badge__ring--celebrate' : '', animation.active && score.total === 100 ? 'score-badge__ring--perfect' : ''].filter(Boolean).join(' ');
  return (
    <div className="score-badge">
      <div className={ringClass} data-testid="score-ring" style={{ background: `conic-gradient(var(--accent) ${String(degrees)}deg, var(--border) 0)` }}>
        <span className="score-badge__value" aria-hidden="true" data-testid="score-value">{animation.value}点</span>
      </div>
      <span className="sr-only" aria-live="polite" data-testid="score-announcement">{floorProgress && celebration !== null ? `減点の合計が -${celebration.deductedBefore} から -${celebration.deductedAfter} に減りました` : `${score.total}点`}</span>
      <span className="score-badge__detail" data-testid="score">
        {describeScore(score, codebase)}
      </span>
    </div>
  );
}

/** ヘッダーの右端: 点数のゲージ・テストの状態・減点の内訳。 */
function ScoreArea({ stage, codebase, score, disabled }: Readonly<{ stage: Stage; codebase: Codebase; score: Score; disabled: boolean }>) {
  return (
    <>
      <ScoreBadge score={score} codebase={codebase} />
      <TestStatus stage={stage} codebase={codebase} />
      <ScoreBreakdown key={`${stage.id}-${String(disabled)}`} score={score} disabled={disabled} />
    </>
  );
}

/** ツールバー(キャンバスの上): 変更依頼・やり直し系・図の確認。 */
function ActionToolbar({ stage, isPerfect, active, revealedCount, onRevealHint, onOpenHints }: Readonly<{ stage: Stage; isPerfect: boolean; active: boolean; revealedCount: number; onRevealHint: () => void; onOpenHints: () => void }>) {
  const [guideOpen, setGuideOpen] = useState(false);
  const resetStage = useGameStore((state) => state.resetStage);
  const undo = useGameStore((state) => state.undo);
  const redo = useGameStore((state) => state.redo);
  const startChangeRequests = useGameStore((state) => state.startChangeRequests);
  const investigating = useGameStore((state) => state.changeSession !== null);
  const challenged = useGameStore((state) => state.lastChangeReport !== null);
  const stageId = useGameStore((state) => state.stage.id);
  const selectStage = useGameStore((state) => state.selectStage);
  const startTour = useGameStore((state) => state.startTour);
  const canUndo = useGameStore((state) => state.history.past.length > 0);
  const canRedo = useGameStore((state) => state.history.future.length > 0);
  const openingDone = useGameStore((state) => Object.prototype.hasOwnProperty.call(state.openingFixes, stage.id));
  const closingSolved = useGameStore((state) => state.closingFixSolved);
  const step = stageStep({ score: isPerfect ? 100 : 0, hasModifyRequest: painRequestsOf(stage).modify !== undefined, openingDone, closingSolved });
  const challengeTitle = step === 'closing-fix' ? '先に「もし、この変更が来たら?」をもう一度解いてください' : '点数が100点になると挑戦できます';
  useGuideShortcut(active, setGuideOpen);
  return (
    <div className="toolbar stage-panel__actions">
      <button
        type="button"
        className="toolbar__primary button--primary"
        data-testid="change-request-start"
        onClick={startChangeRequests}
        disabled={investigating || step !== 'change-request'}
        title={step === 'change-request' ? undefined : challengeTitle}
      >
        {challenged ? 'もう一度挑戦' : '変更依頼に挑戦'}
      </button>
      <button type="button" onClick={undo} disabled={!canUndo} title="Ctrl+Z">
        元に戻す
      </button>
      <button type="button" onClick={redo} disabled={!canRedo} title="Ctrl+Y">
        やり直し
      </button>
      <button type="button" className="stage-panel__reset" onClick={resetStage} disabled={investigating}>
        最初に戻す
      </button>
      <ReferenceMenu key={stage.id} stage={stage} disabled={investigating} revealedCount={revealedCount} onRevealHint={onRevealHint} onOpenHints={onOpenHints} />
      <button type="button" data-testid="operation-guide-open" title="操作ガイド(?)" onClick={() => setGuideOpen(true)}>
        操作ガイド
      </button>
      <OperationGuideDialog
        open={guideOpen}
        onClose={() => setGuideOpen(false)}
        repeatTourDisabled={investigating}
        onRepeatTour={() => {
          setGuideOpen(false);
          if (stageId !== TOUR_STAGE_ID) selectStage(TOUR_STAGE_ID);
          startTour(true);
        }}
      />
    </div>
  );
}

/** 前回の下書きから再開したときのお知らせ。エラーではないので message は使わない。 */
function DraftRestoredNotice() {
  const restored = useGameStore((state) => state.restoredDraft);
  if (!restored) return null;
  return (
    <p className="draft-restored" role="status" data-testid="draft-restored">
      前回の続きから再開しました。最初からやり直すときは「最初に戻す」を押してください。
    </p>
  );
}

function StageSidebar({ stage, codebase, score, initialScore, investigating, revealedCount, hints, total, problemRevealed, onRevealProblem, onReveal, hidden, sidebarRef }: Readonly<{
  stage: Stage;
  codebase: Codebase;
  score: Score;
  initialScore: Score;
  investigating: boolean;
  revealedCount: number;
  hints: readonly { text: string; step: SolutionStep }[];
  total: number;
  problemRevealed: boolean;
  onRevealProblem: () => void;
  onReveal: () => void;
  hidden: boolean;
  sidebarRef: RefObject<HTMLElement | null>;
}>) {
  return (
    <aside ref={sidebarRef} id="stage-sidebar" className="sidebar" aria-label="課題とヒント" hidden={hidden}>
      <h2 className="sidebar__title">課題とヒント</h2>
      <StoryIntro key={`story-intro-${stage.id}`} stageId={stage.id} />
      <section className="stage-panel__problem" aria-labelledby="stage-problem-title">
        <h3 id="stage-problem-title">困っていること</h3>
        <p>{stage.problem}</p>
      </section>
      <ClearConditionList stage={stage} codebase={codebase} initial={initialScore} current={score} />
      {!investigating && <RumorList stage={stage} />}
      <section className="stage-panel__hints" aria-labelledby="stage-hints-title">
        <h3 id="stage-hints-title">ヒント</h3>
        <div className="stage-panel__hint-steps">
          <ProblemHint score={score} stageId={stage.id} revealed={problemRevealed} disabled={investigating} onReveal={onRevealProblem} />
          <HintButton revealed={revealedCount} total={total} disabled={investigating || !problemRevealed} onReveal={onReveal} />
          <div className="stage-panel__hint-step">
            <span className="stage-panel__hint-number" aria-hidden="true">3</span>
            <GhostHintButton stage={stage} score={score.total} investigating={investigating} unlocked={problemRevealed} />
          </div>
        </div>
        <HintList hints={hints} codebase={codebase} disabled={investigating} />
      </section>
      {!investigating && <><ChangePainCard stage={stage} codebase={codebase} score={score.total} /><ManualFixPanel stage={stage} codebase={codebase} /></>}
      <details className="stage-panel__description">
        <summary>どんなコード?</summary>
        <p data-testid="stage-description">{stage.description}</p>
      </details>
      {!investigating && score.total >= 100 && <ConceptCheckPanel key={stage.id} checks={stage.checks} />}
      <StoryOutro stage={stage} perfect={!investigating && score.total >= 100} />
    </aside>
  );
}

function SidebarBackdrop({ open, onClose }: Readonly<{ open: boolean; onClose: () => void }>) {
  if (!open) return null;
  return <button type="button" className="sidebar-backdrop" aria-label="課題とヒントの外側をタップして閉じる" onClick={onClose} />;
}

function StageSidebarDrawer({ open, stage, codebase, score, initialScore, investigating, revealedCount, hints, total, problemRevealed, onRevealProblem, onReveal, sidebarRef }: Readonly<{
  open: boolean; stage: Stage; codebase: Codebase; score: Score; initialScore: Score; investigating: boolean;
  revealedCount: number; hints: readonly { text: string; step: SolutionStep }[]; total: number; problemRevealed: boolean;
  onRevealProblem: () => void; onReveal: () => void; sidebarRef: RefObject<HTMLElement | null>;
}>) {
  return <StageSidebar key={stage.id} stage={stage} codebase={codebase} score={score} initialScore={initialScore} investigating={investigating}
    revealedCount={revealedCount} problemRevealed={problemRevealed} onRevealProblem={onRevealProblem} hints={hints} total={total}
    onReveal={onReveal} hidden={!open} sidebarRef={sidebarRef} />;
}

function useStagePanelEffects(stageId: string, score: number, actions: Readonly<{ recordProgress: (stageId: string, score: number) => void; startTour: () => void; setSidebarOpen: (open: boolean) => void }>, tourStep: number | null) {
  const { recordProgress, startTour, setSidebarOpen } = actions;
  useEffect(() => recordProgress(stageId, score), [stageId, score, recordProgress]);
  useEffect(() => startTour(), [stageId, startTour]);
  useEffect(() => {
    if (tourStep === 0) setSidebarOpen(true);
  }, [setSidebarOpen, tourStep]);
}

function useStageHintState(stageId: string, score: Score) {
  const focusRule = useGameStore((state) => state.focusRule);
  const [state, setState] = useState({ stageId, count: 0, problemRevealed: false });
  if (state.stageId !== stageId) setState({ stageId, count: 0, problemRevealed: false });
  const rule = biggestProblem(score);
  return {
    count: state.count,
    problemRevealed: state.problemRevealed,
    revealProblem: () => {
      if (rule !== undefined) {
        focusRule(rule);
        setState({ ...state, problemRevealed: true });
      }
    },
    revealStep: () => setState({ ...state, count: state.count + 1 }),
  };
}

function StageHeader({ stage, codebase, score, investigating }: Readonly<{ stage: Stage; codebase: Codebase; score: Score; investigating: boolean }>) {
  return (
    <header className="stage-panel">
      <h1 className="stage-panel__title">{stage.title}</h1>
      <StageNavigation />
      <div className="stage-panel__spacer" />
      <CritiqueButton disabled={investigating} />
      <ScoreArea stage={stage} codebase={codebase} score={score} disabled={investigating} />
    </header>
  );
}

/** ステージの目標と、行数・結合度・循環依存・責務の混在から出した点数を表示する。責務の中身(responsibility の値)は見せない。 */
function StagePanelContent({ stage, children, active }: Readonly<{ stage: Stage; children: ReactNode; active: boolean }>) {
  // 実装中は部品置き場入りのコードなので、点数と進捗は挑戦前のコードで数える
  const codebase = useGameStore((state) => state.changeSession?.base ?? state.codebase);
  const investigating = useGameStore((state) => state.changeSession !== null);
  const recordProgress = useGameStore((state) => state.recordProgress);
  const startTour = useGameStore((state) => state.startTour);
  const tourStep = useGameStore((state) => state.tourStep);
  const score = useMemo(() => scoreCodebase(codebase, stage), [codebase, stage]);
  const stageHints = useStageHintState(stage.id, score);
  const initialScore = useMemo(() => scoreCodebase(stage.codebase, stage), [stage]);
  // 狭い画面ではキャンバスを優先して、最初は閉じておく(描画は残し、hiddenで隠すだけ)
  const [sidebarOpen, toggleSidebar, setSidebarOpen] = useStageSidebar(stage.id, score.total >= 100);
  const sidebarToggleRef = useRef<HTMLButtonElement>(null);
  const narrowScreen = useNarrowScreen();
  useSidebarDrawer(sidebarOpen, setSidebarOpen, sidebarToggleRef);
  const { handleProps, style: sidebarStyle } = useStageSidebarWidth();
  const { count: revealedCount } = stageHints;
  const { sidebarRef } = useStageFlow(stage, score.total);

  const { hints, total } = useHints(stage, revealedCount);
  const stagePanelActions = useMemo(() => ({ recordProgress, startTour, setSidebarOpen }), [recordProgress, startTour, setSidebarOpen]);
  useStagePanelEffects(stage.id, score.total, stagePanelActions, tourStep);
  return (
    <>
      <SpotlightTour />
      <StageHeader stage={stage} codebase={codebase} score={score} investigating={investigating} />
      <CritiqueResult />
      <ManualFixSidebarOpener setSidebarOpen={setSidebarOpen} />
      <div className={`app__body${sidebarOpen ? ' app__body--sidebar-open' : ''}`} style={sidebarStyle}>
        <StageSidebarDrawer open={sidebarOpen} stage={stage} codebase={codebase} score={score} initialScore={initialScore} investigating={investigating}
          revealedCount={stageHints.count} problemRevealed={stageHints.problemRevealed} onRevealProblem={stageHints.revealProblem} hints={hints}
          total={total} onReveal={stageHints.revealStep} sidebarRef={sidebarRef} />
        <SidebarBackdrop open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        {sidebarOpen && <div className="sidebar-resizable__handle sidebar-resizable__handle--left" {...handleProps} />}
        <StageSidebarToggle ref={sidebarToggleRef} open={sidebarOpen} onToggle={toggleSidebar} />
        <div className="workspace" inert={sidebarOpen && narrowScreen}>
          <ActionToolbar
            stage={stage}
            isPerfect={score.total >= 100}
            active={active}
            revealedCount={revealedCount}
            onRevealHint={stageHints.problemRevealed ? stageHints.revealStep : stageHints.revealProblem}
            onOpenHints={() => setSidebarOpen(true)}
          />
          <DraftRestoredNotice />
          <div className="workspace__main">{children}</div>
        </div>
      </div>
    </>
  );
}

export function StagePanel({ children, active }: Readonly<{ children: ReactNode; active: boolean }>) {
  const stage = useGameStore((state) => state.stage);
  return <StagePanelContent stage={stage} active={active}>{children}</StagePanelContent>;
}
