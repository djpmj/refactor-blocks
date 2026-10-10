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
  learns: ['継承', '共通処理の集約'],
  checks: [
    {
      id: 'check-1',
      question: 'EmailNotifier と SmsNotifier の共通処理を基底クラスに集めると、何が良くなる?',
      choices: [
        { text: '通知の種類ごとに継承階層が深くなり、構造が複雑になる', explanation: '階層は深くなりませんし、複雑にすることが目的でもありません。' },
        { text: '子クラスの行数が0になる', explanation: '行数の削減は結果で、目的ではありません。' },
        { text: '送信ログの記録のような共通の手順を直すとき、直す場所が1か所で済む', explanation: '正解です。同じ処理が複数の子にコピーされていると、直し漏れが起きます。' },
      ],
      answer: 2,
    },
    {
      id: 'check-2',
      question: '共通処理を基底クラスへ集める継承を使うのは、どんなときに向いている?',
      choices: [
        { text: '子クラスどうしが本当に同じ性質を持ち、共通の振る舞いを共有するとき', explanation: '正解です。「同種のもの」として共通点があるときに、継承で共有します。' },
        { text: 'コードを少し短くしたいだけのとき', explanation: '短くしたいだけなら、継承ではなく別の手段のほうが安全なことが多いです。' },
        { text: 'とにかく継承を使うのが良い設計だから', explanation: '継承は強い結びつきを生むので、必要なときに限って使います。' },
      ],
      answer: 0,
    },
  ],
  /** 100点になったときに見せる、この題材で分ける理由。 */
  why: '通知先を追加するたび、既存の通知手順を継承したクラス全体への影響を確認することになります。通知先ごとの違いが表れていれば、新しい通知方法を既存処理から切り離せます。',
  description:
    '会員登録時にメールで知らせる EmailNotifier と、SMSで知らせる SmsNotifier。' +
    'どちらも「送信ログを記録する」処理はコピペしたように全く同じ内容で、「通知文を組み立てる」処理はチャネルごとに内容そのものが違う。' +
    '空の基底クラス NotifierBase は用意されているが、まだどちらのクラスとも継承関係で結ばれていない。',
  goal:
    '重複した「送信ログを記録する」処理をExtract Methodで取り出し、メソッドエディタの「似た処理を持つメソッド」から統合してNotifierBaseへ移そう。' +
    '「通知文を組み立てる」処理はチャネルごとに違う本物の実装なので、それぞれのクラスに残したままでよい。' +
    '最後にEmailNotifier・SmsNotifierの継承元をNotifierBaseに設定しよう。メソッドは8行以内、1クラスの責務は2種類まで',
  limits: { method: 8, class: 19, file: 20 },
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
                  { id: 'frag-build-body-email', label: '通知文を組み立てる', lines: 3, responsibility: 'formatting', suggestedName: 'buildEmailBody' , code: { csharp: 'var body = $"こんにちは {recipient.Name} さん、会員登録ありがとうございます。";\nbody = body.Replace("{confirmationLink}", confirmationLink);\nbody += Environment.NewLine + footer;' }},
                  { id: 'frag-log-email', label: '送信ログを記録する', lines: 3, responsibility: 'logging', suggestedName: 'logEmailNotification', duplicateGroup: 'notification-log' , code: { csharp: "_logger.LogInformation(\"通知を送信しました: {Recipient}\", recipient);\nawait _auditLog.WriteAsync(recipient, DateTimeOffset.UtcNow);\n_logger.LogDebug(\"通知の監査記録を保存しました\");" }},
                  { id: 'frag-send-email', label: 'メールを送信する', lines: 3, responsibility: 'email-delivery', suggestedName: 'sendEmail' , code: { csharp: "var message = new MailMessage(recipient, subject, body);\nawait _mailer.SendAsync(message, cancellationToken);\nawait _mailAuditLog.RecordSentAsync(message.Id, cancellationToken);" }},
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
                  { id: 'frag-build-body-sms', label: '通知文を組み立てる', lines: 3, responsibility: 'formatting', suggestedName: 'buildSmsBody' , code: { csharp: 'var body = $"{recipient.Name} さん、会員登録ありがとうございます。";\nbody = body.Replace("{code}", verificationCode);\nbody += $" 有効期限: {expiresAt:t}";' }},
                  { id: 'frag-log-sms', label: '送信ログを記録する', lines: 3, responsibility: 'logging', suggestedName: 'logSmsNotification', duplicateGroup: 'notification-log' , code: { csharp: "_logger.LogInformation(\"通知を送信しました: {Recipient}\", recipient);\nawait _auditLog.WriteAsync(recipient, DateTimeOffset.UtcNow);\n_logger.LogDebug(\"通知の監査記録を保存しました\");" }},
                  { id: 'frag-send-sms', label: 'SMSを送信する', lines: 3, responsibility: 'sms-delivery', suggestedName: 'sendSms' , code: { csharp: "var message = new SmsMessage(recipient.PhoneNumber, body);\nawait _smsClient.SendAsync(message, cancellationToken);\nawait _smsAuditLog.RecordSentAsync(message.Id, cancellationToken);" }},
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
  learns: ['インターフェース', 'implements'],
  checks: [
    {
      id: 'check-1',
      question: 'PaymentService が PaymentGateway インターフェース越しに決済を呼ぶ利点は?',
      choices: [
        { text: '決済会社を追加・変更しても、注文側のコードを書き換えずに済む', explanation: '正解です。呼ぶ側は約束(インターフェース)だけを知っていればよく、具体的な会社の違いを意識しません。' },
        { text: '決済が必ず成功する', explanation: 'インターフェースは成功を保証しません。構造の話です。' },
        { text: 'クラスの数が減る', explanation: 'インターフェースを使うとクラスが減るとは限りません。' },
      ],
      answer: 0,
    },
    {
      id: 'check-2',
      question: 'StripeGateway などの内部で、API 呼び出しとログ記録を分けるのはなぜ?',
      choices: [
        { text: 'ログが重いので、無効にするため', explanation: 'ログを無効にすることが目的ではありません。' },
        { text: '責務ごとに分ければ、API 仕様の変更とログ形式の変更をそれぞれ独立して直せるから', explanation: '正解です。変わる理由が違う処理は分けておくと、片方の変更が他方に響きません。' },
        { text: 'インターフェースを実装するには、メソッドを2つ以上に分けなければならないから', explanation: '実装のために必須ではありません。責務の整理が目的です。' },
      ],
      answer: 1,
    },
  ],
  /** 100点になったときに見せる、この題材で分ける理由。 */
  why: '決済会社の仕様変更が注文処理に直接入り込むと、決済以外の流れまで壊さないか確認が必要です。接続方法を境界の向こうに置けば、会社ごとの変更を局所化できます。',
  description:
    'PaymentService の checkout は、共通インターフェース PaymentGateway 経由で決済を呼び出すよう最初から書かれている(Stripe・PayPalを名指ししない)。' +
    'しかし StripeGateway・PaypalGateway はまだ PaymentGateway を実装(implements)したと宣言しておらず、' +
    'どちらも「決済APIを呼び出す」処理と「決済ログを記録する」処理を1つのメソッド(charge)に詰め込んでいて、行数の上限を超えている。' +
    '実装を宣言していないと約束違反になる。',
  goal:
    'StripeGateway・PaypalGateway の charge を、Extract Methodで責務(API呼び出し/ログ記録)ごとに分け、PaymentGateway を実装(implements)するよう設定しよう。' +
    'StripeGateway・PaypalGatewayの中身がどう変わっても、PaymentServiceの依存先は最初から最後まで PaymentGateway 1つのまま変わらない。上級3(方針を増やすほど依存も増える)と見比べてみよう。' +
    'メソッドは9行以内、1クラスの責務は3種類まで。実装を宣言していないと約束違反になる。',
  limits: { method: 9, class: 250, file: 400 },
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
                  { id: 'frag-validate-payment', label: '注文内容とカード情報を検証する', lines: 2, responsibility: 'validation', suggestedName: 'validatePayment' , code: { csharp: "if (items.Count == 0 || items.Any(item => !item.IsValid)) throw new ValidationException(\"注文内容が不正です\");\nif (string.IsNullOrWhiteSpace(cardNumber) || string.IsNullOrWhiteSpace(paymentToken)) throw new ValidationException(\"カード情報が必要です\");" }},
                  { id: 'frag-dispatch-gateway', label: 'PaymentGateway(インターフェース)経由で決済を実行する', lines: 3, responsibility: 'gateway-dispatch', uses: ['method-payment-gateway-charge'], suggestedName: 'dispatchGateway' , code: { csharp: "if (input is null) throw new ArgumentNullException(nameof(input));\ncharge();\nreturn true;" }},
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
                  { id: 'frag-stripe-api-call', label: 'Stripe APIを呼び出して決済する', lines: 3, responsibility: 'gateway-integration', suggestedName: 'callStripeApi' , code: { csharp: "var result = await _stripeClient.CreateChargeAsync(amount, paymentToken, cancellationToken);\nif (!result.Succeeded) throw new PaymentException(result.ErrorMessage);\n_logger.LogDebug(\"Stripe charge {ChargeId} completed\", result.ChargeId);" }},
                  { id: 'frag-log-payment-stripe', label: '決済ログを記録する(Stripe)', lines: 4, responsibility: 'payment-logging', suggestedName: 'logStripePayment' , code: { csharp: "_logger.LogInformation(\"{Action} を記録しました\", action);\nawait _auditLog.WriteAsync(action, DateTimeOffset.UtcNow);\n_logger.LogDebug(\"決済ログを記録する(Stripe) が完了しました\");\nreturn true;" }},
                ],
              },
              {
                id: 'method-configure-stripe',
                name: 'configureStripeCredentials',
                visibility: 'public',
                fragments: [
                  { id: 'frag-configure-stripe', label: 'Stripe APIキーを設定する', lines: 4, responsibility: 'stripe-config', suggestedName: 'configureStripe' , code: { csharp: "var apiKey = Environment.GetEnvironmentVariable(\"STRIPE_API_KEY\");\nif (string.IsNullOrWhiteSpace(apiKey)) throw new InvalidOperationException(\"Stripe APIキーがありません\");\n_stripeClient.Configure(apiKey);\nreturn true;" }},
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
                  { id: 'frag-paypal-api-call', label: 'PayPal APIを呼び出して決済する', lines: 3, responsibility: 'gateway-integration', suggestedName: 'callPaypalApi' , code: { csharp: "var result = await _paypalClient.CreateOrderAsync(amount, paymentToken, cancellationToken);\nif (!result.Succeeded) throw new PaymentException(result.ErrorMessage);\n_logger.LogDebug(\"PayPal order {OrderId} completed\", result.OrderId);" }},
                  { id: 'frag-log-payment-paypal', label: '決済ログを記録する(PayPal)', lines: 4, responsibility: 'payment-logging', suggestedName: 'logPaypalPayment' , code: { csharp: "_logger.LogInformation(\"{Action} を記録しました\", action);\nawait _auditLog.WriteAsync(action, DateTimeOffset.UtcNow);\n_logger.LogDebug(\"決済ログを記録する(PayPal) が完了しました\");\nreturn true;" }},
                ],
              },
              {
                id: 'method-configure-paypal',
                name: 'configurePaypalCredentials',
                visibility: 'public',
                fragments: [
                  { id: 'frag-configure-paypal', label: 'PayPal APIキーを設定する', lines: 4, responsibility: 'paypal-config', suggestedName: 'configurePaypal' , code: { csharp: "var clientSecret = Environment.GetEnvironmentVariable(\"PAYPAL_CLIENT_SECRET\");\nif (string.IsNullOrWhiteSpace(clientSecret)) throw new InvalidOperationException(\"PayPal client secretがありません\");\n_paypalClient.Configure(clientSecret);\nreturn true;" }},
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
  learns: ['Strategy', 'implements'],
  checks: [
    {
      id: 'check-1',
      question: '割引計算を Strategy パターンにして方式ごとのクラスに分ける、いちばんの利点は?',
      choices: [
        { text: '新しい割引方式を、既存の方式と注文処理の分岐に手を入れず、クラスの追加で足せる', explanation: '正解です。方式の追加や変更が、他の方式を壊さずに済みます。' },
        { text: '割引額が必ず安くなる', explanation: '割引額は、パターンの選択では変わりません。' },
        { text: 'if 文が1つもないコードになる', explanation: 'if が消えるのは結果であり、目的ではありません。' },
      ],
      answer: 0,
    },
    {
      id: 'check-2',
      question: 'Strategy パターンが、やりすぎになるのは、どんなとき?',
      choices: [
        { text: '割引方式がこれからも頻繁に増える見込みのとき', explanation: '増える見込みがあるなら、効果が大きい場面です。' },
        { text: '方式が複数あって、方式ごとに別の担当者が変更するとき', explanation: '分けると助かる場面です。' },
        { text: '方式が2つで固定されていて、計算も数行で、今後増える見込みもないとき', explanation: '正解です。この場合は、クラスを増やす手間のほうが大きく、単純な分岐のほうが読みやすいです。' },
      ],
      answer: 2,
    },
  ],
  /** 100点になったときに見せる、この題材で分ける理由。 */
  why: '割引条件を変えるたびに、他の割引方式と注文処理の分岐まで読み解くことになります。方式ごとの計算が分かれていれば、変更するルールを個別に見られます。',
  description:
    'DiscountService の calculateDiscount が、会員ランク(通常/プレミアム/VIP)によって割引の計算方法をif分岐で切り替えている。' +
    '3つの分岐処理が1つの長いメソッドに同居していて、ランクごとの割引ルールを変えるたびにこのメソッドを触ることになる。' +
    'calculateメソッドの型だけを宣言した DiscountStrategy は用意されているが、まだどのクラスとも実装関係で結ばれていない。',
  goal:
    '3つの割引ロジックを、それぞれ新しく作るクラス(RegularDiscount/PremiumDiscount/VipDiscount)へ切り出し、' +
    'どのクラスも DiscountStrategy を実装(implements)するよう設定しよう。上級1・2とは違い、受け皿は1つに集約せず3つに分ける。メソッドは11行以内、1クラスは14行・ファイルは15行以内、1クラスの責務は2種類まで',
  limits: { method: 11, class: 14, file: 15 },
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
                  { id: 'frag-validate-order', label: '注文内容と会員ランクを検証する', lines: 5, responsibility: 'validation', suggestedName: 'validateOrder' , code: { csharp: "var items = order.Items;\nif (items is null || items.Count == 0) throw new ValidationException(\"注文に商品がありません\");\nvar subtotal = items.Sum(item => item.UnitPrice * item.Quantity);\nvar rank = order.MemberRank;\nif (!Enum.IsDefined(rank)) throw new ValidationException(\"会員ランクが不正です\");" }},
                  { id: 'frag-branch-regular', label: '会員ランクが「通常」なら、割引なしで合計する', lines: 3, responsibility: 'discount-regular', suggestedName: 'calculate' , code: { csharp: "if (subtotal <= 0) return 0;\nvar regularTotal = decimal.Round(subtotal, 2);\nif (rank == MemberRank.Regular) return regularTotal;" }},
                  { id: 'frag-branch-premium', label: '会員ランクが「プレミアム」なら、一律10%引きで合計する', lines: 3, responsibility: 'discount-premium', suggestedName: 'calculate' , code: { csharp: "var premiumRate = 0.10m;\nvar discountedTotal = subtotal * (1 - premiumRate);\nif (rank == MemberRank.Premium) return decimal.Round(discountedTotal, 2);" }},
                  { id: 'frag-branch-vip', label: '会員ランクが「VIP」なら、送料無料込みで合計する', lines: 3, responsibility: 'discount-vip', suggestedName: 'calculate' , code: { csharp: "var shippingFee = rank == MemberRank.Vip ? 0m : standardShippingFee;\nvar vipDiscountedTotal = subtotal * 0.80m;\nreturn decimal.Round(vipDiscountedTotal + shippingFee, 2);" }},
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
  learns: ['Factory', '生成の集約'],
  checks: [
    {
      id: 'check-1',
      question: 'レポートの組み立てを Factory に集める理由は?',
      choices: [
        { text: 'オブジェクトの組み立て手順の変更を、使う側のコントローラーごとに直さず、1か所で済ませるため', explanation: '正解です。生成の知識が1か所にあれば、使う側は組み立て方を知らなくて済みます。' },
        { text: 'コントローラーを不要にするため', explanation: 'コントローラーは必要で、役割が変わるだけです。' },
        { text: 'レポートの内容を速く作るため', explanation: '速度は目的ではありません。' },
      ],
      answer: 0,
    },
    {
      id: 'check-2',
      question: 'Factory を使う利点が薄いのは、どんな場面?',
      choices: [
        { text: '組み立てが毎回違う、複雑で、使う場所が何か所もあるとき', explanation: '利点が大きい場面です。' },
        { text: '組み立てが1行で済み、使う場所も1か所だけのとき', explanation: '正解です。そこまで単純なら、Factory を挟むと読む場所が増えるだけです。' },
        { text: 'レポートの形式が将来増える見込みのとき', explanation: '増える見込みがあるなら、効果が大きい場面です。' },
      ],
      answer: 1,
    },
  ],
  /** 100点になったときに見せる、この題材で分ける理由。 */
  why: 'レポート形式を追加するたび、作成手順の条件分岐に既存形式の処理が積み重なります。形式の組み立てを分ければ、新しい形式の変更が既存の出力に触れにくくなります。',
  description:
    'WeeklyReportController と MonthlyReportController は、どちらも「データを集計する」「レポートオブジェクトを組み立てる」' +
    '「レポートを送信する」の3処理を1つのメソッドに詰め込んでいる。' +
    '「レポートオブジェクトを組み立てる」処理はコピペしたように全く同じ内容で、2クラスに重複している。' +
    '空のクラス ReportFactory は用意されているが、まだどちらのクラスからも使われていない。',
  goal:
    '重複した「レポートオブジェクトを組み立てる」処理をExtract Methodで取り出し、メソッドエディタの「似た処理を持つメソッド」から統合してReportFactoryへ移そう。' +
    '上級1と違い、継承(継承元の設定)は使わない。別クラスへ処理を任せる(委譲)だけで解けるはず。メソッドは11行以内、1クラスの責務は2種類まで',
  limits: { method: 11, class: 14, file: 15 },
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
                  { id: 'frag-gather-weekly-data', label: '週次データを集計する', lines: 3, responsibility: 'data-aggregation', suggestedName: 'gatherWeeklyData' , code: { csharp: "var rows = source.GroupBy(item => item.Category)\n    .Select(group => new ReportRow(group.Key, group.Sum(item => item.Amount)))\n    .ToList();" }},
                  { id: 'frag-build-report-weekly', label: 'レポートオブジェクトを組み立てる', lines: 3, responsibility: 'report-building', suggestedName: 'buildReport', duplicateGroup: 'report-building' , code: { csharp: "var report = new Report(periodStart, periodEnd, rows);\nreport.Validate();\n_logger.LogInformation(\"レポートを検証しました: {RowCount}\", report.Rows.Count);" }},
                  { id: 'frag-send-weekly', label: 'レポートを送信する', lines: 3, responsibility: 'report-delivery', suggestedName: 'sendReport' , code: { csharp: "var payload = JsonSerializer.Serialize(report);\nusing var response = await _httpClient.PostAsync(endpoint, new StringContent(payload), cancellationToken);\nresponse.EnsureSuccessStatusCode();" }},
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
                  { id: 'frag-gather-monthly-data', label: '月次データを集計する', lines: 3, responsibility: 'data-aggregation', suggestedName: 'gatherMonthlyData' , code: { csharp: "var rows = source.GroupBy(item => item.Category)\n    .Select(group => new ReportRow(group.Key, group.Sum(item => item.Amount)))\n    .ToList();" }},
                  { id: 'frag-build-report-monthly', label: 'レポートオブジェクトを組み立てる', lines: 3, responsibility: 'report-building', suggestedName: 'buildReport', duplicateGroup: 'report-building' , code: { csharp: "var report = new Report(periodStart, periodEnd, rows);\nreport.Validate();\n_logger.LogInformation(\"レポートを検証しました: {RowCount}\", report.Rows.Count);" }},
                  { id: 'frag-send-monthly', label: 'レポートを送信する', lines: 3, responsibility: 'report-delivery', suggestedName: 'sendReport' , code: { csharp: "var payload = JsonSerializer.Serialize(report);\nusing var response = await _httpClient.PostAsync(endpoint, new StringContent(payload), cancellationToken);\nresponse.EnsureSuccessStatusCode();" }},
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
  learns: ['継承の見直し', 'Collapse Hierarchy'],
  checks: [
    {
      id: 'check-1',
      question: '子が1つしかない継承を畳む(Collapse Hierarchy)のはなぜ?',
      choices: [
        { text: '継承を使うことは常に悪いことだから', explanation: '継承が悪いわけではなく、使われない拡張ポイントが読む負担になるのが問題です。' },
        { text: '将来 Excel などに対応するときに困らないようにするため', explanation: '将来のための足場は、実際に必要になってから足せばよいです。' },
        { text: '使われていない拡張ポイントを残すと、読む量と考える場所が増えるだけで、得るものがないから', explanation: '正解です。実際に使われていない抽象化は、理解のコストだけを払うことになります。' },
      ],
      answer: 2,
    },
    {
      id: 'check-2',
      question: '上級1(共通処理を基底クラスへ集める)と、このステージで、向きが逆なのはなぜ?',
      choices: [
        { text: '上級1は共通点が複数の子にある実態に合わせて集め、ここは子が1つなのでまとめる。どちらも実態に合わせる点で同じ', explanation: '正解です。構造は今のコードの実態に合わせるもので、増やす向きも減らす向きもあります。' },
        { text: '上級1は間違いで、このステージが正しいから', explanation: 'どちらも、状況に応じた正しい選択です。' },
        { text: '継承は2回までしか使えないから', explanation: 'そのような決まりはありません。' },
      ],
      answer: 0,
    },
  ],
  /** 100点になったときに見せる、この題材で分ける理由。 */
  why: '出力形式ごとに変わる処理まで親クラスに置くと、形式変更が他の出力へ波及しないか心配になります。共通手順と形式固有の処理が分かれていれば、変更範囲を判断しやすくなります。',
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
                  { id: 'frag-validate-query', label: '検索条件を検証する', lines: 2, responsibility: 'http', suggestedName: 'validateQuery' , code: { csharp: "if (input.StartDate > input.EndDate) throw new ValidationException(\"期間が逆転しています\");\nif (input.StartDate < minimumDate || input.EndDate > maximumDate) throw new ValidationException(\"期間が範囲外です\");" }},
                  { id: 'frag-fetch-sales', label: '売上データを取得する', lines: 2, responsibility: 'query', suggestedName: 'fetchSales' , code: { csharp: "if (input is null) throw new ArgumentNullException(nameof(input));\nvar sales = await _salesRepository.FindAsync(input.StartDate, input.EndDate, cancellationToken);" }},
                  {
                    id: 'frag-output-csv',
                    label: 'CSVを出力する',
                    lines: 5,
                    responsibility: 'http',
                    uses: ['method-prepare-export', 'method-write-rows'],
                    suggestedName: 'outputCsv',
                   code: { csharp: "var rows = sales.Select(sale => new SalesRow(sale.ProductName, sale.Amount)).ToList();\nvar writer = new StringWriter();\nprepareExport(writer, rows);\nwriteRows(writer, rows);\nreturn writer.ToString();" }},
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
                fragments: [{ id: 'frag-decide-header', label: '文字コードとヘッダー行を決める', lines: 4, responsibility: 'csv-format' , code: { csharp: "var encoding = options.Encoding ?? Encoding.UTF8;\nvar header = string.Join(\",\", typeof(SalesRow).GetProperties().Select(property => Quote(property.Name)));\nawait writer.WriteLineAsync(header, encoding, cancellationToken);\nreturn header;" }}],
              },
              {
                id: 'method-escape-value',
                name: 'escapeValue',
                visibility: 'protected',
                // Template Method: 基底クラスが子クラスのフック(quoteChar)を呼ぶ。2クラスに分けたままだと互いを呼び合う循環が残る
                fragments: [{ id: 'frag-escape-value', label: '値をエスケープする', lines: 3, responsibility: 'csv-format', uses: ['method-quote-char'] , code: { csharp: "var escaped = value.Replace(\"\"\", \"\"\"\");\nvar quoted = $\"{quoteChar()}{escaped}{quoteChar()}\";\nreturn quoted;" }}],
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
                fragments: [{ id: 'frag-write-rows', label: '行をCSVに書き出す', lines: 3, responsibility: 'csv-format', uses: ['method-escape-value'] , code: { csharp: "foreach (var row in rows)\n    await writer.WriteLineAsync(string.Join(\",\", row.Values.Select(value => escapeValue(value))));\nawait writer.FlushAsync(cancellationToken);" }}],
              },
              {
                id: 'method-quote-char',
                name: 'quoteChar',
                visibility: 'protected',
                fragments: [{ id: 'frag-quote-char', label: 'クォートに使う文字を返す(BaseExporter から呼ばれるフック)', lines: 3, responsibility: 'csv-format' , code: { csharp: "var quote = options.AlwaysQuote ? \"\\\"\" : string.Empty;\nif (value.Contains(options.Delimiter)) return \"\\\"\";\nreturn quote;" }}],
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
  learns: ['ISP', 'implements'],
  checks: [
    {
      id: 'check-1',
      question: '太ったインターフェースを役割ごとに分ける(ISP)と、何が助かる?',
      choices: [
        { text: '実装するクラスが、使わないメソッドの空実装を強いられなくなる', explanation: '正解です。必要な約束だけを持てば、関係のない変更に巻き込まれません。' },
        { text: 'インターフェースの数が増えて、設計が立派に見える', explanation: '数が増えること自体に価値はありません。' },
        { text: 'メソッドの行数が減る', explanation: '行数の話ではなく、実装側に求める約束の話です。' },
      ],
      answer: 0,
    },
    {
      id: 'check-2',
      question: 'ISP で分けすぎになるのは、どんなとき?',
      choices: [
        { text: 'チャットだけを使う連携先があるとき', explanation: 'その場合は、分ける効果が大きいです。' },
        { text: 'タスク管理の機能を後から足したいとき', explanation: '足したいなら、分けておくほうが影響が小さくなります。' },
        { text: '連携先が、チャットもタスク管理も常に両方扱うと決まっているのに、メソッドごとに別のインターフェースへ分けるとき', explanation: '正解です。常に一緒に使う約束まで細切れにすると、型の数が増えるだけになります。' },
      ],
      answer: 2,
    },
  ],
  /** 100点になったときに見せる、この題材で分ける理由。 */
  why: 'チャットとタスク管理の契約が一緒だと、片方だけを扱う連携先にも不要な変更や実装が求められます。用途ごとに契約を分ければ、機能追加時に関係する連携先だけを見れば済みます。',
  description:
    '障害対応の連絡を自動化するため、Slack・Teams・Backlog・Chatwork をまとめて扱う CollaborationTool インターフェースを作った。' +
    'ところが Slack と Teams はタスク管理ができず createTask・completeTask を「未対応」の例外で潰し、Backlog はチャットに投稿できず postMessage を空実装で潰している。' +
    '投稿しか使わない AlertNotifier も、タスクしか使わない IncidentService も、同じ太いインターフェースに依存している。',
  goal:
    'CollaborationTool を、投稿の役割(ChatClient)とタスク管理の役割(TaskTracker)に分けよう。各クラスには本当に使うインターフェースだけを実装させ、' +
    '両方できる ChatworkClient には両方を実装させよう。要らなくなった空実装は、メソッドエディタの「空実装のメソッドを削除」で消そう。依存先は1クラスまで',
  limits: { method: 12, class: 23, file: 24 },
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
                  { id: 'frag-alert-format', label: 'アラートの内容から通知文を組み立てる', lines: 3, responsibility: 'alert-format', suggestedName: 'buildAlertMessage' , code: { csharp: "var severityLabel = alert.Severity == IncidentSeverity.High ? \"重大\" : \"通常\";\nvar body = $\"{severityLabel}: {alert.Title} - {alert.Description}\";\nvar message = new ChatMessage(channel, body);" }},
                  {
                    id: 'frag-alert-dispatch',
                    label: 'チャットへ投稿する',
                    lines: 3,
                    responsibility: 'alert-dispatch',
                    uses: ['method-tool-post-message'],
                    suggestedName: 'dispatchAlert',
                   code: { csharp: "var alert = new ChatMessage(subject, body);\nawait postMessage(alert);\n_logger.LogInformation(\"アラートを投稿しました\");" }},
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
                  { id: 'frag-triage', label: '障害の影響範囲と重要度を判定する', lines: 2, responsibility: 'triage', suggestedName: 'triageIncident' , code: { csharp: "if (input is null) throw new ArgumentNullException(nameof(input));\nvar severity = affectedServices.Count > 3 ? IncidentSeverity.High : IncidentSeverity.Normal;" }},
                  {
                    id: 'frag-incident-dispatch-create',
                    label: '対応タスクを登録する',
                    lines: 3,
                    responsibility: 'incident-dispatch',
                    uses: ['method-tool-create-task'],
                    suggestedName: 'createIncidentTask',
                   code: { csharp: "var incidentTask = new IncidentTask(incident.Id, severity);\nawait createTask(incidentTask);\n_logger.LogInformation(\"対応タスクを登録しました\");" }},
                  {
                    id: 'frag-incident-dispatch-complete',
                    label: '復旧したらタスクを完了にする',
                    lines: 3,
                    responsibility: 'incident-dispatch',
                    uses: ['method-tool-complete-task'],
                    suggestedName: 'completeIncidentTask',
                   code: { csharp: "if (!incident.IsRecovered) return false;\nawait completeTask(incident.Id);\nreturn true;" }},
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
                fragments: [{ id: 'frag-slack-chat-post', label: 'Slack APIでチャンネルに投稿する', lines: 3, responsibility: 'chat-post', suggestedName: 'postToSlack' , code: { csharp: "var payload = JsonSerializer.Serialize(message);\nusing var response = await _httpClient.PostAsync(endpoint, new StringContent(payload), cancellationToken);\nresponse.EnsureSuccessStatusCode();" }}],
              },
              {
                id: 'method-slack-create-task',
                name: 'createTask',
                visibility: 'public',
                fragments: [{ id: 'frag-slack-task-create-stub', label: '未対応: UnsupportedOperationErrorを投げるだけ', lines: 1, responsibility: 'task-create', stub: true , code: { csharp: "throw new NotSupportedException();" }}],
              },
              {
                id: 'method-slack-complete-task',
                name: 'completeTask',
                visibility: 'public',
                fragments: [{ id: 'frag-slack-task-complete-stub', label: '未対応: UnsupportedOperationErrorを投げるだけ', lines: 1, responsibility: 'task-complete', stub: true , code: { csharp: "throw new NotSupportedException();" }}],
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
                fragments: [{ id: 'frag-teams-chat-post', label: 'Teams のWebhookでチャネルに投稿する', lines: 3, responsibility: 'chat-post', suggestedName: 'postToTeams' , code: { csharp: "var payload = JsonSerializer.Serialize(message);\nusing var response = await _httpClient.PostAsync(endpoint, new StringContent(payload), cancellationToken);\nresponse.EnsureSuccessStatusCode();" }}],
              },
              {
                id: 'method-teams-create-task',
                name: 'createTask',
                visibility: 'public',
                fragments: [{ id: 'frag-teams-task-create-stub', label: '未対応: UnsupportedOperationErrorを投げるだけ', lines: 1, responsibility: 'task-create', stub: true , code: { csharp: "throw new NotSupportedException();" }}],
              },
              {
                id: 'method-teams-complete-task',
                name: 'completeTask',
                visibility: 'public',
                fragments: [{ id: 'frag-teams-task-complete-stub', label: '未対応: UnsupportedOperationErrorを投げるだけ', lines: 1, responsibility: 'task-complete', stub: true , code: { csharp: "throw new NotSupportedException();" }}],
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
                fragments: [{ id: 'frag-backlog-chat-post-stub', label: '未対応: 何もせずreturnする空実装', lines: 1, responsibility: 'chat-post', stub: true , code: { csharp: "return;" }}],
              },
              {
                id: 'method-backlog-create-task',
                name: 'createTask',
                visibility: 'public',
                fragments: [{ id: 'frag-backlog-task-create', label: 'Backlog APIで課題を登録する', lines: 3, responsibility: 'task-create', suggestedName: 'createBacklogIssue' , code: { csharp: "var payload = JsonSerializer.Serialize(message);\nusing var response = await _httpClient.PostAsync(endpoint, new StringContent(payload), cancellationToken);\nresponse.EnsureSuccessStatusCode();" }}],
              },
              {
                id: 'method-backlog-complete-task',
                name: 'completeTask',
                visibility: 'public',
                fragments: [
                  { id: 'frag-backlog-task-complete', label: 'Backlog APIで課題の状態を完了にする', lines: 3, responsibility: 'task-complete', suggestedName: 'completeBacklogIssue' , code: { csharp: "var payload = JsonSerializer.Serialize(message);\nusing var response = await _httpClient.PostAsync(endpoint, new StringContent(payload), cancellationToken);\nresponse.EnsureSuccessStatusCode();" }},
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
                fragments: [{ id: 'frag-chatwork-chat-post', label: 'Chatwork APIでルームに投稿する', lines: 3, responsibility: 'chat-post', suggestedName: 'postToChatwork' , code: { csharp: "var payload = JsonSerializer.Serialize(message);\nusing var response = await _httpClient.PostAsync(endpoint, new StringContent(payload), cancellationToken);\nresponse.EnsureSuccessStatusCode();" }}],
              },
              {
                id: 'method-chatwork-create-task',
                name: 'createTask',
                visibility: 'public',
                fragments: [{ id: 'frag-chatwork-task-create', label: 'Chatwork APIでタスクを登録する', lines: 3, responsibility: 'task-create', suggestedName: 'createChatworkTask' , code: { csharp: "var payload = JsonSerializer.Serialize(message);\nusing var response = await _httpClient.PostAsync(endpoint, new StringContent(payload), cancellationToken);\nresponse.EnsureSuccessStatusCode();" }}],
              },
              {
                id: 'method-chatwork-complete-task',
                name: 'completeTask',
                visibility: 'public',
                fragments: [{ id: 'frag-chatwork-task-complete', label: 'Chatwork APIでタスクを完了にする', lines: 3, responsibility: 'task-complete', suggestedName: 'completeChatworkTask' , code: { csharp: "var payload = JsonSerializer.Serialize(message);\nusing var response = await _httpClient.PostAsync(endpoint, new StringContent(payload), cancellationToken);\nresponse.EnsureSuccessStatusCode();" }}],
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
  learns: ['Value Object', 'カプセル化'],
  checks: [
    {
      id: 'check-1',
      question: 'amount と currency を Money にまとめる、いちばんの理由は?',
      choices: [
        { text: 'フィールドの数を減らして、見た目を短くするため', explanation: '見た目の数ではなく、一緒に扱うべき値の整合性が目的です。' },
        { text: '金額と通貨のルール(加算、端数の扱いなど)を1か所に集め、数値と文字列がバラバラに扱われるのを防ぐため', explanation: '正解です。値と振る舞いをまとめれば、ルールの確認先が1か所になります。' },
        { text: 'Money クラスにすると計算が速くなるから', explanation: '速度は変わりません。' },
      ],
      answer: 1,
    },
    {
      id: 'check-2',
      question: 'Value Object は、なぜ不変(作ったら変えない)に作ることが多い?',
      choices: [
        { text: 'メモリを節約するため', explanation: 'メモリの節約が主な理由ではありません。' },
        { text: 'コードの行数を減らすため', explanation: '行数の話ではありません。' },
        { text: 'どこかで勝手に書き換わって、同じ金額が別の値になる事故を防ぐため', explanation: '正解です。値として安全に受け渡せるので、予想外の変更に悩まされません。' },
      ],
      answer: 2,
    },
  ],
  /** 100点になったときに見せる、この題材で分ける理由。 */
  why: '金額の端数や通貨の扱いを変えるとき、数値を使う各処理に同じルールが散らばっていないか探すことになります。値とその振る舞いがまとまれば、金額ルールを一箇所で確認できます。',
  description:
    '経費精算システム。外貨の経費に対応したとき、経費(Expense)の金額を amount(数値)と currency(通貨コードの文字列)のまま持たせた。' +
    'その結果、申請(ExpenseApplicationService)・承認(ApprovalService)・精算(PayoutService)の3つのサービスが、' +
    '「金額が0より大きく対応している通貨か」「同じ通貨どうしで合計する」「通貨ごとの小数桁で表示する」を、それぞれコピペで持っている。',
  goal:
    '金額と通貨をひとまとまりの値(Money)として扱おう。コピペされた処理は抽出して統合(Merge Methods)し、amount・currency と一緒に新しい Money クラスへ移す。' +
    'Money は自分で自分を検証し、足し算や表示も自分でする(値オブジェクト)。Expense に直接入れるのではなく、別のクラスにしよう。メソッドは13行・クラスは23行以内、1クラスの責務は3種類まで、依存先は2クラスまで',
  limits: { method: 13, class: 23, file: 24 },
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
              { id: 'field-amount', name: 'amount', visibility: 'public', description: '申請する経費の金額', type: { csharp: 'decimal' } },
              { id: 'field-currency', name: 'currency', visibility: 'public', description: '金額の通貨コード', type: { csharp: 'string' } },
              { id: 'field-category', name: 'category', visibility: 'public', description: '経費の分類', type: { csharp: 'string' } },
              { id: 'field-status', name: 'status', visibility: 'public', description: '申請の状態', type: { csharp: 'string' } },
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
                    lines: 3,
                    responsibility: 'workflow',
                    reads: ['field-category'],
                    writes: ['field-status'],
                   code: { csharp: "if (string.IsNullOrWhiteSpace(category)) throw new ValidationException(\"勘定科目が必要です\");\nstatus = \"Submitted\";\nreturn true;" }},
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
                    lines: 3,
                    responsibility: 'category-rule',
                    reads: ['field-category'],
                   code: { csharp: "var requiredCategories = new[] { \"Travel\", \"Equipment\" };\nvar required = requiredCategories.Contains(category);\nreturn required;" }},
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
                    lines: 3,
                    responsibility: 'application',
                    uses: ['method-is-receipt-required'],
                    suggestedName: 'checkExpenseForm',
                   code: { csharp: "var receiptRequired = isReceiptRequired(category);\nif (expenseDate > DateTime.UtcNow || string.IsNullOrWhiteSpace(category)) throw new ValidationException(\"日付か勘定科目が不正です\");\nif (receiptRequired && receipt is null) throw new ValidationException(\"領収書が必要です\");" }},
                  {
                    id: 'frag-apply-validate-money',
                    label: '金額が0より大きく、対応している通貨か確かめる',
                    lines: 3,
                    responsibility: 'money-validation',
                    reads: ['field-amount', 'field-currency'],
                    duplicateGroup: 'money-validate',
                    suggestedName: 'validateMoney',
                   code: { csharp: "if (amount <= 0) throw new ArgumentOutOfRangeException(nameof(amount));\nif (!SupportedCurrencies.Contains(currency)) throw new ArgumentException(\"通貨に対応していません\");\nif (amount != decimal.Round(amount, CurrencyDigits.For(currency))) throw new ArgumentException(\"通貨の小数桁を超えています\");" }},
                  {
                    id: 'frag-apply-format-money',
                    label: '通貨ごとの小数桁で金額を表示用に整える',
                    lines: 3,
                    responsibility: 'money-format',
                    reads: ['field-amount', 'field-currency'],
                    duplicateGroup: 'money-format',
                    suggestedName: 'formatMoney',
                   code: { csharp: "var digits = CurrencyDigits.For(currency);\nvar format = $\"F{digits}\";\nvar formattedAmount = amount.ToString(format, CultureInfo.InvariantCulture);" }},
                  {
                    id: 'frag-apply-request-approval',
                    label: '申請を提出し、上長へ承認依頼を送る',
                    lines: 3,
                    responsibility: 'approval-request',
                    uses: ['method-submit'],
                    suggestedName: 'requestApproval',
                   code: { csharp: "submit();\nvar approval = new ApprovalRequest(supervisorId, expenseId, formattedAmount);\nawait _approvalService.RequestAsync(approval, cancellationToken);" }},
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
                    lines: 2,
                    responsibility: 'aggregation',
                    suggestedName: 'collectMonthlyExpenses',
                   code: { csharp: "var monthStart = new DateTime(DateTime.UtcNow.Year, DateTime.UtcNow.Month, 1);\nvar expenses = await _expenseRepository.FindByDepartmentAsync(departmentId, monthStart, cancellationToken);" }},
                  {
                    id: 'frag-approve-validate-money',
                    label: '金額が0より大きく、対応している通貨か確かめる',
                    lines: 3,
                    responsibility: 'money-validation',
                    reads: ['field-amount', 'field-currency'],
                    duplicateGroup: 'money-validate',
                    suggestedName: 'validateMoney',
                   code: { csharp: "if (amount <= 0) throw new ArgumentOutOfRangeException(nameof(amount));\nif (!SupportedCurrencies.Contains(currency)) throw new ArgumentException(\"通貨に対応していません\");\nif (amount != decimal.Round(amount, CurrencyDigits.For(currency))) throw new ArgumentException(\"通貨の小数桁を超えています\");" }},
                  {
                    id: 'frag-approve-sum-money',
                    label: '同じ通貨どうしで金額を合計し、新しい金額として返す',
                    lines: 3,
                    responsibility: 'money-arithmetic',
                    reads: ['field-amount', 'field-currency'],
                    duplicateGroup: 'money-sum',
                    suggestedName: 'sumMoney',
                   code: { csharp: "if (currency != other.currency) throw new InvalidOperationException(\"通貨が一致しません\");\nvar sum = amount + other.amount;\nvar result = new Money(sum, currency);" }},
                  { id: 'frag-approve-return-money', label: '計算した金額を返す', lines: 1, responsibility: 'money-arithmetic', code: { csharp: 'return result;' } },
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
                    lines: 3,
                    responsibility: 'money-arithmetic',
                    reads: ['field-amount', 'field-currency'],
                    duplicateGroup: 'money-sum',
                    suggestedName: 'sumMoney',
                   code: { csharp: "if (currency != other.currency) throw new InvalidOperationException(\"通貨が一致しません\");\nvar sum = amount + other.amount;\nvar result = new Money(sum, currency);" }},
                  {
                    id: 'frag-payout-format-money',
                    label: '通貨ごとの小数桁で金額を表示用に整える',
                    lines: 3,
                    responsibility: 'money-format',
                    reads: ['field-amount', 'field-currency'],
                    duplicateGroup: 'money-format',
                    suggestedName: 'formatMoney',
                   code: { csharp: "var digits = CurrencyDigits.For(currency);\nvar format = $\"F{digits}\";\nvar formattedAmount = amount.ToString(format, CultureInfo.InvariantCulture);" }},
                  {
                    id: 'frag-payout-transfer',
                    label: '振込データを作って銀行へ送る',
                    lines: 4,
                    responsibility: 'transfer',
                    suggestedName: 'sendTransfer',
                   code: { csharp: "var transfer = new BankTransfer(bankAccount, result.Amount);\nawait _bankClient.TransferAsync(transfer, cancellationToken);\n_logger.LogDebug(\"振込データを作って銀行へ送る が完了しました\");\nreturn true;" }},
                ],
              },
            ],
          },
        ],
      },
    ],
  },
};

