import { describe, expect, it } from 'vitest';
import { changeKindOf } from '../../domain/change/ChangeRequest';
import { measureExtendPain, painRequestsOf } from '../../domain/change/changePain';
import { scoreCodebase } from '../../domain/scoring/score';
import { applySolutionSteps, sampleAnswerSteps, type SolutionStep } from '../../domain/stage/sampleAnswer';
import { stages } from './stageCatalog';

const stage = stages.find((candidate) => candidate.id === 'intermediate-member-rank-branching');
if (stage === undefined) throw new Error('中級10 (intermediate-member-rank-branching) がありません');
const { extend } = painRequestsOf(stage);
if (extend === undefined) throw new Error('中級10に extend の依頼がありません');
const solution = sampleAnswerSteps[stage.id] ?? [];

describe('中級10: 会員ランクごとのif分岐', () => {
  it('初期状態は100点にならず、模範解答(抽出→ランクごとのクラスへ移動→implements)で100点になる', () => {
    // Arrange / Act
    const initial = scoreCodebase(stage.codebase, stage);
    const solved = scoreCodebase(applySolutionSteps(stage.codebase, solution), stage);

    // Assert
    expect(initial.total).toBeLessThan(100);
    expect(solved.total).toBe(100);
  });

  it('抽出だけして同じクラスに残した状態は100点にならず、書き換えるクラスも減らない', () => {
    // Arrange
    const extractOnly: SolutionStep[] = ['regular', 'premium', 'vip'].flatMap((rank): SolutionStep[] => [
      { extract: { from: 'quotePrice', fragmentIds: [`frag-price-${rank}`], name: `${rank}Price` } },
      { extract: { from: 'quoteShipping', fragmentIds: [`frag-shipping-${rank}`], name: `${rank}Shipping` } },
    ]);

    // Act
    const played = applySolutionSteps(stage.codebase, extractOnly);
    const pain = measureExtendPain(stage, played, extend);

    // Assert
    expect(scoreCodebase(played, stage).total).toBeLessThan(100);
    expect(pain?.currentModified.length).toBeGreaterThanOrEqual(1);
    expect(pain?.improved).toBe(false);
  });

  it('ランクごとのクラスに移しても、MemberRankを実装するまでは書き換えるクラスが残る', () => {
    // Arrange
    const withoutImplements = solution.filter((step) => !('addInterface' in step));

    // Act
    const pain = measureExtendPain(stage, applySolutionSteps(stage.codebase, withoutImplements), extend);

    // Assert
    expect(pain?.currentModified.length).toBeGreaterThanOrEqual(1);
  });

  it('初期状態は書き換えるクラスが1以上、模範解答では0(新しいクラスを足すだけ)', () => {
    // Arrange
    const solved = applySolutionSteps(stage.codebase, solution);

    // Act
    const pain = measureExtendPain(stage, solved, extend);

    // Assert
    expect(pain?.initialModified.length).toBeGreaterThanOrEqual(1);
    expect(pain?.currentModified).toEqual([]);
    expect(pain?.currentTarget).toEqual({ kind: 'new-class', implementing: 'MemberRank' });
  });

  it('why があり、extend が1件目、全依頼に partName がある', () => {
    // Arrange / Act
    const kinds = stage.changeRequests.map((request) => changeKindOf(request));

    // Assert
    expect(stage.why.trim()).not.toBe('');
    expect(kinds).toEqual(['extend', 'modify']);
    expect(stage.changeRequests.every((request) => (request.partName ?? '').trim() !== '')).toBe(true);
  });
});
