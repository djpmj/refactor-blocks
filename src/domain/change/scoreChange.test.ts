import { describe, expect, it } from 'vitest';
import type { ChangeImpact } from './measureChange';
import { averageScore, scoreChange } from './scoreChange';

const cleanImpact: ChangeImpact = {
  sites: ['m1'],
  classesTouched: 1,
  filesTouched: 1,
  linesAdded: 8,
  rippleClasses: [],
  mixedResponsibilities: 0,
  overLimitTouched: 0,
};

describe('scoreChange', () => {
  it('減点がなければ100点で、内訳は6ルールを常に同じ順で返す', () => {
    // Arrange / Act
    const score = scoreChange(cleanImpact);

    // Assert
    expect(score.total).toBe(100);
    expect(score.deductions.map((deduction) => deduction.rule)).toEqual([
      'shotgun',
      'ripple',
      'entangled',
      'limit-break',
      'missed',
      'extra',
    ]);
  });

  it('散らばり・波及・巻き込み・上限超え・調査の漏れと余計な選択を、表のとおりに減点する', () => {
    // Arrange
    const impact: ChangeImpact = {
      ...cleanImpact,
      classesTouched: 3,
      rippleClasses: ['a', 'b'],
      mixedResponsibilities: 2,
      overLimitTouched: 1,
    };
    const investigation = { missed: ['x'], extra: ['y', 'z'] };

    // Act
    const score = scoreChange(impact, investigation);

    // Assert
    // 散らばり(3-1)*10 + 波及2*5 + 巻き込み2*5 + 上限超え10 + 漏れ10 + 余計2*5 = 70
    expect(score.total).toBe(30);
    expect(score.deductions.map((deduction) => deduction.points)).toEqual([20, 10, 10, 10, 10, 10]);
  });

  it('0点より下にはしない', () => {
    // Arrange
    const impact: ChangeImpact = { ...cleanImpact, classesTouched: 20 };

    // Act
    const score = scoreChange(impact);

    // Assert
    expect(score.total).toBe(0);
  });
});

describe('averageScore', () => {
  it('点数の平均を四捨五入する', () => {
    // Arrange
    const scores = [
      { total: 100, deductions: [] },
      { total: 85, deductions: [] },
    ];

    // Act / Assert
    expect(averageScore(scores)).toBe(93);
  });

  it('空なら100点', () => {
    expect(averageScore([])).toBe(100);
  });
});
