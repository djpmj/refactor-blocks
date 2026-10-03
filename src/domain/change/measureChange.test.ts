import { describe, expect, it } from 'vitest';
import type { Codebase } from '../codebase/Codebase';
import { fragment, sampleCodebase } from '../codebase/testFixtures';
import type { ChangeRequest } from './ChangeRequest';
import { measureChange } from './measureChange';

const taxRequest: ChangeRequest = { id: 'req-tax', title: '軽減税率', description: '', responsibility: 'tax', linesPerSite: 8 };
const limits = { method: 20, class: 100, file: 100 };

/** 注文クラスが税クラスの calc を呼んでいる。税の処理は calc だけにある。 */
function separatedCodebase(): Codebase {
  return {
    files: [
      {
        id: 'file-order',
        path: 'src/Order.ts',
        classes: [
          {
            id: 'class-order',
            name: 'Order',
            methods: [
              {
                id: 'method-place',
                name: 'place',
                visibility: 'public',
                fragments: [fragment('f-validate', 10, 'validation'), { ...fragment('f-call', 1, 'call'), uses: ['method-calc'] }],
              },
            ],
          },
        ],
      },
      {
        id: 'file-tax',
        path: 'src/Tax.ts',
        classes: [
          {
            id: 'class-tax',
            name: 'Tax',
            methods: [{ id: 'method-calc', name: 'calc', visibility: 'public', fragments: [fragment('f-tax', 8, 'tax')] }],
          },
        ],
      },
    ],
  };
}

describe('measureChange', () => {
  it('1メソッドに責務が混ざっていると、巻き込みと上限超えが増える', () => {
    // Arrange
    const codebase = sampleCodebase();

    // Act
    const result = measureChange(codebase, taxRequest, limits);

    // Assert
    expect(result).toEqual({
      ok: true,
      value: {
        sites: ['method-place'],
        classesTouched: 1,
        filesTouched: 1,
        linesAdded: 8,
        rippleClasses: [],
        mixedResponsibilities: 2,
        overLimitTouched: 1,
      },
    });
  });

  it('責務が分かれていれば巻き込みも上限超えもなく、呼び出し元のクラスが波及先になる', () => {
    // Arrange
    const codebase = separatedCodebase();

    // Act
    const result = measureChange(codebase, taxRequest, limits);

    // Assert
    expect(result).toEqual({
      ok: true,
      value: {
        sites: ['method-calc'],
        classesTouched: 1,
        filesTouched: 1,
        linesAdded: 8,
        rippleClasses: ['class-order'],
        mixedResponsibilities: 0,
        overLimitTouched: 0,
      },
    });
  });

  it('変更箇所がなければ no-sites', () => {
    // Arrange
    const codebase = sampleCodebase();

    // Act
    const result = measureChange(codebase, { ...taxRequest, responsibility: 'shipping' }, limits);

    // Assert
    expect(result).toEqual({ ok: false, error: 'no-sites' });
  });
});
