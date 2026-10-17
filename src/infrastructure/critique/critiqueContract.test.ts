import { describe, expect, it } from 'vitest';
import { buildCritiqueRequest } from '../../domain/critique/critiqueRequest';
import { scoreCodebase } from '../../domain/scoring/score';
import { sampleAnswerCodebase } from '../../domain/stage/sampleAnswer';
import { stages } from '../stages/stageCatalog';
import { isCritiqueRequestBody, MAX_BODY_LENGTH } from '../../../workers/critique/src/validate';

describe('講評リクエスト契約', () => {
  it('全ステージの初期コードと解答例がサーバーの検証を通り、本文上限以内になる', () => {
    for (const stage of stages) {
      for (const codebase of [stage.codebase, sampleAnswerCodebase(stage)]) {
        const request = buildCritiqueRequest(codebase, stage, scoreCodebase(codebase, stage));
        const serialized = JSON.stringify(request);

        expect(serialized.length).toBeLessThanOrEqual(MAX_BODY_LENGTH);
        expect(isCritiqueRequestBody(JSON.parse(serialized))).toBe(true);
      }
    }
  });

  it('必須項目が欠けた本文を拒否する', () => {
    const valid = { goal: '目標', score: { total: 100, deductions: [] }, files: [] };

    expect(isCritiqueRequestBody({ score: valid.score, files: [] })).toBe(false);
    expect(isCritiqueRequestBody({ ...valid, files: {} })).toBe(false);
    expect(isCritiqueRequestBody({ ...valid, files: [{ lines: 1, deductionPoints: 0, classes: [{ name: 'A', lines: 1 }] }] })).toBe(false);
  });
});
