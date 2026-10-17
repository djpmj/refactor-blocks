import { useEffect, useMemo, useRef, useState } from 'react';
import type { Codebase } from '../../domain/codebase/Codebase';
import { clearConditions, worstMeasures } from '../../domain/stage/clearConditions';
import type { Score } from '../../domain/scoring/score';
import type { Stage } from '../../domain/stage/Stage';
import type { History } from '../../domain/codebase/history';
import { useGameStore } from '../store/useGameStore';
import { describeCondition } from './describeCondition';

type PreviousConditions = {
  readonly stageId: string;
  readonly unmetRules: ReadonlySet<string>;
  readonly history: History;
  readonly layoutResetCount: number;
};

type JustMetConditions = {
  readonly stageId: string;
  readonly rules: ReadonlySet<string>;
};

function didRestoreHistory(previous: PreviousConditions, stageId: string, codebase: Codebase): boolean {
  if (previous.stageId !== stageId) return false;
  return previous.history.past.at(-1) === codebase || previous.history.future[0] === codebase;
}

function shouldSuppressTransition(previous: PreviousConditions | null, stageId: string, codebase: Codebase, layoutResetCount: number): boolean {
  return previous !== null && previous.stageId === stageId
    && (previous.layoutResetCount !== layoutResetCount || didRestoreHistory(previous, stageId, codebase));
}

function getNewlyMetRules(previous: PreviousConditions | null, stageId: string, conditions: ReturnType<typeof clearConditions>, suppress: boolean): string[] {
  if (previous === null || previous.stageId !== stageId || suppress) return [];
  return conditions
    .filter((condition) => condition.count === 0 && previous.unmetRules.has(condition.rule))
    .map((condition) => condition.rule);
}

function hasRegressed(previous: PreviousConditions | null, stageId: string, conditions: ReturnType<typeof clearConditions>): boolean {
  return previous !== null && previous.stageId === stageId
    && conditions.some((condition) => condition.count > 0 && !previous.unmetRules.has(condition.rule));
}

function rememberConditions(stageId: string, conditions: ReturnType<typeof clearConditions>, history: History, layoutResetCount: number): PreviousConditions {
  return {
    stageId,
    unmetRules: new Set(conditions.filter((condition) => condition.count > 0).map((condition) => condition.rule)),
    history,
    layoutResetCount,
  };
}

function addJustMetRules(current: JustMetConditions, stageId: string, rules: readonly string[]): JustMetConditions {
  return { stageId, rules: new Set([...current.rules, ...rules]) };
}

function useJustMetRules(stageId: string, conditions: ReturnType<typeof clearConditions>, codebase: Codebase) {
  const previousConditions = useRef<PreviousConditions | null>(null);
  const [justMetConditions, setJustMetConditions] = useState<JustMetConditions>({ stageId: '', rules: new Set() });
  const history = useGameStore((state) => state.history);
  const layoutResetCount = useGameStore((state) => state.layoutResetCount);

  useEffect(() => {
    const previous = previousConditions.current;
    const suppress = shouldSuppressTransition(previous, stageId, codebase, layoutResetCount);
    const newlyMet = getNewlyMetRules(previous, stageId, conditions, suppress);
    const regressed = hasRegressed(previous, stageId, conditions);
    previousConditions.current = rememberConditions(stageId, conditions, history, layoutResetCount);
    if (previous?.stageId !== stageId || regressed) {
      setJustMetConditions({ stageId, rules: new Set() });
      return;
    }
    if (newlyMet.length > 0) setJustMetConditions((currentState) => addJustMetRules(currentState, stageId, newlyMet));
  }, [codebase, conditions, history, layoutResetCount, stageId]);

  function clear(rule: string): void {
    setJustMetConditions((currentState) => {
      const rules = new Set(currentState.rules);
      rules.delete(rule);
      return { ...currentState, rules };
    });
  }

  return { rules: justMetConditions.stageId === stageId ? justMetConditions.rules : new Set<string>(), clear };
}

function conditionLabel(achieved: boolean, goal: string, current: string | null): string {
  const status = achieved ? '達成' : '未達成';
  const currentText = current === null ? '' : ` (${current})`;
  return `${status}: ${goal}${currentText}`;
}

export function ClearConditionList({ stage, codebase, initial, current }: Readonly<{
  stage: Stage;
  codebase: Codebase;
  initial: Score;
  current: Score;
}>) {
  const conditions = useMemo(() => clearConditions(initial, current), [initial, current]);
  const measures = useMemo(() => worstMeasures(codebase, stage), [codebase, stage]);
  const justMet = useJustMetRules(stage.id, conditions, codebase);

  const achievedCount = conditions.filter((condition) => condition.count === 0).length;
  const allAchieved = achievedCount === conditions.length;
  return (
    <section className="clear-conditions" aria-labelledby="clear-conditions-title">
      <div className="clear-conditions__heading">
        <h3 id="clear-conditions-title">クリア条件</h3>
        <span
          className={`clear-conditions__progress${allAchieved ? ' clear-conditions__progress--complete' : ''}`}
          data-testid="clear-conditions-progress"
        >
          {achievedCount}/{conditions.length} 達成
        </span>
      </div>
      <ul aria-live="polite">
        {conditions.map((condition) => {
          const achieved = condition.count === 0;
          const description = describeCondition(condition, stage, measures, codebase);
          const recentlyAchieved = justMet.rules.has(condition.rule);
          const label = conditionLabel(achieved, description.goal, description.current);
          return (
            <li
              key={condition.rule}
              className={`clear-condition--${achieved ? 'met' : 'unmet'}${recentlyAchieved ? ' clear-condition--just-met' : ''}`}
              aria-label={label}
              onAnimationEnd={(event) => {
                if (event.target === event.currentTarget) justMet.clear(condition.rule);
              }}
            >
              <span className="clear-condition__badge" aria-hidden="true">{achieved ? '✓' : '✗'}</span>
              <span className="clear-condition__description">
                <span className="clear-condition__goal">{description.goal}</span>
                {description.current !== null && <span className="clear-condition__current">{description.current}</span>}
                {stage.conditionNotes?.[condition.rule] === undefined ? null : (
                  <small className="clear-condition__note">理由: {stage.conditionNotes[condition.rule]}</small>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
