import type { Stage } from '../../domain/stage/Stage';

/**
 * 上級1: メール通知(EmailNotifier)とSMS通知(SmsNotifier)が、
 * 「通知文を組み立てる」「送信ログを記録する」処理をそれぞれ自分の中に抱え込んでいる(同じような処理が2クラスに散らばっている)。
 * すでに空の基底クラス NotifierBase が用意されているが、まだ継承関係は結ばれていない。
 * 「送信ログを記録する」はコピペで生まれた本物の重複(frag-log-email/frag-log-smsにduplicateGroupを付与済み)
 * なので Merge Methods で1つに統合してから NotifierBase へ移す。「通知文を組み立てる」はチャネルごとに
 * 中身が本質的に違うので、統合せず各クラスに残したまま Move Method で共通の受け皿には集めない。
 */
const notifierHierarchyStage: Stage = {
  id: 'advanced-notifier-hierarchy',
  level: 'advanced',
  title: '上級1: 通知クラスの共通処理を基底クラスへ集める',
  description:
    '会員登録時にメールで知らせる EmailNotifier と、SMSで知らせる SmsNotifier。' +
    'どちらも「送信ログを記録する」処理はコピペしたように全く同じ内容で、「通知文を組み立てる」処理はチャネルごとに内容そのものが違う。' +
    '空の基底クラス NotifierBase は用意されているが、まだどちらのクラスとも継承関係で結ばれていない。',
  goal:
    '重複した「送信ログを記録する」処理をExtract Methodで取り出し、メソッドエディタの「似た処理を持つメソッド」から統合してNotifierBaseへ移そう。' +
    '「通知文を組み立てる」処理はチャネルごとに違う本物の実装なので、それぞれのクラスに残したままでよい。' +
    '最後にEmailNotifier・SmsNotifierの継承元をNotifierBaseに設定しよう。メソッドは60行以内、1クラスの責務は2種類まで',
  limits: { method: 60, class: 220, file: 350 },
  dependencyLimit: 2,
  responsibilityLimit: 2,
  changeRequests: [
    { id: 'req-notification-format', title: '通知文の書式を見直して', description: '通知文に、問い合わせ番号を差し込めるようにしたい。', responsibility: 'formatting', linesPerSite: 8, partName: 'insertInquiryNumber' },
    { id: 'req-notification-log', title: '送信ログの記録方法を見直して', description: '送信ログに、再送かどうかのフラグを追加したい。', responsibility: 'logging', linesPerSite: 6, partName: 'logResendFlag' },
  ],
  codebase: {
    files: [
      {
        id: 'file-email-notifier',
        path: 'src/notify/EmailNotifier.ts',
        classes: [
          {
            id: 'class-email-notifier',
            name: 'EmailNotifier',
            methods: [
              {
                id: 'method-notify-email',
                name: 'notifyByEmail',
                visibility: 'public',
                fragments: [
                  { id: 'frag-build-body-email', label: '通知文を組み立てる', lines: 32, responsibility: 'formatting', suggestedName: 'buildEmailBody' },
                  { id: 'frag-log-email', label: '送信ログを記録する', lines: 24, responsibility: 'logging', suggestedName: 'logEmailNotification', duplicateGroup: 'notification-log' },
                  { id: 'frag-send-email', label: 'メールを送信する', lines: 34, responsibility: 'email-delivery', suggestedName: 'sendEmail' },
                ],
              },
            ],
          },
        ],
      },
      {
        id: 'file-sms-notifier',
        path: 'src/notify/SmsNotifier.ts',
        classes: [
          {
            id: 'class-sms-notifier',
            name: 'SmsNotifier',
            methods: [
              {
                id: 'method-notify-sms',
                name: 'notifyBySms',
                visibility: 'public',
                fragments: [
                  { id: 'frag-build-body-sms', label: '通知文を組み立てる', lines: 30, responsibility: 'formatting', suggestedName: 'buildSmsBody' },
                  { id: 'frag-log-sms', label: '送信ログを記録する', lines: 22, responsibility: 'logging', suggestedName: 'logSmsNotification', duplicateGroup: 'notification-log' },
                  { id: 'frag-send-sms', label: 'SMSを送信する', lines: 32, responsibility: 'sms-delivery', suggestedName: 'sendSms' },
                ],
              },
            ],
          },
        ],
      },
      {
        id: 'file-notifier-base',
        path: 'src/notify/NotifierBase.ts',
        classes: [{ id: 'class-notifier-base', name: 'NotifierBase', methods: [] }],
      },
    ],
  },
};

/**
 * 上級2: ネットショップの決済。PaymentService.checkout は最初から共通インターフェース PaymentGateway
 * (処理本体を持たない契約メソッド charge のみ)だけを呼んでおり、Stripe・PayPalを名指ししない
 * (本物のDIP: 呼び出し元は抽象への依存だけを持つ)。StripeGateway・PaypalGateway は自分の処理本体を
 * 保ったまま、まだ PaymentGateway を実装(implements)したと宣言していない。プレイヤーは行数超過の解消
 * (Extract Method)と実装関係の宣言(Set Superclass)を行う。StripeGateway・PaypalGateway の中身が
 * どう変わっても PaymentService の依存本数が1のまま変わらない、という点が上級3(Strategy、依存が
 * 実装数に比例して増える)との対比になる(詳細: docs/specs/payment-gateway-true-dip.md)。
 */
