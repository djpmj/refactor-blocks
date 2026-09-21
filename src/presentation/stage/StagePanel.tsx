import { useMemo } from 'react';
import { scoreCodebase, type Score, type ScoreRule } from '../../domain/scoring/score';
import { useGameStore } from '../store/useGameStore';

const RULE_LABEL: Record<ScoreRule, string> = { 'line-limit': '行数', coupling: '結合度', cycle: '循環依存' };

function describeScore(score: Score): string {
  const details = score.deductions
    .filter((deduction) => deduction.points > 0)
    .map((deduction) => `${RULE_LABEL[deduction.rule]} -${deduction.points}`);
  return details.length === 0 ? `✅ ${score.total}点` : `${score.total}点(${details.join(' / ')})`;
}

/** ステージの目標と、行数・結合度・循環依存から出した点数を表示する。 */
export function StagePanel() {
  const stage = useGameStore((state) => state.stage);
  const codebase = useGameStore((state) => state.codebase);
  const resetStage = useGameStore((state) => state.resetStage);
  const score = useMemo(() => scoreCodebase(codebase, stage), [codebase, stage]);
  return (
    <header className="stage-panel">
      <div>
        <h1 className="stage-panel__title">{stage.title}</h1>
        <p className="stage-panel__goal">{stage.goal}</p>
      </div>
      <div className="stage-panel__status" data-testid="score" aria-live="polite">
        {describeScore(score)}
      </div>
      <button type="button" className="stage-panel__reset" onClick={resetStage}>
        やり直す
      </button>
    </header>
  );
}
