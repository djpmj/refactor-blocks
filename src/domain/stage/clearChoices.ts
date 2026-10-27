import type { StageStep } from '../change/stageStep';

export type ClearChoice =
  | { readonly kind: 'accept-change-request' }
  | { readonly kind: 'closing-fix' }
  | { readonly kind: 'next-stage'; readonly stageId: string }
  | { readonly kind: 'back' };

/** クリア画面の行き先。先頭が主ボタンで、戻るは必ず最後。 */
export function clearChoices(input: Readonly<{ step: StageStep; hasChangeRequests: boolean; nextStageId: string | undefined }>): ClearChoice[] {
  const choices: ClearChoice[] = [];
  if (input.step === 'change-request' && input.hasChangeRequests) choices.push({ kind: 'accept-change-request' });
  if (input.step === 'closing-fix') choices.push({ kind: 'closing-fix' });
  if (input.nextStageId !== undefined) choices.push({ kind: 'next-stage', stageId: input.nextStageId });
  choices.push({ kind: 'back' });
  return choices;
}
