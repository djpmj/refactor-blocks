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
};

export function describeScore(score: Score): string {
  const details = score.deductions
    .filter((deduction) => deduction.points > 0)
    .map((deduction) => `${RULE_LABEL[deduction.rule]} -${deduction.points}`);
  return details.length === 0 ? `✅ ${score.total}点` : `${score.total}点(${details.join(' / ')})`;
}
