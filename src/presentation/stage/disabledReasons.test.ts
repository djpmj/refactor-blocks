import { describe, expect, it } from 'vitest';
import { changeRequestStartReason, ghostHintReason, hintStepReason, INVESTIGATING_REASON, PROBLEM_FIRST_REASON } from './disabledReasons';

describe('changeRequestStartReason', () => {
  it.each([
    ['change-request', null],
    ['opening-fix', '先に、このコードのまま変更を手で入れてみてください(「実際に直してみる」)'],
    ['refactor', '点数が100点になると挑戦できます'],
    ['closing-fix', '先に「もし、この変更が来たら?」をもう一度解いてください'],
  ] as const)('%s の理由', (step, expected) => {
    // Arrange / Act
    const reason = changeRequestStartReason({ investigating: false, step });
    // Assert
    expect(reason).toBe(expected);
  });
  it('実装中を優先する', () => {
    // Arrange / Act
    const reason = changeRequestStartReason({ investigating: true, step: 'change-request' });
    // Assert
    expect(reason).toBe(INVESTIGATING_REASON);
  });
});

describe('hintStepReason', () => {
  it.each([
    [{ problemRevealed: false, revealed: 0, total: 2 }, PROBLEM_FIRST_REASON],
    [{ problemRevealed: true, revealed: 1, total: 2 }, null],
    [{ problemRevealed: true, revealed: 2, total: 2 }, 'ヒントはすべて開きました'],
  ] as const)('ヒントの理由', (input, expected) => {
    // Arrange / Act
    const reason = hintStepReason(input);
    // Assert
    expect(reason).toBe(expected);
  });
});

describe('ghostHintReason', () => {
  const ready = { investigating: false, unlocked: true, manualFixing: false, playing: false, hasMove: true, perfect: false };
  it.each([
    [{}, null],
    [{ unlocked: false, hasMove: false }, PROBLEM_FIRST_REASON],
    [{ manualFixing: true }, '手で直している間は使えません'],
    [{ playing: true }, '動きを再生しています'],
    [{ hasMove: false, perfect: true }, 'ドラッグで動かす手は残っていません'],
    [{ perfect: true }, '100点なので、見せる手はもうありません'],
    [{ investigating: true }, INVESTIGATING_REASON],
  ] as const)('動きの理由', (override, expected) => {
    // Arrange / Act
    const reason = ghostHintReason({ ...ready, ...override });
    // Assert
    expect(reason).toBe(expected);
  });
});