const templateMethodStage: Stage = {
  id: 'advanced-template-method',
  level: 'advanced',
  title: '上級8: 取り込みの手順を Template Method にまとめる',
  learns: ['Template Method', '継承'],
  checks: [
    {
      id: 'check-1',
      question: '取り込みの手順を親クラスに持たせ、違う部分だけを子に書く(Template Method)のはなぜ?',
      choices: [
        { text: '共通の流れの変更を親の1か所で済ませ、子は形式の違いだけに集中できるから', explanation: '正解です。手順がコピペされていると、形式ごとに直す必要があります。' },
        { text: '子クラスを減らすため', explanation: '子クラスの数は減りません。' },
        { text: '継承を使うと必ず速くなるから', explanation: '速度は関係ありません。' },
      ],
      answer: 0,
    },
    {
      id: 'check-2',
      question: 'Template Method が向かないのは、どんなとき?',
      choices: [
        { text: '形式ごとに違うのが変換だけのとき', explanation: 'このステージのように、効果が大きい場面です。' },
        { text: '形式ごとに手順の流れそのものが大きく違い、共通部分が少ないとき', explanation: '正解です。無理に共通の流れに合わせると、親が不自然な空フックだらけになります。' },
        { text: '形式が今後増える見込みのとき', explanation: '増えるなら、効果が大きい場面です。' },
      ],
      answer: 1,
    },
  ],
  /** 100点になったときに見せる、この題材で分ける理由。 */
  why: '取込手順の共通部分と形式ごとの違いが混ざると、形式追加のたびに既存の手順全体を編集することになります。共通の流れと形式固有の処理が分かれていれば、追加箇所が明確になります。',
  description: 'ネットショップの注文取り込み。取引先ごとに CSV と JSON で注文ファイルが届き、CsvOrderImporter と JsonOrderImporter が「ファイルを読み込む → 注文データに変換する → 検証する → 保存する」をそれぞれ持っている。違うのは変換だけで、残りの3手順はコピペ。OrderImporter には parse の宣言(中身のない protected メソッド)だけが用意されている。',
  goal: '共通の3手順は抽出して統合し OrderImporter へ移そう。変換だけは子に parse として残し、OrderImporter を継承させてから parse を protected にしよう。最後に呼び出しだけになった2つの importOrders も統合して OrderImporter へ移そう。上級1と違い、親が手順を持ち、子は違う1手順だけを書く。メソッドは13行以内、1クラスの責務は3種類まで、依存先は1クラスまで',
  limits: {
    method: 13,
    class: 35,
    file: 36,
  },
  dependencyLimit: 1,
  responsibilityLimit: 3,
  changeRequests: [
    {
      id: 'req-add-xml',
      title: 'XMLでも取り込めるようにして',
      description: '新しい取引先はXMLで注文ファイルを送ってくる。CSV・JSONの取り込みはこれまでどおり使う。',
      responsibility: 'order-parse',
      linesPerSite: 30,
      kind: 'extend',
      partName: 'parse',
    },
    {
      id: 'req-order-validation',
      title: '注文の検証ルールを見直して',
      description: '注文日が未来日付の注文を取り込まないようにしたい。',
      responsibility: 'order-validation',
      linesPerSite: 5,
      partName: 'rejectFutureOrderDate',
    },
  ],
  codebase: {
    files: [
      {
        id: 'file-import-controller',
        path: 'src/order/ImportController.ts',
        classes: [
          {
            id: 'class-import-controller',
            name: 'ImportController',
            methods: [
              {
                id: 'method-upload',
                name: 'upload',
                visibility: 'public',
                fragments: [
                  {
                    id: 'frag-detect-format',
                    label: 'アップロードされたファイルの形式を判定する',
                    lines: 3,
                    responsibility: 'http',
                    suggestedName: 'detectFormat',
                   code: { csharp: "if (input is null) throw new ArgumentNullException(nameof(input));\nvar format = Path.GetExtension(input.FileName).ToLowerInvariant();\nobject? result = null;" }},
                  {
                    id: 'frag-dispatch-csv',
                    label: 'CSVなら CsvOrderImporter で取り込む',
                    lines: 2,
                    responsibility: 'import-dispatch',
                    uses: [
                      'method-import-csv',
                    ],
                    suggestedName: 'importCsv',
                   code: { csharp: "if (format == \".csv\") result = await csvImporter.importOrders(input);\nif (format is not (\".csv\" or \".json\")) throw new ValidationException(\"未対応の形式です\");" }},
                  {
                    id: 'frag-dispatch-json',
                    label: 'JSONなら JsonOrderImporter で取り込む',
                    lines: 3,
                    responsibility: 'import-dispatch',
                    uses: [
                      'method-import-json',
                    ],
                    suggestedName: 'importJson',
                   code: { csharp: "if (format == \".json\") result = await jsonImporter.importOrders(input);\nif (result is null) throw new InvalidOperationException(\"Importer returned no result\");\nreturn result;" }},
                ],
              },
            ],
          },
        ],
      },
      {
        id: 'file-csv-order-importer',
        path: 'src/order/CsvOrderImporter.ts',
        classes: [
          {
            id: 'class-csv-order-importer',
            name: 'CsvOrderImporter',
            methods: [
              {
                id: 'method-import-csv',
                name: 'importOrders',
                visibility: 'public',
                fragments: [
                  {
                    id: 'frag-csv-read',
                    label: 'ファイルを開いて1行ずつ読み込む',
                    lines: 3,
                    responsibility: 'file-read',
                    duplicateGroup: 'order-import-read',
                    suggestedName: 'readLines',
                   code: { csharp: "if (!File.Exists(path)) throw new FileNotFoundException(path);\nvar lines = File.ReadAllLines(path);\nif (lines.Length == 0) throw new ValidationException(\"ファイルにデータがありません\");" }},
                  {
                    id: 'frag-csv-parse',
                    label: 'CSVの列を注文データに変換する',
                    lines: 3,
                    responsibility: 'order-parse',
                    suggestedName: 'parse',
                   code: { csharp: "if (lines is null || lines.Count == 0) throw new ValidationException(\"CSVにデータがありません\");\nvar orders = lines.Select(ParseOrder).ToList();\nif (orders.Count == 0) throw new ValidationException(\"注文データがありません\");" }},
                  {
                    id: 'frag-csv-validate',
                    label: '必須項目と金額を検証する',
                    lines: 3,
                    responsibility: 'order-validation',
                    duplicateGroup: 'order-import-validate',
                    suggestedName: 'validateOrders',
                   code: { csharp: "foreach (var order in orders) {\n    if (order.Items.Count == 0 || order.Total < 0 || order.Items.Any(item => item.UnitPrice < 0)) throw new ValidationException(\"注文内容または単価が不正です\");\n}" }},
                  {
                    id: 'frag-csv-save',
                    label: '注文をまとめて保存する',
                    lines: 3,
                    responsibility: 'persistence',
                    duplicateGroup: 'order-import-save',
                    suggestedName: 'saveOrders',
                   code: { csharp: "await _orderRepository.SaveManyAsync(orders, cancellationToken);\nawait _unitOfWork.CommitAsync(cancellationToken);\nreturn true;" }},
                ],
              },
            ],
          },
        ],
      },
      {
        id: 'file-json-order-importer',
        path: 'src/order/JsonOrderImporter.ts',
        classes: [
          {
            id: 'class-json-order-importer',
            name: 'JsonOrderImporter',
            methods: [
              {
                id: 'method-import-json',
                name: 'importOrders',
                visibility: 'public',
                fragments: [
                  {
                    id: 'frag-json-read',
                    label: 'ファイルを開いて1行ずつ読み込む',
                    lines: 3,
                    responsibility: 'file-read',
                    duplicateGroup: 'order-import-read',
                    suggestedName: 'readLines',
                   code: { csharp: "if (!File.Exists(path)) throw new FileNotFoundException(path);\nvar lines = File.ReadAllLines(path);\nif (lines.Length == 0) throw new ValidationException(\"ファイルにデータがありません\");" }},
                  {
                    id: 'frag-json-parse',
                    label: 'JSONの項目を注文データに変換する',
                    lines: 3,
                    responsibility: 'order-parse',
                    suggestedName: 'parse',
                   code: { csharp: "using var document = JsonDocument.Parse(string.Join(Environment.NewLine, lines));\nvar orders = document.RootElement.Deserialize<List<Order>>() ?? throw new ValidationException(\"JSONに注文がありません\");\nif (orders.Count == 0) throw new ValidationException(\"注文データがありません\");" }},
                  {
                    id: 'frag-json-validate',
                    label: '必須項目と金額を検証する',
                    lines: 3,
                    responsibility: 'order-validation',
                    duplicateGroup: 'order-import-validate',
                    suggestedName: 'validateOrders',
                   code: { csharp: "foreach (var order in orders) {\n    if (order.Items.Count == 0 || order.Total < 0 || order.Items.Any(item => item.UnitPrice < 0)) throw new ValidationException(\"注文内容または単価が不正です\");\n}" }},
                  {
                    id: 'frag-json-save',
                    label: '注文をまとめて保存する',
                    lines: 3,
                    responsibility: 'persistence',
                    duplicateGroup: 'order-import-save',
                    suggestedName: 'saveOrders',
                   code: { csharp: "await _orderRepository.SaveManyAsync(orders, cancellationToken);\nawait _unitOfWork.CommitAsync(cancellationToken);\nreturn true;" }},
                ],
              },
            ],
          },
        ],
      },
      {
        id: 'file-order-importer',
        path: 'src/order/OrderImporter.ts',
        classes: [
          {
            id: 'class-order-importer',
            name: 'OrderImporter',
            methods: [
              {
                id: 'method-order-importer-parse',
                name: 'parse',
                visibility: 'protected',
                fragments: [],
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
  templateMethodStage,
];
