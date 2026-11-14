import { describe, expect, it } from 'vitest';
import { changeKindOf } from '../../domain/change/ChangeRequest';
import { measureExtendPain, measurePain } from '../../domain/change/changePain';
import { allClasses } from '../../domain/codebase/Codebase';
import { findLineLimitViolations } from '../../domain/scoring/lineLimits';
import { scoreCodebase } from '../../domain/scoring/score';
import { applySolutionSteps, sampleAnswerSteps } from '../../domain/stage/sampleAnswer';
import { stages } from './stageCatalog';

const stage = stages.find((candidate) => candidate.id === 'advanced-approval-chain');
if (stage === undefined) throw new Error('経費審査ステージがありません');
const solution = sampleAnswerSteps[stage.id] ?? [];

describe('上級11: 経費申請の審査', () => {
  it('模範解答の20手で初期違反がなくなり100点になる', () => {
    // Arrange
    const solved = applySolutionSteps(stage.codebase, solution);
    // Act
    const initial = scoreCodebase(stage.codebase, stage);
    const final = scoreCodebase(solved, stage);
    // Assert
    expect(solution).toHaveLength(20);
    expect(initial.total).toBeLessThan(100);
    expect(new Set(initial.deductions.filter((deduction) => deduction.count > 0).map((deduction) => deduction.rule))).toEqual(new Set(['line-limit', 'responsibility']));
    expect(findLineLimitViolations(stage.codebase, stage.limits)).toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'method', targetId: 'method-review-claim' })]));
    expect(final.total).toBe(100);
  });

  it('4つのルールが同じ契約を実装し、審査の順を残す', () => {
    // Arrange
    const solved = applySolutionSteps(stage.codebase, solution);
    const classes = allClasses(solved);
    const contract = classes.find((candidate) => candidate.name === 'ApprovalRule');
    // Act
    const reviewer = classes.find((candidate) => candidate.name === 'ClaimReviewer');
    const fragments = reviewer?.methods.find((method) => method.name === 'review')?.fragments ?? [];
    // Assert
    for (const name of ['AmountLimitRule', 'ReceiptRule', 'DuplicateClaimRule', 'ManagerApprovalRule']) {
      const codeClass = classes.find((candidate) => candidate.name === name);
      expect(codeClass?.interfaceIds).toContain(contract?.id);
      expect(codeClass?.methods.map((method) => method.name)).toEqual(['check']);
      const responsibilities = codeClass?.methods.flatMap((method) => method.fragments).map((fragment) => fragment.responsibility);
      expect(new Set(responsibilities).size).toBe(1);
    }
    expect(fragments.map((fragment) => fragment.responsibility)).toEqual(['call', 'call', 'call', 'call', 'review-flow']);
  });

  it('契約を実装しない近道は100点にならない', () => {
    // Arrange
    const incomplete = solution.filter((step) => !('addInterface' in step));
    // Act
    const score = scoreCodebase(applySolutionSteps(stage.codebase, incomplete), stage);
    // Assert
    expect(score.total).toBeLessThan(100);
    expect(score.deductions.map((deduction) => deduction.rule)).toContain('contract');
  });

  it('ルール追加と順番変更の変更箇所が狭まる', () => {
    // Arrange
    const solved = applySolutionSteps(stage.codebase, solution);
    // Act
    const extend = measureExtendPain(stage, solved, stage.changeRequests[0]);
    const modify = measurePain(stage, solved);
    // Assert
    expect(extend?.initialModified.length).toBeGreaterThanOrEqual(1);
    expect(extend?.currentModified).toEqual([]);
    expect(extend?.currentTarget).toEqual({ kind: 'new-class', implementing: 'ApprovalRule' });
    expect(modify?.initial.siteIds).toEqual(['method-review-claim']);
    expect(modify?.current.siteIds).toEqual(['method-review-claim']);
    expect(modify?.initial.readLines).toBe(26);
    expect(modify?.current.readLines).toBe(18);
  });

  it('依頼とうわさ、理解度チェックが仕様どおり', () => {
    // Arrange / Act
    const kinds = stage.changeRequests.map(changeKindOf);
    // Assert
    expect(kinds).toEqual(['extend', 'modify', 'modify']);
    expect(stage.changeRequests.map((request) => request.rumor !== undefined)).toEqual([false, false, true]);
    for (const check of stage.checks) {
      expect(check.choices[check.answer].text.length).toBeLessThan(Math.max(...check.choices.map((choice) => choice.text.length)));
    }
  });
});
