import type { Stage } from '../../domain/stage/Stage';

/**
 * 上級1: メール通知(EmailNotifier)とSMS通知(SmsNotifier)が、
 * 「通知文を組み立てる」「送信ログを記録する」処理をそれぞれ自分の中に抱え込んでいる(同じような処理が2クラスに散らばっている)。
 * すでに空の基底クラス NotifierBase が用意されているが、まだ継承関係は結ばれていない。
 * 共通の処理を NotifierBase へ Move Method で移し、継承元を設定して初めて、
 * 送信方法ごとの違い(email-delivery / sms-delivery)だけが各クラスに残る。
 */
const notifierHierarchyStage: Stage = {
  id: 'advanced-notifier-hierarchy',
  level: 'advanced',
  title: '上級1: 通知クラスの共通処理を基底クラスへ集める',
  description:
    '会員登録時にメールで知らせる EmailNotifier と、SMSで知らせる SmsNotifier。' +
    'どちらも「通知文を組み立てる」処理と「送信ログを記録する」処理をコピーしたように自分の中に抱えていて、送信方法そのものの違いは最後の一部だけ。' +
    '空の基底クラス NotifierBase は用意されているが、まだどちらのクラスとも継承関係で結ばれていない。',
  goal: '共通の処理を NotifierBase へ Move Method で移し、EmailNotifier・SmsNotifier の継承元を NotifierBase に設定しよう。メソッドは60行以内、1クラスの責務は2種類まで',
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
                  { id: 'frag-log-email', label: '送信ログを記録する', lines: 24, responsibility: 'logging', suggestedName: 'logEmailNotification' },
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
                  { id: 'frag-log-sms', label: '送信ログを記録する', lines: 22, responsibility: 'logging', suggestedName: 'logSmsNotification' },
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
 * 上級2: ネットショップの決済。PaymentService が Stripe 用・PayPal 用の決済クラスを名指しで直接呼んでいる
 * (具象クラスへの直接依存)。空の PaymentGateway クラス(インターフェース役)は用意されているが、
 * まだ誰にも使われていない。決済処理を PaymentGateway へ Move Method で移し、
 * StripeGateway・PaypalGateway の実装先(implements)を PaymentGateway に設定すると、
 * PaymentService の依存先が1つに集約される。
 */
const paymentGatewayInterfaceStage: Stage = {
  id: 'advanced-payment-gateway-interface',
  level: 'advanced',
  title: '上級2: 決済ゲートウェイをインターフェース越しに呼ぶ',
  description:
    'PaymentService が、Stripe用の StripeGateway と PayPal用の PaypalGateway を名指しで直接呼び出している。' +
    'どちらのゲートウェイクラスも「決済APIを呼び出す」処理と「決済ログを記録する」処理をコピーしたように自分の中に抱えていて、設定情報の違いは最後の一部だけ。' +
    '空のクラス PaymentGateway は用意されているが、まだどちらのクラスとも実装関係で結ばれていない。',
  goal: '決済APIの呼び出しを PaymentGateway へ Move Method で移し、StripeGateway・PaypalGateway が PaymentGateway を実装(implements)するよう設定しよう。メソッドは90行以内、1クラスの責務は2種類まで',
  limits: { method: 90, class: 250, file: 400 },
  dependencyLimit: 1,
  responsibilityLimit: 2,
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
                  { id: 'frag-dispatch-stripe', label: 'Stripe決済ゲートウェイを直接呼び出す', lines: 12, responsibility: 'gateway-dispatch', uses: ['method-charge-stripe'], suggestedName: 'dispatchStripe' },
                  { id: 'frag-dispatch-paypal', label: 'PayPal決済ゲートウェイを直接呼び出す', lines: 12, responsibility: 'gateway-dispatch', uses: ['method-charge-paypal'], suggestedName: 'dispatchPaypal' },
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
                name: 'chargeStripe',
                visibility: 'public',
                fragments: [
                  { id: 'frag-stripe-api-call', label: 'Stripe APIを呼び出して決済する', lines: 30, responsibility: 'gateway-integration', suggestedName: 'callStripeApi' },
                  { id: 'frag-log-payment-stripe', label: '決済ログを記録する(Stripe)', lines: 16, responsibility: 'payment-logging', suggestedName: 'logStripePayment' },
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
                name: 'chargePaypal',
                visibility: 'public',
                fragments: [
                  { id: 'frag-paypal-api-call', label: 'PayPal APIを呼び出して決済する', lines: 28, responsibility: 'gateway-integration', suggestedName: 'callPaypalApi' },
                  { id: 'frag-log-payment-paypal', label: '決済ログを記録する(PayPal)', lines: 16, responsibility: 'payment-logging', suggestedName: 'logPaypalPayment' },
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
        classes: [{ id: 'class-payment-gateway', name: 'PaymentGateway', methods: [] }],
      },
    ],
  },
};

export const advancedStages: readonly Stage[] = [notifierHierarchyStage, paymentGatewayInterfaceStage];
