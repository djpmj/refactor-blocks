import type { BlankDesignProblem } from '../../domain/blank/BlankDesignProblem';
import { trayCodebase } from '../../domain/blank/tray';
import type { Method } from '../../domain/codebase/Codebase';

const placeOrder: Method = {
  id: 'method-blank-place-order',
  name: 'placeOrder',
  visibility: 'public',
  fragments: [
    {
      id: 'frag-blank-place-order',
      label: '注文を受け付け、税の計算・保存・確認メールを順に呼ぶ',
      lines: 10,
      responsibility: 'order-flow',
      uses: ['method-blank-calculate-order-tax', 'method-blank-save-order', 'method-blank-send-order-confirm-mail'],
    },
  ],
};
const shipOrder: Method = {
  id: 'method-blank-ship-order',
  name: 'shipOrder',
  visibility: 'public',
  fragments: [
    {
      id: 'frag-blank-ship-order',
      label: '発送を受け付け、発送状況の記録・発送メールを順に呼ぶ',
      lines: 10,
      responsibility: 'order-flow',
      uses: ['method-blank-update-shipping-status', 'method-blank-send-shipped-mail'],
    },
  ],
};
const calculateOrderTax: Method = {
  id: 'method-blank-calculate-order-tax',
  name: 'calculateOrderTax',
  visibility: 'public',
  fragments: [{ id: 'frag-blank-calculate-order-tax', label: '注文金額に消費税を足す', lines: 18, responsibility: 'tax' }],
};
const saveOrder: Method = {
  id: 'method-blank-save-order',
  name: 'saveOrder',
  visibility: 'public',
  fragments: [{ id: 'frag-blank-save-order', label: '注文をDBに保存する', lines: 20, responsibility: 'persistence' }],
};
const updateShippingStatus: Method = {
  id: 'method-blank-update-shipping-status',
  name: 'updateShippingStatus',
  visibility: 'public',
  fragments: [{ id: 'frag-blank-update-shipping-status', label: '発送状況をDBに記録する', lines: 16, responsibility: 'persistence' }],
};
const sendOrderConfirmMail: Method = {
  id: 'method-blank-send-order-confirm-mail',
  name: 'sendOrderConfirmMail',
  visibility: 'public',
  fragments: [{ id: 'frag-blank-send-order-confirm-mail', label: '注文確認メールを送る', lines: 20, responsibility: 'notification' }],
};
const sendShippedMail: Method = {
  id: 'method-blank-send-shipped-mail',
  name: 'sendShippedMail',
  visibility: 'public',
  fragments: [{ id: 'frag-blank-send-shipped-mail', label: '発送完了メールを送る', lines: 18, responsibility: 'notification' }],
};

const orderShippingParts = [placeOrder, shipOrder, calculateOrderTax, saveOrder, updateShippingStatus, sendOrderConfirmMail, sendShippedMail];

/** 白紙設計の問題の一覧。ステージ一覧・ステージ選択・進捗には入れない。 */
export const blankDesignProblems: readonly BlankDesignProblem[] = [
  {
    id: 'blank-order-shipping',
    level: 'beginner',
    title: '白紙1: 注文と発送',
    learns: ['責務の分離', 'クラス設計'],
    why: '税率やメール文面を変えるたびに注文と発送の一連の流れを読み直す必要があります。処理の置き場所が分かれていれば、変更先を特定しやすくなります。',
    goal: '部品置き場の7つの部品を、すべて自分で作ったクラスに配置しよう。メソッドは40行・クラスは80行以内、1クラスの責務は1種類、依存先は3クラスまで',
    description:
      'ネットショップの注文と発送の機能を、白紙から設計する。お客さんが注文を確定したら、注文金額に消費税を足し、注文をDBに保存して、注文確認メールを送る。' +
      '倉庫が商品を発送したら、発送状況をDBに記録して、発送完了メールを送る。' +
      'なお、消費税は軽減税率への対応が近いうちに入る予定。メールには、全通共通の文言の追加がよく頼まれる。',
    limits: { method: 40, class: 80, file: 200 },
    dependencyLimit: 3,
    responsibilityLimit: 1,
    codebase: trayCodebase(orderShippingParts),
    changeRequests: [
      {
        id: 'req-blank-mail-footer',
        title: 'メールに配信停止の案内を付けて',
        description: '送るメールすべての末尾に、配信停止の案内を入れたい。',
        responsibility: 'notification',
        linesPerSite: 5,
      },
      {
        id: 'req-blank-reduced-tax',
        title: '軽減税率に対応して',
        description: '食品は8%、それ以外は10%で消費税を計算したい。',
        responsibility: 'tax',
        linesPerSite: 20,
      },
    ],
    modelAnswer: [
      { addFile: 'src/order/OrderService.ts' },
      { addFile: 'src/order/TaxCalculator.ts' },
      { addFile: 'src/order/OrderRepository.ts' },
      { addFile: 'src/mail/OrderMailer.ts' },
      { addClass: { name: 'OrderService', file: 'src/order/OrderService.ts' } },
      { addClass: { name: 'TaxCalculator', file: 'src/order/TaxCalculator.ts' } },
      { addClass: { name: 'OrderRepository', file: 'src/order/OrderRepository.ts' } },
      { addClass: { name: 'OrderMailer', file: 'src/mail/OrderMailer.ts' } },
      { move: { method: 'placeOrder', toClass: 'OrderService' } },
      { move: { method: 'shipOrder', toClass: 'OrderService' } },
      { move: { method: 'calculateOrderTax', toClass: 'TaxCalculator' } },
      { move: { method: 'saveOrder', toClass: 'OrderRepository' } },
      { move: { method: 'updateShippingStatus', toClass: 'OrderRepository' } },
      { move: { method: 'sendOrderConfirmMail', toClass: 'OrderMailer' } },
      { move: { method: 'sendShippedMail', toClass: 'OrderMailer' } },
    ],
    explanation:
      '"注文"と"発送"という機能の流れで分けると、メールやDBの処理が両方のクラスに散らばり、メール共通の変更で2クラスを直すことになる。' +
      '変わる理由(税・保存・メール)ごとにクラスを分け、流れを組み立てるOrderServiceから呼ぶ形にすると、1つの変更が1つのクラスに収まる。' +
      '模範解答と同じ形でなくても、点数が同じなら同じくらい良い設計。',
  },
];