const paymentGatewayInterfaceStage: Stage = {
  id: 'advanced-payment-gateway-interface',
  level: 'advanced',
  title: '上級2: 決済ゲートウェイをインターフェース越しに呼ぶ',
  description:
    'PaymentService の checkout は、共通インターフェース PaymentGateway 経由で決済を呼び出すよう最初から書かれている(Stripe・PayPalを名指ししない)。' +
    'しかし StripeGateway・PaypalGateway はまだ PaymentGateway を実装(implements)したと宣言しておらず、' +
    'どちらも「決済APIを呼び出す」処理と「決済ログを記録する」処理を1つのメソッド(charge)に詰め込んでいて、行数の上限を超えている。' +
    '実装を宣言していないと約束違反になる。',
  goal:
    'StripeGateway・PaypalGateway の charge を、Extract Methodで責務(API呼び出し/ログ記録)ごとに分け、PaymentGateway を実装(implements)するよう設定しよう。' +
    'StripeGateway・PaypalGatewayの中身がどう変わっても、PaymentServiceの依存先は最初から最後まで PaymentGateway 1つのまま変わらない。上級3(方針を増やすほど依存も増える)と見比べてみよう。' +
    'メソッドは90行以内、1クラスの責務は3種類まで。実装を宣言していないと約束違反になる。',
  limits: { method: 90, class: 250, file: 400 },
  dependencyLimit: 1,
  // stripe-config/paypal-configは各ゲートウェイに残る正当な3つ目の責務(このステージの狙いと無関係なため違反にしない)。
  responsibilityLimit: 3,
  changeRequests: [
    {
      id: 'req-add-paypay',
      title: 'PayPayでも払えるようにして',
      description: '決済手段にPayPayを追加したい。Stripe・PayPalの決済はこれまでどおり使う。',
      responsibility: 'gateway-integration',
      linesPerSite: 30,
      kind: 'extend',
      partName: 'charge',
    },
    { id: 'req-payment-logging', title: '決済ログの記録方法を見直して', description: '決済ログに、失敗時のリトライ回数を残したい。', responsibility: 'payment-logging', linesPerSite: 6, partName: 'logRetryCount' },
    { id: 'req-gateway-integration', title: '決済APIの呼び出し方を見直して', description: '決済API呼び出しに、共通のタイムアウト設定を追加したい。', responsibility: 'gateway-integration', linesPerSite: 5, partName: 'applyGatewayTimeout' },
  ],
  codebase: {
    files: [
      {
        id: 'file-payment-service',
        path: 'src/payment/PaymentService.ts',
        classes: [
          {
            id: 'class-payment-service',
            name: 'PaymentService',
            methods: [
              {
                id: 'method-checkout',
                name: 'checkout',
                visibility: 'public',
                fragments: [
                  { id: 'frag-validate-payment', label: '注文内容とカード情報を検証する', lines: 60, responsibility: 'validation', suggestedName: 'validatePayment' },
                  { id: 'frag-dispatch-gateway', label: 'PaymentGateway(インターフェース)経由で決済を実行する', lines: 12, responsibility: 'gateway-dispatch', uses: ['method-payment-gateway-charge'], suggestedName: 'dispatchGateway' },
                ],
              },
            ],
          },
        ],
      },
      {
        id: 'file-stripe-gateway',
        path: 'src/payment/StripeGateway.ts',
        classes: [
          {
            id: 'class-stripe-gateway',
            name: 'StripeGateway',
            methods: [
              {
                id: 'method-charge-stripe',
                name: 'charge',
                visibility: 'public',
                fragments: [
                  { id: 'frag-stripe-api-call', label: 'Stripe APIを呼び出して決済する', lines: 60, responsibility: 'gateway-integration', suggestedName: 'callStripeApi' },
                  { id: 'frag-log-payment-stripe', label: '決済ログを記録する(Stripe)', lines: 32, responsibility: 'payment-logging', suggestedName: 'logStripePayment' },
                ],
              },
              {
                id: 'method-configure-stripe',
                name: 'configureStripeCredentials',
                visibility: 'public',
                fragments: [
                  { id: 'frag-configure-stripe', label: 'Stripe APIキーを設定する', lines: 14, responsibility: 'stripe-config', suggestedName: 'configureStripe' },
                ],
              },
            ],
          },
        ],
      },
      {
        id: 'file-paypal-gateway',
        path: 'src/payment/PaypalGateway.ts',
        classes: [
          {
            id: 'class-paypal-gateway',
            name: 'PaypalGateway',
            methods: [
              {
                id: 'method-charge-paypal',
                name: 'charge',
                visibility: 'public',
                fragments: [
                  { id: 'frag-paypal-api-call', label: 'PayPal APIを呼び出して決済する', lines: 58, responsibility: 'gateway-integration', suggestedName: 'callPaypalApi' },
                  { id: 'frag-log-payment-paypal', label: '決済ログを記録する(PayPal)', lines: 32, responsibility: 'payment-logging', suggestedName: 'logPaypalPayment' },
                ],
              },
              {
                id: 'method-configure-paypal',
                name: 'configurePaypalCredentials',
                visibility: 'public',
                fragments: [
                  { id: 'frag-configure-paypal', label: 'PayPal APIキーを設定する', lines: 14, responsibility: 'paypal-config', suggestedName: 'configurePaypal' },
                ],
              },
            ],
          },
        ],
      },
      {
        id: 'file-payment-gateway',
        path: 'src/payment/PaymentGateway.ts',
        classes: [
          {
            id: 'class-payment-gateway',
            name: 'PaymentGateway',
            methods: [{ id: 'method-payment-gateway-charge', name: 'charge', visibility: 'public', fragments: [] }],
          },
        ],
      },
    ],
  },
};

