import type { Score } from '../../domain/scoring/score';
import type { FragmentPlacementDiff } from '../../domain/stage/designDiff';
import { RULE_LABEL } from './describeScore';

/** 責務と、プレイヤー・解答例の置き先の組が同じ処理をまとめたもの。 */
export type DesignDiffGroup = {
  readonly fragmentLabels: readonly string[];
  readonly responsibility: string;
  readonly playerClass: string;
  readonly answerClass: string;
};

export function groupDesignDiff(diffs: readonly FragmentPlacementDiff[]): DesignDiffGroup[] {
  const groups = new Map<string, { labels: string[]; first: FragmentPlacementDiff }>();
  for (const item of diffs) {
    const key = JSON.stringify([item.responsibility, item.playerClass, item.answerClass]);
    const group = groups.get(key);
    if (group === undefined) groups.set(key, { labels: [item.fragmentLabel], first: item });
    else group.labels.push(item.fragmentLabel);
  }
  return [...groups.values()].map(({ labels, first }) => ({ fragmentLabels: labels, responsibility: first.responsibility, playerClass: first.playerClass, answerClass: first.answerClass }));
}

export function describeDesignDiffGroup(group: DesignDiffGroup): string {
  const labels = group.fragmentLabels.map((label) => '「' + label + '」').join('');
  return `${labels}: あなた ${group.playerClass} / 解答例 ${group.answerClass}`;
}

/** 置き場所の違いを、責務ごとにまとめた文にする。どちらが良いかは書かない。 */
export function describeDesignDiff(diffs: readonly FragmentPlacementDiff[]): string[] {
  return groupDesignDiff(diffs).map(describeDesignDiffGroup);
}

/** 採点ルールごとの減点がプレイヤーと解答例で違うときだけ、それぞれの減点を事実として並べる。 */
export function describeScoreGap(player: Score, answer: Score): string[] {
  const pointsOf = (score: Score, rule: Score['deductions'][number]['rule']) => score.deductions.find((deduction) => deduction.rule === rule)?.points ?? 0;
  const rules = [...new Set([...player.deductions, ...answer.deductions].map((deduction) => deduction.rule))];
  return rules.flatMap((rule) => {
    const mine = pointsOf(player, rule);
    const theirs = pointsOf(answer, rule);
    if (mine === theirs) return [];
    return [
      ...(mine > 0 ? [`あなたの設計は ${RULE_LABEL[rule]} で -${mine} 点`] : []),
      ...(theirs > 0 ? [`解答例は ${RULE_LABEL[rule]} で -${theirs} 点`] : []),
    ];
  });
}
