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
  it('変更クラス内の別メソッドにある無関係な責務の種類を数える', () => {
    // Arrange
    const codebase: Codebase = {
      files: [{ id: 'file-tax', path: 'src/Tax.ts', classes: [{
        id: 'class-tax', name: 'Tax', methods: [
          { id: 'method-tax', name: 'tax', visibility: 'public', fragments: [fragment('tax', 4, 'tax')] },
          { id: 'method-order', name: 'order', visibility: 'public', fragments: [fragment('order', 4, 'shipping'), fragment('save', 2, 'persistence'), fragment('notify', 2, 'notification')] },
          { id: 'method-call', name: 'call', visibility: 'public', fragments: [fragment('call', 1, 'call')] },
        ],
      }] }],
    };

    // Act
    const result = measureChange(codebase, taxRequest, limits);

    // Assert
    expect(result.ok && result.value.classMixedResponsibilities).toBe(3);
  });

  it('変更箇所が複数クラスなら、それぞれの別責務数を合計する', () => {
    // Arrange
    const codebase: Codebase = {
      files: [{ id: 'file', path: 'src/Tax.ts', classes: [
        { id: 'tax-a', name: 'TaxA', methods: [
          { id: 'tax-a-site', name: 'tax', visibility: 'public', fragments: [fragment('tax-a-frag', 1, 'tax')] },
          { id: 'other-a', name: 'other', visibility: 'public', fragments: [fragment('shipping-a', 1, 'shipping')] },
        ] },
        { id: 'tax-b', name: 'TaxB', methods: [
          { id: 'tax-b-site', name: 'tax', visibility: 'public', fragments: [fragment('tax-b-frag', 1, 'tax')] },
          { id: 'other-b', name: 'other', visibility: 'public', fragments: [fragment('notify-b', 1, 'notification')] },
        ] },
      ] }],
    };

    // Act
    const result = measureChange(codebase, taxRequest, limits);

    // Assert
    expect(result.ok && result.value.classMixedResponsibilities).toBe(2);
  });

  it('税だけのクラスは0、注文の流れが同居するクラスは1種類と数える', () => {
    // Arrange
    const taxOnly: Codebase = { files: [{ id: 'file', path: 'tax.ts', classes: [{ id: 'tax', name: 'Tax', methods: [
      { id: 'tax-site', name: 'tax', visibility: 'public', fragments: [fragment('tax', 1, 'tax')] },
    ] }] }] };
    const mixed: Codebase = { files: [{ id: 'file', path: 'tax.ts', classes: [{ id: 'tax', name: 'Tax', methods: [
      { id: 'tax-site', name: 'tax', visibility: 'public', fragments: [fragment('tax', 1, 'tax')] },
      { id: 'order-flow', name: 'order', visibility: 'public', fragments: [fragment('shipping', 1, 'shipping')] },
    ] }] }] };

    // Act
    const onlyResult = measureChange(taxOnly, taxRequest, limits);
    const mixedResult = measureChange(mixed, taxRequest, limits);

    // Assert
    expect(onlyResult.ok && onlyResult.value.classMixedResponsibilities).toBe(0);
    expect(mixedResult.ok && mixedResult.value.classMixedResponsibilities).toBe(1);
  });

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
        classMixedResponsibilities: 0,
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
        classMixedResponsibilities: 0,
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