/**
 * 上級3: ネットショップの注文合計金額の計算。DiscountService.calculateDiscount が、
 * 会員ランク(通常/プレミアム/VIP)によって割引の計算方法をif分岐で切り替えている
 * (分岐に相当する3つの処理が1つのメソッドの中に埋め込まれている)。
 * 共通のインターフェース役 DiscountStrategy(calculateメソッドの型だけを宣言し、処理本体は持たない)は
 * 用意されているが、ランクごとの計算クラスはまだ存在しない(プレイヤーが作る)。
 * 上級1・2と違い、受け皿を1つに集約せず、方針の数だけ具象クラスを残す
 * (Strategyパターン本来の「方針を増やしても既存クラスに触らずに済む」形)。
 */
const discountStrategyStage: Stage = {
  id: 'advanced-discount-strategy',
  level: 'advanced',
  title: '上級3: 会員ランクの割引をStrategyパターンへ組み替える',
  description:
    'DiscountService の calculateDiscount が、会員ランク(通常/プレミアム/VIP)によって割引の計算方法をif分岐で切り替えている。' +
    '3つの分岐処理が1つの長いメソッドに同居していて、ランクごとの割引ルールを変えるたびにこのメソッドを触ることになる。' +
    'calculateメソッドの型だけを宣言した DiscountStrategy は用意されているが、まだどのクラスとも実装関係で結ばれていない。',
  goal:
    '3つの割引ロジックを、それぞれ新しく作るクラス(RegularDiscount/PremiumDiscount/VipDiscount)へ切り出し、' +
    'どのクラスも DiscountStrategy を実装(implements)するよう設定しよう。上級1・2とは違い、受け皿は1つに集約せず3つに分ける。メソッドは90行以内、1クラスの責務は2種類まで',
  limits: { method: 90, class: 250, file: 400 },
  // 模範解答は3つの具象クラスをそれぞれ呼ぶため常に3依存になる。結合度の改善はこのステージの狙いではない(仕様書参照)。
  dependencyLimit: 3,
  responsibilityLimit: 2,
  changeRequests: [
    { id: 'req-premium-discount', title: 'プレミアム会員の割引率を変えて', description: 'プレミアム会員の割引率を12%に変えたい。', responsibility: 'discount-premium', linesPerSite: 5, partName: 'revisePremiumRate' },
    { id: 'req-vip-discount', title: 'VIP会員の割引条件を変えて', description: 'VIP会員には送料無料に加えてポイント還元率も上げたい。', responsibility: 'discount-vip', linesPerSite: 6, partName: 'raiseVipPointRate' },
  ],
  codebase: {
    files: [
      {
        id: 'file-discount-service',
        path: 'src/pricing/DiscountService.ts',
        classes: [
          {
            id: 'class-discount-service',
            name: 'DiscountService',
            methods: [
              {
                id: 'method-calculate-discount',
                name: 'calculateDiscount',
                visibility: 'public',
                fragments: [
                  { id: 'frag-validate-order', label: '注文内容と会員ランクを検証する', lines: 60, responsibility: 'validation', suggestedName: 'validateOrder' },
                  { id: 'frag-branch-regular', label: '会員ランクが「通常」なら、割引なしで合計する', lines: 14, responsibility: 'discount-regular', suggestedName: 'calculate' },
                  { id: 'frag-branch-premium', label: '会員ランクが「プレミアム」なら、一律10%引きで合計する', lines: 16, responsibility: 'discount-premium', suggestedName: 'calculate' },
                  { id: 'frag-branch-vip', label: '会員ランクが「VIP」なら、送料無料込みで合計する', lines: 18, responsibility: 'discount-vip', suggestedName: 'calculate' },
                ],
              },
            ],
          },
        ],
      },
      {
        id: 'file-discount-strategy',
        path: 'src/pricing/DiscountStrategy.ts',
        classes: [
          {
            id: 'class-discount-strategy',
            name: 'DiscountStrategy',
            methods: [{ id: 'method-discount-strategy-calculate', name: 'calculate', visibility: 'public', fragments: [] }],
          },
        ],
      },
    ],
  },
};

/**
 * 上級4: 週次レポート(WeeklyReportController)と月次レポート(MonthlyReportController)が、
 * 「データを集計する」「レポートオブジェクトを組み立てる」「レポートを送信する」の3処理を1つのメソッドに
 * 詰め込んでいる。「レポートオブジェクトを組み立てる」だけは2クラスで内容が完全に同じ(コピペの重複、
 * duplicateGroupを付与済み)。空のクラス ReportFactory は用意されているが、まだ何も移されていない。
 * 上級1(継承で共通処理をまとめる)と違い、このステージは継承を一切使わない。Merge Methodsで重複を
 * 統合し、Move Methodで別クラス(Factory)へ委譲するだけで解ける、という対比になる。
 */
