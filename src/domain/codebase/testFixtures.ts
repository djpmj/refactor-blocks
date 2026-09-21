import type { Codebase, Fragment } from './Codebase';

/** テスト専用のサンプル。OrderService.placeOrder が検証・税計算・保存を1メソッドに抱えている。 */
export function fragment(id: string, lines: number, responsibility = 'misc'): Fragment {
  return { id, label: id, lines, responsibility };
}

export function sampleCodebase(): Codebase {
  return {
    files: [
      {
        id: 'file-order',
        path: 'src/OrderService.ts',
        classes: [
          {
            id: 'class-order',
            name: 'OrderService',
            methods: [
              {
                id: 'method-place',
                name: 'placeOrder',
                visibility: 'public',
                fragments: [
                  fragment('f-validate', 10, 'validation'),
                  fragment('f-tax', 8, 'tax'),
                  fragment('f-save', 6, 'persistence'),
                ],
              },
            ],
          },
        ],
      },
      {
        id: 'file-tax',
        path: 'src/TaxCalculator.ts',
        classes: [{ id: 'class-tax', name: 'TaxCalculator', methods: [] }],
      },
    ],
  };
}
