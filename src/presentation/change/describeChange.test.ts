import { describe, expect, it } from 'vitest';
import { sampleCodebase } from '../../domain/codebase/testFixtures';
import type { ChangeAssessment } from '../../domain/change/scoreChange';
import { CHANGE_RULE_LABEL, describeDeductions } from './describeChange';

describe('describeDeductions', () => {
  it('クラス単位の巻き込みに指定された名前と説明を使う', () => {
    // Arrange
    const assessment: ChangeAssessment = {
      impact: {
        sites: ['method-place'], classesTouched: 1, filesTouched: 1, linesAdded: 1, rippleClasses: [],
        mixedResponsibilities: 0, classMixedResponsibilities: 1, overLimitTouched: 0,
      },
      score: { total: 95, deductions: [{ rule: 'entangled-class', count: 1, points: 5 }] },
    };

    // Act
    const reasons = describeDeductions(assessment, sampleCodebase());

    // Assert
    expect(CHANGE_RULE_LABEL['entangled-class']).toBe('巻き込み(クラス)');
    expect(reasons).toEqual(['巻き込み(クラス): 直すクラスに、この変更と関係のない処理が同居している。直すときに読む量が増え、巻き込んで壊すおそれもある']);
  });
});
