import { useState } from 'react';
import { useGameStore } from '../store/useGameStore';
import { RULE_LABEL } from './describeScore';
import { RULE_WHY } from './ruleWhy';
import type { Score, ScoreRule } from '../../domain/scoring/score';

export function ScoreBreakdown({ score, disabled }: Readonly<{
  score: Score;
  disabled: boolean;
}>) {
  const [openRules, setOpenRules] = useState<ReadonlySet<ScoreRule>>(new Set());
  const focusedRule = useGameStore((state) => state.focusedRule);
  const focusRule = useGameStore((state) => state.focusRule);
  const deductions = score.deductions.filter((deduction) => deduction.points > 0);
  if (deductions.length === 0) return null;
  const toggleWhy = (rule: ScoreRule) => setOpenRules((current) => {
    const next = new Set(current);
    if (!next.delete(rule)) next.add(rule);
    return next;
  });
  return (
    <details className="score-breakdown">
      <summary>減点の内訳({deductions.length})</summary>
      <div className="score-breakdown__items">
        {deductions.map(({ rule, count }) => {
          const open = openRules.has(rule);
          const whyId = `score-why-${rule}`;
          return (
            <div key={rule} className="score-breakdown__item">
              <div className="score-breakdown__row">
                <button
                  type="button"
                  aria-pressed={focusedRule === rule}
                  disabled={disabled}
                  onClick={() => focusRule(focusedRule === rule ? null : rule)}
                >
                  {RULE_LABEL[rule]} ×{count}
                </button>
                <button
                  type="button"
                  className="score-breakdown__why-toggle"
                  aria-expanded={open}
                  aria-controls={whyId}
                  disabled={disabled}
                  onClick={() => toggleWhy(rule)}
                >
                  なぜ?
                </button>
              </div>
              <div id={whyId} className="score-breakdown__why" hidden={!open}>
                <p><strong>こう困ります:</strong>{RULE_WHY[rule].trouble}</p>
                <p><strong>だから:</strong>{RULE_WHY[rule].because}</p>
              </div>
            </div>
          );
        })}
      </div>
    </details>
  );
}
