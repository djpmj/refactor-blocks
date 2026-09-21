import { describe, expect, it } from 'vitest';
import { sampleCodebase } from '../codebase/testFixtures';
import { findLineLimitViolations } from './lineLimits';

describe('findLineLimitViolations', () => {
  it('上限を超えたメソッド・クラス・ファイルだけを返す', () => {
    // Arrange
    const codebase = sampleCodebase();

    // Act
    const violations = findLineLimitViolations(codebase, { method: 20, class: 100, file: 27 });

    // Assert
    expect(violations).toEqual([
      { kind: 'method', targetId: 'method-place', lines: 26, limit: 20 },
      { kind: 'file', targetId: 'file-order', lines: 28, limit: 27 },
    ]);
  });

  it('ちょうど上限の行数は違反にしない', () => {
    // Arrange
    const codebase = sampleCodebase();

    // Act
    const violations = findLineLimitViolations(codebase, { method: 26, class: 28, file: 28 });

    // Assert
    expect(violations).toEqual([]);
  });
});
