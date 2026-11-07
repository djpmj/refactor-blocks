import type { StageStep } from '../../domain/change/stageStep';

export const INVESTIGATING_REASON = '変更依頼の実装中は使えません(「実装を終える」か「やめる」で戻ります)';
export const UNDO_UNAVAILABLE_REASON = 'まだ元に戻せる操作がありません';
export const REDO_UNAVAILABLE_REASON = 'やり直せる操作がありません(元に戻した直後に使えます)';
export const PROBLEM_FIRST_REASON = '先に「どこが問題?」を見てみよう';

export function changeRequestStartReason(input: Readonly<{ investigating: boolean; step: StageStep }>): string | null {
  if (input.investigating) return INVESTIGATING_REASON;
  if (input.step === 'opening-fix') return '先に、このコードのまま変更を手で入れてみてください(「実際に直してみる」)';
  if (input.step === 'refactor') return '点数が100点になると挑戦できます';
  if (input.step === 'closing-fix') return '先に「もし、この変更が来たら?」をもう一度解いてください';
  return null;
}

export function hintStepReason(input: Readonly<{ problemRevealed: boolean; revealed: number; total: number }>): string | null {
  if (!input.problemRevealed) return PROBLEM_FIRST_REASON;
  if (input.revealed >= input.total) return 'ヒントはすべて開きました';
  return null;
}

export function ghostHintReason(input: Readonly<{
  investigating: boolean; unlocked: boolean; manualFixing: boolean; playing: boolean; hasMove: boolean; perfect: boolean;
}>): string | null {
  if (input.investigating) return INVESTIGATING_REASON;
  if (!input.unlocked) return PROBLEM_FIRST_REASON;
  if (input.manualFixing) return '手で直している間は使えません';
  if (input.playing) return '動きを再生しています';
  if (!input.hasMove) return 'ドラッグで動かす手は残っていません';
  if (input.perfect) return '100点なので、見せる手はもうありません';
  return null;
}
