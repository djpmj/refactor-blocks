import type { Stage } from '../../domain/stage/Stage';

/** チュートリアル1: Extract Method だけで解ける。まとまった処理を1つ抜き出せば行数の上限に収まる。 */
const extractMethodStage: Stage = {
  id: 'tutorial-extract-method',
  level: 'tutorial',
  title: 'チュートリアル1: 長いメソッドを分ける',
  learns: ['Extract Method'],
  checks: [
    {
      id: 'check-1',
      question: '長い printMonthlyReport を小さなメソッドに分けるいちばんの理由は?',
      choices: [
        { text: 'メソッドの数を増やすほど良い設計になるから', explanation: '数を増やすこと自体は目的ではありません。意味のないまとまりで分けても、読みにくさは変わりません。' },
        { text: '集計・計算・表示のどれを変えるときも、読む範囲をそのまとまりに絞れるから', explanation: '正解です。処理ごとに名前の付いたメソッドになっていれば、変えたい部分だけを読めばよくなります。' },
        { text: '行数の上限を超えているので、数字を合わせるため', explanation: '行数の上限は目安で、分ける目的ではありません。数字を合わせるだけで中身が混ざったままでは、変更しやすくなりません。' },
      ],
      answer: 1,
    },
    {
      id: 'check-2',
      question: '抽出したメソッドに処理の内容が分かる名前を付けるのはなぜ?',
      choices: [
        { text: '名前を読めば中身を開かなくても何をする処理か分かり、全体の流れが追いやすくなるから', explanation: '正解です。メソッド名が処理の説明になるので、printMonthlyReport は流れを読むだけで済みます。' },
        { text: '名前が長いほど採点で加点されるから', explanation: '名前の長さは採点に関係しません。大事なのは処理の内容を正しく伝えることです。' },
        { text: 'コメントを書かなくてよいので、名前はどんな名前でもよいから', explanation: '名前が内容と合っていなければ、コメントの代わりにならず、かえって誤解のもとになります。' },
      ],
      answer: 0,
    },
  ],
  /** 100点になったときに見せる、この題材で分ける理由。 */
  why: '前年同月比や表の列を変えるたびに、集計から出力まで続く長い処理を読み直すことになります。集計と表示を分ければ、数字や見せ方の変更箇所を追いやすくなります。',
  description:
    '月次の売上レポートを画面に出す ReportService。売上の集計・前月比の計算・表の組み立て・出力が、1つのメソッド printMonthlyReport に上から順に書かれている。',
  goal: 'メソッドは20行以内に。メソッドをクリックし、まとまった処理を選んで「メソッドとして抽出」しよう',
  limits: { method: 20, class: 200, file: 300 },
  dependencyLimit: 2,
  responsibilityLimit: 3,
  changeRequests: [
    { id: 'req-report-yoy', title: '前年同月比も出して', description: '経営会議用に、前月比だけでなく前年同月比もレポートに出したい。', responsibility: 'aggregation', linesPerSite: 10, partName: 'compareWithLastYear' },
    { id: 'req-report-share', title: '表に「構成比」列を追加して', description: '売上の表に、全体に占める割合の列を足したい。', responsibility: 'formatting', linesPerSite: 8, partName: 'buildShareColumn' },
  ],
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
                  { id: 'frag-aggregate-sales', label: '今月の売上を集計する', lines: 6, responsibility: 'aggregation', suggestedName: 'aggregateSales', code: { csharp: 'var monthlySales = sales\n    .Where(s => s.Month == currentMonth)\n    .Sum(s => s.Amount);\n\nvar transactionCount = sales\n    .Count(s => s.Month == currentMonth);' } },
                  { id: 'frag-compare-last-month', label: '前月比を計算する', lines: 7, responsibility: 'aggregation', suggestedName: 'compareWithLastMonth', code: { csharp: 'var lastMonthSales = sales\n    .Where(s => s.Month == previousMonth)\n    .Sum(s => s.Amount);\n\nvar changeRate = lastMonthSales == 0\n    ? 0\n    : (monthlySales - lastMonthSales) / lastMonthSales;' } },
                  { id: 'frag-table-header', label: '表のヘッダーを組み立てる', lines: 1, responsibility: 'formatting', suggestedName: 'buildTableHeader', code: { csharp: 'var header = "商品名 | 数量 | 売上";' } },
                  { id: 'frag-table-rows', label: '表の行を組み立てる', lines: 3, responsibility: 'formatting', suggestedName: 'buildTableRows', code: { csharp: 'var rows = sales\n    .GroupBy(s => s.ProductName)\n    .Select(group => $"{group.Key} | {group.Count()} | {group.Sum(s => s.Amount):C}");' } },
                  { id: 'frag-print', label: '画面に出力する', lines: 9, responsibility: 'output', suggestedName: 'print', code: { csharp: '// レポートを出力する\nConsole.WriteLine(header);\n\nforeach (var row in rows)\n{\n    Console.WriteLine(row);\n}\n\nConsole.WriteLine($"前月比: {changeRate:P}");' } },
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
  learns: ['Extract Method', 'Move Method'],
  checks: [
    {
      id: 'check-1',
      question: '税の計算を TaxCalculator のような別クラスに分ける、いちばんの理由は?',
      choices: [
        { text: 'OrderService の行数を減らして、上限に収めるため', explanation: '行数は結果として減りますが、理由ではありません。同じ行数でも、税とは別の理由で変わる処理が混ざっていると変更しにくいままです。' },
        { text: 'クラスの数が多いほど良い設計だから', explanation: 'クラスは数ではなく、変わる理由ごとにまとまっているかが大切です。' },
        { text: '税率の変更が来ても、注文の検証や保存の処理を読まずに直せるようにするため', explanation: '正解です。軽減税率のような変更は税の処理だけを見れば済み、注文の流れに影響しません。' },
      ],
      answer: 2,
    },
    {
      id: 'check-2',
      question: 'placeOrder から確認メールの送信や保存をメソッドとして抽出すると、何が良くなる?',
      choices: [
        { text: 'メールの文面や保存の方法を変えるとき、注文の検証などの無関係な処理まで読まなくてよくなる', explanation: '正解です。変更する理由ごとにメソッドが分かれていれば、直す場所が見つけやすくなります。' },
        { text: '処理が速くなる', explanation: 'メソッドを分けても実行速度は変わりません。読みやすさと変更のしやすさの話です。' },
        { text: '呼び出し先が増えるので、変更に強くなる', explanation: '呼び出し先が増えること自体は変更に強い理由ではありません。変更の影響範囲が狭くなることが効果です。' },
      ],
      answer: 0,
    },
  ],
  /** 100点になったときに見せる、この題材で分ける理由。 */
  why: '税率やメール文面の変更が注文の検証や保存処理に紛れ、関係ない手順まで確認することになります。役割ごとに置き場所が分かれていれば、変更する理由のある処理を探せます。',
  description:
    'ネットショップの注文を受け付ける OrderService。placeOrder の中に、入力と在庫の検証・小計と消費税(軽減税率あり)の計算・DBへの保存・確認メールの送信が全部入っている。税の計算を担当する TaxCalculator は用意されているが、まだ空っぽ。',
  goal: 'メソッドは40行以内に。税の計算は抽出してから TaxCalculator へドラッグで移そう',
  limits: { method: 40, class: 200, file: 300 },
  dependencyLimit: 2,
  // 税の計算を TaxCalculator へ移せば OrderService の責務が4種類になり、上限を満たす
  responsibilityLimit: 4,
  changeRequests: [
    { id: 'req-reduced-tax', title: '軽減税率の対象を増やして', description: '来月から、持ち帰り用の総菜も軽減税率(8%)の対象になる。', responsibility: 'tax', linesPerSite: 8, partName: 'addReducedTaxItems' },
    { id: 'req-mail-text', title: '確認メールの文面を変えて', description: '確認メールに、お問い合わせ窓口の案内を入れたい。', responsibility: 'notification', linesPerSite: 6, partName: 'addContactGuide' },
    { id: 'req-stock-rule', title: '在庫の検証ルールを足して', description: '1回の注文で買える数量に上限を設けたい。', responsibility: 'validation', linesPerSite: 5, partName: 'validateQuantityLimit' },
  ],
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
