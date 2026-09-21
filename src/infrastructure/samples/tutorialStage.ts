import type { Stage } from '../../domain/stage/Stage';

/** チュートリアル: 注文処理が1メソッドに詰め込まれた OrderService を分解する。 */
export const tutorialStage: Stage = {
  id: 'tutorial-order-service',
  title: 'ステージ1: 太った placeOrder',
  goal: 'メソッドは20行以内に。税の計算は TaxCalculator へ移そう',
  limits: { method: 20, class: 60, file: 80 },
  dependencyLimit: 2,
  // 税の計算を TaxCalculator へ移せば OrderService の責務が4種類になり、上限を満たす
  responsibilityLimit: 4,
  codebase: {
    files: [
      {
        id: 'file-order-service',
        path: 'src/order/OrderService.ts',
        classes: [
          {
            id: 'class-order-service',
            name: 'OrderService',
            methods: [
              {
                id: 'method-place-order',
                name: 'placeOrder',
                visibility: 'public',
                fragments: [
                  { id: 'frag-validate-items', label: '商品が空でないか検証する', lines: 6, responsibility: 'validation', suggestedName: 'validateItems' },
                  { id: 'frag-validate-stock', label: '在庫があるか検証する', lines: 8, responsibility: 'validation', suggestedName: 'validateStock' },
                  { id: 'frag-subtotal', label: '小計を計算する', lines: 5, responsibility: 'pricing', suggestedName: 'calculateSubtotal' },
                  { id: 'frag-tax', label: '消費税を計算する(軽減税率あり)', lines: 9, responsibility: 'tax', suggestedName: 'calculateTax' },
                  { id: 'frag-save', label: '注文をDBに保存する', lines: 7, responsibility: 'persistence', suggestedName: 'saveOrder' },
                  { id: 'frag-mail', label: '確認メールを送る', lines: 6, responsibility: 'notification', suggestedName: 'sendConfirmationMail' },
                ],
              },
            ],
          },
        ],
      },
      {
        id: 'file-tax-calculator',
        path: 'src/tax/TaxCalculator.ts',
        classes: [{ id: 'class-tax-calculator', name: 'TaxCalculator', methods: [] }],
      },
    ],
  },
};
