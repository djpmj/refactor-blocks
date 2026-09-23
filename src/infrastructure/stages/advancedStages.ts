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
    { id: 'req-notification-format', title: '通知文の書式を見直して', description: '通知文に、問い合わせ番号を差し込めるようにしたい。', responsibility: 'formatting', linesPerSite: 8 },
    { id: 'req-notification-log', title: '送信ログの記録方法を見直して', description: '送信ログに、再送かどうかのフラグを追加したい。', responsibility: 'logging', linesPerSite: 6 },
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
    'どちらも「決済APIを呼び出す」処理と「決済ログを記録する」処理を1つのメソッド(charge)に詰め込んでいて、行数の上限を超えている。',
  goal:
    'StripeGateway・PaypalGateway の charge を、Extract Methodで責務(API呼び出し/ログ記録)ごとに分け、PaymentGateway を実装(implements)するよう設定しよう。' +
    'StripeGateway・PaypalGatewayの中身がどう変わっても、PaymentServiceの依存先は最初から最後まで PaymentGateway 1つのまま変わらない。上級3(方針を増やすほど依存も増える)と見比べてみよう。' +
    'メソッドは90行以内、1クラスの責務は3種類まで',
  limits: { method: 90, class: 250, file: 400 },
  dependencyLimit: 1,
  // stripe-config/paypal-configは各ゲートウェイに残る正当な3つ目の責務(このステージの狙いと無関係なため違反にしない)。
  responsibilityLimit: 3,
  changeRequests: [
    { id: 'req-payment-logging', title: '決済ログの記録方法を見直して', description: '決済ログに、失敗時のリトライ回数を残したい。', responsibility: 'payment-logging', linesPerSite: 6 },
    { id: 'req-gateway-integration', title: '決済APIの呼び出し方を見直して', description: '決済API呼び出しに、共通のタイムアウト設定を追加したい。', responsibility: 'gateway-integration', linesPerSite: 5 },
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
    { id: 'req-premium-discount', title: 'プレミアム会員の割引率を変えて', description: 'プレミアム会員の割引率を12%に変えたい。', responsibility: 'discount-premium', linesPerSite: 5 },
    { id: 'req-vip-discount', title: 'VIP会員の割引条件を変えて', description: 'VIP会員には送料無料に加えてポイント還元率も上げたい。', responsibility: 'discount-vip', linesPerSite: 6 },
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

export const advancedStages: readonly Stage[] = [notifierHierarchyStage, paymentGatewayInterfaceStage, discountStrategyStage];
