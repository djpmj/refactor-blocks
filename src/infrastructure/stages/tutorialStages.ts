import type { Stage } from '../../domain/stage/Stage';

/** チュートリアル1: Extract Method だけで解ける。まとまった処理を1つ抜き出せば行数の上限に収まる。 */
const extractMethodStage: Stage = {
  methodNames: { aggregation: 'aggregateSales', formatting: 'buildTable', output: 'printReport' },
  responsibilityNames: { aggregation: '集計', formatting: '表の組み立て', output: '出力' },
  classNames: {
    "aggregation": "AggregationHandler",
    "formatting": "FormattingHandler",
    "output": "OutputHandler",
  },
  id: 'tutorial-extract-method',
  problem: 'printMonthlyReportに集計・計算・表の組み立て・出力がまとまっている',
  level: 'tutorial',
  title: 'チュートリアル1: 長いメソッドを分ける',
  outcome: '長いメソッドから、まとまった処理を別のメソッドとして取り出せる',
  learns: ['Extract Method'],
  principles: ['srp'],
  checks: [
    {
      id: 'check-1',
      question: '長い printMonthlyReport を小さなメソッドに分けるいちばんの理由は?',
      choices: [
        { text: 'メソッドの数を増やすほど良い設計になるから', explanation: '数を増やすこと自体は目的ではありません。意味のないまとまりで分けても、読みにくさは変わりません。' },
        { text: '集計・計算・表示のどれを変えるときも、読む範囲をそのまとまりに絞れるから', explanation: '処理ごとに名前の付いたメソッドになっていれば、変えたい部分だけを読めばよくなります。' },
        { text: '行数の上限を超えているので、数字を合わせるため', explanation: '行数の上限は目安で、分ける目的ではありません。数字を合わせるだけで中身が混ざったままでは、変更しやすくなりません。' },
      ],
      answer: 1,
    },
    {
      id: 'check-2',
      question: '抽出したメソッドに処理の内容が分かる名前を付けるのはなぜ?',
      choices: [
        { text: '名前を読めば中身を開かなくても何をする処理か分かり、全体の流れが追いやすくなるから', explanation: 'メソッド名が処理の説明になるので、printMonthlyReport は流れを読むだけで済みます。' },
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
  goal: 'メソッドは28行以内に。メソッドをクリックし、まとまった処理を選んで「メソッドとして抽出」しよう',
  limits: { method: 28, class: 54, file: 61 },
  dependencyLimit: 3,
  responsibilityLimit: 3,
  changeRequests: [
    { id: 'req-report-yoy', title: '前年同月比も出して', description: '経営会議用に、前月比だけでなく前年同月比もレポートに出したい。', responsibility: 'aggregation', linesPerSite: 12, partName: 'compareWithLastYear' },
    { id: 'req-report-share', title: '表に「構成比」列を追加して', description: '売上の表に、全体に占める割合の列を足したい。', responsibility: 'formatting', linesPerSite: 12, partName: 'buildShareColumn', rumor: { from: '営業の佐藤さん', text: '経理の人たちが、レポートの表の見せ方をそのうち変えたいと話していたらしいですよ。' } },
    { id: 'req-boss-aggregation', title: '集計を、前年同月比と店舗別の内訳まで含めて作り直して', description: '経営会議の要望で、売上の集計を前月比だけでなく、前年同月比と店舗別の内訳まで出せるよう全面的に作り直したい。', responsibility: 'aggregation', linesPerSite: 20, boss: true, partName: 'rebuildAggregation', rumor: { from: '先輩の田中さん', text: '数字の出し方を、根こそぎ変える大きな話が出るかもしれないと聞きました。' } },
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
                  { id: 'frag-table-header', label: '表のヘッダーを組み立てる', lines: 2, responsibility: 'formatting', suggestedName: 'buildTableHeader', code: { csharp: "var header = \"商品名 | 数量 | 売上\";\n_logger.LogDebug(\"表のヘッダーを組み立てる が完了しました\");" } },
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
  methodNames: { validation: 'validateOrder', pricing: 'calculateSubtotal', tax: 'calculateTax', persistence: 'saveOrder', notification: 'sendConfirmationMail' },
  responsibilityNames: { validation: '入力の検証', pricing: '小計の計算', tax: '税の計算', persistence: 'DBへの保存', notification: 'メール通知' },
  classNames: {
    "validation": "Validator",
    "pricing": "PriceCalculator",
    "tax": "OrderTaxCalculator",
    "persistence": "Repository",
    "notification": "InvoiceMailer",
  },
  id: 'tutorial-order-service',
  problem: '注文処理の中に税計算が含まれている',
  level: 'tutorial',
  title: 'チュートリアル2: 太った placeOrder',
  outcome: '取り出したメソッドを、担当のクラスへドラッグで移せる',
  learns: ['Extract Method', 'Move Method'],
  principles: ['srp'],
  checks: [
    {
      id: 'check-1',
      question: '税の計算を TaxCalculator のような別クラスに分ける、いちばんの理由は?',
      choices: [
        { text: 'OrderService の行数を減らして、上限に収めるため', explanation: '行数は結果として減りますが、理由ではありません。同じ行数でも、税とは別の理由で変わる処理が混ざっていると変更しにくいままです。' },
        { text: 'クラスの数が多いほど良い設計だから', explanation: 'クラスは数ではなく、変わる理由ごとにまとまっているかが大切です。' },
        { text: '税率の変更が来ても、注文の検証や保存の処理を読まずに直せるようにするため', explanation: '軽減税率のような変更は税の処理だけを見れば済み、注文の流れに影響しません。' },
      ],
      answer: 2,
    },
    {
      id: 'check-2',
      question: 'placeOrder から確認メールの送信や保存をメソッドとして抽出すると、何が良くなる?',
      choices: [
        { text: 'メールの文面や保存の方法を変えるとき、注文の検証などの無関係な処理まで読まなくてよくなる', explanation: '変更する理由ごとにメソッドが分かれていれば、直す場所が見つけやすくなります。' },
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
  goal: 'メソッドは22行以内に。税の計算は抽出してから TaxCalculator へドラッグで移そう',
  limits: { method: 22, class: 50, file: 60 },
  dependencyLimit: 3,
  // 税の計算を TaxCalculator へ移せば OrderService の責務が4種類になり、上限を満たす
  responsibilityLimit: 4,
  changeRequests: [
    { id: 'req-reduced-tax', title: '軽減税率の対象を増やして', description: '来月から、持ち帰り用の総菜も軽減税率(8%)の対象になる。', responsibility: 'tax', linesPerSite: 8, partName: 'addReducedTaxItems' },
    { id: 'req-mail-text', title: '確認メールの文面を変えて', description: '確認メールに、お問い合わせ窓口の案内を入れたい。', responsibility: 'notification', linesPerSite: 6, partName: 'addContactGuide', rumor: { from: '先輩の田中さん', text: 'お客様に伝える内容が、今後少し変わるかもしれないそうです。' } },
    { id: 'req-stock-rule', title: '在庫の検証ルールを足して', description: '1回の注文で買える数量に上限を設けたい。', responsibility: 'validation', linesPerSite: 5, partName: 'validateQuantityLimit', rumor: { from: '先輩の田中さん', text: '「受け付けの条件」を変えたいという話が、いつか出てくるかもしれないらしいです。' } },
    { id: 'req-boss-tax', title: '税の計算を、品目ごとの税率と端数処理まで含めて作り直して', description: '来月から軽減税率の品目が増え、端数処理も品目ごとに変わる。税の計算をまるごと作り直したい。', responsibility: 'tax', linesPerSite: 20, boss: true, partName: 'calculateTaxByItem', rumor: { from: '先輩の田中さん', text: '税まわりで、大きな制度変更が来るかもしれないと聞きました。' } },
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
                  { id: 'frag-validate-items', label: '商品が空でないか検証する', lines: 2, responsibility: 'validation', suggestedName: 'validateItems' , code: { csharp: "if (items.Count == 0) throw new ValidationException(\"対象がありません\");\nif (items.Any(item => !item.IsValid)) throw new ValidationException(\"入力が不正です\");" }},
                  { id: 'frag-validate-stock', label: '在庫があるか検証する', lines: 3, responsibility: 'validation', suggestedName: 'validateStock' , code: { csharp: "if (quantity <= 0) throw new ArgumentOutOfRangeException(nameof(quantity));\nif (!await _inventory.IsAvailableAsync(productId, quantity)) throw new InsufficientStockException(productId);\nawait _inventory.ReserveAsync(productId, quantity);" }},
                  { id: 'frag-subtotal', label: '小計を計算する', lines: 2, responsibility: 'pricing', suggestedName: 'calculateSubtotal' , code: { csharp: "var total = items.Sum(item => item.Quantity * item.UnitPrice);\norder.Subtotal = decimal.Round(total, 2);" }},
                  { id: 'frag-tax', label: '消費税を計算する(軽減税率あり)', lines: 4, responsibility: 'tax', suggestedName: 'calculateTax' , code: { csharp: "var taxRate = isReducedRate ? reducedTaxRate : standardTaxRate;\nvar taxAmount = decimal.Round(order.Subtotal * taxRate, 0, MidpointRounding.AwayFromZero);\norder.TaxAmount = taxAmount;\norder.Total = order.Subtotal + taxAmount;" }},
                  { id: 'frag-save', label: '注文をDBに保存する', lines: 3, responsibility: 'persistence', suggestedName: 'saveOrder' , code: { csharp: "cancellationToken.ThrowIfCancellationRequested();\nawait _repository.SaveAsync(order, cancellationToken);\nawait _unitOfWork.CommitAsync(cancellationToken);" }},
                  { id: 'frag-mail', label: '確認メールを送る', lines: 3, responsibility: 'notification', suggestedName: 'sendConfirmationMail' , code: { csharp: "var message = new MailMessage(order.CustomerEmail, \"注文確認\", $\"注文 {order.Id}: 合計 {order.Total:C}\");\nawait _mailer.SendAsync(message, cancellationToken);\nawait _mailAuditLog.RecordSentAsync(message.Id, cancellationToken);" }},
                ],
              },
            ],
          },
        ],
      },
      {
        id: 'file-tax-calculator',
        path: 'src/tax/TaxCalculator.ts',
        classes: [{ id: 'class-tax-calculator', name: 'TaxCalculator', roleResponsibilities: ['tax'], methods: [] }],
      },
    ],
  },
};

export const tutorialStages: readonly Stage[] = [extractMethodStage, orderServiceStage];
