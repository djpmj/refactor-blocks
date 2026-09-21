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
  goal: '赤い矢印(循環依存)をなくそう。メソッドが本来いるべきクラスはどこ? メソッドは15行以内、1クラスの責務は4種類まで',
  limits: { method: 15, class: 50, file: 60 },
  dependencyLimit: 2,
  responsibilityLimit: 4,
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
                  { id: 'frag-reserve-stock', label: '在庫を引き当てる', lines: 6, responsibility: 'inventory', uses: ['method-reserve'], suggestedName: 'reserveStock' },
                  { id: 'frag-order-total', label: '合計金額を求める', lines: 2, responsibility: 'pricing', uses: ['method-calculate-order-total'], suggestedName: 'orderTotal' },
                  { id: 'frag-member-discount', label: '会員ランクで割引する', lines: 5, responsibility: 'discount', uses: ['method-get-rank'], suggestedName: 'applyMemberDiscount' },
                  { id: 'frag-pay', label: '決済する', lines: 6, responsibility: 'payment', suggestedName: 'pay' },
                ],
              },
              {
                id: 'method-get-lines',
                name: 'getLines',
                visibility: 'public',
                fragments: [
                  { id: 'frag-list-lines', label: '注文明細の一覧を返す', lines: 3, responsibility: 'pricing', suggestedName: 'listLines' },
                ],
              },
              {
                id: 'method-count-orders-of',
                name: 'countOrdersOf',
                visibility: 'public',
                fragments: [
                  { id: 'frag-count-orders', label: '顧客の過去の注文数を数える', lines: 4, responsibility: 'history', suggestedName: 'countOrders' },
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
                  { id: 'frag-judge-rank', label: '注文数から会員ランクを判定する', lines: 5, responsibility: 'membership', uses: ['method-count-orders-of'], suggestedName: 'judgeRank' },
                ],
              },
              {
                id: 'method-calculate-order-total',
                name: 'calculateOrderTotal',
                visibility: 'public',
                fragments: [
                  { id: 'frag-sum-order-lines', label: '注文明細の金額を合計する', lines: 8, responsibility: 'pricing', uses: ['method-get-lines'], suggestedName: 'sumOrderLines' },
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
                  { id: 'frag-decrease-stock', label: '在庫数を減らす', lines: 5, responsibility: 'inventory', suggestedName: 'decreaseStock' },
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
  goal: 'ファイルは40行、クラスは30行以内、1クラスの責務は2種類まで。メソッドを持ち主へ返し、「ファイルを追加」してクラスを移そう',
  limits: { method: 15, class: 30, file: 40 },
  dependencyLimit: 2,
  responsibilityLimit: 2,
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
                  { id: 'frag-validate-cart', label: 'カートの中身を検証する', lines: 5, responsibility: 'validation', suggestedName: 'validateCart' },
                  { id: 'frag-cart-subtotal', label: '小計を計算する', lines: 5, responsibility: 'pricing', suggestedName: 'calculateSubtotal' },
                  { id: 'frag-call-shipping-fee', label: 'calculateShippingFee() を呼び出す', lines: 1, responsibility: 'call', uses: ['method-calculate-shipping-fee'] },
                  { id: 'frag-call-add-points', label: 'addPoints() を呼び出す', lines: 1, responsibility: 'call', uses: ['method-add-points'] },
                ],
              },
              {
                id: 'method-calculate-shipping-fee',
                name: 'calculateShippingFee',
                visibility: 'private',
                fragments: [
                  { id: 'frag-shipping-fee', label: '地域と重さから送料を決める', lines: 9, responsibility: 'shipping', suggestedName: 'decideShippingFee' },
                ],
              },
              {
                id: 'method-add-points',
                name: 'addPoints',
                visibility: 'private',
                fragments: [
                  { id: 'frag-add-points', label: '購入額に応じてポイントを付ける', lines: 7, responsibility: 'points', suggestedName: 'grantPoints' },
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
                  { id: 'frag-schedule-delivery', label: '配送日を決める', lines: 7, responsibility: 'shipping', suggestedName: 'decideDeliveryDate' },
                ],
              },
              {
                id: 'method-track-package',
                name: 'trackPackage',
                visibility: 'public',
                fragments: [
                  { id: 'frag-track-package', label: '配送状況を問い合わせる', lines: 6, responsibility: 'shipping', suggestedName: 'fetchTrackingStatus' },
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
                  { id: 'frag-get-balance', label: 'ポイント残高を取得する', lines: 5, responsibility: 'points', suggestedName: 'fetchBalance' },
                ],
              },
              {
                id: 'method-expire-points',
                name: 'expirePoints',
                visibility: 'public',
                fragments: [
                  { id: 'frag-expire-points', label: '期限切れのポイントを失効させる', lines: 7, responsibility: 'points', suggestedName: 'expireOldPoints' },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
};

export const intermediateStages: readonly Stage[] = [cyclicDependencyStage, godFileStage];
