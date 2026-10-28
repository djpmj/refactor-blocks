import { describe, expect, it } from 'vitest';
import { clearChoices } from './clearChoices';

describe('clearChoices', () => {
  it('変更依頼、次のステージ、戻るの順に出す', () => {
    expect(clearChoices({ step: 'change-request', hasChangeRequests: true, nextStageId: 'next' })).toEqual([
      { kind: 'accept-change-request' }, { kind: 'next-stage', stageId: 'next' }, { kind: 'back' },
    ]);
  });
  it('仕上げの手直しを変更依頼より先に出す', () => {
    expect(clearChoices({ step: 'closing-fix', hasChangeRequests: true, nextStageId: 'next' })).toEqual([
      { kind: 'closing-fix' }, { kind: 'next-stage', stageId: 'next' }, { kind: 'back' },
    ]);
  });
  it('変更依頼も次のステージも無ければ戻るだけ', () => {
    expect(clearChoices({ step: 'change-request', hasChangeRequests: false, nextStageId: undefined })).toEqual([{ kind: 'back' }]);
  });
  it('組み替え中は変更依頼を出さない', () => {
    expect(clearChoices({ step: 'refactor', hasChangeRequests: true, nextStageId: 'next' })).toEqual([
      { kind: 'next-stage', stageId: 'next' }, { kind: 'back' },
    ]);
  });
});
