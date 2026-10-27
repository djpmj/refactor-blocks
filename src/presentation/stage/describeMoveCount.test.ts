import { describe, expect, it } from 'vitest';
import { describeMoveCount } from './describeMoveCount';

describe('describeMoveCount', () => {
  it('手数と模範解答の手数を出す', () => {
    // Arrange・Act・Assert
    expect(describeMoveCount({ moves: 1, sample: 1, best: undefined })).toBe('あなたの手数: 1手(模範解答: 1手)');
  });

  it('模範解答が無ければ括弧を付けない', () => {
    // Arrange・Act・Assert
    expect(describeMoveCount({ moves: 4, sample: undefined, best: undefined })).toBe('あなたの手数: 4手');
  });

  it('自己ベストが今回より小さいときだけ足す', () => {
    // Arrange・Act・Assert
    expect(describeMoveCount({ moves: 3, sample: 1, best: 1 })).toBe('あなたの手数: 3手(模範解答: 1手・自己ベスト: 1手)');
    expect(describeMoveCount({ moves: 4, sample: undefined, best: 2 })).toBe('あなたの手数: 4手(自己ベスト: 2手)');
    expect(describeMoveCount({ moves: 3, sample: 1, best: 3 })).toBe('あなたの手数: 3手(模範解答: 1手)');
    expect(describeMoveCount({ moves: 3, sample: undefined, best: 3 })).toBe('あなたの手数: 3手');
  });

  it('手数が数えられないとき(下書きから再開)は理由を出し、自己ベストがあれば後ろに付ける', () => {
    // Arrange・Act・Assert
    expect(describeMoveCount({ moves: undefined, sample: 1, best: undefined })).toBe('前回の続きから再開したため、手数は数えていません');
    expect(describeMoveCount({ moves: undefined, sample: 1, best: 1 })).toBe('前回の続きから再開したため、手数は数えていません(自己ベスト: 1手)');
  });
});
