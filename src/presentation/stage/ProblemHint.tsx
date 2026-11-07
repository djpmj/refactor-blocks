import { biggestProblem } from '../../domain/scoring/biggestProblem';
import type { Score } from '../../domain/scoring/score';
import { useGameStore } from '../store/useGameStore';
import { RULE_LABEL } from './describeScore';
import { lineLimitWhy, RULE_WHY } from './ruleWhy';
import { findLineLimitViolations } from '../../domain/scoring/lineLimits';
import { ReasonButton } from '../ReasonButton';
import { INVESTIGATING_REASON } from './disabledReasons';

export function ProblemHint({ score, revealed, disabled, onReveal }: Readonly<{ score: Score; revealed: boolean; disabled: boolean; onReveal: () => void }>) {
  const codebase = useGameStore((state) => state.codebase);
  const stage = useGameStore((state) => state.stage);
  const rule = biggestProblem(score);
  const noProblemReason = rule === undefined ? '減点がないので、見る問題はありません' : null;
  const disabledReason = disabled ? INVESTIGATING_REASON : noProblemReason;
  const deduction = score.deductions.find((item) => item.rule === rule);
  const lineWhy = rule === 'line-limit'
    ? lineLimitWhy(findLineLimitViolations(codebase, stage.limits).map((violation) => violation.kind))
    : [];
  return (
    <div className="stage-panel__hint-step">
      <span className="stage-panel__hint-number" aria-hidden="true">1</span>
      <ReasonButton
        className="problem-hint-button"
        data-testid="hint-problem"
        disabledReason={disabledReason}
        onClick={() => { if (rule !== undefined) onReveal(); }}
      >
        どこが問題?
      </ReasonButton>
      {revealed && rule !== undefined && deduction !== undefined && (
        <div className="problem-hint-text" data-testid="hint-problem-text" aria-live="polite">
          <p>いちばん大きい減点: {RULE_LABEL[rule]}(-{String(deduction.points)}点)</p>
          {rule === 'line-limit'
            ? lineWhy.map((why) => <p key={why.trouble}>{why.trouble}</p>)
            : <p>{RULE_WHY[rule].trouble}</p>}
          <p>光っている場所を見て、どう直せばよいか考えてみよう</p>
        </div>
      )}
    </div>
  );
}