const reportFactoryStage: Stage = {
  id: 'advanced-report-factory',
  level: 'advanced',
  title: '上級4: レポート生成処理をFactoryへ集約する',
  description:
    'WeeklyReportController と MonthlyReportController は、どちらも「データを集計する」「レポートオブジェクトを組み立てる」' +
    '「レポートを送信する」の3処理を1つのメソッドに詰め込んでいる。' +
    '「レポートオブジェクトを組み立てる」処理はコピペしたように全く同じ内容で、2クラスに重複している。' +
    '空のクラス ReportFactory は用意されているが、まだどちらのクラスからも使われていない。',
  goal:
    '重複した「レポートオブジェクトを組み立てる」処理をExtract Methodで取り出し、メソッドエディタの「似た処理を持つメソッド」から統合してReportFactoryへ移そう。' +
    '上級1と違い、継承(継承元の設定)は使わない。別クラスへ処理を任せる(委譲)だけで解けるはず。メソッドは70行以内、1クラスの責務は2種類まで',
  limits: { method: 70, class: 230, file: 380 },
  dependencyLimit: 1,
  responsibilityLimit: 2,
  changeRequests: [
    { id: 'req-report-building', title: '帳票のタイトルの付け方を見直して', description: '週次・月次のレポートのタイトルに、出力日時を含めたい。', responsibility: 'report-building', linesPerSite: 6, partName: 'addExportedAtToTitle' },
    { id: 'req-report-delivery', title: 'レポートの送信方法を見直して', description: 'レポート送信に、失敗時の再送処理を追加したい。', responsibility: 'report-delivery', linesPerSite: 5, partName: 'retryReportDelivery' },
  ],
  codebase: {
    files: [
      {
        id: 'file-weekly-report-controller',
        path: 'src/report/WeeklyReportController.ts',
        classes: [
          {
            id: 'class-weekly-report-controller',
            name: 'WeeklyReportController',
            methods: [
              {
                id: 'method-export-weekly-report',
                name: 'exportWeeklyReport',
                visibility: 'public',
                fragments: [
                  { id: 'frag-gather-weekly-data', label: '週次データを集計する', lines: 42, responsibility: 'data-aggregation', suggestedName: 'gatherWeeklyData' },
                  { id: 'frag-build-report-weekly', label: 'レポートオブジェクトを組み立てる', lines: 28, responsibility: 'report-building', suggestedName: 'buildReport', duplicateGroup: 'report-building' },
                  { id: 'frag-send-weekly', label: 'レポートを送信する', lines: 22, responsibility: 'report-delivery', suggestedName: 'sendReport' },
                ],
              },
            ],
          },
        ],
      },
      {
        id: 'file-monthly-report-controller',
        path: 'src/report/MonthlyReportController.ts',
        classes: [
          {
            id: 'class-monthly-report-controller',
            name: 'MonthlyReportController',
            methods: [
              {
                id: 'method-export-monthly-report',
                name: 'exportMonthlyReport',
                visibility: 'public',
                fragments: [
                  { id: 'frag-gather-monthly-data', label: '月次データを集計する', lines: 44, responsibility: 'data-aggregation', suggestedName: 'gatherMonthlyData' },
                  { id: 'frag-build-report-monthly', label: 'レポートオブジェクトを組み立てる', lines: 26, responsibility: 'report-building', suggestedName: 'buildReport', duplicateGroup: 'report-building' },
                  { id: 'frag-send-monthly', label: 'レポートを送信する', lines: 22, responsibility: 'report-delivery', suggestedName: 'sendReport' },
                ],
              },
            ],
          },
        ],
      },
      {
        id: 'file-report-factory',
        path: 'src/report/ReportFactory.ts',
        classes: [{ id: 'class-report-factory', name: 'ReportFactory', methods: [] }],
      },
    ],
  },
};

/**
 * 上級5: 上級1(共通処理を基底クラスへ集める)と逆向きの操作。BaseExporter.escapeValue は子クラスのフック quoteChar を呼ぶ
 * (Template Method)ので、メソッドを一部だけ移して継承を外すと、2クラスが互いを呼び合う循環依存が残る。「いずれ Excel や PDF にも」と用意した BaseExporter の
 * 子クラスが CsvExporter だけのまま、CSV の処理が2クラスに散らばっている。子が1つの継承は畳んで1クラスにまとめる
 * (Fowler の Collapse Hierarchy)。実装が1つのインターフェース(implements)は、テストの差し替えや依存関係逆転
 * (上級2)のために正当に使われるので、この減点(lone-superclass)の対象にしていない。
 */
