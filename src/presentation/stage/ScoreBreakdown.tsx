import { useGameStore } from '../store/useGameStore';
import { RULE_LABEL } from './describeScore';
import type { Score } from '../../domain/scoring/score';

export function ScoreBreakdown({ score, disabled }: Readonly<{
  score: Score;
  disabled: boolean;
}>) {
  const focusedRule = useGameStore((state) => state.focusedRule);
  const focusRule = useGameStore((state) => state.focusRule);
  const deductions = score.deductions.filter((deduction) => deduction.points > 0);
  if (deductions.length === 0) return null;
  return (
    <details className="score-breakdown">
      <summary>減点の内訳({deductions.length})</summary>
      <div className="score-breakdown__items">
        {deductions.map(({ rule, count }) => (
          <button
            key={rule}
            type="button"
            aria-pressed={focusedRule === rule}
            disabled={disabled}
            onClick={() => focusRule(focusedRule === rule ? null : rule)}
          >
            {RULE_LABEL[rule]} ×{count}
          </button>
        ))}
      </div>
    </details>
  );
}
