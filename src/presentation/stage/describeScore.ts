import type { Score, ScoreRule } from '../../domain/scoring/score';
import { classDependencies, findCycles } from '../../domain/codebase/dependencies';
import type { Codebase } from '../../domain/codebase/Codebase';

export const RULE_LABEL: Record<ScoreRule, string> = {
  'line-limit': '行数',
  coupling: '結合度',
  cycle: '循環依存',
  responsibility: '責務の混在',
  'mixed-method': '責務の混ざったメソッド',
  misplaced: '役割と違う処理が入ったクラス',
  visibility: 'アクセス制御',
  empty: '空のクラス・ファイル',
  unused: '未使用のprivateメソッド',
  'lone-superclass': '子が1つだけの継承',
  stub: '使わないメソッドの空実装',
  contract: 'インターフェースの約束違反',
  'feature-envy': '他クラスのデータを触りすぎ(Feature Envy)',
  encapsulation: 'カプセル化の破れ',
  cohesion: '無関係なデータの塊が同居(凝集度が低い)',
  'trivial-method': '極小メソッドの量産',
  'thin-class': '役割の薄い極小クラス',
  'middle-man': '横流しするだけのクラス',
  layer: '層の依存の向き',
};

export function describeScore(score: Score, codebase?: Codebase): string {
  const details = score.deductions
    .filter((deduction) => deduction.points > 0)
    .map((deduction) => {
      const cycleCount = deduction.rule === 'cycle' && codebase !== undefined
        ? ` ${findCycles(classDependencies(codebase)).length}組`
        : '';
      return `${RULE_LABEL[deduction.rule]}${cycleCount} -${deduction.points}`;
    });
  const deductionSummary = score.total === 0 ? [`減点の合計 -${score.deducted}`, ...details].join(' / ') : details.join(' / ');
  return details.length === 0 ? `✅ ${score.total}点` : `${score.total}点(${deductionSummary})`;
}

/** ヘッダー用の1行。点数はリング、ルールごとの内訳は「減点の内訳」に任せる。 */
export function describeScoreShort(score: Score): string {
  const ruleCount = score.deductions.filter((deduction) => deduction.points > 0).length;
  return ruleCount === 0 ? '✅ 減点なし' : `減点 ${ruleCount}項目(-${score.deducted})`;
}

/** 点数が、ステージを開いたとき(初期コード)と同じか。100点は対象外(初期点が100点でも注記は出さない)。 */
export function isStartingScore(score: Score, initial: Score): boolean {
  return score.total === initial.total && score.deducted === initial.deducted && score.total < 100;
}
