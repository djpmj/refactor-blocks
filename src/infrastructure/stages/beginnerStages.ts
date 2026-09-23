import type { Stage } from '../../domain/stage/Stage';

/** 初級1: 保存とメール送信まで抱えた UserController から、用意されたクラスへ処理を移す。 */
const userControllerStage: Stage = {
  id: 'beginner-user-controller',
  level: 'beginner',
  title: '初級1: 何でも屋の UserController',
  description:
    'Web APIでユーザー登録・削除のリクエストを受ける UserController。本来の仕事はリクエストの検証とレスポンスの組み立てなのに、DBへの保存・削除やメール送信まで自分でやっている。',
  goal: 'メソッドは50行・クラスは150行以内、1クラスの責務は1種類まで。DBとメールの処理は UserRepository と Mailer に任せよう',
  limits: { method: 50, class: 150, file: 300 },
  dependencyLimit: 2,
  // 入力値の検証とレスポンスの組み立ては、どちらもHTTPの受け口としての責務に数える
  responsibilityLimit: 1,
  changeRequests: [
    { id: 'req-mail-footer', title: 'メールに配信停止の案内を付けて', description: 'ユーザーに送るメールすべての末尾に、配信停止の案内を入れる必要がある。', responsibility: 'notification', linesPerSite: 4, partName: 'appendUnsubscribeGuide' },
    { id: 'req-soft-delete', title: 'ユーザー削除を論理削除にして', description: 'ユーザーを物理的には消さず、削除日時を記録する方式に変える。', responsibility: 'persistence', linesPerSite: 6, partName: 'markUserDeleted' },
  ],
  codebase: {
    files: [
      {
        id: 'file-user-controller',
        path: 'src/user/UserController.ts',
        classes: [
          {
            id: 'class-user-controller',
            name: 'UserController',
            methods: [
              {
                id: 'method-register-user',
                name: 'registerUser',
                visibility: 'public',
                fragments: [
                  { id: 'frag-validate-input', label: '入力値を検証する', lines: 26, responsibility: 'http', suggestedName: 'validateInput' },
                  { id: 'frag-save-user', label: 'ユーザーをDBに保存する', lines: 36, responsibility: 'persistence', suggestedName: 'saveUser' },
                  { id: 'frag-welcome-mail', label: 'ようこそメールを送る', lines: 30, responsibility: 'notification', suggestedName: 'sendWelcomeMail' },
                  { id: 'frag-register-response', label: 'レスポンスを組み立てる', lines: 16, responsibility: 'http', suggestedName: 'buildResponse' },
                ],
              },
              {
                id: 'method-delete-user',
                name: 'deleteUser',
                visibility: 'public',
                fragments: [
                  { id: 'frag-delete-user', label: 'ユーザーをDBから削除する', lines: 20, responsibility: 'persistence', suggestedName: 'removeUserRecord' },
                  { id: 'frag-farewell-mail', label: 'お別れメールを送る', lines: 16, responsibility: 'notification', suggestedName: 'sendFarewellMail' },
                  { id: 'frag-delete-response', label: 'レスポンスを組み立てる', lines: 10, responsibility: 'http', suggestedName: 'buildDeleteResponse' },
                ],
              },
            ],
          },
        ],
      },
      {
        id: 'file-user-repository',
        path: 'src/user/UserRepository.ts',
        classes: [{ id: 'class-user-repository', name: 'UserRepository', methods: [] }],
      },
      {
        id: 'file-mailer',
        path: 'src/mail/Mailer.ts',
        classes: [{ id: 'class-mailer', name: 'Mailer', methods: [] }],
      },
    ],
  },
};

/** 初級2: 移動先のクラスが用意されていない。責務ごとのクラスを自分で作ってから移す。 */
const invoiceServiceStage: Stage = {
  id: 'beginner-invoice-service',
  level: 'beginner',
  title: '初級2: クラスを自分で作る',
  description:
    '請求書を作って送る InvoiceService。金額の計算・PDFの描画・ストレージへの保存・メール送信・送信履歴の記録を1クラスで抱えている。今回は受け皿のクラスが用意されていない。',
  goal: 'メソッドは50行、クラスは150行以内、1クラスの責務は2種類まで。「クラスを追加」で受け皿を作ろう',
  limits: { method: 50, class: 150, file: 300 },
  dependencyLimit: 3,
  responsibilityLimit: 2,
  changeRequests: [
    { id: 'req-pdf-layout', title: '請求書PDFのレイアウトを変えて', description: 'ロゴの位置と明細表の列幅を変更したい。', responsibility: 'rendering', linesPerSite: 10, partName: 'adjustPdfLayout' },
    { id: 'req-rounding', title: '金額の端数処理を変えて', description: '請求金額の端数を、切り捨てから四捨五入にする。', responsibility: 'pricing', linesPerSite: 6, partName: 'roundHalfUp' },
  ],
  codebase: {
    files: [
      {
        id: 'file-invoice-service',
        path: 'src/invoice/InvoiceService.ts',
        classes: [
          {
            id: 'class-invoice-service',
            name: 'InvoiceService',
            methods: [
              {
                id: 'method-issue-invoice',
                name: 'issueInvoice',
                visibility: 'public',
                fragments: [
                  { id: 'frag-sum-items', label: '明細の金額を合計する', lines: 24, responsibility: 'pricing', suggestedName: 'sumItems' },
                  { id: 'frag-apply-discount', label: '割引を適用する', lines: 18, responsibility: 'pricing', suggestedName: 'applyDiscount' },
                  { id: 'frag-render-pdf', label: '請求書のPDFを描画する', lines: 44, responsibility: 'rendering', suggestedName: 'renderPdf' },
                  { id: 'frag-store-pdf', label: 'PDFをストレージに保存する', lines: 24, responsibility: 'storage', suggestedName: 'storePdf' },
                ],
              },
              {
                id: 'method-send-invoice',
                name: 'sendInvoice',
                visibility: 'public',
                fragments: [
                  { id: 'frag-attach-mail', label: '請求書をメールに添付して送る', lines: 26, responsibility: 'notification', suggestedName: 'mailInvoice' },
                  { id: 'frag-record-history', label: '送信履歴を記録する', lines: 20, responsibility: 'storage', suggestedName: 'recordHistory' },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
};

export const beginnerStages: readonly Stage[] = [userControllerStage, invoiceServiceStage];
