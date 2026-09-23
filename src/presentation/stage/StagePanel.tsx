import { useEffect, useMemo, useState } from 'react';
import { scoreCodebase, type Score, type ScoreRule } from '../../domain/scoring/score';
import { sampleAnswerCodebase, sampleAnswerSteps } from '../../domain/stage/sampleAnswer';
import type { Stage, StageLevel } from '../../domain/stage/Stage';
import { CritiquePanel } from '../critique/CritiquePanel';
import { CodebasePreviewDialog } from '../preview/CodebasePreviewDialog';
import { useGameStore } from '../store/useGameStore';
import { HintPanel } from './HintPanel';

const RULE_LABEL: Record<ScoreRule, string> = {
  'line-limit': '行数',
  coupling: '結合度',
  cycle: '循環依存',
  responsibility: '責務の混在',
  visibility: 'アクセス制御',
  empty: '空のクラス・ファイル',
  unused: '未使用のprivateメソッド',
};

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

function describeScore(score: Score): string {
  const details = score.deductions
    .filter((deduction) => deduction.points > 0)
    .map((deduction) => `${RULE_LABEL[deduction.rule]} -${deduction.points}`);
  return details.length === 0 ? `✅ ${score.total}点` : `${score.total}点(${details.join(' / ')})`;
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

/** ステージの目標と、行数・結合度・循環依存・責務の混在から出した点数を表示する。責務の中身(responsibility の値)は見せない。 */
export function StagePanel() {
  const stage = useGameStore((state) => state.stage);
  const codebase = useGameStore((state) => state.codebase);
  const resetStage = useGameStore((state) => state.resetStage);
  const undo = useGameStore((state) => state.undo);
  const redo = useGameStore((state) => state.redo);
  const startChangeRequests = useGameStore((state) => state.startChangeRequests);
  const investigating = useGameStore((state) => state.changeSession !== null);
  const challenged = useGameStore((state) => state.lastChangeReport !== null);
  const canUndo = useGameStore((state) => state.history.past.length > 0);
  const canRedo = useGameStore((state) => state.history.future.length > 0);
  const recordProgress = useGameStore((state) => state.recordProgress);
  const score = useMemo(() => scoreCodebase(codebase, stage), [codebase, stage]);
  useEffect(() => {
    recordProgress(stage.id, score.total);
  }, [stage.id, score.total, recordProgress]);
  return (
    <header className="stage-panel">
      <StageSelect />
      <div className="stage-panel__heading">
        <h1 className="stage-panel__title">{stage.title}</h1>
        <p className="stage-panel__goal">{stage.goal}</p>
        {/* ステージを切り替えたら畳んだ状態を戻して、新しい題材の説明を開いて見せる */}
        <details key={stage.id} className="stage-panel__description" open>
          <summary>どんなコード?</summary>
          <p data-testid="stage-description">{stage.description}</p>
        </details>
      </div>
      <div className="stage-panel__status" data-testid="score" aria-live="polite">
        {describeScore(score)}
      </div>
      <CritiquePanel disabled={investigating} />
      <HintPanel key={stage.id} stage={stage} disabled={investigating} />
      <div className="stage-panel__actions">
        <button type="button" data-testid="change-request-start" onClick={startChangeRequests} disabled={investigating}>
          {challenged ? 'もう一度挑戦' : '変更依頼に挑戦'}
        </button>
        <button type="button" onClick={undo} disabled={!canUndo || investigating} title="Ctrl+Z">
          元に戻す
        </button>
        <button type="button" onClick={redo} disabled={!canRedo || investigating} title="Ctrl+Y">
          やり直し
        </button>
        <button type="button" className="stage-panel__reset" onClick={resetStage} disabled={investigating}>
          最初に戻す
        </button>
        <PreviewButtons key={stage.id} stage={stage} disabled={investigating} />
      </div>
    </header>
  );
}
