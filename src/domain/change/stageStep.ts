export type StageStep = 'opening-fix' | 'refactor' | 'closing-fix' | 'change-request';

export function stageStep(input: Readonly<{
  score: number;
  hasModifyRequest: boolean;
  openingDone: boolean;
  closingSolved: boolean;
}>): StageStep {
  if (!input.hasModifyRequest) return input.score >= 100 ? 'change-request' : 'refactor';
  if (!input.openingDone) return 'opening-fix';
  if (input.score < 100) return 'refactor';
  return input.closingSolved ? 'change-request' : 'closing-fix';
}
