import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import type { Codebase } from '../../domain/codebase/Codebase';
import { scoreCodebase, type Score } from '../../domain/scoring/score';
import { sampleAnswerCodebase, sampleAnswerSteps, type SolutionStep } from '../../domain/stage/sampleAnswer';
import type { Stage } from '../../domain/stage/Stage';
import { CritiqueButton, CritiqueResult } from '../critique/CritiquePanel';
import { SampleAnswerReplayDialog } from './SampleAnswerReplayDialog';
import { CodebasePreviewDialog } from '../preview/CodebasePreviewDialog';
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
import { useResizableSidebarWidth } from '../useResizableSidebarWidth';
import { ClearConditionList } from './ClearConditionList';
import { GhostHintButton } from './GhostHintButton';

/** ステージ一覧のダイアログを開くボタン。 */
function RoadmapButton() {
  const [open, setOpen] = useState(false);
  const investigating = useGameStore((state) => state.changeSession !== null);
  return (
    <>
      <button type="button" data-testid="roadmap-open" disabled={investigating} onClick={() => setOpen(true)}>
        ステージ一覧
      </button>
      <StageRoadmapDialog open={open} onClose={() => setOpen(false)} />
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

type PreviewKind = 'before' | 'sample';

function useStageSidebarWidth() {
  const { width, handleProps } = useResizableSidebarWidth({
    side: 'left', defaultWidth: 260, minWidth: 200, maxWidth: 480, ariaLabel: '課題とヒントの幅を変更',
  });
  const style: CSSProperties & { readonly '--sidebar-width': string } = { '--sidebar-width': `${width}px` };
  return { handleProps, style };
}

function StageSidebarToggle({ open, onToggle }: Readonly<{ open: boolean; onToggle: () => void }>) {
  const label = open ? 'サイドバーを閉じる' : 'サイドバーを開く';
  return <button type="button" className="sidebar-toggle" aria-expanded={open} aria-controls="stage-sidebar" aria-label={label} title={label} onClick={onToggle}>{open ? '«' : '»'}</button>;
}

/** 「変更前」「解答例」の図を読み取り専用で見せるボタン。呼び出し側で key={stage.id} を付け、ステージを切り替えたら閉じるようにする。 */
function PreviewButtons({ stage, disabled }: Readonly<{ stage: Stage; disabled: boolean }>) {
  const [preview, setPreview] = useState<PreviewKind | null>(null);
  const [replaying, setReplaying] = useState(false);
  const sampleSteps = sampleAnswerSteps[stage.id];
  const hasSampleAnswer = sampleSteps !== undefined;
  const codebase = useMemo(() => {
    if (preview === 'before') return stage.codebase;
    if (preview === 'sample' && hasSampleAnswer) return sampleAnswerCodebase(stage);
    return null;
  }, [preview, stage, hasSampleAnswer]);
  return (
    <>
      <button type="button" onClick={() => setPreview('before')} disabled={disabled}>
        変更前の図を見る
      </button>
      <button type="button" onClick={() => setPreview('sample')} disabled={disabled || !hasSampleAnswer} title={hasSampleAnswer ? undefined : 'このステージには解答例が未登録です'}>
        解答例の図を見る
      </button>
      <button type="button" data-testid="sample-replay-open" onClick={() => setReplaying(true)} disabled={disabled || !hasSampleAnswer} title="模範解答の手順を1手ずつ見ます(答えが分かります)">
        解答を再生
      </button>
      {replaying && sampleSteps !== undefined && <SampleAnswerReplayDialog stage={stage} steps={sampleSteps} onClose={() => setReplaying(false)} />}
      <CodebasePreviewDialog title={preview === 'sample' ? '解答例の図' : '変更前の図'} codebase={codebase} methodLimit={stage.limits.method} onClose={() => setPreview(null)} />
    </>
  );
}

/** 点数を丸いゲージで見せる。詳細(減点の内訳)は隣のテキストに出す。 */
function ScoreBadge({ score }: Readonly<{ score: Score }>) {
  const degrees = Math.max(0, Math.min(100, score.total)) * 3.6;
  return (
    <div className="score-badge" aria-live="polite">
      <div className="score-badge__ring" style={{ background: `conic-gradient(var(--accent) ${String(degrees)}deg, var(--border) 0)` }}>
        <span className="score-badge__value">{score.total}点</span>
      </div>
      <span className="score-badge__detail" data-testid="score">
        {describeScore(score)}
      </span>
    </div>
  );
}

/** ヘッダーの右端: 点数のゲージ・テストの状態・減点の内訳。 */
function ScoreArea({ stage, codebase, score, disabled }: Readonly<{ stage: Stage; codebase: Codebase; score: Score; disabled: boolean }>) {
  return (
    <>
      <ScoreBadge score={score} />
      <TestStatus stage={stage} codebase={codebase} />
      <ScoreBreakdown score={score} disabled={disabled} />
    </>
  );
}

/** ツールバー(キャンバスの上): 変更依頼・やり直し系・図の確認。 */
function ActionToolbar({ stage, isPerfect, active }: Readonly<{ stage: Stage; isPerfect: boolean; active: boolean }>) {
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
  useGuideShortcut(active, setGuideOpen);
  return (
    <div className="toolbar stage-panel__actions">
      <button
        type="button"
        className="toolbar__primary button--primary"
        data-testid="change-request-start"
        onClick={startChangeRequests}
        disabled={investigating || !isPerfect}
        title={isPerfect ? undefined : '点数が100点になると挑戦できます'}
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
      <PreviewButtons key={stage.id} stage={stage} disabled={investigating} />
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

function StageSidebar({ stage, codebase, score, initialScore, investigating, revealedCount, hints, total, onReveal, hidden }: Readonly<{
  stage: Stage;
  codebase: Codebase;
  score: Score;
  initialScore: Score;
  investigating: boolean;
  revealedCount: number;
  hints: readonly { text: string; step: SolutionStep }[];
  total: number;
  onReveal: () => void;
  hidden: boolean;
}>) {
  return (
    <aside id="stage-sidebar" className="sidebar" aria-label="課題とヒント" hidden={hidden}>
      <h2 className="sidebar__title">課題とヒント</h2>
      <StoryIntro key={`story-intro-${stage.id}`} stageId={stage.id} />
      <section className="stage-panel__problem" aria-labelledby="stage-problem-title">
        <h3 id="stage-problem-title">困っていること</h3>
        <p>{stage.problem}</p>
      </section>
      <ClearConditionList stage={stage} codebase={codebase} initial={initialScore} current={score} />
      <section className="stage-panel__hints" aria-labelledby="stage-hints-title">
        <h3 id="stage-hints-title">ヒント</h3>
        <HintButton revealed={revealedCount} total={total} disabled={investigating} onReveal={onReveal} />
        <GhostHintButton stage={stage} score={score.total} investigating={investigating} />
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

/** ステージの目標と、行数・結合度・循環依存・責務の混在から出した点数を表示する。責務の中身(responsibility の値)は見せない。 */
function StagePanelContent({ stage, children, active }: Readonly<{ stage: Stage; children: ReactNode; active: boolean }>) {
  // 実装中は部品置き場入りのコードなので、点数と進捗は挑戦前のコードで数える
  const codebase = useGameStore((state) => state.changeSession?.base ?? state.codebase);
  const investigating = useGameStore((state) => state.changeSession !== null);
  const recordProgress = useGameStore((state) => state.recordProgress);
  const startTour = useGameStore((state) => state.startTour);
  const tourStep = useGameStore((state) => state.tourStep);
  // ステージを切り替えたらヒントを閉じ直す。keyで作り直すとキャンバスまで作り直してしまうので、開いた数にステージIDを添える
  const [revealed, setRevealed] = useState({ stageId: stage.id, count: 0 });
  const score = useMemo(() => scoreCodebase(codebase, stage), [codebase, stage]);
  const initialScore = useMemo(() => scoreCodebase(stage.codebase, stage), [stage]);
  // 狭い画面ではキャンバスを優先して、最初は閉じておく(描画は残し、hiddenで隠すだけ)
  const [sidebarOpen, toggleSidebar, setSidebarOpen] = useStageSidebar(stage.id, score.total >= 100);
  const { handleProps, style: sidebarStyle } = useStageSidebarWidth();
  const revealedCount = revealed.stageId === stage.id ? revealed.count : 0;
  const { hints, total } = useHints(stage, revealedCount);
  useEffect(() => {
    recordProgress(stage.id, score.total);
  }, [stage.id, score.total, recordProgress]);
  useEffect(() => {
    startTour();
  }, [stage.id, startTour]);
  useEffect(() => {
    if (tourStep === 0) setSidebarOpen(true);
  }, [setSidebarOpen, tourStep]);
  return (
    <>
      <SpotlightTour />
      <header className="stage-panel">
        <h1 className="stage-panel__title">{stage.title}</h1>
        <StageNavigation />
        <div className="stage-panel__spacer" />
        <CritiqueButton disabled={investigating} />
        <ScoreArea stage={stage} codebase={codebase} score={score} disabled={investigating} />
      </header>
      <CritiqueResult />
      <div className={`app__body${sidebarOpen ? ' app__body--sidebar-open' : ''}`} style={sidebarStyle}>
        <StageSidebar
          stage={stage}
          codebase={codebase}
          score={score}
          initialScore={initialScore}
          investigating={investigating}
          revealedCount={revealedCount}
          hints={hints}
          total={total}
          onReveal={() => setRevealed({ stageId: stage.id, count: revealedCount + 1 })}
          hidden={!sidebarOpen}
        />
        {sidebarOpen && <div className="sidebar-resizable__handle sidebar-resizable__handle--left" {...handleProps} />}
        <StageSidebarToggle open={sidebarOpen} onToggle={toggleSidebar} />
        <div className="workspace">
          <ActionToolbar stage={stage} isPerfect={score.total >= 100} active={active} />
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
