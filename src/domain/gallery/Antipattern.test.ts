import { describe, expect, it } from 'vitest';
import type { Stage } from '../stage/Stage';
import { practiceStages, type AntipatternEntry } from './Antipattern';

function stageOf(id: string, learns: readonly string[]): Stage {
  return {
    id,
    level: 'tutorial',
    title: id,
    why: '',
    goal: '',
    problem: '',
    description: '',
    learns,
    outcome: '',
    checks: [],
    limits: { method: 10, class: 20, file: 30 },
    dependencyLimit: 3,
    responsibilityLimit: 2,
    codebase: { files: [] },
    classNames: {},
    responsibilityNames: {},
    changeRequests: [],
  };
}

function entryOf(learns: readonly string[]): AntipatternEntry {
  return { id: 'e', kind: 'smell', name: 'e', symptom: 's', harm: 'h', remedy: 'r', learns };
}

describe('practiceStages', () => {
  it('stages が空なら空', () => {
    // Arrange
    const entry = entryOf(['Feature Envy']);

    // Act
    const result = practiceStages(entry, []);

    // Assert
    expect(result).toEqual([]);
  });

  it('タグを learns に持つステージだけを返す', () => {
    // Arrange
    const a = stageOf('A', ['Feature Envy', 'Move Method']);
    const b = stageOf('B', ['Move Method']);

    // Act
    const result = practiceStages(entryOf(['Feature Envy']), [a, b]);

    // Assert
    expect(result).toEqual([a]);
  });

  it('複数のタグのどれかに当たるステージを返す', () => {
    // Arrange
    const a = stageOf('A', ['分岐の分離']);
    const b = stageOf('B', ['Strategy', 'implements']);
    const c = stageOf('C', ['ISP']);

    // Act
    const result = practiceStages(entryOf(['分岐の分離', 'Strategy']), [a, b, c]);

    // Assert
    expect(result).toEqual([a, b]);
  });

  it('1つのステージが2つのタグに当たっても1回だけ返す', () => {
    // Arrange
    const a = stageOf('A', ['カプセル化', 'private']);

    // Act
    const result = practiceStages(entryOf(['カプセル化', 'private']), [a]);

    // Assert
    expect(result).toEqual([a]);
  });

  it('並び順は stages の順を保つ', () => {
    // Arrange
    const c = stageOf('C', ['X']);
    const a = stageOf('A', ['Y']);

    // Act
    const result = practiceStages(entryOf(['Y', 'X']), [c, a]);

    // Assert
    expect(result).toEqual([c, a]);
  });

  it('完全一致だけを当てる', () => {
    // Arrange
    const a = stageOf('A', ['継承の見直し']);

    // Act
    const result = practiceStages(entryOf(['継承']), [a]);

    // Assert
    expect(result).toEqual([]);
  });

  it('項目の learns が空なら空', () => {
    // Arrange
    const a = stageOf('A', ['X']);

    // Act
    const result = practiceStages(entryOf([]), [a]);

    // Assert
    expect(result).toEqual([]);
  });
});
