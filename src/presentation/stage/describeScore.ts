import type { Score, ScoreRule } from '../../domain/scoring/score';

export const RULE_LABEL: Record<ScoreRule, string> = {
  'line-limit': '行数',
  coupling: '結合度',
  cycle: '循環依存',
  responsibility: '責務の混在',
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
};

export function describeScore(score: Score): string {
  const details = score.deductions
    .filter((deduction) => deduction.points > 0)
    .map((deduction) => `${RULE_LABEL[deduction.rule]} -${deduction.points}`);
  return details.length === 0 ? `✅ ${score.total}点` : `${score.total}点(${details.join(' / ')})`;
}
