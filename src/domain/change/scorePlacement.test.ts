import { describe, expect, it } from 'vitest';
import type { Placement } from './measurePlacement';
import { scorePlacement, type PlacementRule } from './scorePlacement';

const clean: Placement = {
  partClassId: 'class-a',
  partClassName: 'A',
  modifiedClassIds: [],
  otherResponsibilities: 0,
  addedResponsibilityClasses: 0,
  attachment: 'existing-class',
};

function pointsOf(placement: Placement, kind: 'modify' | 'extend', rule: PlacementRule): number | undefined {
  return scorePlacement(placement, kind).deductions.find((deduction) => deduction.rule === rule)?.points;
}

describe('scorePlacement', () => {
  it('減点がなければ100点で、内訳は5ルールを表の順で返す', () => {
    // Arrange / Act
    const score = scorePlacement(clean, 'modify');

    // Assert
    expect(score.total).toBe(100);
    expect(score.deductions.map((deduction) => deduction.rule)).toEqual(['open-closed', 'mixed-responsibility', 'scattered', 'unwired', 'concrete-base']);
    expect(score.deductions.every((deduction) => deduction.points === 0)).toBe(true);
  });

  it("'modify' は既存クラス1つまで許し、2つなら -10", () => {
    // Arrange
    const one: Placement = { ...clean, modifiedClassIds: ['a'] };
    const two: Placement = { ...clean, modifiedClassIds: ['a', 'b'] };

    // Act / Assert
    expect(pointsOf(one, 'modify', 'open-closed')).toBe(0);
    expect(scorePlacement(two, 'modify').deductions[0]).toEqual({ rule: 'open-closed', count: 1, points: 10 });
  });

  it("'extend' は既存クラスを1つ触ると -10", () => {
    // Arrange
    const one: Placement = { ...clean, modifiedClassIds: ['a'] };

    // Act
    const score = scorePlacement(one, 'extend');

    // Assert
    expect(score.deductions[0]).toEqual({ rule: 'open-closed', count: 1, points: 10 });
    expect(score.total).toBe(90);
  });

  it('無関係な責務は1種類ごとに -5', () => {
    // Arrange / Act
    const score = scorePlacement({ ...clean, otherResponsibilities: 3 }, 'modify');

    // Assert
    expect(score.deductions[1]).toEqual({ rule: 'mixed-responsibility', count: 3, points: 15 });
  });

  it("責務の分散は 'modify' なら -10、'extend' なら0", () => {
    // Arrange
    const scattered: Placement = { ...clean, addedResponsibilityClasses: 1 };

    // Act / Assert
    expect(pointsOf(scattered, 'modify', 'scattered')).toBe(10);
    expect(pointsOf(scattered, 'extend', 'scattered')).toBe(0);
  });

  it("つながり方は none が -20、concrete が -10、abstract と existing-class は0", () => {
    // Arrange / Act / Assert
    expect(scorePlacement({ ...clean, attachment: 'none' }, 'extend').total).toBe(80);
    expect(scorePlacement({ ...clean, attachment: 'concrete' }, 'extend').total).toBe(90);
    expect(scorePlacement({ ...clean, attachment: 'abstract' }, 'extend').total).toBe(100);
    expect(scorePlacement({ ...clean, attachment: 'existing-class' }, 'extend').total).toBe(100);
  });

  it('0点より下にはしない', () => {
    // Arrange
    const worst: Placement = { ...clean, otherResponsibilities: 30, attachment: 'none' };

    // Act
    const score = scorePlacement(worst, 'modify');

    // Assert
    expect(score.total).toBe(0);
  });
});
