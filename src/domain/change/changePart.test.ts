import { describe, expect, it } from 'vitest';
import { TRAY_FILE_ID } from '../blank/tray';
import { moveMethod } from '../codebase/moveMethod';
import { sampleCodebase } from '../codebase/testFixtures';
import { changeKindOf, type ChangeRequest } from './ChangeRequest';
import { changePart, isChangePartPlaced, withChangePart } from './changePart';

const request: ChangeRequest = { id: 'req-tax', title: '軽減税率', description: '', responsibility: 'tax', linesPerSite: 8, partName: 'addReducedTax' };

describe('changePart', () => {
  it('依頼から public のメソッド1つと処理1つの部品を作る', () => {
    // Arrange / Act
    const part = changePart(request);

    // Assert
    expect(part).toEqual({
      id: 'method-part-req-tax',
      name: 'addReducedTax',
      visibility: 'public',
      fragments: [{ id: 'req-tax:part', label: '軽減税率', lines: 8, responsibility: 'tax' }],
    });
  });

  it('partName がなければ名前は addedLogic', () => {
    // Arrange
    // Act
    const part = changePart({ ...request, partName: undefined });

    // Assert
    expect(part.name).toBe('addedLogic');
  });
});

describe('withChangePart', () => {
  it('元のファイルの後ろに、部品だけを入れた部品置き場を足す', () => {
    // Arrange
    const codebase = sampleCodebase();

    // Act
    const result = withChangePart(codebase, request);

    // Assert
    expect(result.files.slice(0, -1)).toEqual(codebase.files);
    const tray = result.files.at(-1);
    expect(tray?.id).toBe(TRAY_FILE_ID);
    expect(tray?.classes[0]?.methods).toEqual([changePart(request)]);
  });

  it('元のCodebaseを変更しない', () => {
    // Arrange
    const codebase = sampleCodebase();
    const snapshot = structuredClone(codebase);

    // Act
    withChangePart(codebase, request);

    // Assert
    expect(codebase).toEqual(snapshot);
  });
});

describe('isChangePartPlaced', () => {
  it('置き場にある間は false、クラスへ移すと true、置き場へ戻すと false', () => {
    // Arrange
    const start = withChangePart(sampleCodebase(), request);

    // Act
    const moved = moveMethod(start, 'method-part-req-tax', 'class-tax');
    if (!moved.ok) throw new Error('成功するはず');
    const returned = moveMethod(moved.value, 'method-part-req-tax', 'class-blank-tray');
    if (!returned.ok) throw new Error('成功するはず');

    // Assert
    expect(isChangePartPlaced(start, request)).toBe(false);
    expect(isChangePartPlaced(moved.value, request)).toBe(true);
    expect(isChangePartPlaced(returned.value, request)).toBe(false);
  });
});

describe('changeKindOf', () => {
  it('省略時は modify、extend はそのまま', () => {
    // Arrange / Act / Assert
    expect(changeKindOf(request)).toBe('modify');
    expect(changeKindOf({ ...request, kind: 'extend' })).toBe('extend');
  });
});
