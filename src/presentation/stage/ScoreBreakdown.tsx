import { useState } from 'react';
import { useGameStore } from '../store/useGameStore';
import { RULE_LABEL } from './describeScore';
import { lineLimitWhy, RULE_WHY } from './ruleWhy';
import type { Score, ScoreRule } from '../../domain/scoring/score';
import { findClass, type Codebase } from '../../domain/codebase/Codebase';
import { findMisplacedResponsibilities } from '../../domain/scoring/misplacedResponsibilities';
import { classDependencies, findCycles } from '../../domain/codebase/dependencies';
import { findLineLimitViolations } from '../../domain/scoring/lineLimits';
import { violationDependencies } from '../../domain/scoring/violationDependencies';
import { violationTargets } from '../../domain/scoring/violationTargets';
import type { Stage } from '../../domain/stage/Stage';
import { GlossaryTermsRow } from '../glossary/GlossaryText';
import { describeDependencies, describeTargets, type DescribedTargets } from './describeTargets';

function MisplacedViolationDetails({ codebase }: Readonly<{ codebase: Codebase }>) {
  const violations = findMisplacedResponsibilities(codebase);
  if (violations.length === 0) return null;
  return (
    <ul className="score-breakdown__violation-details" data-testid="misplaced-violations">
      {violations.map((violation) => {
        const codeClass = findClass(codebase, violation.classId);
        if (codeClass === undefined) return null;
        return <li key={violation.classId}><strong>{codeClass.name}</strong>: {violation.fragments.map(({ label }) => label).join('、')}</li>;
      })}
    </ul>
  );
}

function clearPreviewRules(previewRuleFor: (rule: ScoreRule | null, source: 'hover' | 'focus') => void): void {
  previewRuleFor(null, 'hover');
  previewRuleFor(null, 'focus');
}

function deductionLabel(rule: ScoreRule, count: number, codebase: Codebase): string {
  if (rule !== 'cycle') return `${RULE_LABEL[rule]} ×${count}`;
  return `${RULE_LABEL[rule]} ${findCycles(classDependencies(codebase)).length}組(矢印${count}本)`;
}

function describeRule(rule: ScoreRule, codebase: Codebase, stage: Stage): DescribedTargets {
  if (rule === 'coupling' || rule === 'cycle' || rule === 'layer') return describeDependencies(codebase, violationDependencies(codebase, stage)[rule]);
  return describeTargets(codebase, violationTargets(codebase, stage)[rule]);
}

/** 減点の原因になっているクラス・メソッド(依存なら矢印)を名前で並べる。押すとキャンバスでその場所を選んで寄せる。 */
function TargetNames({ rule, codebase, stage, disabled }: Readonly<{ rule: ScoreRule; codebase: Codebase; stage: Stage; disabled: boolean }>) {
  const selectMethod = useGameStore((state) => state.selectMethod);
  const focusHint = useGameStore((state) => state.focusHint);
  const { names, rest } = describeRule(rule, codebase, stage);
  if (names.length === 0) return null;
  return (
    <p className="score-breakdown__targets" data-testid={`score-targets-${rule}`}>
      対象:{' '}
      {names.map(({ label, target }, index) => (
        <span key={label}>
          {index > 0 ? '、' : null}
          <button
            type="button"
            className="score-breakdown__target"
            disabled={disabled}
            onClick={() => {
              if (target.methodIds.length === 1) selectMethod(target.methodIds[0]);
              focusHint(target, `score-target-${rule}-${label}`);
            }}
          >
            {label}
          </button>
        </span>
      ))}
      {rest > 0 ? `、ほか ${rest} 件` : null}
    </p>
  );
}

function RuleDetails({ rule, codebase, stage, disabled }: Readonly<{ rule: ScoreRule; codebase: Codebase; stage: Stage; disabled: boolean }>) {
  return <>
    <TargetNames rule={rule} codebase={codebase} stage={stage} disabled={disabled} />
    {rule === 'misplaced' ? <MisplacedViolationDetails codebase={codebase} /> : null}
  </>;
}

function WhyText({ rule, lineWhy }: Readonly<{ rule: ScoreRule; lineWhy: ReturnType<typeof lineLimitWhy> }>) {
  if (rule === 'line-limit') {
    return <>{lineWhy.map((why) => (
      <div key={why.trouble}>
        <p><strong>こう困ります:</strong>{why.trouble}</p>
        <p><strong>だから:</strong>{why.because}</p>
      </div>
    ))}</>;
  }
  return <>
    <GlossaryTermsRow text={RULE_LABEL[rule]} className="score-breakdown__terms" />
    <p><strong>こう困ります:</strong>{RULE_WHY[rule].trouble}</p>
    <p><strong>だから:</strong>{RULE_WHY[rule].because}</p>
  </>;
}

export function ScoreBreakdown({ score, disabled }: Readonly<{
  score: Score;
  disabled: boolean;
}>) {
  const [openRules, setOpenRules] = useState<ReadonlySet<ScoreRule>>(new Set());
  const codebase = useGameStore((state) => state.codebase);
  const stage = useGameStore((state) => state.stage);
  const focusedRule = useGameStore((state) => state.focusedRule);
  const focusRule = useGameStore((state) => state.focusRule);
  const previewRuleFor = useGameStore((state) => state.previewRuleFor);
  const deductions = score.deductions.filter((deduction) => deduction.points > 0);
  const lineWhy = lineLimitWhy(findLineLimitViolations(codebase, stage.limits).map((violation) => violation.kind));
  if (deductions.length === 0) return null;
  const toggleWhy = (rule: ScoreRule) => setOpenRules((current) => {
    const next = new Set(current);
    if (!next.delete(rule)) next.add(rule);
    return next;
  });
  return (
    <details className="score-breakdown" onToggle={(event) => { if (!event.currentTarget.open) clearPreviewRules(previewRuleFor); }}>
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
                  onMouseEnter={() => { if (!disabled) previewRuleFor(rule, 'hover'); }} onMouseLeave={() => previewRuleFor(null, 'hover')}
                  onFocus={() => { if (!disabled) previewRuleFor(rule, 'focus'); }} onBlur={() => previewRuleFor(null, 'focus')}
                >
                  {deductionLabel(rule, count, codebase)}
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
              <RuleDetails rule={rule} codebase={codebase} stage={stage} disabled={disabled} />
              <div id={whyId} className="score-breakdown__why" hidden={!open}>
                <WhyText rule={rule} lineWhy={lineWhy} />
              </div>
            </div>
          );
        })}
      </div>
    </details>
  );
}
