import type { ChangeAssessment, ChangeRule } from '../../domain/change/scoreChange';
import { allClasses, findMethod, type Codebase } from '../../domain/codebase/Codebase';

export const CHANGE_RULE_LABEL: Record<ChangeRule, string> = {
  shotgun: '散らばり',
  ripple: '波及',
  entangled: '巻き込み',
  'limit-break': '上限超え',
  missed: '修正漏れ',
  extra: '調査の無駄',
};

function names(codebase: Codebase, ids: readonly string[], kind: 'class' | 'method'): string {
  const found =
    kind === 'class'
      ? allClasses(codebase).filter((codeClass) => ids.includes(codeClass.id))
      : ids.flatMap((id) => findMethod(codebase, id) ?? []);
  return found.map((item) => item.name).join('、');
}

/** 減点のあるルールごとに、実務でなぜそれが困るのかを1文で説明する。 */
export function describeDeductions({ impact, score }: ChangeAssessment, codebase: Codebase): string[] {
  const count = (rule: ChangeRule): number => score.deductions.find((deduction) => deduction.rule === rule)?.count ?? 0;
  const reasons: Record<ChangeRule, string> = {
    shotgun: `変更が${String(impact.classesTouched)}つのクラスに散らばっていて、それぞれを直す必要があった`,
    ripple: `変更したクラスを呼んでいる ${names(codebase, impact.rippleClasses, 'class')} も影響を受け、動作確認が必要になる`,
    entangled: `変更するメソッドに、依頼と関係ない責務が${String(impact.mixedResponsibilities)}種類同居していて、巻き込んで壊すおそれがある`,
    'limit-break': `変更を入れると行数の上限を超えるメソッド・クラス・ファイルが${String(impact.overLimitTouched)}個ある`,
    missed: `変更が必要な${String(count('missed'))}か所を見落とした(実務なら修正漏れのバグになる)`,
    extra: `変更が不要なメソッドを${String(count('extra'))}個調べた(調査の無駄)`,
  };
  return score.deductions.filter((deduction) => deduction.points > 0).map((deduction) => `${CHANGE_RULE_LABEL[deduction.rule]}: ${reasons[deduction.rule]}`);
}

/** 変更が必要だったメソッドの名前(表示用)。 */
export function siteNames({ impact }: ChangeAssessment, codebase: Codebase): string {
  return names(codebase, impact.sites, 'method');
}
