import { useMemo } from 'react';
import type { Codebase } from '../../domain/codebase/Codebase';
import { clearConditions, worstMeasures } from '../../domain/stage/clearConditions';
import type { Score } from '../../domain/scoring/score';
import type { Stage } from '../../domain/stage/Stage';
import { describeCondition } from './describeCondition';

export function ClearConditionList({ stage, codebase, initial, current }: Readonly<{
  stage: Stage;
  codebase: Codebase;
  initial: Score;
  current: Score;
}>) {
  const conditions = useMemo(() => clearConditions(initial, current), [initial, current]);
  const measures = useMemo(() => worstMeasures(codebase, stage), [codebase, stage]);
  return (
    <section className="clear-conditions" aria-labelledby="clear-conditions-title">
      <h3 id="clear-conditions-title">クリア条件</h3>
      <ul aria-live="polite">
        {conditions.map((condition) => {
          const achieved = condition.count === 0;
          const description = describeCondition(condition, stage, measures);
          return (
            <li key={condition.rule} aria-label={`${achieved ? '達成' : '未達成'}: ${description}`}>
              <span aria-hidden="true">{achieved ? '✓' : '✗'}</span> {description}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
