import type { Stage } from '../../domain/stage/Stage';

/** チュートリアル1: Extract Method だけで解ける。まとまった処理を1つ抜き出せば行数の上限に収まる。 */
const extractMethodStage: Stage = {
  id: 'tutorial-extract-method',
  level: 'tutorial',
  title: 'チュートリアル1: 長いメソッドを分ける',
  description:
    '月次の売上レポートを画面に出す ReportService。売上の集計・前月比の計算・表の組み立て・出力が、1つのメソッド printMonthlyReport に上から順に書かれている。',
  goal: 'メソッドは50行以内に。メソッドをクリックし、まとまった処理を選んで「メソッドとして抽出」しよう',
  limits: { method: 50, class: 200, file: 300 },
  dependencyLimit: 2,
  responsibilityLimit: 3,
  codebase: {
    files: [
      {
        id: 'file-report-service',
        path: 'src/report/ReportService.ts',
        classes: [
          {
            id: 'class-report-service',
            name: 'ReportService',
            methods: [
              {
                id: 'method-print-monthly-report',
                name: 'printMonthlyReport',
                visibility: 'public',
                fragments: [
                  { id: 'frag-aggregate-sales', label: '今月の売上を集計する', lines: 22, responsibility: 'aggregation', suggestedName: 'aggregateSales' },
                  { id: 'frag-compare-last-month', label: '前月比を計算する', lines: 16, responsibility: 'aggregation', suggestedName: 'compareWithLastMonth' },
                  { id: 'frag-table-header', label: '表のヘッダーを組み立てる', lines: 14, responsibility: 'formatting', suggestedName: 'buildTableHeader' },
                  { id: 'frag-table-rows', label: '表の行を組み立てる', lines: 24, responsibility: 'formatting', suggestedName: 'buildTableRows' },
                  { id: 'frag-print', label: '画面に出力する', lines: 8, responsibility: 'output', suggestedName: 'print' },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
};

/** チュートリアル2: 注文処理が1メソッドに詰め込まれた OrderService を分解し、税の計算を別クラスへ移す。 */
const orderServiceStage: Stage = {
  id: 'tutorial-order-service',
  level: 'tutorial',
  title: 'チュートリアル2: 太った placeOrder',
  description:
    'ネットショップの注文を受け付ける OrderService。placeOrder の中に、入力と在庫の検証・小計と消費税(軽減税率あり)の計算・DBへの保存・確認メールの送信が全部入っている。税の計算を担当する TaxCalculator は用意されているが、まだ空っぽ。',
  goal: 'メソッドは40行以内に。税の計算は抽出してから TaxCalculator へドラッグで移そう',
  limits: { method: 40, class: 200, file: 300 },
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
                  { id: 'frag-validate-items', label: '商品が空でないか検証する', lines: 12, responsibility: 'validation', suggestedName: 'validateItems' },
                  { id: 'frag-validate-stock', label: '在庫があるか検証する', lines: 18, responsibility: 'validation', suggestedName: 'validateStock' },
                  { id: 'frag-subtotal', label: '小計を計算する', lines: 14, responsibility: 'pricing', suggestedName: 'calculateSubtotal' },
                  { id: 'frag-tax', label: '消費税を計算する(軽減税率あり)', lines: 24, responsibility: 'tax', suggestedName: 'calculateTax' },
                  { id: 'frag-save', label: '注文をDBに保存する', lines: 20, responsibility: 'persistence', suggestedName: 'saveOrder' },
                  { id: 'frag-mail', label: '確認メールを送る', lines: 16, responsibility: 'notification', suggestedName: 'sendConfirmationMail' },
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

export const tutorialStages: readonly Stage[] = [extractMethodStage, orderServiceStage];