const collapseHierarchyStage: Stage = {
  id: 'advanced-collapse-hierarchy',
  level: 'advanced',
  title: '上級5: 子が1つしかない継承を畳む',
  description:
    '売上をCSVでダウンロードさせる SalesController。「いずれ Excel や PDF にも対応するかもしれない」と先輩が基底クラス BaseExporter を用意したが、' +
    '2年たっても子クラスは CsvExporter だけ。しかも BaseExporter の escapeValue が子の quoteChar を呼び返すので、2クラスが互いに呼び合っている' +
    '(循環依存の赤い印はこのため)。CSVの仕様を少し変えるたびに BaseExporter と CsvExporter を行き来している。',
  goal:
    '使われない拡張ポイントは畳んで、1つのクラスにまとめよう。上級1(共通処理を基底クラスへ集める)とは逆向きの操作。' +
    '1つのクラスにまとめれば呼び合い(循環依存)も消える。2つ目の出力形式が本当に必要になってから、継承を作り直せば間に合う。依存先は1クラスまで',
  limits: { method: 90, class: 200, file: 300 },
  dependencyLimit: 1,
  responsibilityLimit: 2,
  changeRequests: [
    { id: 'req-tab-delimiter', title: '区切り文字をタブにも切り替えられるようにして', description: 'Excelで開きやすいよう、タブ区切りのファイルも出せるようにする。', responsibility: 'csv-format', linesPerSite: 6, partName: 'switchToTabDelimiter' },
    { id: 'req-fiscal-year', title: '集計期間を会計年度で指定できるようにして', description: '4月始まりの会計年度で、売上の集計期間を指定できるようにする。', responsibility: 'query', linesPerSite: 4, partName: 'filterByFiscalYear' },
  ],
  codebase: {
    files: [
      {
        id: 'file-sales-controller',
        path: 'src/sales/SalesController.ts',
        classes: [
          {
            id: 'class-sales-controller',
            name: 'SalesController',
            methods: [
              {
                id: 'method-download-sales-csv',
                name: 'downloadSalesCsv',
                visibility: 'public',
                fragments: [
                  { id: 'frag-validate-query', label: '検索条件を検証する', lines: 36, responsibility: 'http', suggestedName: 'validateQuery' },
                  { id: 'frag-fetch-sales', label: '売上データを取得する', lines: 40, responsibility: 'query', suggestedName: 'fetchSales' },
                  {
                    id: 'frag-output-csv',
                    label: 'CSVを出力する',
                    lines: 8,
                    responsibility: 'http',
                    uses: ['method-prepare-export', 'method-write-rows'],
                    suggestedName: 'outputCsv',
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        id: 'file-base-exporter',
        path: 'src/export/BaseExporter.ts',
        classes: [
          {
            id: 'class-base-exporter',
            name: 'BaseExporter',
            methods: [
              {
                id: 'method-prepare-export',
                name: 'prepareExport',
                visibility: 'public',
                fragments: [{ id: 'frag-decide-header', label: '文字コードとヘッダー行を決める', lines: 18, responsibility: 'csv-format' }],
              },
              {
                id: 'method-escape-value',
                name: 'escapeValue',
                visibility: 'protected',
                // Template Method: 基底クラスが子クラスのフック(quoteChar)を呼ぶ。2クラスに分けたままだと互いを呼び合う循環が残る
                fragments: [{ id: 'frag-escape-value', label: '値をエスケープする', lines: 14, responsibility: 'csv-format', uses: ['method-quote-char'] }],
              },
            ],
          },
        ],
      },
      {
        id: 'file-csv-exporter',
        path: 'src/export/CsvExporter.ts',
        classes: [
          {
            id: 'class-csv-exporter',
            name: 'CsvExporter',
            superclassId: 'class-base-exporter',
            methods: [
              {
                id: 'method-write-rows',
                name: 'writeRows',
                visibility: 'public',
                fragments: [{ id: 'frag-write-rows', label: '行をCSVに書き出す', lines: 26, responsibility: 'csv-format', uses: ['method-escape-value'] }],
              },
              {
                id: 'method-quote-char',
                name: 'quoteChar',
                visibility: 'protected',
                fragments: [{ id: 'frag-quote-char', label: 'クォートに使う文字を返す(BaseExporter から呼ばれるフック)', lines: 4, responsibility: 'csv-format' }],
              },
            ],
          },
        ],
      },
    ],
  },
};

/**
 * 上級6: 上級2・3が「インターフェースを使う側から見た結合度」を扱ったのに対し、このステージは
 * 「インターフェース自体を大きくしすぎたときの痛み」を扱う(ISP)。障害対応の連絡を自動化するため、
 * チャット(Slack・Teams)と課題管理(Backlog)と、その両方ができる Chatwork をまとめて扱う
 * CollaborationTool インターフェースを作った。Slack・Teamsはタスク管理ができず createTask・
 * completeTask を「未対応」で潰し、Backlogはチャットに投稿できず postMessage を空実装で潰している。
 * ChatworkClientは分けたあと両方のインターフェースを実装する。投稿だけ使う AlertNotifier、
 * タスク管理だけ使う IncidentService は、どちらも太った CollaborationTool に依存している。
 */
const interfaceSegregationStage: Stage = {
  id: 'advanced-interface-segregation',
  level: 'advanced',
  title: '上級6: 太ったインターフェースを役割ごとに分ける',
  description:
    '障害対応の連絡を自動化するため、Slack・Teams・Backlog・Chatwork をまとめて扱う CollaborationTool インターフェースを作った。' +
    'ところが Slack と Teams はタスク管理ができず createTask・completeTask を「未対応」の例外で潰し、Backlog はチャットに投稿できず postMessage を空実装で潰している。' +
    '投稿しか使わない AlertNotifier も、タスクしか使わない IncidentService も、同じ太いインターフェースに依存している。',
  goal:
    'CollaborationTool を、投稿の役割(ChatClient)とタスク管理の役割(TaskTracker)に分けよう。各クラスには本当に使うインターフェースだけを実装させ、' +
    '両方できる ChatworkClient には両方を実装させよう。要らなくなった空実装は、メソッドエディタの「空実装のメソッドを削除」で消そう。依存先は1クラスまで',
  limits: { method: 90, class: 200, file: 300 },
  dependencyLimit: 1,
  // 空実装の責務でresponsibilityとstubが二重に減点されないよう、実装クラスは空実装込みで最大3種類までにする。
  responsibilityLimit: 3,
  changeRequests: [
    {
      id: 'req-task-assignee',
      title: '障害の対応タスクに担当者を割り当てて',
      description: 'タスクを登録するときに担当者を指定できるようにしたい。',
      responsibility: 'task-create',
      linesPerSite: 4,
      partName: 'assignTaskOwner',
    },
    {
      id: 'req-thread-reply',
      title: 'アラートをスレッドにまとめて投稿して',
      description: '同じ障害の続報は、最初の投稿のスレッドに返信したい。',
      responsibility: 'chat-post',
      linesPerSite: 5,
      partName: 'replyInThread',
    },
  ],
  codebase: {
    files: [
      {
        id: 'file-alert-notifier',
        path: 'src/alert/AlertNotifier.ts',
        classes: [
          {
            id: 'class-alert-notifier',
            name: 'AlertNotifier',
            methods: [
              {
                id: 'method-notify-alert',
                name: 'notifyAlert',
                visibility: 'public',
                fragments: [
                  { id: 'frag-alert-format', label: 'アラートの内容から通知文を組み立てる', lines: 40, responsibility: 'alert-format', suggestedName: 'buildAlertMessage' },
                  {
                    id: 'frag-alert-dispatch',
                    label: 'チャットへ投稿する',
                    lines: 8,
                    responsibility: 'alert-dispatch',
                    uses: ['method-tool-post-message'],
                    suggestedName: 'dispatchAlert',
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        id: 'file-incident-service',
        path: 'src/incident/IncidentService.ts',
        classes: [
          {
            id: 'class-incident-service',
            name: 'IncidentService',
            methods: [
              {
                id: 'method-report-incident',
                name: 'reportIncident',
                visibility: 'public',
                fragments: [
                  { id: 'frag-triage', label: '障害の影響範囲と重要度を判定する', lines: 60, responsibility: 'triage', suggestedName: 'triageIncident' },
                  {
                    id: 'frag-incident-dispatch-create',
                    label: '対応タスクを登録する',
                    lines: 12,
                    responsibility: 'incident-dispatch',
                    uses: ['method-tool-create-task'],
                    suggestedName: 'createIncidentTask',
                  },
                  {
                    id: 'frag-incident-dispatch-complete',
                    label: '復旧したらタスクを完了にする',
                    lines: 10,
                    responsibility: 'incident-dispatch',
                    uses: ['method-tool-complete-task'],
                    suggestedName: 'completeIncidentTask',
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        id: 'file-collaboration-tool',
        path: 'src/integration/CollaborationTool.ts',
        classes: [
          {
            id: 'class-collaboration-tool',
            name: 'CollaborationTool',
            methods: [
              { id: 'method-tool-post-message', name: 'postMessage', visibility: 'public', fragments: [] },
              { id: 'method-tool-create-task', name: 'createTask', visibility: 'public', fragments: [] },
              { id: 'method-tool-complete-task', name: 'completeTask', visibility: 'public', fragments: [] },
            ],
          },
        ],
      },
      {
        id: 'file-slack-client',
        path: 'src/integration/SlackClient.ts',
        classes: [
          {
            id: 'class-slack-client',
            name: 'SlackClient',
            interfaceIds: ['class-collaboration-tool'],
            methods: [
              {
                id: 'method-slack-post-message',
                name: 'postMessage',
                visibility: 'public',
                fragments: [{ id: 'frag-slack-chat-post', label: 'Slack APIでチャンネルに投稿する', lines: 36, responsibility: 'chat-post', suggestedName: 'postToSlack' }],
              },
              {
                id: 'method-slack-create-task',
                name: 'createTask',
                visibility: 'public',
                fragments: [{ id: 'frag-slack-task-create-stub', label: '未対応: UnsupportedOperationErrorを投げるだけ', lines: 3, responsibility: 'task-create', stub: true }],
              },
              {
                id: 'method-slack-complete-task',
                name: 'completeTask',
                visibility: 'public',
                fragments: [{ id: 'frag-slack-task-complete-stub', label: '未対応: UnsupportedOperationErrorを投げるだけ', lines: 3, responsibility: 'task-complete', stub: true }],
              },
            ],
          },
        ],
      },
      {
        id: 'file-teams-client',
        path: 'src/integration/TeamsClient.ts',
        classes: [
          {
            id: 'class-teams-client',
            name: 'TeamsClient',
            interfaceIds: ['class-collaboration-tool'],
            methods: [
              {
                id: 'method-teams-post-message',
                name: 'postMessage',
                visibility: 'public',
                fragments: [{ id: 'frag-teams-chat-post', label: 'Teams のWebhookでチャネルに投稿する', lines: 30, responsibility: 'chat-post', suggestedName: 'postToTeams' }],
              },
              {
                id: 'method-teams-create-task',
                name: 'createTask',
                visibility: 'public',
                fragments: [{ id: 'frag-teams-task-create-stub', label: '未対応: UnsupportedOperationErrorを投げるだけ', lines: 3, responsibility: 'task-create', stub: true }],
              },
              {
                id: 'method-teams-complete-task',
                name: 'completeTask',
                visibility: 'public',
                fragments: [{ id: 'frag-teams-task-complete-stub', label: '未対応: UnsupportedOperationErrorを投げるだけ', lines: 3, responsibility: 'task-complete', stub: true }],
              },
            ],
          },
        ],
      },
      {
        id: 'file-backlog-client',
        path: 'src/integration/BacklogClient.ts',
        classes: [
          {
            id: 'class-backlog-client',
            name: 'BacklogClient',
            interfaceIds: ['class-collaboration-tool'],
            methods: [
              {
                id: 'method-backlog-post-message',
                name: 'postMessage',
                visibility: 'public',
                fragments: [{ id: 'frag-backlog-chat-post-stub', label: '未対応: 何もせずreturnする空実装', lines: 2, responsibility: 'chat-post', stub: true }],
              },
              {
                id: 'method-backlog-create-task',
                name: 'createTask',
                visibility: 'public',
                fragments: [{ id: 'frag-backlog-task-create', label: 'Backlog APIで課題を登録する', lines: 40, responsibility: 'task-create', suggestedName: 'createBacklogIssue' }],
              },
              {
                id: 'method-backlog-complete-task',
                name: 'completeTask',
                visibility: 'public',
                fragments: [
                  { id: 'frag-backlog-task-complete', label: 'Backlog APIで課題の状態を完了にする', lines: 20, responsibility: 'task-complete', suggestedName: 'completeBacklogIssue' },
                ],
              },
            ],
          },
        ],
      },
      {
        id: 'file-chatwork-client',
        path: 'src/integration/ChatworkClient.ts',
        classes: [
          {
            id: 'class-chatwork-client',
            name: 'ChatworkClient',
            interfaceIds: ['class-collaboration-tool'],
            methods: [
              {
                id: 'method-chatwork-post-message',
                name: 'postMessage',
                visibility: 'public',
                fragments: [{ id: 'frag-chatwork-chat-post', label: 'Chatwork APIでルームに投稿する', lines: 32, responsibility: 'chat-post', suggestedName: 'postToChatwork' }],
              },
              {
                id: 'method-chatwork-create-task',
                name: 'createTask',
                visibility: 'public',
                fragments: [{ id: 'frag-chatwork-task-create', label: 'Chatwork APIでタスクを登録する', lines: 18, responsibility: 'task-create', suggestedName: 'createChatworkTask' }],
              },
              {
                id: 'method-chatwork-complete-task',
                name: 'completeTask',
                visibility: 'public',
                fragments: [{ id: 'frag-chatwork-task-complete', label: 'Chatwork APIでタスクを完了にする', lines: 10, responsibility: 'task-complete', suggestedName: 'completeChatworkTask' }],
              },
            ],
          },
        ],
      },
    ],
  },
};

/**
 * 上級7: 経費(Expense)の金額を amount(数値)と currency(通貨コードの文字列)のままフィールドに持たせているため、
 * 申請(ExpenseApplicationService)・承認(ApprovalService)・精算(PayoutService)の3サービスが「金額の検証」
 * 「同じ通貨どうしの合計」「通貨ごとの表示整形」をそれぞれコピペで持っている(重複3グループ、各2か所)。
 * 上級4(Merge Methods)と中級8(Extract Class)の組み合わせ: 重複をMerge Methodsで1つに統合してから、
 * amount・currencyと一緒に新しいMoneyクラスへ移す(Primitive Obsession → Value Object)。
 * 値の出どころはExpenseの1か所に絞り、不変性(作ったあとに書き換えない)は採点しない(amount・currencyへのwritesを置かない)。
 * submitがcategoryも読むのは、凝集度の全ステージ化でExpenseがsubmit・isReceiptRequiredの2塊に分かれないようにするため。
 */
const valueObjectStage: Stage = {
  id: 'advanced-value-object',
  level: 'advanced',
  title: '上級7: 金額と通貨を Money にまとめる',
  description:
    '経費精算システム。外貨の経費に対応したとき、経費(Expense)の金額を amount(数値)と currency(通貨コードの文字列)のまま持たせた。' +
    'その結果、申請(ExpenseApplicationService)・承認(ApprovalService)・精算(PayoutService)の3つのサービスが、' +
    '「金額が0より大きく対応している通貨か」「同じ通貨どうしで合計する」「通貨ごとの小数桁で表示する」を、それぞれコピペで持っている。',
  goal:
    '金額と通貨をひとまとまりの値(Money)として扱おう。コピペされた処理は抽出して統合(Merge Methods)し、amount・currency と一緒に新しい Money クラスへ移す。' +
    'Money は自分で自分を検証し、足し算や表示も自分でする(値オブジェクト)。Expense に直接入れるのではなく、別のクラスにしよう。メソッドは50行・クラスは65行以内、1クラスの責務は3種類まで、依存先は2クラスまで',
  limits: { method: 50, class: 65, file: 300 },
  dependencyLimit: 2,
  responsibilityLimit: 3,
  changeRequests: [
    { id: 'req-accept-euro', title: 'ユーロ建ての経費も申請できるようにして', description: '海外出張が増えたので、対応通貨にユーロ(EUR)を足したい', responsibility: 'money-validation', linesPerSite: 4, partName: 'acceptEuro' },
    { id: 'req-hide-yen-decimals', title: '円は小数点以下を表示しないで', description: '円の金額は「1,200円」のように小数点以下を出さずに表示したい', responsibility: 'money-format', linesPerSite: 6, partName: 'hideYenDecimals' },
  ],
  codebase: {
    files: [
      {
        id: 'file-expense',
        path: 'src/expense/Expense.ts',
        classes: [
          {
            id: 'class-expense',
            name: 'Expense',
            fields: [
              { id: 'field-amount', name: 'amount', visibility: 'public' },
              { id: 'field-currency', name: 'currency', visibility: 'public' },
              { id: 'field-category', name: 'category', visibility: 'public' },
              { id: 'field-status', name: 'status', visibility: 'public' },
            ],
            methods: [
              {
                id: 'method-submit',
                name: 'submit',
                visibility: 'public',
                fragments: [
                  {
                    id: 'frag-submit-expense',
                    label: '勘定科目が決まっているか確かめ、状態を提出済みにする',
                    lines: 8,
                    responsibility: 'workflow',
                    reads: ['field-category'],
                    writes: ['field-status'],
                  },
                ],
              },
              {
                id: 'method-is-receipt-required',
                name: 'isReceiptRequired',
                visibility: 'public',
                fragments: [
                  {
                    id: 'frag-receipt-required',
                    label: '勘定科目から領収書が必要か判定する',
                    lines: 10,
                    responsibility: 'category-rule',
                    reads: ['field-category'],
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        id: 'file-expense-application-service',
        path: 'src/expense/ExpenseApplicationService.ts',
        classes: [
          {
            id: 'class-expense-application-service',
            name: 'ExpenseApplicationService',
            methods: [
              {
                id: 'method-submit-expense',
                name: 'submitExpense',
                visibility: 'public',
                fragments: [
                  {
                    id: 'frag-apply-check-form',
                    label: '日付・勘定科目・領収書の有無を確かめる',
                    lines: 20,
                    responsibility: 'application',
                    uses: ['method-is-receipt-required'],
                    suggestedName: 'checkExpenseForm',
                  },
                  {
                    id: 'frag-apply-validate-money',
                    label: '金額が0より大きく、対応している通貨か確かめる',
                    lines: 16,
                    responsibility: 'money-validation',
                    reads: ['field-amount', 'field-currency'],
                    duplicateGroup: 'money-validate',
                    suggestedName: 'validateMoney',
                  },
                  {
                    id: 'frag-apply-format-money',
                    label: '通貨ごとの小数桁で金額を表示用に整える',
                    lines: 16,
                    responsibility: 'money-format',
                    reads: ['field-amount', 'field-currency'],
                    duplicateGroup: 'money-format',
                    suggestedName: 'formatMoney',
                  },
                  {
                    id: 'frag-apply-request-approval',
                    label: '申請を提出し、上長へ承認依頼を送る',
                    lines: 26,
                    responsibility: 'approval-request',
                    uses: ['method-submit'],
                    suggestedName: 'requestApproval',
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        id: 'file-approval-service',
        path: 'src/expense/ApprovalService.ts',
        classes: [
          {
            id: 'class-approval-service',
            name: 'ApprovalService',
            methods: [
              {
                id: 'method-approve-monthly-expenses',
                name: 'approveMonthlyExpenses',
                visibility: 'public',
                fragments: [
                  {
                    id: 'frag-approve-collect',
                    label: '部署ごとに今月の申請を集める',
                    lines: 10,
                    responsibility: 'aggregation',
                    suggestedName: 'collectMonthlyExpenses',
                  },
                  {
                    id: 'frag-approve-validate-money',
                    label: '金額が0より大きく、対応している通貨か確かめる',
                    lines: 16,
                    responsibility: 'money-validation',
                    reads: ['field-amount', 'field-currency'],
                    duplicateGroup: 'money-validate',
                    suggestedName: 'validateMoney',
                  },
                  {
                    id: 'frag-approve-sum-money',
                    label: '同じ通貨どうしで金額を合計し、新しい金額として返す',
                    lines: 18,
                    responsibility: 'money-arithmetic',
                    reads: ['field-amount', 'field-currency'],
                    duplicateGroup: 'money-sum',
                    suggestedName: 'sumMoney',
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        id: 'file-payout-service',
        path: 'src/expense/PayoutService.ts',
        classes: [
          {
            id: 'class-payout-service',
            name: 'PayoutService',
            methods: [
              {
                id: 'method-pay-out',
                name: 'payOut',
                visibility: 'public',
                fragments: [
                  {
                    id: 'frag-payout-sum-money',
                    label: '同じ通貨どうしで金額を合計し、新しい金額として返す',
                    lines: 18,
                    responsibility: 'money-arithmetic',
                    reads: ['field-amount', 'field-currency'],
                    duplicateGroup: 'money-sum',
                    suggestedName: 'sumMoney',
                  },
                  {
                    id: 'frag-payout-format-money',
                    label: '通貨ごとの小数桁で金額を表示用に整える',
                    lines: 16,
                    responsibility: 'money-format',
                    reads: ['field-amount', 'field-currency'],
                    duplicateGroup: 'money-format',
                    suggestedName: 'formatMoney',
                  },
                  {
                    id: 'frag-payout-transfer',
                    label: '振込データを作って銀行へ送る',
                    lines: 12,
                    responsibility: 'transfer',
                    suggestedName: 'sendTransfer',
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
};

export const advancedStages: readonly Stage[] = [
  notifierHierarchyStage,
  paymentGatewayInterfaceStage,
  discountStrategyStage,
  reportFactoryStage,
  collapseHierarchyStage,
  interfaceSegregationStage,
  valueObjectStage,
];
