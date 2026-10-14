import { biggestProblem } from '../../domain/scoring/biggestProblem';
import type { Score } from '../../domain/scoring/score';
import { useGameStore } from '../store/useGameStore';
import { RULE_LABEL } from './describeScore';
import { RULE_WHY } from './ruleWhy';
import { useIdle } from './useIdle';

export function ProblemHint({ score, stageId, revealed, disabled, onReveal }: Readonly<{ score: Score; stageId: string; revealed: boolean; disabled: boolean; onReveal: () => void }>) {
  const codebase = useGameStore((state) => state.codebase);
  const rule = biggestProblem(score);
  const deduction = score.deductions.find((item) => item.rule === rule);
  const idle = useIdle(!disabled && !revealed && score.total < 100, codebase, stageId);
  return (
    <div className="stage-panel__hint-step">
      <span className="stage-panel__hint-number" aria-hidden="true">1</span>
      <button
        type="button"
        className={`problem-hint-button${idle ? ' ghost-hint-button--idle' : ''}`}
        data-testid="hint-problem"
        disabled={disabled || rule === undefined}
        onClick={() => { if (rule !== undefined) onReveal(); }}
      >
        どこが問題?
      </button>
      {revealed && rule !== undefined && deduction !== undefined && (
        <div className="problem-hint-text" data-testid="hint-problem-text" aria-live="polite">
          <p>いちばん大きい減点: {RULE_LABEL[rule]}(-{String(deduction.points)}点)</p>
          <p>{RULE_WHY[rule].trouble}</p>
          <p>光っている場所を見て、どう直せばよいか考えてみよう</p>
        </div>
      )}
    </div>
  );
}
