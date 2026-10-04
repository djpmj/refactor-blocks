import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { scoreCodebase, type Score } from '../../domain/scoring/score';
import { sampleAnswerCodebase, sampleAnswerSteps } from '../../domain/stage/sampleAnswer';
import type { Stage, StageLevel } from '../../domain/stage/Stage';
import { CritiqueButton, CritiqueResult } from '../critique/CritiquePanel';
import { CodebasePreviewDialog } from '../preview/CodebasePreviewDialog';
import { OperationGuideDialog } from '../guide/OperationGuideDialog';
import { useGuideShortcut } from '../guide/useGuideShortcut';
import { useGameStore } from '../store/useGameStore';
import { describeScore } from './describeScore';
import { ScoreBreakdown } from './ScoreBreakdown';
import { HintList } from './HintList';
import { HintButton } from './HintPanel';
import { ChangePainCard } from './ChangePainCard';
import { ManualFixPanel } from './ManualFixPanel';
import { useHints } from './useHints';
import { useStageSidebar } from './useStageSidebar';

const LEVEL_LABEL: Record<StageLevel, string> = {
  tutorial: 'チュートリアル',
  beginner: '初級',
  intermediate: '中級',
  advanced: '上級',
};

function StageSelect() {
  const stages = useGameStore((state) => state.stages);
  // ステージは難易度順に並んでいるので、出てきた順に難易度をまとめる
  const levels = [...new Set(stages.map((stage) => stage.level))];
  const stageId = useGameStore((state) => state.stage.id);
  const selectStage = useGameStore((state) => state.selectStage);
  const progress = useGameStore((state) => state.progress);
  return (
    <select
      aria-label="ステージ"
      className="stage-panel__select"
      value={stageId}
      onChange={(event) => {
        selectStage(event.target.value);
      }}
    >
      {levels.map((level) => (
        <optgroup key={level} label={LEVEL_LABEL[level]}>
          {stages
            .filter((stage) => stage.level === level)
            .map((stage) => (
              <option key={stage.id} value={stage.id}>
                {progress[stage.id] === 100 ? '✅ ' : ''}
                {stage.title}
              </option>
            ))}
        </optgroup>
      ))}
    </select>
  );
}

type PreviewKind = 'before' | 'sample';

/** 「変更前」「解答例」の図を読み取り専用で見せるボタン。呼び出し側で key={stage.id} を付け、ステージを切り替えたら閉じるようにする。 */
function PreviewButtons({ stage, disabled }: Readonly<{ stage: Stage; disabled: boolean }>) {
  const [preview, setPreview] = useState<PreviewKind | null>(null);
  const hasSampleAnswer = sampleAnswerSteps[stage.id] !== undefined;
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

/** ツールバー(キャンバスの上): 変更依頼・やり直し系・図の確認。 */
function ActionToolbar({ stage, isPerfect, active }: Readonly<{ stage: Stage; isPerfect: boolean; active: boolean }>) {
  const [guideOpen, setGuideOpen] = useState(false);
  const resetStage = useGameStore((state) => state.resetStage);
  const undo = useGameStore((state) => state.undo);
  const redo = useGameStore((state) => state.redo);
  const startChangeRequests = useGameStore((state) => state.startChangeRequests);
  const investigating = useGameStore((state) => state.changeSession !== null);
  const challenged = useGameStore((state) => state.lastChangeReport !== null);
  const canUndo = useGameStore((state) => state.history.past.length > 0);
  const canRedo = useGameStore((state) => state.history.future.length > 0);
  useGuideShortcut(active, guideOpen, setGuideOpen);
  return (
    <div className="toolbar stage-panel__actions">
      <button
        type="button"
        className="toolbar__primary"
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
      <OperationGuideDialog open={guideOpen} onClose={() => setGuideOpen(false)} />
    </div>
  );
}

/** ステージの目標と、行数・結合度・循環依存・責務の混在から出した点数を表示する。責務の中身(responsibility の値)は見せない。 */
function StagePanelContent({ stage, children, active }: Readonly<{ stage: Stage; children: ReactNode; active: boolean }>) {
  // 実装中は部品置き場入りのコードなので、点数と進捗は挑戦前のコードで数える
  const codebase = useGameStore((state) => state.changeSession?.base ?? state.codebase);
  const investigating = useGameStore((state) => state.changeSession !== null);
  const recordProgress = useGameStore((state) => state.recordProgress);
  // ステージを切り替えたらヒントを閉じ直す。keyで作り直すとキャンバスまで作り直してしまうので、開いた数にステージIDを添える
  const [revealed, setRevealed] = useState({ stageId: stage.id, count: 0 });
  const score = useMemo(() => scoreCodebase(codebase, stage), [codebase, stage]);
  // 狭い画面ではキャンバスを優先して、最初は閉じておく(描画は残し、hiddenで隠すだけ)
  const [sidebarOpen, toggleSidebar] = useStageSidebar(stage.id, score.total >= 100);
  const revealedCount = revealed.stageId === stage.id ? revealed.count : 0;
  const { hints, total } = useHints(stage, revealedCount);
  useEffect(() => {
    recordProgress(stage.id, score.total);
  }, [stage.id, score.total, recordProgress]);
  return (
    <>
      <header className="stage-panel">
        <h1 className="stage-panel__title">{stage.title}</h1>
        <StageSelect />
        <div className="stage-panel__spacer" />
        <CritiqueButton disabled={investigating} />
        <HintButton revealed={revealedCount} total={total} disabled={investigating} onReveal={() => setRevealed({ stageId: stage.id, count: revealedCount + 1 })} />
        <ScoreBadge score={score} />
        <ScoreBreakdown score={score} disabled={investigating} />
      </header>
      <CritiqueResult />
      <div className={`app__body${sidebarOpen ? ' app__body--sidebar-open' : ''}`}>
        <aside id="stage-sidebar" className="sidebar" aria-label="課題とヒント" hidden={!sidebarOpen}>
          <h2 className="sidebar__title">課題とヒント</h2>
          <p className="stage-panel__goal">
            <strong>課題: </strong>
            {stage.goal}
          </p>
          {!investigating && <ChangePainCard stage={stage} codebase={codebase} score={score.total} />}
          {!investigating && <ManualFixPanel stage={stage} codebase={codebase} />}
          <HintList hints={hints} />
          <details className="stage-panel__description" open>
            <summary>どんなコード?</summary>
            <p data-testid="stage-description">{stage.description}</p>
          </details>
        </aside>
        <button
          type="button"
          className="sidebar-toggle"
          aria-expanded={sidebarOpen}
          aria-controls="stage-sidebar"
          aria-label={sidebarOpen ? 'サイドバーを閉じる' : 'サイドバーを開く'}
          title={sidebarOpen ? 'サイドバーを閉じる' : 'サイドバーを開く'}
          onClick={toggleSidebar}
        >
          {sidebarOpen ? '«' : '»'}
        </button>
        <div className="workspace">
          <ActionToolbar stage={stage} isPerfect={score.total >= 100} active={active} />
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
