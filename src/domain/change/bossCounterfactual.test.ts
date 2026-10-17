import { describe, expect, it } from 'vitest';
import type { Codebase } from '../codebase/Codebase';
import { fragment } from '../codebase/testFixtures';
import { bossCounterfactual } from './bossCounterfactual';
import type { ChangeRequest } from './ChangeRequest';

const limits = { method: 40, class: 30, file: 100 };
const boss: ChangeRequest = { id: 'req-boss', title: '税を作り直して', description: '', responsibility: 'tax', linesPerSite: 20, boss: true, partName: 'rebuildTax' };

/** 1つの大きなクラスにすべての処理がある。 */
const fatCodebase: Codebase = {
  files: [{
    id: 'file-order',
    path: 'src/OrderService.ts',
    classes: [{
      id: 'class-order',
      name: 'OrderService',
      methods: [{ id: 'method-place', name: 'placeOrder', visibility: 'public', fragments: [fragment('f-validate', 5, 'validation'), fragment('f-tax', 5, 'tax'), fragment('f-save', 5, 'persistence')] }],
    }],
  }],
};

describe('bossCounterfactual', () => {
  it('ボスでない依頼は undefined', () => {
    // Arrange
    const request = { ...boss, boss: undefined };

    // Act
    const result = bossCounterfactual({ codebase: fatCodebase, limits }, request);

    // Assert
    expect(result).toBeUndefined();
  });

  it('大きなクラス1つのコードでは、そのクラスが書き換わり、上限を超え、100点未満になる', () => {
    // Arrange / Act
    const result = bossCounterfactual({ codebase: fatCodebase, limits }, boss);

    // Assert
    expect(result?.modifiedClassNames).toEqual(['OrderService']);
    expect(result?.overLimitClassNames).toEqual(['OrderService']);
    expect(result?.score).toBeLessThan(100);
  });

  it('上限を超えないなら overLimitClassNames は空', () => {
    // Arrange
    const roomy = { ...limits, class: 200 };

    // Act
    const result = bossCounterfactual({ codebase: fatCodebase, limits: roomy }, boss);

    // Assert
    expect(result?.overLimitClassNames).toEqual([]);
  });

  it('置き先が無い(クラスが無い)コードでは undefined', () => {
    // Arrange
    const empty: Codebase = { files: [] };

    // Act
    const result = bossCounterfactual({ codebase: empty, limits }, boss);

    // Assert
    expect(result).toBeUndefined();
  });
});
