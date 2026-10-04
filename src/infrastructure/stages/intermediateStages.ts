import type { Stage } from '../../domain/stage/Stage';

/**
 * 中級1: 置き場所を間違えたメソッドのせいで Order と Customer が互いに依存している。
 * Customer.calculateOrderTotal は Order.getLines を、Customer.getRank は Order.countOrdersOf を呼んでいるので、
 * calculateOrderTotal を Order に、countOrdersOf を Customer に置いて初めて循環が消える。
 */
const cyclicDependencyStage: Stage = {
  id: 'intermediate-cyclic-dependency',
  level: 'intermediate',
  title: '中級1: 循環依存を断ち切る',
  learns: ['循環依存', 'Move Method'],
  checks: [
    {
      id: 'check-1',
      question: 'Order と Customer が互いを呼び合う循環依存は、なぜ避けたほうがよい?',
      choices: [
        { text: '片方を変えると、もう片方も同時に確認や修正が要り、一緒でないと変更もテストもしにくいから', explanation: '正解です。循環していると、どちらか単独で理解・変更・テストするのが難しくなります。' },
        { text: '矢印が赤く表示されて見た目が悪いから', explanation: '赤い矢印は問題を知らせる表示で、避ける理由は変更のしにくさです。' },
        { text: 'クラスの行数が増えるから', explanation: '循環依存は行数の問題ではなく、クラス同士の結びつきの問題です。' },
      ],
      answer: 0,
    },
    {
      id: 'check-2',
      question: '循環をなくすために、メソッドをデータの持ち主のクラスへ移すと考えるのはなぜ?',
      choices: [
        { text: 'メソッドを移すと呼び出し回数が減るから', explanation: '呼び出し回数が減るのは副次的な効果です。主な理由ではありません。' },
        { text: '持ち主のクラスのデータを使う処理は、そこに置くほうが外から読み書きせずに済み、依存が一方向になりやすいから', explanation: '正解です。データと処理が同じ場所にあれば、他のクラスを呼ぶ必要が減ります。' },
        { text: 'クラスの名前を覚えやすくするため', explanation: '名前の覚えやすさは、移動の理由ではありません。' },
      ],
      answer: 1,
    },
  ],
  /** 100点になったときに見せる、この題材で分ける理由。 */
  why: '価格ルールを変えるとき、注文・顧客・在庫が互いに呼び合う経路まで確かめる必要があります。各データの扱いをそれぞれの役割に寄せると、変更の影響を追いやすくなります。',
  description:
    '注文(Order)と顧客(Customer)のクラス。注文の合計金額を求めるメソッドが Customer に、顧客の過去の注文数を数えるメソッドが Order に置かれているせいで、2つのクラスがお互いを呼び合っている。',
  goal: '赤い矢印(循環依存)をなくそう。メソッドが本来いるべきクラスはどこ? メソッドは50行以内、1クラスの責務は4種類まで',
  limits: { method: 50, class: 200, file: 300 },
  dependencyLimit: 2,
  responsibilityLimit: 4,
  changeRequests: [
    { id: 'req-price-rule', title: '価格の計算ルールを変えて', description: 'セール期間中は、明細の小計に期間限定の値引きを反映したい。', responsibility: 'pricing', linesPerSite: 8, partName: 'applySaleDiscount' },
    { id: 'req-member-discount', title: '会員割引の条件を変えて', description: '会員ランクごとの割引率を見直すことになった。', responsibility: 'discount', linesPerSite: 6, partName: 'reviseRankDiscountRate' },
  ],
  codebase: {
    files: [
      {
        id: 'file-order',
        path: 'src/order/Order.ts',
        classes: [
          {
            id: 'class-order',
            name: 'Order',
            methods: [
              {
                id: 'method-checkout',
                name: 'checkout',
                visibility: 'public',
                fragments: [
                  { id: 'frag-reserve-stock', label: '在庫を引き当てる', lines: 30, responsibility: 'inventory', uses: ['method-reserve'], suggestedName: 'reserveStock' },
                  { id: 'frag-order-total', label: '合計金額を求める', lines: 6, responsibility: 'pricing', uses: ['method-calculate-order-total'], suggestedName: 'orderTotal' },
                  { id: 'frag-member-discount', label: '会員ランクで割引する', lines: 18, responsibility: 'discount', uses: ['method-get-rank'], suggestedName: 'applyMemberDiscount' },
                  { id: 'frag-pay', label: '決済する', lines: 26, responsibility: 'payment', suggestedName: 'pay' },
                ],
              },
              {
                id: 'method-get-lines',
                name: 'getLines',
                visibility: 'public',
                fragments: [
                  { id: 'frag-list-lines', label: '注文明細の一覧を返す', lines: 10, responsibility: 'pricing', suggestedName: 'listLines' },
                ],
              },
              {
                id: 'method-count-orders-of',
                name: 'countOrdersOf',
                visibility: 'public',
                fragments: [
                  { id: 'frag-count-orders', label: '顧客の過去の注文数を数える', lines: 14, responsibility: 'history', suggestedName: 'countOrders' },
                ],
              },
            ],
          },
        ],
      },
      {
        id: 'file-customer',
        path: 'src/customer/Customer.ts',
        classes: [
          {
            id: 'class-customer',
            name: 'Customer',
            methods: [
              {
                id: 'method-get-rank',
                name: 'getRank',
                visibility: 'public',
                fragments: [
                  { id: 'frag-judge-rank', label: '注文数から会員ランクを判定する', lines: 18, responsibility: 'membership', uses: ['method-count-orders-of'], suggestedName: 'judgeRank' },
                ],
              },
              {
                id: 'method-calculate-order-total',
                name: 'calculateOrderTotal',
                visibility: 'public',
                fragments: [
                  { id: 'frag-sum-order-lines', label: '注文明細の金額を合計する', lines: 30, responsibility: 'pricing', uses: ['method-get-lines'], suggestedName: 'sumOrderLines' },
                ],
              },
            ],
          },
        ],
      },
      {
        id: 'file-inventory',
        path: 'src/inventory/Inventory.ts',
        classes: [
          {
            id: 'class-inventory',
            name: 'Inventory',
            methods: [
              {
                id: 'method-reserve',
                name: 'reserve',
                visibility: 'public',
                fragments: [
                  { id: 'frag-decrease-stock', label: '在庫数を減らす', lines: 20, responsibility: 'inventory', suggestedName: 'decreaseStock' },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
};

/** 中級2: 3つのクラスが1ファイルに同居している。メソッドを持ち主へ返し、クラスごとにファイルを分ける。 */
const godFileStage: Stage = {
  id: 'intermediate-god-file',
  level: 'intermediate',
  title: '中級2: 何でも入った1つのファイル',
  learns: ['ファイル分割', '責務の分離'],
  checks: [
    {
      id: 'check-1',
      question: 'カート・配送・ポイントを別ファイルに分けるいちばんの理由は?',
      choices: [
        { text: 'ファイルの数が多いほど読みやすいから', explanation: '数ではなく、役割ごとに置き場所がはっきりしていることが読みやすさにつながります。' },
        { text: '1ファイルが長いとエディタが重くなるから', explanation: 'エディタの動作は、ファイル分割の主な理由ではありません。' },
        { text: '配送やポイントの変更のとき、無関係なカートの処理と一緒に編集・レビューせずに済むから', explanation: '正解です。役割ごとにファイルが分かれていれば、修正対象を見つけやすく、変更の衝突も減ります。' },
      ],
      answer: 2,
    },
    {
      id: 'check-2',
      question: 'CartService が持つ送料計算を、本来のクラスへ戻すのはなぜ?',
      choices: [
        { text: '送料の知識は配送の責務なので、配送のルールが変わったときに直す場所を1つにできるから', explanation: '正解です。関連する知識が1か所にあれば、変更漏れや探し回る手間が減ります。' },
        { text: 'private メソッドは使ってはいけないから', explanation: 'private は悪いものではありません。置き場所が責務に合っているかが問題です。' },
        { text: 'CartService の行数を0にするため', explanation: '行数を減らすのは結果であり、目的は責務を正しい場所に置くことです。' },
      ],
      answer: 0,
    },
  ],
  /** 100点になったときに見せる、この題材で分ける理由。 */
  why: '一つのファイルに複数の業務処理が集まると、小さな変更でも無関係な処理との絡みを読み解くことになります。役割で置き場所を分ければ、修正対象を見つけやすくなります。',
  description:
    'カート(CartService)・配送(ShippingService)・ポイント(PointService)の3クラスが、1つのファイルに同居している。しかも CartService が、送料の計算とポイントの付与を private メソッドとして抱え込んでいる。',
  goal: 'ファイルは300行、クラスは180行以内、1クラスの責務は2種類まで。メソッドを持ち主へ返し、「ファイルを追加」してクラスを移そう',
  limits: { method: 100, class: 180, file: 300 },
  dependencyLimit: 2,
  responsibilityLimit: 2,
  changeRequests: [
    { id: 'req-shipping-rule', title: '送料のルールを変えて', description: '離島への配送に追加料金がかかるようになった。', responsibility: 'shipping', linesPerSite: 8, partName: 'addRemoteIslandFee' },
    { id: 'req-points-rule', title: 'ポイントのルールを変えて', description: 'ポイントの有効期限を1年から2年に延ばし、付与も見直す。', responsibility: 'points', linesPerSite: 6, partName: 'extendPointExpiry' },
  ],
  codebase: {
    files: [
      {
        id: 'file-services',
        path: 'src/app/services.ts',
        classes: [
          {
            id: 'class-cart-service',
            name: 'CartService',
            methods: [
              {
                id: 'method-checkout-cart',
                name: 'checkoutCart',
                visibility: 'public',
                fragments: [
                  { id: 'frag-validate-cart', label: 'カートの中身を検証する', lines: 34, responsibility: 'validation', suggestedName: 'validateCart' },
                  { id: 'frag-cart-subtotal', label: '小計を計算する', lines: 44, responsibility: 'pricing', suggestedName: 'calculateSubtotal' },
                  { id: 'frag-call-shipping-fee', label: 'calculateShippingFee() を呼び出す', lines: 1, responsibility: 'call', uses: ['method-calculate-shipping-fee'] },
                  { id: 'frag-call-add-points', label: 'addPoints() を呼び出す', lines: 1, responsibility: 'call', uses: ['method-add-points'] },
                ],
              },
              {
                id: 'method-calculate-shipping-fee',
                name: 'calculateShippingFee',
                visibility: 'private',
                fragments: [
                  { id: 'frag-shipping-fee', label: '地域と重さから送料を決める', lines: 64, responsibility: 'shipping', suggestedName: 'decideShippingFee' },
                ],
              },
              {
                id: 'method-add-points',
                name: 'addPoints',
                visibility: 'private',
                fragments: [
                  { id: 'frag-add-points', label: '購入額に応じてポイントを付ける', lines: 50, responsibility: 'points', suggestedName: 'grantPoints' },
                ],
              },
            ],
          },
          {
            id: 'class-shipping-service',
            name: 'ShippingService',
            methods: [
              {
                id: 'method-schedule-delivery',
                name: 'scheduleDelivery',
                visibility: 'public',
                fragments: [
                  { id: 'frag-schedule-delivery', label: '配送日を決める', lines: 30, responsibility: 'shipping', suggestedName: 'decideDeliveryDate' },
                ],
              },
              {
                id: 'method-track-package',
                name: 'trackPackage',
                visibility: 'public',
                fragments: [
                  { id: 'frag-track-package', label: '配送状況を問い合わせる', lines: 26, responsibility: 'shipping', suggestedName: 'fetchTrackingStatus' },
                ],
              },
            ],
          },
          {
            id: 'class-point-service',
            name: 'PointService',
            methods: [
              {
                id: 'method-get-balance',
                name: 'getBalance',
                visibility: 'public',
                fragments: [
                  { id: 'frag-get-balance', label: 'ポイント残高を取得する', lines: 20, responsibility: 'points', suggestedName: 'fetchBalance' },
                ],
              },
              {
                id: 'method-expire-points',
                name: 'expirePoints',
                visibility: 'public',
                fragments: [
                  { id: 'frag-expire-points', label: '期限切れのポイントを失効させる', lines: 32, responsibility: 'points', suggestedName: 'expireOldPoints' },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
};

/**
 * 中級3: NotificationService が、TemplateEngine の private メソッド renderTemplate を直接呼んでいる。
 * TemplateEngine 側は自分の中でしか使わないつもりで private にしたが、外から呼ばれてしまっている。
 * renderTemplate を呼び出し元(NotificationService)へ Move Method して初めて越境呼び出しが消える。
 * public にするだけでは依存が残るよう、依存先の上限を0にしている(メソッドエディタの「可視性」で public にするだけでは解決させない)。
 */
const misplacedPrivateStage: Stage = {
  id: 'intermediate-misplaced-private',
  level: 'intermediate',
  title: '中級3: 越境する private メソッド',
  learns: ['カプセル化', 'private'],
  checks: [
    {
      id: 'check-1',
      question: 'private メソッドを外のクラスから呼ばないようにするのは、なぜ大切?',
      choices: [
        { text: 'private と書いてあるメソッドは、速く動くから', explanation: '可視性は実行速度に影響しません。' },
        { text: '持ち主が内部の事情で変更しても、外のクラスが壊れない約束を守れるから', explanation: '正解です。private は「内部の都合なので外から頼らないで」という約束で、これを守ると変更の影響が閉じます。' },
        { text: 'public にするとセキュリティ上の問題が出るから', explanation: 'public にすること自体がセキュリティ問題になるわけではありません。変更に弱くなることが問題です。' },
      ],
      answer: 1,
    },
    {
      id: 'check-2',
      question: '呼ぶ側のクラスへメソッドを移して解決するのは、どんなときに向いている?',
      choices: [
        { text: 'メソッドが他のクラスでは使われず、呼ぶ側の仕事の一部になっているとき', explanation: '正解です。そのメソッドが実質的に呼ぶ側の仕事なら、同じクラスに置くほうが自然です。' },
        { text: 'どんなメソッドでも、とにかく public にして済ませたいとき', explanation: 'public にすれば違反は消えますが、内部の約束を捨てることになり、解決ではありません。' },
        { text: 'クラスの数を減らしたいだけのとき', explanation: '数を減らすこと自体が目的ではありません。役割に合う置き場所かどうかで決めます。' },
      ],
      answer: 0,
    },
  ],
  /** 100点になったときに見せる、この題材で分ける理由。 */
  why: '通知方法を変えるたびに、通知の組み立てとテンプレート処理の境界まで調べることになります。各処理を担当するクラスに置けば、変更先がはっきりします。',
  description:
    '配送完了を知らせる NotificationService。通知メールの文面を組み立てる処理の中で、実は TemplateEngine クラスに private として置かれた renderTemplate() を直接呼んでいる。TemplateEngine 側は自分の中でしか使わないつもりで private にしたはずなのに、外から呼ばれてしまっている。',
  goal:
    'メソッドは50行以内に。private なメソッドを他クラスから呼んでいる箇所(アクセス制御の違反)をなくそう。呼んでいる側と同じクラスへ Move Method で移動し、空になったクラスやファイルは片付けよう。' +
    'NotificationService だけで通知を組み立てられるようにしよう(依存先は0クラス)',
  limits: { method: 50, class: 200, file: 300 },
  dependencyLimit: 0,
  responsibilityLimit: 4,
  visibilityEnforced: true,
  changeRequests: [
    { id: 'req-sms', title: '通知をSMSにも送れるようにして', description: '配送完了の通知を、メールだけでなくSMSでも送れるようにしたい。', responsibility: 'delivery', linesPerSite: 8, partName: 'sendSms' },
    { id: 'req-log-format', title: '送信ログのフォーマットを見直して', description: '送信ログに記録する項目を増やし、書式を見直したい。', responsibility: 'logging', linesPerSite: 5, partName: 'formatDeliveryLog' },
  ],
  codebase: {
    files: [
      {
        id: 'file-notification-service',
        path: 'src/notification/NotificationService.ts',
        classes: [
          {
            id: 'class-notification-service',
            name: 'NotificationService',
            methods: [
              {
                id: 'method-notify-shipment',
                name: 'notifyShipment',
                visibility: 'public',
                fragments: [
                  { id: 'frag-gather-info', label: '通知に必要な情報を集める', lines: 26, responsibility: 'notification', suggestedName: 'gatherNotificationInfo' },
                  { id: 'frag-render-template', label: 'テンプレートを描画する', lines: 6, responsibility: 'notification', uses: ['method-render-template'], suggestedName: 'renderNotification' },
                  { id: 'frag-send-mail', label: 'メールを送信する', lines: 30, responsibility: 'delivery', suggestedName: 'sendMail' },
                  { id: 'frag-log-delivery', label: '送信ログを記録する', lines: 20, responsibility: 'logging', suggestedName: 'logDelivery' },
                ],
              },
            ],
          },
        ],
      },
      {
        id: 'file-template-engine',
        path: 'src/notification/TemplateEngine.ts',
        classes: [
          {
            id: 'class-template-engine',
            name: 'TemplateEngine',
            methods: [
              {
                id: 'method-render-template',
                name: 'renderTemplate',
                visibility: 'private',
                fragments: [
                  { id: 'frag-embed-body', label: '本文のテンプレートを埋め込む', lines: 46, responsibility: 'rendering', suggestedName: 'embedBody' },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
};

/**
 * 中級4・中級5で共有する初期コード。税の計算と帳票の整形は、どちらを残しても SalesReportService の
 * 大きさが同じになるよう、行数をそろえている(構造の採点だけでは正解が決まらないようにするため)。
 */
const salesReportCodebase: Stage['codebase'] = {
  files: [
    {
      id: 'file-sales-report-service',
      path: 'src/report/SalesReportService.ts',
      classes: [
        {
          id: 'class-sales-report-service',
          name: 'SalesReportService',
          methods: [
            {
              id: 'method-generate-monthly-report',
              name: 'generateMonthlyReport',
              visibility: 'public',
              fragments: [
                { id: 'frag-monthly-aggregate', label: '月次の売上を集計する', lines: 40, responsibility: 'aggregation', suggestedName: 'aggregateMonthlySales' },
                { id: 'frag-monthly-tax', label: '税額を計算する', lines: 30, responsibility: 'tax', suggestedName: 'calculateMonthlyTax' },
                { id: 'frag-monthly-format', label: '帳票の形式に整形する', lines: 30, responsibility: 'formatting', suggestedName: 'formatMonthlyReport' },
              ],
            },
            {
              id: 'method-generate-quarterly-report',
              name: 'generateQuarterlyReport',
              visibility: 'public',
              fragments: [
                { id: 'frag-quarterly-aggregate', label: '四半期の売上を集計する', lines: 36, responsibility: 'aggregation', suggestedName: 'aggregateQuarterlySales' },
                { id: 'frag-quarterly-tax', label: '税額を計算する', lines: 28, responsibility: 'tax', suggestedName: 'calculateQuarterlyTax' },
                { id: 'frag-quarterly-format', label: '帳票の形式に整形する', lines: 28, responsibility: 'formatting', suggestedName: 'formatQuarterlyReport' },
              ],
            },
          ],
        },
      ],
    },
    {
      // 呼び出し元。波及の減点は「呼ばれている側」にしか付かないので、誰からも呼ばれないクラスによく変わる処理を置くと満点になってしまう。
      // それを防ぐため、ここは上限60行近くまで大きくしてあり、税や整形のメソッドを持ち込むと変更で上限を超える
      id: 'file-report-controller',
      path: 'src/report/ReportController.ts',
      classes: [
        {
          id: 'class-report-controller',
          name: 'ReportController',
          methods: [
            {
              id: 'method-download-report',
              name: 'downloadReport',
              visibility: 'public',
              fragments: [
                {
                  id: 'frag-dispatch-report',
                  label: '期間に応じて月次・四半期の帳票を作って返す',
                  lines: 55,
                  responsibility: 'http',
                  uses: ['method-generate-monthly-report', 'method-generate-quarterly-report'],
                  suggestedName: 'dispatchReport',
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};

/** 中級4・中級5で共通の数値。依存1本・責務2種類なので、税と整形のうち片方だけを別クラスへ出すことになる。 */
const salesReportRules = {
  limits: { method: 60, class: 150, file: 300 },
  dependencyLimit: 1,
  responsibilityLimit: 2,
} satisfies Pick<Stage, 'limits' | 'dependencyLimit' | 'responsibilityLimit'>;

const salesReportGoal = 'メソッドは60行・クラスは150行以内、1クラスの責務は2種類まで、依存先は1クラスまで。よく変わる所を1つのクラスに閉じ込めよう';

/** 中級4: 税の計算がよく変わる。税の計算を別クラスへ出すのが正解。 */
const volatileTaxStage: Stage = {
  id: 'intermediate-volatile-tax',
  level: 'intermediate',
  title: '中級4: 変わるのは税の計算',
  learns: ['変わる部分の分離', '責務の分離'],
  checks: [
    {
      id: 'check-1',
      question: '経理から「税の計算ルールは頻繁に変わる」と聞いたとき、税の計算を独立させる理由は?',
      choices: [
        { text: '税の計算を速くするため', explanation: '実行速度は関係ありません。変更のしやすさの話です。' },
        { text: '変更が多い部分を1か所に閉じ込めて、改正のたびに帳票全体を読み直さなくて済むようにするため', explanation: '正解です。頻繁に変わる部分を分けておけば、その変更が他の処理に波及しません。' },
        { text: '変わらない部分も含め、すべてをクラスに分けるのが良い設計だから', explanation: '全部を分けるのが目的ではありません。変わる部分に注目して分けます。' },
      ],
      answer: 1,
    },
    {
      id: 'check-2',
      question: 'このステージでは、帳票の見た目の処理まで細かく分ける必要は薄いのはなぜ?',
      choices: [
        { text: '見た目の処理は行数が少ないから', explanation: '行数ではなく、実際に変わるかどうかが判断の基準です。' },
        { text: '帳票の見た目は分けてはいけないから', explanation: '禁止ではありません。変更の見込みが低いので、優先度が低いという話です。' },
        { text: '見た目はここ数年変わっておらず、分けても得られる効果が小さいから', explanation: '正解です。変わる見込みの低い部分まで分けると、手間だけ増えます。' },
      ],
      answer: 2,
    },
  ],
  /** 100点になったときに見せる、この題材で分ける理由。 */
  why: '税ルールの更新が注文処理と一緒に置かれていると、税と無関係な注文手順まで変更のたびに読み直します。税の計算を独立させれば、制度変更をそこに集められます。',
  description:
    '画面の ReportController から呼ばれ、月次・四半期の売上帳票を作る SalesReportService。経理からは「税の計算ルールは法改正や社内規定で毎月のように変わる」と聞いている。一方、帳票の見た目はここ3年変わっていない。',
  goal: salesReportGoal,
  ...salesReportRules,
  changeRequests: [
    { id: 'req-reduced-tax-items', title: '軽減税率の対象品目を増やして', description: '新しく扱い始めた定期購読の新聞を、軽減税率の対象として計算する。', responsibility: 'tax', linesPerSite: 14, partName: 'addNewspaperReducedTax' },
    { id: 'req-tax-rounding', title: '税額の端数処理を変えて', description: '税額の端数を、明細ごとではなく請求単位でまとめて切り捨てる。', responsibility: 'tax', linesPerSite: 14, partName: 'roundTaxPerInvoice' },
  ],
  codebase: salesReportCodebase,
};

/** 中級5: 中級4と同じコードで、帳票の形式がよく変わる。整形を別クラスへ出すのが正解。 */
const volatileFormatStage: Stage = {
  id: 'intermediate-volatile-format',
  level: 'intermediate',
  title: '中級5: 変わるのは帳票の形式',
  learns: ['変わる部分の分離', '責務の分離'],
  checks: [
    {
      id: 'check-1',
      question: '取引先ごとに帳票の形式の依頼が来ると聞いたとき、形式ごとの組み立てを分ける理由は?',
      choices: [
        { text: '形式の追加・変更が、データ取得や業務判断の処理に触れずにできるようにするため', explanation: '正解です。変わる部分を分けておけば、新しい形式を足しても他の処理を壊しにくくなります。' },
        { text: '税の計算を速くするため', explanation: '税の計算は今回は変わらない部分です。形式の話とは関係ありません。' },
        { text: '形式ごとにファイルを増やすと点数が上がるから', explanation: '点数のために増やすのではなく、変更の影響を閉じ込めるために分けます。' },
      ],
      answer: 0,
    },
    {
      id: 'check-2',
      question: '中級4と同じコードでも、分けるべき場所が違うのはなぜ?',
      choices: [
        { text: '採点の基準がステージごとにランダムに変わるから', explanation: '採点は決まったルールで行われます。' },
        { text: 'コードの行数が違うから', explanation: 'コードは同じで、違うのは何が変わりそうかという情報です。' },
        { text: '分けるべき場所は、コードの形ではなく、実際にどこが変わりやすいかで決まるから', explanation: '正解です。同じコードでも、変更の見込みが違えば、効果的な分け方も変わります。' },
      ],
      answer: 2,
    },
  ],
  /** 100点になったときに見せる、この題材で分ける理由。 */
  why: '出力形式を変えるたびに、データ取得や業務判断が混ざった処理を追うことになります。形式ごとの組み立てを分ければ、表示変更の影響を閉じ込められます。',
  description:
    '中級4とまったく同じ、ReportController から呼ばれる SalesReportService。ただし今回は、営業から「取引先ごとに帳票の形式(列の並び・PDF/CSV)を変えてほしいという依頼が毎月来る」と聞いている。税の計算はここ数年変わっていない。',
  goal: salesReportGoal,
  ...salesReportRules,
  changeRequests: [
    { id: 'req-column-order', title: '取引先向けに列の並びを変えて', description: '大口の取引先向けに、商品コードを先頭の列に移した帳票を出す。', responsibility: 'formatting', linesPerSite: 14, partName: 'reorderColumnsForKeyAccount' },
    { id: 'req-pdf-output', title: 'PDFでも出せるようにして', description: 'これまでのCSVに加えて、PDFの帳票も出せるようにする。', responsibility: 'formatting', linesPerSite: 14, partName: 'renderPdfReport' },
  ],
  codebase: salesReportCodebase,
};

/**
 * 中級6: 中級1がメソッド呼び出し(uses)の置き場所だったのに対し、こちらはフィールドの読み書きが題材。
 * BillingService が Subscription の public フィールドを読み書きし(Tell, Don't Ask違反)、
 * トライアル日数(trialDays)というデータまで BillingService に取り残されている。
 * Extract Method してから Subscription へ Move Method し、一緒に使うフィールドを Move Field で運ぶ。
 */
const featureEnvyStage: Stage = {
  id: 'intermediate-feature-envy',
  level: 'intermediate',
  title: '中級6: 他人のデータばかり触るメソッド',
  learns: ['Feature Envy', 'Move Method'],
  checks: [
    {
      id: 'check-1',
      question: 'BillingService が Subscription のフィールドばかり読む状態は、なぜ問題?',
      choices: [
        { text: '契約の仕様が変わると、契約を知らない BillingService まで直すことになり、変更が散らばるから', explanation: '正解です。データと、それを使う処理が離れていると、片方の変更がもう片方に影響します。' },
        { text: 'フィールドを読むと処理が遅くなるから', explanation: 'フィールドを読むコストは問題ではありません。' },
        { text: 'public フィールドは文法上使えないから', explanation: '使えますが、外から勝手に変えられるので、守りたいルールを壊せてしまいます。' },
      ],
      answer: 0,
    },
    {
      id: 'check-2',
      question: 'トライアル判定や請求額の計算を Subscription に移す考え方は?',
      choices: [
        { text: 'Subscription の行数を増やすことが目的', explanation: '行数が増えるのは結果で、目的ではありません。' },
        { text: 'データを持つクラスに仕事を頼み、外から中身を覗いて判断しないようにする(Tell, Don\'t Ask)', explanation: '正解です。判断を持ち主に任せれば、ルールが1か所にまとまり、外からの書き換えも防げます。' },
        { text: 'BillingService を空にして削除するのが目的', explanation: '空にすることが目的ではありません。残る責務はそのクラスの仕事として残ります。' },
      ],
      answer: 1,
    },
  ],
  /** 100点になったときに見せる、この題材で分ける理由。 */
  why: '契約内容を変えるたびに、契約データを持たないサービス側の処理を調べる必要があります。データを扱う側に振る舞いがまとまれば、変更先を見つけやすくなります。',
  description:
    'SaaS の月額課金を担当する BillingService。契約(Subscription)は public なフィールドを持つだけのクラスで、トライアル中かの判定も、席数と単価からの請求額の計算も、解約の手続きも、すべて BillingService が Subscription のフィールドを読んで行い、最後に subscription.status を外から書き換えている。しかも、キャンペーンで契約ごとに変わるようになったトライアル日数(trialDays)が、まだ BillingService のフィールドのまま残っている。',
  goal: 'データを持つクラスに仕事を頼もう(Tell, Don\'t Ask)。他クラスのフィールドばかり触る処理は Extract Method してからデータの持ち主へ移し、一緒に使うフィールドは Move Field で運ぼう。メソッドは60行以内、1クラスの責務は3種類まで、依存先は1クラスまで',
  limits: { method: 60, class: 150, file: 300 },
  dependencyLimit: 1,
  responsibilityLimit: 3,
  changeRequests: [
    { id: 'req-free-admin-seat', title: '管理者の席は無料にして', description: '契約の管理者1名分の席は請求しないようにしたい', responsibility: 'pricing', linesPerSite: 6, partName: 'excludeAdminSeat' },
    { id: 'req-campaign-trial', title: 'キャンペーン契約はトライアルを30日にして', description: 'キャンペーン経由の契約だけ、トライアル期間を30日に延ばしたい', responsibility: 'trial', linesPerSite: 4, partName: 'applyCampaignTrial' },
  ],
  codebase: {
    files: [
      {
        id: 'file-billing-service',
        path: 'src/billing/BillingService.ts',
        classes: [
          {
            id: 'class-billing-service',
            name: 'BillingService',
            fields: [
              { id: 'field-payment-gateway', name: 'paymentGateway', visibility: 'private', description: '決済を処理するゲートウェイ', type: { csharp: 'IPaymentGateway' } },
              { id: 'field-mailer', name: 'mailer', visibility: 'private', description: 'メールを送信するサービス', type: { csharp: 'IMailer' } },
              { id: 'field-trial-days', name: 'trialDays', visibility: 'private', description: '無料試用期間の日数', type: { csharp: 'int' } },
            ],
            methods: [
              {
                id: 'method-renew-subscription',
                name: 'renewSubscription',
                visibility: 'public',
                fragments: [
                  {
                    id: 'frag-check-trial',
                    label: 'トライアル期間中なら請求しない',
                    lines: 12,
                    responsibility: 'trial',
                    reads: ['field-started-at', 'field-status', 'field-trial-days'],
                    suggestedName: 'isInTrial',
                  },
                  {
                    id: 'frag-calc-fee',
                    label: '解約済み・支払い停止中なら請求しない。それ以外は席数と単価から今月の請求額を計算する',
                    lines: 28,
                    responsibility: 'pricing',
                    reads: ['field-status', 'field-seats', 'field-unit-price'],
                    suggestedName: 'monthlyFee',
                  },
                  {
                    id: 'frag-charge-card',
                    label: '決済代行サービスでカードに請求する',
                    lines: 30,
                    responsibility: 'payment',
                    reads: ['field-payment-gateway'],
                    suggestedName: 'chargeCard',
                  },
                  {
                    id: 'frag-send-invoice-mail',
                    label: '請求書メールを送る',
                    lines: 22,
                    responsibility: 'notification',
                    reads: ['field-mailer'],
                    suggestedName: 'sendInvoiceMail',
                  },
                ],
              },
              {
                id: 'method-cancel-subscription',
                name: 'cancelSubscription',
                visibility: 'public',
                fragments: [
                  {
                    id: 'frag-check-cancelable',
                    label: '解約できる状態か確かめる',
                    lines: 10,
                    responsibility: 'cancellation',
                    reads: ['field-status', 'field-canceled-at'],
                    suggestedName: 'checkCancelable',
                  },
                  {
                    id: 'frag-mark-canceled',
                    label: '状態を解約済みにし、解約日を記録する',
                    lines: 6,
                    responsibility: 'cancellation',
                    writes: ['field-status', 'field-canceled-at'],
                    suggestedName: 'markCanceled',
                  },
                  {
                    id: 'frag-send-cancel-mail',
                    label: '解約の確認メールを送る',
                    lines: 18,
                    responsibility: 'notification',
                    reads: ['field-mailer'],
                    suggestedName: 'sendCancelMail',
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        id: 'file-subscription',
        path: 'src/billing/Subscription.ts',
        classes: [
          {
            id: 'class-subscription',
            name: 'Subscription',
            fields: [
              { id: 'field-status', name: 'status', visibility: 'public', description: '契約の状態', type: { csharp: 'string' } },
              { id: 'field-started-at', name: 'startedAt', visibility: 'public', description: '契約を開始した日時', type: { csharp: 'DateTime' } },
              { id: 'field-seats', name: 'seats', visibility: 'public', description: '契約中の座席数', type: { csharp: 'int' } },
              { id: 'field-unit-price', name: 'unitPrice', visibility: 'public', description: '座席あたりの料金', type: { csharp: 'decimal' } },
              { id: 'field-canceled-at', name: 'canceledAt', visibility: 'public', description: '解約した日時', type: { csharp: 'DateTime?' } },
            ],
            methods: [],
          },
        ],
      },
    ],
  },
};

/**
 * 中級7: Account はフィールドがすべて private で、getter/setter だけを public に公開している(貧血ドメインモデル)。
 * 中級6は public フィールドを外から触る形だったが、こちらは getter で取り出して判断し、setter で書き戻す形で同じことをしている。
 * アクセサ越しのアクセスも Feature Envy・カプセル化の破れに数え、visibilityEnforced で「移したメソッドを public にする」必要を見せる。
 */
const anemicDomainModelStage: Stage = {
  id: 'intermediate-anemic-domain-model',
  level: 'intermediate',
  title: '中級7: getter/setter だけの口座クラス',
  learns: ['貧血ドメインモデル', 'カプセル化'],
  checks: [
    {
      id: 'check-1',
      question: 'getter で取り出して判断し、setter で書き戻す形は、なぜ「public フィールドと同じ」と言われる?',
      choices: [
        { text: 'getter と setter は処理が遅いから', explanation: '速度の問題ではありません。' },
        { text: '名前が長くなるから', explanation: '名前の長さの問題ではありません。' },
        { text: '口座のルール(残高不足の確認など)を外が自由に迂回でき、ルールを Account が守れないから', explanation: '正解です。外が自由に値を書き換えられると、不変条件を守る役割がクラスにありません。' },
      ],
      answer: 2,
    },
    {
      id: 'check-2',
      question: '引き出しのルールを Account に持たせる利点は?',
      choices: [
        { text: '残高に関する判断が1か所にまとまり、ルール変更のときに Account だけを見れば済む', explanation: '正解です。データと判断が一緒にあれば、変更の確認先が絞れます。' },
        { text: 'サービスクラスが不要になり、すべてのクラスを削除できる', explanation: 'サービスの役割は残ります。振る舞いをあるべき場所に置くだけです。' },
        { text: 'getter が使えるようになる', explanation: 'getter は元から使えます。ルールの置き場所の話です。' },
      ],
      answer: 0,
    },
  ],
  /** 100点になったときに見せる、この題材で分ける理由。 */
  why: '注文ルールを変えると、データだけの注文クラスと判断を担うサービスの両方を行き来します。注文に関する判断がまとまれば、ルール変更の確認先を絞れます。',
  description:
    'ネット銀行の口座(Account)。フィールドはすべて private で、getBalance / setBalance のような getter と setter が並んでいるので、一見カプセル化できているように見える。' +
    'しかし、凍結中かどうかの確認も、残高と1日の引き出し上限のチェックも、残高の更新も、すべて AccountService が getter で値を取り出して判断し、setter で書き戻している。',
  goal:
    'getter で取り出して判断し、setter で書き戻すのは、public フィールドを外から触るのと同じ。口座のルールは Account に任せよう(Tell, Don\'t Ask)。' +
    'ルールの処理を Extract Method して Account へ移し、外から呼ぶメソッドは public に、もう外から使わない setter は private にしよう(メソッドエディタの「可視性」)。' +
    'メソッドは60行以内、依存先は1クラスまで',
  limits: { method: 60, class: 150, file: 300 },
  dependencyLimit: 1,
  responsibilityLimit: 5,
  visibilityEnforced: true,
  changeRequests: [
    { id: 'req-premium-daily-limit', title: 'プレミアム会員は1日の引き出し上限を上げて', description: 'プレミアム会員だけ、1日に引き出せる上限額を100万円にしたい', responsibility: 'withdrawal-limit', linesPerSite: 6, partName: 'raisePremiumDailyLimit' },
    { id: 'req-deposit-while-frozen', title: '凍結中でも入金だけは受け付けて', description: '口座が凍結されていても、入金(給与の振込など)は受け付けるようにしたい', responsibility: 'account-status', linesPerSite: 4, partName: 'allowDepositWhileFrozen' },
  ],
  codebase: {
    files: [
      {
        id: 'file-account',
        path: 'src/account/Account.ts',
        classes: [
          {
            id: 'class-account',
            name: 'Account',
            fields: [
              { id: 'field-balance', name: 'balance', visibility: 'private', description: '口座の現在残高', type: { csharp: 'decimal' } },
              { id: 'field-status', name: 'status', visibility: 'private', description: '口座の状態', type: { csharp: 'string' } },
              { id: 'field-daily-withdrawn', name: 'dailyWithdrawn', visibility: 'private', description: '本日の引き出し合計', type: { csharp: 'decimal' } },
            ],
            methods: [
              {
                id: 'method-get-balance',
                name: 'getBalance',
                visibility: 'public',
                fragments: [{ id: 'frag-get-balance', label: '残高を返す', lines: 3, responsibility: 'accessor', reads: ['field-balance'], accessor: true }],
              },
              {
                id: 'method-set-balance',
                name: 'setBalance',
                visibility: 'public',
                fragments: [{ id: 'frag-set-balance', label: '残高を書き換える', lines: 3, responsibility: 'accessor', writes: ['field-balance'], accessor: true }],
              },
              {
                id: 'method-get-status',
                name: 'getStatus',
                visibility: 'public',
                fragments: [{ id: 'frag-get-status', label: '口座の状態を返す', lines: 3, responsibility: 'accessor', reads: ['field-status'], accessor: true }],
              },
              {
                id: 'method-get-daily-withdrawn',
                name: 'getDailyWithdrawn',
                visibility: 'public',
                fragments: [{ id: 'frag-get-daily-withdrawn', label: '本日の引き出し額を返す', lines: 3, responsibility: 'accessor', reads: ['field-daily-withdrawn'], accessor: true }],
              },
              {
                id: 'method-set-daily-withdrawn',
                name: 'setDailyWithdrawn',
                visibility: 'public',
                fragments: [{ id: 'frag-set-daily-withdrawn', label: '本日の引き出し額を書き換える', lines: 3, responsibility: 'accessor', writes: ['field-daily-withdrawn'], accessor: true }],
              },
            ],
          },
        ],
      },
      {
        id: 'file-account-service',
        path: 'src/account/AccountService.ts',
        classes: [
          {
            id: 'class-account-service',
            name: 'AccountService',
            fields: [
              { id: 'field-transaction-log', name: 'transactionLog', visibility: 'private', description: '取引を記録するログ', type: { csharp: 'ITransactionLog' } },
              { id: 'field-notifier', name: 'notifier', visibility: 'private', description: '通知を送るサービス', type: { csharp: 'INotifier' } },
            ],
            methods: [
              {
                id: 'method-withdraw',
                name: 'withdraw',
                visibility: 'public',
                fragments: [
                  {
                    id: 'frag-withdraw-check-status',
                    label: 'getStatus() で状態を取り出し、凍結されていないか確かめる',
                    lines: 8,
                    responsibility: 'account-status',
                    uses: ['method-get-status'],
                    suggestedName: 'checkNotFrozen',
                  },
                  {
                    id: 'frag-check-withdrawable',
                    label: '残高と1日の引き出し上限から引き出せるか確かめる',
                    lines: 18,
                    responsibility: 'withdrawal-limit',
                    uses: ['method-get-balance', 'method-get-daily-withdrawn'],
                    suggestedName: 'checkWithdrawable',
                  },
                  {
                    id: 'frag-debit-balance',
                    label: '残高を減らし、本日の引き出し額を足して setter で書き戻す',
                    lines: 8,
                    responsibility: 'balance',
                    uses: ['method-get-balance', 'method-set-balance', 'method-get-daily-withdrawn', 'method-set-daily-withdrawn'],
                    suggestedName: 'debitBalance',
                  },
                  {
                    id: 'frag-withdraw-log',
                    label: '取引履歴に記録する',
                    lines: 24,
                    responsibility: 'history',
                    reads: ['field-transaction-log'],
                    suggestedName: 'logWithdrawal',
                  },
                  {
                    id: 'frag-withdraw-notify',
                    label: '引き出し後の残高をメールで知らせる',
                    lines: 22,
                    responsibility: 'notification',
                    reads: ['field-notifier'],
                    uses: ['method-get-balance'],
                    suggestedName: 'notifyWithdrawal',
                  },
                ],
              },
              {
                id: 'method-deposit',
                name: 'deposit',
                visibility: 'public',
                fragments: [
                  {
                    id: 'frag-deposit-check-status',
                    label: 'getStatus() で状態を取り出し、凍結されていないか確かめる',
                    lines: 8,
                    responsibility: 'account-status',
                    uses: ['method-get-status'],
                    suggestedName: 'checkNotFrozenForDeposit',
                  },
                  {
                    id: 'frag-credit-balance',
                    label: '残高を増やして setBalance() で書き戻す',
                    lines: 6,
                    responsibility: 'balance',
                    uses: ['method-get-balance', 'method-set-balance'],
                    suggestedName: 'creditBalance',
                  },
                  {
                    id: 'frag-deposit-log',
                    label: '取引履歴に記録する',
                    lines: 20,
                    responsibility: 'history',
                    reads: ['field-transaction-log'],
                    suggestedName: 'logDeposit',
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

/**
 * 中級8: 中級6・7はデータの持ち主へ処理を寄せる話だったが、こちらは1クラスの中のデータの塊ごとにクラスを分ける話(Extract Class)。
 * Employee が給与(baseSalary・overtimeRate・bankAccount)と住所(postalCode・prefecture・addressLine)という
 * 互いに使わないフィールドの塊を抱えており、凝集度(cohesion)で検出できる。responsibilityLimit を4にして二重に減点しない。
 */
const extractClassStage: Stage = {
  id: 'intermediate-extract-class',
  level: 'intermediate',
  title: '中級8: 給与と住所を抱えた社員クラス',
  learns: ['Extract Class', '責務の分離'],
  checks: [
    {
      id: 'check-1',
      question: '給与と住所を別クラスに分けるとき、何を手がかりに分ける?',
      choices: [
        { text: 'メソッドの行数が同じものを集める', explanation: '行数が同じかどうかは、責務の違いを表しません。' },
        { text: 'メソッドが一緒に使うフィールドの塊を手がかりに、役割ごとに分ける', explanation: '正解です。同じデータを使う処理は同じ役割なので、塊ごとにクラスにすると凝集度が高まります。' },
        { text: 'アルファベット順に並べて半分に割る', explanation: '順序では、役割の違いは分かりません。' },
      ],
      answer: 1,
    },
    {
      id: 'check-2',
      question: '1つのクラスに別々の理由で変わる処理が集まると、何が困る?',
      choices: [
        { text: 'クラスの名前が決まらない', explanation: '名前の話ではなく、変更の影響範囲の話です。' },
        { text: 'コンパイルに時間がかかる', explanation: 'ビルド時間は問題の本質ではありません。' },
        { text: '給与のルール変更の影響を、住所の処理まで気にしながら確認することになる', explanation: '正解です。別々の理由で変わる処理が同居すると、片方の変更でもクラス全体を気にする必要があります。' },
      ],
      answer: 2,
    },
  ],
  /** 100点になったときに見せる、この題材で分ける理由。 */
  why: '一つのクラスに別々の理由で変わる処理が集まると、片方の変更でも全体の長さや関連を気にします。まとまりを分ければ、それぞれの変更を独立して追えます。',
  description:
    '人事システムの社員(Employee)クラス。基本給・残業単価・振込口座を使う給与計算のメソッドと、郵便番号・都道府県・番地を使う住所のメソッドが同居している。' +
    '給与のメソッドは住所のフィールドを一切使わず、住所のメソッドも給与のフィールドを一切使わない。住所の書式を直すたびに、給与計算の入った大きなクラスを開くことになっている。',
  goal:
    'メソッドがどのフィールドを使っているかを見て、一緒に使われるフィールドとメソッドの塊ごとにクラスを分けよう(Extract Class)。' +
    '新しいクラスを作り、フィールドは Move Field、メソッドは Move Method で移す。メソッドは60行・クラスは120行以内',
  limits: { method: 60, class: 120, file: 300 },
  dependencyLimit: 1,
  responsibilityLimit: 4,
  changeRequests: [
    { id: 'req-building-name', title: '住所に建物名・部屋番号の欄を足して', description: '源泉徴収票の郵送が届かないことがあるので、建物名と部屋番号も持てるようにしたい', responsibility: 'address', linesPerSite: 6, partName: 'addBuildingName' },
    { id: 'req-late-night-overtime', title: '深夜残業の割増率を上げて', description: '22時以降の残業は、割増率を50%で計算したい', responsibility: 'payroll', linesPerSite: 8, partName: 'applyLateNightPremium' },
  ],
  codebase: {
    files: [
      {
        id: 'file-employee',
        path: 'src/hr/Employee.ts',
        classes: [
          {
            id: 'class-employee',
            name: 'Employee',
            fields: [
              { id: 'field-base-salary', name: 'baseSalary', visibility: 'private', description: '基本給(月額)', type: { csharp: 'decimal' } },
              { id: 'field-overtime-rate', name: 'overtimeRate', visibility: 'private', description: '時間外勤務の時給', type: { csharp: 'decimal' } },
              { id: 'field-bank-account', name: 'bankAccount', visibility: 'private', description: '給与の振込先口座', type: { csharp: 'BankAccount' } },
              { id: 'field-postal-code', name: 'postalCode', visibility: 'private', description: '住所の郵便番号', type: { csharp: 'string' } },
              { id: 'field-prefecture', name: 'prefecture', visibility: 'private', description: '住所の都道府県', type: { csharp: 'string' } },
              { id: 'field-address-line', name: 'addressLine', visibility: 'private', description: '住所の町名・番地', type: { csharp: 'string' } },
            ],
            methods: [
              {
                id: 'method-calculate-monthly-pay',
                name: 'calculateMonthlyPay',
                visibility: 'public',
                fragments: [
                  {
                    id: 'frag-overtime-pay',
                    label: '残業時間と残業単価から残業代を計算する',
                    lines: 26,
                    responsibility: 'payroll',
                    reads: ['field-base-salary', 'field-overtime-rate'],
                    suggestedName: 'calculateOvertimePay',
                  },
                  {
                    id: 'frag-withholding',
                    label: '所得税と社会保険料を差し引く',
                    lines: 32,
                    responsibility: 'withholding',
                    reads: ['field-base-salary'],
                    suggestedName: 'withholdTaxes',
                  },
                  {
                    id: 'frag-pay-transfer',
                    label: '給与の振込データを作る',
                    lines: 24,
                    responsibility: 'transfer',
                    reads: ['field-bank-account'],
                    suggestedName: 'buildTransferData',
                  },
                ],
              },
              {
                id: 'method-format-mailing-address',
                name: 'formatMailingAddress',
                visibility: 'public',
                fragments: [
                  {
                    id: 'frag-format-address',
                    label: '郵便番号・都道府県・番地を宛名ラベルの形に整える',
                    lines: 22,
                    responsibility: 'address',
                    reads: ['field-postal-code', 'field-prefecture', 'field-address-line'],
                    suggestedName: 'formatLabel',
                  },
                ],
              },
              {
                id: 'method-change-address',
                name: 'changeAddress',
                visibility: 'public',
                fragments: [
                  {
                    id: 'frag-validate-postal-code',
                    label: '郵便番号の形式を確かめる',
                    lines: 12,
                    responsibility: 'address',
                    reads: ['field-postal-code'],
                    suggestedName: 'validatePostalCode',
                  },
                  {
                    id: 'frag-update-address',
                    label: '住所を書き換える',
                    lines: 8,
                    responsibility: 'address',
                    writes: ['field-postal-code', 'field-prefecture', 'field-address-line'],
                    suggestedName: 'updateAddress',
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

/**
 * 中級9: 注文・請求・見積の3クラスに、ほぼ同じ「消費税を計算する」処理がコピペされている。
 * 中級4(変わる場所の切り分け)と違い、コピペの重複をまとめる理由(直し忘れ)が主題。
 * Extract Method → 統合(Merge Methods)→ TaxCalculator へ移動、の既存の操作だけで解ける。
 */
const copyPasteTaxStage: Stage = {
  id: 'intermediate-copy-paste-tax',
  level: 'intermediate',
  title: '中級9: コピペされた消費税計算を1か所にまとめる',
  learns: ['重複の排除', 'Merge Methods'],
  checks: [
    {
      id: 'check-1',
      question: '消費税の計算が3か所にコピペされていると、どんな点が危ない?',
      choices: [
        { text: '税率が変わったとき、1か所でも直し忘れると請求額が食い違うから', explanation: '正解です。同じ知識が散らばっていると、変更の漏れがバグにつながります。' },
        { text: 'コードが長いので読むのに時間がかかるから', explanation: '行数だけの問題ではなく、変更時の直し忘れがより深刻です。' },
        { text: 'コピペは文法上エラーになるから', explanation: '文法上の問題はありません。保守性の問題です。' },
      ],
      answer: 0,
    },
    {
      id: 'check-2',
      question: '似た処理を1つにまとめるとき、まとめ先のクラスにはどんな基準で置く?',
      choices: [
        { text: 'いちばん行数が多いクラスに置く', explanation: '行数はまとめ先の基準になりません。' },
        { text: '最初に見つけたクラスに置く', explanation: '見つけた順は関係なく、役割に合う場所にします。' },
        { text: 'その知識(税の計算)を担当する役割のクラスに置く', explanation: '正解です。知識の持ち主を1つに決めると、変更は持ち主だけで済みます。' },
      ],
      answer: 2,
    },
  ],
  /** 100点になったときに見せる、この題材で分ける理由。 */
  why: '税率が変わるたびに3か所を同じように直す必要があり、1か所でも直し忘れると請求額が合わなくなります。1か所にまとめれば、直すのは1か所だけで、直し忘れが起きません。',
  description:
    '販売システムの注文確定(OrderService.confirm)・請求書発行(InvoiceService.issue)・見積作成(QuoteService.create)。' +
    'どのメソッドにも、ほぼ同じ「消費税を計算する」処理がコピペされていて、注文・請求・見積それぞれの処理と同居している。' +
    '空のクラス TaxCalculator は用意されているが、まだどこからも使われていない。',
  goal: '消費税の計算が3か所にコピペされています。1か所にまとめて、変更に強くしよう。Extract Methodで取り出し、似た処理を持つメソッドを統合して TaxCalculator へ移す。メソッドは70行以内、1クラスの責務は1種類まで',
  limits: { method: 70, class: 100, file: 300 },
  dependencyLimit: 1,
  responsibilityLimit: 1,
  changeRequests: [
    { id: 'req-reduced-tax-rate', title: '軽減税率8%に対応して', description: '飲食料品は消費税を8%で計算するようにしたい。', responsibility: 'tax', linesPerSite: 8, partName: 'applyReducedTaxRate' },
    { id: 'req-order-stock-check', title: '在庫確認のルールを見直して', description: '注文確定のとき、予約在庫も数に入れて確かめたい。', responsibility: 'ordering', linesPerSite: 6, partName: 'countReservedStock' },
  ],
  codebase: {
    files: [
      {
        id: 'file-order-service',
        path: 'src/sales/OrderService.ts',
        classes: [
          {
            id: 'class-order-service',
            name: 'OrderService',
            methods: [
              {
                id: 'method-confirm-order',
                name: 'confirm',
                visibility: 'public',
                fragments: [
                  { id: 'frag-order-check', label: '在庫と注文内容を確かめる', lines: 30, responsibility: 'ordering', suggestedName: 'checkOrder' },
                  { id: 'frag-order-tax', label: '消費税を計算する', lines: 24, responsibility: 'tax', suggestedName: 'calculateOrderTax', duplicateGroup: 'tax-calc' },
                  { id: 'frag-order-save', label: '注文を確定して保存する', lines: 30, responsibility: 'ordering', suggestedName: 'saveOrder' },
                ],
              },
            ],
          },
        ],
      },
      {
        id: 'file-invoice-service',
        path: 'src/sales/InvoiceService.ts',
        classes: [
          {
            id: 'class-invoice-service',
            name: 'InvoiceService',
            methods: [
              {
                id: 'method-issue-invoice',
                name: 'issue',
                visibility: 'public',
                fragments: [
                  { id: 'frag-invoice-build', label: '請求明細を組み立てる', lines: 32, responsibility: 'invoicing', suggestedName: 'buildInvoiceLines' },
                  { id: 'frag-invoice-tax', label: '消費税を計算する', lines: 26, responsibility: 'tax', suggestedName: 'calculateInvoiceTax', duplicateGroup: 'tax-calc' },
                  { id: 'frag-invoice-issue', label: '請求書を発行して送る', lines: 28, responsibility: 'invoicing', suggestedName: 'issueInvoice' },
                ],
              },
            ],
          },
        ],
      },
      {
        id: 'file-quote-service',
        path: 'src/sales/QuoteService.ts',
        classes: [
          {
            id: 'class-quote-service',
            name: 'QuoteService',
            methods: [
              {
                id: 'method-create-quote',
                name: 'create',
                visibility: 'public',
                fragments: [
                  { id: 'frag-quote-estimate', label: '見積項目を集計する', lines: 34, responsibility: 'quoting', suggestedName: 'estimateItems' },
                  { id: 'frag-quote-tax', label: '消費税を計算する', lines: 25, responsibility: 'tax', suggestedName: 'calculateQuoteTax', duplicateGroup: 'tax-calc' },
                  { id: 'frag-quote-save', label: '見積書を作って保存する', lines: 26, responsibility: 'quoting', suggestedName: 'saveQuote' },
                ],
              },
            ],
          },
        ],
      },
      {
        id: 'file-tax-calculator',
        path: 'src/sales/TaxCalculator.ts',
        classes: [{ id: 'class-tax-calculator', name: 'TaxCalculator', methods: [] }],
      },
    ],
  },
};

/**
 * 中級10: 会員ランク(通常/プレミアム/VIP)ごとのif分岐が、価格(PriceCalculator)と送料(ShippingCalculator)の2クラスに散らばっている。
 * 契約だけを持つ MemberRank は用意されていて、CheckoutService が呼んでいるが、どのクラスとも実装関係で結ばれていない。
 * ランクごとのクラスに集めて MemberRank を実装すると、ランクの追加が「新しいクラス1つ」で済むことが体験できる(オブジェクト指向の入口)。
 * 上級3(割引のStrategy、受け皿は1メソッド)と違い、1クラスが価格と送料の2メソッドを持つ。既存の操作だけで解ける。
 */
const memberRankBranchingStage: Stage = {
  id: 'intermediate-member-rank-branching',
  level: 'intermediate',
  title: '中級10: 会員ランクごとのif分岐をクラスに分ける',
  learns: ['分岐の分離', '継承'],
  checks: [
    {
      id: 'check-1',
      question: '会員ランクごとの if 分岐を、ランクごとのクラスに分けるのは、どんな変更に効く?',
      choices: [
        { text: 'ランクの追加で、価格と送料の両方の分岐を探して直さずに、新しいクラスを足すだけで済む', explanation: '正解です。新しい種類を足すとき、既存のコードを書き換えずに済み、壊す心配が減ります。' },
        { text: '価格の計算式そのものが変わるとき', explanation: '式の変更は、分岐のクラス化とは別の問題です。' },
        { text: 'ランクが一生増えないとき', explanation: '増えない場合は、分けるほどのメリットは小さくなります。' },
      ],
      answer: 0,
    },
    {
      id: 'check-2',
      question: 'この分け方がやりすぎになるのは、どんなとき?',
      choices: [
        { text: 'ランクが常に増え続けるとき', explanation: '増え続けるなら、むしろこの分け方が効きます。' },
        { text: 'ランクが2つしかなく、今後も増えず、分岐も短いとき', explanation: '正解です。変更の見込みが無いなら、クラスを増やすより if のほうが単純で読みやすいことがあります。' },
        { text: '価格と送料の両方で分岐があるとき', explanation: '両方で分岐があるなら、まとめて分ける利点が大きいです。' },
      ],
      answer: 1,
    },
  ],
  /** 100点になったときに見せる、この題材で分ける理由。 */
  why: '会員ランクが増えるたびに、価格と送料の2つのクラスを開いて分岐を足していました。ランクごとのクラスにしたので、新しいランクはクラスを1つ足すだけで済み、既存のコードを壊す心配がありません。',
  description:
    '価格を決める PriceCalculator.quotePrice と、送料を決める ShippingCalculator.quoteShipping が、' +
    '会員ランク(通常/プレミアム/VIP)ごとのif分岐を、それぞれ持っている。新しいランクが増えるたびに、2つのクラスを開いて分岐を足すことになる。' +
    '価格と送料の契約だけを持つ MemberRank は用意され、CheckoutService が呼んでいるが、まだどのクラスとも実装関係で結ばれていない。',
  goal:
    '会員ランクごとの分岐を、ランクごとの新しいクラス(RegularRank/PremiumRank/VipRank)に集めよう。Extract Methodで分岐を calculatePrice / calculateShipping として取り出し、Move Methodでランクのクラスへ移す。' +
    '1つのクラスが価格と送料の両方を持つ。3クラスとも MemberRank を実装(implements)すると、新しいランクはクラスを足すだけで済む。メソッドは40行以内、クラスは70行以内',
  limits: { method: 40, class: 70, file: 100 },
  // 模範解答では、価格・送料の両方がランクごとの3クラスを呼ぶ。結合度の改善はこのステージの狙いではない。
  dependencyLimit: 3,
  responsibilityLimit: 3,
  changeRequests: [
    { id: 'req-add-gold-rank', title: 'ゴールド会員を追加して', description: '新しい会員ランク「ゴールド」を追加したい。価格も送料もゴールド用の計算にする。', responsibility: 'rank-gold', linesPerSite: 12, kind: 'extend', partName: 'applyGoldRank' },
    { id: 'req-premium-shipping', title: 'プレミアムの送料を変えて', description: 'プレミアム会員の送料を、一律500円に変えたい。', responsibility: 'shipping-premium', linesPerSite: 4, partName: 'revisePremiumShipping' },
  ],
  codebase: {
    files: [
      {
        id: 'file-price-calculator',
        path: 'src/membership/PriceCalculator.ts',
        classes: [
          {
            id: 'class-price-calculator',
            name: 'PriceCalculator',
            methods: [
              {
                id: 'method-quote-price',
                name: 'quotePrice',
                visibility: 'public',
                fragments: [
                  { id: 'frag-price-regular', label: '会員ランクが「通常」なら、定価で計算する', lines: 30, responsibility: 'price-regular', suggestedName: 'calculatePrice' },
                  { id: 'frag-price-premium', label: '会員ランクが「プレミアム」なら、10%引きで計算する', lines: 32, responsibility: 'price-premium', suggestedName: 'calculatePrice' },
                  { id: 'frag-price-vip', label: '会員ランクが「VIP」なら、20%引きで計算する', lines: 34, responsibility: 'price-vip', suggestedName: 'calculatePrice' },
                ],
              },
            ],
          },
        ],
      },
      {
        id: 'file-shipping-calculator',
        path: 'src/membership/ShippingCalculator.ts',
        classes: [
          {
            id: 'class-shipping-calculator',
            name: 'ShippingCalculator',
            methods: [
              {
                id: 'method-quote-shipping',
                name: 'quoteShipping',
                visibility: 'public',
                fragments: [
                  { id: 'frag-shipping-regular', label: '会員ランクが「通常」なら、送料を全額かける', lines: 22, responsibility: 'shipping-regular', suggestedName: 'calculateShipping' },
                  { id: 'frag-shipping-premium', label: '会員ランクが「プレミアム」なら、送料を半額にする', lines: 24, responsibility: 'shipping-premium', suggestedName: 'calculateShipping' },
                  { id: 'frag-shipping-vip', label: '会員ランクが「VIP」なら、送料を無料にする', lines: 26, responsibility: 'shipping-vip', suggestedName: 'calculateShipping' },
                ],
              },
            ],
          },
        ],
      },
      {
        id: 'file-checkout-service',
        path: 'src/membership/CheckoutService.ts',
        classes: [
          {
            id: 'class-checkout-service',
            name: 'CheckoutService',
            methods: [
              {
                id: 'method-checkout',
                name: 'checkout',
                visibility: 'public',
                fragments: [
                  { id: 'frag-checkout-validate', label: '注文内容を検証する', lines: 10, responsibility: 'validation', suggestedName: 'validateOrder' },
                  { id: 'frag-checkout-rank', label: 'MemberRank(インターフェース)経由で価格と送料を求める', lines: 12, responsibility: 'pricing', uses: ['method-member-rank-price', 'method-member-rank-shipping'], suggestedName: 'priceOrder' },
                  { id: 'frag-checkout-save', label: '注文を確定して保存する', lines: 10, responsibility: 'ordering', suggestedName: 'saveOrder' },
                ],
              },
            ],
          },
        ],
      },
      {
        id: 'file-member-rank',
        path: 'src/membership/MemberRank.ts',
        classes: [
          {
            id: 'class-member-rank',
            name: 'MemberRank',
            methods: [
              { id: 'method-member-rank-price', name: 'calculatePrice', visibility: 'public', fragments: [] },
              { id: 'method-member-rank-shipping', name: 'calculateShipping', visibility: 'public', fragments: [] },
            ],
          },
        ],
      },
    ],
  },
};

/**
 * 中級11: OrderController に、リクエストの検証(http)・在庫と金額のルール(order-rule)・DB保存(persistence)が同居している。
 * Controller → Service → Repository の一方通行に分ける。保存だけを Repository へ移して Controller から直接呼ぶと、層を飛ばして減点される。
 * 層はファイルのパスではなく、処理の責務から決める。既存の操作(Extract Method / Move Method)だけで解ける。
 */
const layeredOrderApiStage: Stage = {
  id: 'intermediate-layered-order-api',
  level: 'intermediate',
  title: '中級11: Controller に全部書いてある注文API',
  learns: ['層(Controller/Service/Repository)', '依存の向き'],
  checks: [
    {
      id: 'check-1',
      question: 'Controller から Repository を直接呼ぶ形が、避けたほうがよいと言われるのはなぜ?',
      choices: [
        { text: 'Controller が保存の細かい事情を知ることになり、業務ルールを挟む場所もなくなるから', explanation: '正解です。間に Service がないと、ルールが Controller に染み出し、保存の変更も受け口に響きます。' },
        { text: 'Repository のメソッドは Controller から呼べない決まりだから', explanation: '技術的には呼べます。問題は、層の役割が崩れて変更が広がることです。' },
        { text: 'クラスの数が増えて遅くなるから', explanation: '層の分け方は速度の話ではなく、変更しやすさの話です。' },
      ],
      answer: 0,
    },
    {
      id: 'check-2',
      question: '「保存先をDBから外部APIに変える」とき、層が分かれていると何が嬉しい?',
      choices: [
        { text: 'どの層も、全部同時に直せば済む', explanation: '全部を同時に直す必要がある状態が、分けていないコードの困りごとです。' },
        { text: 'Controller と Service を直さずに、Repository だけを直せばよい', explanation: '正解です。下の層の事情は、1つ上の層までしか知られていないので、変更が閉じ込められます。' },
        { text: 'Repository は変更しなくてよくなる', explanation: '保存先の変更は、まさに Repository が受け持つ変更です。' },
      ],
      answer: 1,
    },
    {
      id: 'check-3',
      question: 'Repository が Service のメソッドを呼ぶ(下から上を呼ぶ)形の問題は?',
      choices: [
        { text: '呼び出しが1回増えるだけで、問題はない', explanation: '回数ではなく、依存の向きが問題です。' },
        { text: 'Service が private になってしまう', explanation: '可視性とは関係がありません。' },
        { text: '上の層を変えると下の層まで壊れ、層を別々に変えられなくなる', explanation: '正解です。依存は上から下への一方通行にすると、下の層を単独でテストしたり差し替えたりできます。' },
      ],
      answer: 2,
    },
  ],
  /** 100点になったときに見せる、この題材で分ける理由。 */
  why: '保存先の変更や送料のルール変更のたびに、Controller の長いメソッドを読み解いて直すことになります。層ごとに分けると、保存先の変更は Repository だけ、ルールの変更は Service だけで済みます。',
  description:
    '注文APIの OrderController。placeOrder(注文する)と cancelOrder(キャンセルする)の中に、リクエストの検証・レスポンスの組み立て(http)、' +
    '在庫の確認や金額の計算などの業務ルール(order-rule)、注文や在庫のDB保存(persistence)がすべて書かれている。' +
    '空のクラス OrderService と OrderRepository は用意されているが、まだ使われていない。',
  goal: 'Controller に何でも書いてあります。業務ルールは OrderService へ、保存は OrderRepository へ移し、Controller → Service → Repository の一方通行にしよう。Controller から Repository を直接呼ぶのは層を飛ばす形。メソッドは50行以内、1クラスの責務は1種類まで',
  limits: { method: 50, class: 100, file: 300 },
  dependencyLimit: 1,
  responsibilityLimit: 1,
  layers: [
    { name: 'Controller', responsibilities: ['http'] },
    { name: 'Service', responsibilities: ['order-rule'] },
    { name: 'Repository', responsibilities: ['persistence'] },
  ],
  changeRequests: [
    { id: 'req-external-storage', title: '保存先をDBから外部APIに変えて', description: '注文の保存先を、自社DBから外部の注文管理APIに切り替えることになった。', responsibility: 'persistence', linesPerSite: 10, partName: 'switchToExternalApi' },
    { id: 'req-free-shipping', title: '送料無料の条件を変えて', description: '送料無料になる条件を、合計5,000円以上から3,000円以上に下げたい。', responsibility: 'order-rule', linesPerSite: 6, partName: 'reviseFreeShippingRule' },
  ],
  codebase: {
    files: [
      {
        id: 'file-order-controller',
        path: 'src/order/OrderController.ts',
        classes: [
          {
            id: 'class-order-controller',
            name: 'OrderController',
            methods: [
              {
                id: 'method-place-order',
                name: 'placeOrder',
                visibility: 'public',
                fragments: [
                  { id: 'frag-place-parse', label: 'リクエストを検証する', lines: 14, responsibility: 'http', suggestedName: 'parsePlaceRequest' },
                  { id: 'frag-place-stock', label: '在庫を確認する', lines: 18, responsibility: 'order-rule', suggestedName: 'checkStock' },
                  { id: 'frag-place-price', label: '送料込みの金額を計算する', lines: 22, responsibility: 'order-rule', suggestedName: 'calculateTotal' },
                  { id: 'frag-place-save', label: '注文を保存して在庫を減らす', lines: 18, responsibility: 'persistence', suggestedName: 'saveOrder' },
                  { id: 'frag-place-respond', label: 'レスポンスを組み立てる', lines: 14, responsibility: 'http', suggestedName: 'buildPlaceResponse' },
                ],
              },
              {
                id: 'method-cancel-order',
                name: 'cancelOrder',
                visibility: 'public',
                fragments: [
                  { id: 'frag-cancel-parse', label: 'リクエストを検証する', lines: 10, responsibility: 'http', suggestedName: 'parseCancelRequest' },
                  { id: 'frag-cancel-rule', label: 'キャンセルできるか判定し、返金額を計算する', lines: 20, responsibility: 'order-rule', suggestedName: 'judgeCancel' },
                  { id: 'frag-cancel-save', label: 'キャンセルを保存して在庫を戻す', lines: 18, responsibility: 'persistence', suggestedName: 'saveCancellation' },
                  { id: 'frag-cancel-respond', label: 'レスポンスを組み立てる', lines: 10, responsibility: 'http', suggestedName: 'buildCancelResponse' },
                ],
              },
            ],
          },
        ],
      },
      {
        id: 'file-order-service',
        path: 'src/order/OrderService.ts',
        classes: [{ id: 'class-order-service', name: 'OrderService', methods: [] }],
      },
      {
        id: 'file-order-repository',
        path: 'src/order/OrderRepository.ts',
        classes: [{ id: 'class-order-repository', name: 'OrderRepository', methods: [] }],
      },
    ],
  },
};

export const intermediateStages: readonly Stage[] = [
  cyclicDependencyStage,
  godFileStage,
  misplacedPrivateStage,
  volatileTaxStage,
  volatileFormatStage,
  featureEnvyStage,
  anemicDomainModelStage,
  extractClassStage,
  copyPasteTaxStage,
  memberRankBranchingStage,
  layeredOrderApiStage,
];
