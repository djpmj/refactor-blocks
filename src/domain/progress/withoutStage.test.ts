import { describe, expect, it } from 'vitest';
import { withoutStage } from './withoutStage';

describe('withoutStage', () => {
  it('指定したステージの分だけを除いた新しい記録を返し、元は変えない', () => {
    // Arrange
    const record = { a: 100, b: 80 };
    // Act
    const next = withoutStage(record, 'a');
    // Assert
    expect(next).toEqual({ b: 80 });
    expect(record).toEqual({ a: 100, b: 80 });
  });

  it('無いIDなら同じ参照を返す', () => {
    // Arrange
    const record = { a: 100 };
    // Act
    const next = withoutStage(record, 'x');
    // Assert
    expect(next).toBe(record);
  });

  it('空の記録なら同じ参照を返す', () => {
    // Arrange
    const record = {};
    // Act
    const next = withoutStage(record, 'a');
    // Assert
    expect(next).toBe(record);
  });

  it('値が配列の記録からも除ける', () => {
    // Arrange
    const record = { a: ['concept-check'], b: ['change-request'] };
    // Act
    const next = withoutStage(record, 'a');
    // Assert
    expect(next).toEqual({ b: ['change-request'] });
  });

  it('値が undefined で入っているキーも、キーごとなくす', () => {
    // Arrange
    const record: Readonly<Partial<Record<string, number>>> = { a: undefined, b: 1 };
    // Act
    const next = withoutStage(record, 'a');
    // Assert
    expect(Object.hasOwn(next, 'a')).toBe(false);
    expect(next).toEqual({ b: 1 });
  });
});
