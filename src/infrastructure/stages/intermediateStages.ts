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
  description:
    '注文(Order)と顧客(Customer)のクラス。注文の合計金額を求めるメソッドが Customer に、顧客の過去の注文数を数えるメソッドが Order に置かれているせいで、2つのクラスがお互いを呼び合っている。',
  goal: '赤い矢印(循環依存)をなくそう。メソッドが本来いるべきクラスはどこ? メソッドは50行以内、1クラスの責務は4種類まで',
  limits: { method: 50, class: 200, file: 300 },
  dependencyLimit: 2,
  responsibilityLimit: 4,
  changeRequests: [
    { id: 'req-price-rule', title: '価格の計算ルールを変えて', description: 'セール期間中は、明細の小計に期間限定の値引きを反映したい。', responsibility: 'pricing', linesPerSite: 8 },
    { id: 'req-member-discount', title: '会員割引の条件を変えて', description: '会員ランクごとの割引率を見直すことになった。', responsibility: 'discount', linesPerSite: 6 },
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
  title: '中級2: 何でも入った services.ts',
  description:
    'カート(CartService)・配送(ShippingService)・ポイント(PointService)の3クラスが、1つのファイル services.ts に同居している。しかも CartService が、送料の計算とポイントの付与を private メソッドとして抱え込んでいる。',
  goal: 'ファイルは300行、クラスは180行以内、1クラスの責務は2種類まで。メソッドを持ち主へ返し、「ファイルを追加」してクラスを移そう',
  limits: { method: 100, class: 180, file: 300 },
  dependencyLimit: 2,
  responsibilityLimit: 2,
  changeRequests: [
    { id: 'req-shipping-rule', title: '送料のルールを変えて', description: '離島への配送に追加料金がかかるようになった。', responsibility: 'shipping', linesPerSite: 8 },
    { id: 'req-points-rule', title: 'ポイントのルールを変えて', description: 'ポイントの有効期限を1年から2年に延ばし、付与も見直す。', responsibility: 'points', linesPerSite: 6 },
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
 */
const misplacedPrivateStage: Stage = {
  id: 'intermediate-misplaced-private',
  level: 'intermediate',
  title: '中級3: 越境する private メソッド',
  description:
    '配送完了を知らせる NotificationService。通知メールの文面を組み立てる処理の中で、実は TemplateEngine クラスに private として置かれた renderTemplate() を直接呼んでいる。TemplateEngine 側は自分の中でしか使わないつもりで private にしたはずなのに、外から呼ばれてしまっている。',
  goal: 'メソッドは50行以内に。private なメソッドを他クラスから呼んでいる箇所(アクセス制御の違反)をなくそう。呼んでいる側と同じクラスへ Move Method で移動し、空になったクラスやファイルは片付けよう',
  limits: { method: 50, class: 200, file: 300 },
  dependencyLimit: 2,
  responsibilityLimit: 4,
  visibilityEnforced: true,
  changeRequests: [
    { id: 'req-sms', title: '通知をSMSにも送れるようにして', description: '配送完了の通知を、メールだけでなくSMSでも送れるようにしたい。', responsibility: 'delivery', linesPerSite: 8 },
    { id: 'req-log-format', title: '送信ログのフォーマットを見直して', description: '送信ログに記録する項目を増やし、書式を見直したい。', responsibility: 'logging', linesPerSite: 5 },
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
  description:
    '画面の ReportController から呼ばれ、月次・四半期の売上帳票を作る SalesReportService。経理からは「税の計算ルールは法改正や社内規定で毎月のように変わる」と聞いている。一方、帳票の見た目はここ3年変わっていない。',
  goal: salesReportGoal,
  ...salesReportRules,
  changeRequests: [
    { id: 'req-reduced-tax-items', title: '軽減税率の対象品目を増やして', description: '新しく扱い始めた定期購読の新聞を、軽減税率の対象として計算する。', responsibility: 'tax', linesPerSite: 14 },
    { id: 'req-tax-rounding', title: '税額の端数処理を変えて', description: '税額の端数を、明細ごとではなく請求単位でまとめて切り捨てる。', responsibility: 'tax', linesPerSite: 14 },
  ],
  codebase: salesReportCodebase,
};

/** 中級5: 中級4と同じコードで、帳票の形式がよく変わる。整形を別クラスへ出すのが正解。 */
const volatileFormatStage: Stage = {
  id: 'intermediate-volatile-format',
  level: 'intermediate',
  title: '中級5: 変わるのは帳票の形式',
  description:
    '中級4とまったく同じ、ReportController から呼ばれる SalesReportService。ただし今回は、営業から「取引先ごとに帳票の形式(列の並び・PDF/CSV)を変えてほしいという依頼が毎月来る」と聞いている。税の計算はここ数年変わっていない。',
  goal: salesReportGoal,
  ...salesReportRules,
  changeRequests: [
    { id: 'req-column-order', title: '取引先向けに列の並びを変えて', description: '大口の取引先向けに、商品コードを先頭の列に移した帳票を出す。', responsibility: 'formatting', linesPerSite: 14 },
    { id: 'req-pdf-output', title: 'PDFでも出せるようにして', description: 'これまでのCSVに加えて、PDFの帳票も出せるようにする。', responsibility: 'formatting', linesPerSite: 14 },
  ],
  codebase: salesReportCodebase,
};

export const intermediateStages: readonly Stage[] = [cyclicDependencyStage, godFileStage, misplacedPrivateStage, volatileTaxStage, volatileFormatStage];
