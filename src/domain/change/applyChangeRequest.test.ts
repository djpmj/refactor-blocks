import { describe, expect, it } from 'vitest';
import { allClasses } from '../codebase/Codebase';
import { methodLines } from '../codebase/lineCount';
import { sampleCodebase } from '../codebase/testFixtures';
import { applyChangeRequest } from './applyChangeRequest';
import type { ChangeRequest } from './ChangeRequest';

const taxRequest: ChangeRequest = { id: 'req-tax', title: '軽減税率', description: '', responsibility: 'tax', linesPerSite: 8 };

describe('applyChangeRequest', () => {
  it('変更箇所のメソッドに、依頼の責務を持つ処理を末尾に足す', () => {
    // Arrange
    const codebase = sampleCodebase();

    // Act
    const result = applyChangeRequest(codebase, taxRequest);

    // Assert
    if (!result.ok) throw new Error('成功するはず');
    const [placeOrder] = allClasses(result.value).flatMap((codeClass) => codeClass.methods);
    expect(methodLines(placeOrder)).toBe(methodLines(sampleCodebase().files[0].classes[0].methods[0]) + 8);
    expect(placeOrder.fragments.at(-1)).toMatchObject({ id: 'req-tax:method-place', lines: 8, responsibility: 'tax' });
  });

  it('元のCodebaseは変更しない', () => {
    // Arrange
    const codebase = sampleCodebase();
    const snapshot = structuredClone(codebase);

    // Act
    applyChangeRequest(codebase, taxRequest);

    // Assert
    expect(codebase).toEqual(snapshot);
  });

  it('変更箇所がなければ no-sites', () => {
    // Arrange
    const codebase = sampleCodebase();

    // Act
    const result = applyChangeRequest(codebase, { ...taxRequest, responsibility: 'shipping' });

    // Assert
    expect(result).toEqual({ ok: false, error: 'no-sites' });
  });
});
