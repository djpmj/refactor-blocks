import type { ChangeOutcome } from '../../application/ChangeRequestUseCases';
import { changeKindOf } from '../../domain/change/ChangeRequest';
import type { ChangeAssessment, ChangeRule } from '../../domain/change/scoreChange';
import type { PlacementRule } from '../../domain/change/scorePlacement';
import { allClasses, findClass, findMethod, type Codebase } from '../../domain/codebase/Codebase';

export const CHANGE_RULE_LABEL: Record<ChangeRule, string> = {
  shotgun: '散らばり',
  ripple: '波及',
  entangled: '巻き込み',
  'limit-break': '上限超え',
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
  const reasons: Record<ChangeRule, string> = {
    shotgun: `変更が${String(impact.classesTouched)}つのクラスに散らばっていて、それぞれを直す必要があった`,
    ripple: `変更したクラスを呼んでいる ${names(codebase, impact.rippleClasses, 'class')} も影響を受け、動作確認が必要になる`,
    entangled: `変更するメソッドに、依頼と関係ない責務が${String(impact.mixedResponsibilities)}種類同居していて、巻き込んで壊すおそれがある`,
    'limit-break': `変更を入れると行数の上限を超えるメソッド・クラス・ファイルが${String(impact.overLimitTouched)}個ある`,
  };
  return score.deductions.filter((deduction) => deduction.points > 0).map((deduction) => `${CHANGE_RULE_LABEL[deduction.rule]}: ${reasons[deduction.rule]}`);
}

/** 変更が必要だったメソッドの名前(表示用)。 */
export function siteNames({ impact }: ChangeAssessment, codebase: Codebase): string {
  return names(codebase, impact.sites, 'method');
}

export const PLACEMENT_RULE_LABEL: Record<PlacementRule, string> = {
  'open-closed': '既存クラスの修正',
  'mixed-responsibility': '責務の混在',
  scattered: '責務の分散',
  unwired: '未接続',
  'concrete-base': '具象クラスの継承',
};

/** 置き方の減点のあるルールごとに、なぜ困るのかを1文で説明する。codebase は挑戦前のコード。 */
export function describePlacement({ request, placement: { placement, score } }: ChangeOutcome, codebase: Codebase): string[] {
  const modified = names(codebase, placement.modifiedClassIds, 'class');
  const base = placement.attachedClassId === undefined ? '' : (findClass(codebase, placement.attachedClassId)?.name ?? '');
  const reasons: Record<PlacementRule, string> =
    {
      'open-closed':
        changeKindOf(request) === 'extend'
          ? `機能の追加なのに、既存のクラス(${modified})を書き換えた。追加のたびに既存のコードを触ると、壊すおそれとテストの手間が増える`
          : `ルールの変更に必要な1クラスより多く、既存のクラス(${modified})を書き換えた`,
      'mixed-responsibility': `置いた先の ${placement.partClassName} に、依頼と関係ない責務が${String(placement.otherResponsibilities)}種類同居している`,
      scattered: '同じ種類の処理がすでにあるクラスとは別の場所に置いたので、その責務を持つクラスが1つ増えて散らばった',
      unwired: '新しいクラスがどこからも呼ばれない。実際には呼び出し元の既存クラスを書き換えて、新しいクラスを名指しで呼ぶことになる',
      'concrete-base': `中身のある ${base} を継承して足した。親の実装が変わると巻き込まれる。中身のないインターフェースを実装する形なら避けられる`,
    };
  return score.deductions.filter((deduction) => deduction.points > 0).map((deduction) => `${PLACEMENT_RULE_LABEL[deduction.rule]}: ${reasons[deduction.rule]}`);
}
