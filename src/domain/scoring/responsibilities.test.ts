import { describe, expect, it } from 'vitest';
import type { Codebase } from '../codebase/Codebase';
import { fragment, sampleCodebase } from '../codebase/testFixtures';
import { findResponsibilityViolations } from './responsibilities';

describe('findResponsibilityViolations', () => {
  it('責務の種類数が上限を超えたクラスだけを返す', () => {
    // Arrange
    const codebase = sampleCodebase();

    // Act
    const violations = findResponsibilityViolations(codebase, 2);

    // Assert
    expect(violations).toEqual([{ classId: 'class-order', responsibilities: 3, limit: 2 }]);
  });

  it('ちょうど上限の種類数は違反にしない', () => {
    // Arrange
    const codebase = sampleCodebase();

    // Act
    const violations = findResponsibilityViolations(codebase, 3);

    // Assert
    expect(violations).toEqual([]);
  });

  it('同じ責務は複数のメソッドにまたがっても1種類と数え、呼び出し(call)は数えない', () => {
    // Arrange
    const codebase: Codebase = {
      files: [
        {
          id: 'file',
          path: 'src/A.ts',
          classes: [
            {
              id: 'class-a',
              name: 'A',
              methods: [
                { id: 'm1', name: 'm1', visibility: 'public', fragments: [fragment('f1', 1, 'tax'), fragment('f2', 1, 'call')] },
                { id: 'm2', name: 'm2', visibility: 'private', fragments: [fragment('f3', 1, 'tax'), fragment('f4', 1, 'io')] },
              ],
            },
          ],
        },
      ],
    };

    // Act
    const violations = findResponsibilityViolations(codebase, 1);

    // Assert
    expect(violations).toEqual([{ classId: 'class-a', responsibilities: 2, limit: 1 }]);
  });
});
