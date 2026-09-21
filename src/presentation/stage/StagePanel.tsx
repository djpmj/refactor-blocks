import { useMemo } from 'react';
import { scoreCodebase, type Score, type ScoreRule } from '../../domain/scoring/score';
import type { StageLevel } from '../../domain/stage/Stage';
import { useGameStore } from '../store/useGameStore';

const RULE_LABEL: Record<ScoreRule, string> = {
  'line-limit': '行数',
  coupling: '結合度',
  cycle: '循環依存',
  responsibility: '責務の混在',
};

const LEVEL_LABEL: Record<StageLevel, string> = {
  tutorial: 'チュートリアル',
  beginner: '初級',
  intermediate: '中級',
};

function StageSelect() {
  const stages = useGameStore((state) => state.stages);
  // ステージは難易度順に並んでいるので、出てきた順に難易度をまとめる
  const levels = [...new Set(stages.map((stage) => stage.level))];
  const stageId = useGameStore((state) => state.stage.id);
  const selectStage = useGameStore((state) => state.selectStage);
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

/** ステージの目標と、行数・結合度・循環依存・責務の混在から出した点数を表示する。責務の中身(responsibility の値)は見せない。 */
export function StagePanel() {
  const stage = useGameStore((state) => state.stage);
  const codebase = useGameStore((state) => state.codebase);
  const resetStage = useGameStore((state) => state.resetStage);
  const undo = useGameStore((state) => state.undo);
  const redo = useGameStore((state) => state.redo);
  const startChangeRequests = useGameStore((state) => state.startChangeRequests);
  const investigating = useGameStore((state) => state.changeSession !== null);
  const canUndo = useGameStore((state) => state.history.past.length > 0);
  const canRedo = useGameStore((state) => state.history.future.length > 0);
  const score = useMemo(() => scoreCodebase(codebase, stage), [codebase, stage]);
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
      <div className="stage-panel__actions">
        <button type="button" data-testid="change-request-start" onClick={startChangeRequests} disabled={investigating}>
          変更依頼に挑戦
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
      </div>
    </header>
  );
}
