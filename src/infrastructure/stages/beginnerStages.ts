import type { Stage } from '../../domain/stage/Stage';
import { beginnerInvoiceServiceRuntime } from './runtime/beginner-invoice-service';
import { beginnerUserControllerRuntime } from './runtime/beginner-user-controller';

/** 初級1: 保存とメール送信まで抱えた UserController から、用意されたクラスへ処理を移す。 */
const userControllerStage: Stage = {
  methodNames: { http: 'handleRequest', persistence: 'saveUser', notification: 'sendNotification' },
  responsibilityNames: { http: '入力の検証', persistence: 'DBへの保存', notification: 'メール通知' },
  classNames: {
    "http": "HttpHandler",
    "persistence": "PersistenceHandler",
    "notification": "WelcomeMailer",
  },
  id: 'beginner-user-controller',
  runtime: beginnerUserControllerRuntime,
  problem: 'ユーザー登録に保存とメール送信がまとまっている',
  level: 'beginner',
  title: '初級1: 何でも屋の UserController',
  outcome: '何でも屋のクラスから、DBやメールの処理を担当のクラスに任せられる',
  learns: ['責務の分離', 'Move Method'],
  principles: ['srp'],
  checks: [
    {
      id: 'check-1',
      question: 'UserController から DB 保存やメール送信を UserRepository・Mailer に任せる、いちばんの理由は?',
      choices: [
        { text: 'コントローラーの行数を短くするため', explanation: '行数は結果です。短くなっても、別の理由で変わる処理が同居していれば変更しにくいままです。' },
        { text: 'クラスを増やすと良い設計になるから', explanation: '増やすこと自体が目的ではありません。変わる理由で分けるから意味があります。' },
        { text: 'メールの変更やDBの変更が、リクエストの処理に影響しないようにするため', explanation: 'リクエストの受け口は、保存方法やメール文面が変わるたびに修正されずに済みます。' },
      ],
      answer: 2,
    },
    {
      id: 'check-2',
      question: '1クラスの責務を1種類に絞ると、どんなときに助かる?',
      choices: [
        { text: 'クラス名を短くできるとき', explanation: 'クラス名の長さは責務の数とは関係ありません。' },
        { text: 'バグがあったとき、疑う場所をそのクラスの役割に絞れるとき', explanation: '役割が1つなら、どの変更も見る場所がそのクラスだと分かります。' },
        { text: '継承を使いたいとき', explanation: '責務を絞ることと継承は別の話です。継承を使うために分けるわけではありません。' },
      ],
      answer: 1,
    },
  ],
  /** 100点になったときに見せる、この題材で分ける理由。 */
  why: 'メールの案内を変えるだけでも、ユーザー登録や削除の処理に埋もれた送信箇所を探す必要があります。通知をまとめれば、メールの変更を通知処理に集められます。',
  description:
    'Web APIでユーザー登録・削除のリクエストを受ける UserController。本来の仕事はリクエストの検証とレスポンスの組み立てなのに、DBへの保存・削除やメール送信まで自分でやっている。',
  goal: 'メソッドは17行・クラスは34行・ファイルは35行以内、1クラスの責務は1種類まで。DBとメールの処理は UserRepository と Mailer に任せよう',
  limits: { method: 17, class: 34, file: 35 },
  dependencyLimit: 2,
  // 入力値の検証とレスポンスの組み立ては、どちらもHTTPの受け口としての責務に数える
  responsibilityLimit: 1,
  changeRequests: [
    { id: 'req-mail-footer', title: 'メールに配信停止の案内を付けて', description: 'ユーザーに送るメールすべての末尾に、配信停止の案内を入れる必要がある。', responsibility: 'notification', linesPerSite: 4, partName: 'appendUnsubscribeGuide' },
    { id: 'req-soft-delete', title: 'ユーザー削除を論理削除にして', description: 'ユーザーを物理的には消さず、削除日時を記録する方式に変える。', responsibility: 'persistence', linesPerSite: 6, partName: 'markUserDeleted', rumor: { from: 'PMの鈴木さん', text: '「データの残し方」を変えたいという話が、いつか出てくるかもしれないらしいです。' } },
    { id: 'req-boss-notification', title: '通知を、メール以外のチャネルと配信設定まで含めて作り直して', description: 'ユーザーへの通知を、メールだけでなくアプリ内通知にも対応させ、ユーザーごとの配信設定も持たせる。通知の仕組みをまるごと作り直したい。', responsibility: 'notification', linesPerSite: 8, boss: true, partName: 'rebuildNotification', rumor: { from: 'PMの鈴木さん', text: 'お知らせの届け方を、全面的に変える話が進んでいるらしいです。' } },
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
                visibility: 'public', parameters: [{ type: 'RegisterInput', name: 'input' }, { type: 'CancellationToken', name: 'cancellationToken' }],
                fragments: [
                  { id: 'frag-validate-input', label: '入力値を検証する', lines: 2, responsibility: 'http', suggestedName: 'validateInput' , code: { csharp: "if (string.IsNullOrWhiteSpace(input.Name)) throw new ValidationException(\"名前が必要です\");\nif (!EmailAddress.TryParse(input.Email, out _)) throw new ValidationException(\"メールアドレスが不正です\");" }, variables: { uses: ['input'] }},
                  { id: 'frag-save-user', label: 'ユーザーをDBに保存する', lines: 3, responsibility: 'persistence', suggestedName: 'saveUser' , code: { csharp: "var user = User.Create(input.Name, input.Email);\nawait FakeUserStore.SaveAsync(user, cancellationToken);\nawait FakeUnitOfWork.CommitAsync(cancellationToken);" }, variables: { declares: [{ name: 'user', type: { csharp: 'User' } }], uses: ['input', 'cancellationToken'] }},
                  { id: 'frag-welcome-mail', label: 'ようこそメールを送る', lines: 3, responsibility: 'notification', suggestedName: 'sendWelcomeMail' , code: { csharp: "var message = new MailMessage(user.Email, \"ようこそ\", $\"{user.Name} さん、登録ありがとうございます\");\nawait FakeMailGateway.SendAsync(message, cancellationToken);\nawait FakeMailAuditLog.RecordSentAsync(message.Id, cancellationToken);" }, variables: { declares: [{ name: 'message', type: { csharp: 'MailMessage' } }], uses: ['user', 'cancellationToken'] }},
                  { id: 'frag-register-response', label: 'レスポンスを組み立てる', lines: 3, responsibility: 'http', suggestedName: 'buildResponse' , code: { csharp: "var response = new ApiResponse(user.Id, user.Name, user.Email);\nLog.Debug($\"登録済みユーザー {user.Id} を返します\");\nResults.Created($\"/users/{user.Id}\", response);" }, variables: { declares: [{ name: 'response', type: { csharp: 'ApiResponse' } }], uses: ['user'] }},
                ],
              },
              {
                id: 'method-delete-user',
                name: 'deleteUser',
                visibility: 'public', parameters: [{ type: 'int', name: 'userId' }, { type: 'string', name: 'userName' }, { type: 'string', name: 'recipient' }, { type: 'string', name: 'subject' }, { type: 'CancellationToken', name: 'cancellationToken' }],
                fragments: [
                  { id: 'frag-delete-user', label: 'ユーザーをDBから削除する', lines: 3, responsibility: 'persistence', suggestedName: 'removeUserRecord' , code: { csharp: "cancellationToken.ThrowIfCancellationRequested();\nawait FakeUserStore.DeleteAsync(userId, cancellationToken);\nawait FakeUnitOfWork.CommitAsync(cancellationToken);" }, variables: { uses: ['userId', 'cancellationToken'] }},
                  { id: 'frag-farewell-mail', label: 'お別れメールを送る', lines: 4, responsibility: 'notification', suggestedName: 'sendFarewellMail' , code: { csharp: "var body = $\"{userName} さん、これまでご利用ありがとうございました\";\nvar message = new MailMessage(recipient, subject, body);\nawait FakeMailGateway.SendAsync(message, cancellationToken);\nawait FakeMailAuditLog.RecordSentAsync(message.Id, cancellationToken);" }, variables: { declares: [{ name: 'body', type: { csharp: 'string' } }, { name: 'message', type: { csharp: 'MailMessage' } }], uses: ['userName', 'recipient', 'subject', 'cancellationToken'] }},
                  { id: 'frag-delete-response', label: 'レスポンスを組み立てる', lines: 3, responsibility: 'http', suggestedName: 'buildDeleteResponse' , code: { csharp: "if (userName is null) throw new ArgumentNullException(nameof(userName));\nvar response = new ApiResponse(204, $\"{userName} を削除しました\");\nResults.Json(response, statusCode: 204);" }, variables: { declares: [{ name: 'response', type: { csharp: 'ApiResponse' } }], uses: ['userName'] }},
                ],
              },
            ],
          },
        ],
      },
      {
        id: 'file-user-repository',
        path: 'src/user/UserRepository.ts',
        classes: [{ id: 'class-user-repository', name: 'UserRepository', roleResponsibilities: ['persistence'], methods: [] }],
      },
      {
        id: 'file-mailer',
        path: 'src/mail/Mailer.ts',
        classes: [{ id: 'class-mailer', name: 'Mailer', roleResponsibilities: ['notification'], methods: [] }],
      },
    ],
  },
};

/** 初級2: 移動先のクラスが用意されていない。責務ごとのクラスを自分で作ってから移す。 */
const invoiceServiceStage: Stage = {
  methodNames: { pricing: 'calculateInvoiceTotal', rendering: 'renderInvoice', storage: 'storeInvoice', notification: 'sendInvoice' },
  responsibilityNames: { pricing: '金額の計算', rendering: 'PDFの描画', storage: 'PDFの保管', notification: 'メール通知' },
  classNames: {
    "pricing": "InvoicePricing",
    "rendering": "InvoicePdfRenderer",
    "storage": "InvoiceStorage",
    "notification": "InvoiceMailer",
  },
  id: 'beginner-invoice-service',
  runtime: beginnerInvoiceServiceRuntime,
  problem: '請求処理と明細計算が同じ場所にある',
  level: 'beginner',
  title: '初級2: クラスを自分で作る',
  outcome: '受け皿のクラスを自分で追加して、責務ごとに分けられる',
  learns: ['クラスの追加', '責務の分離'],
  principles: ['srp'],
  checks: [
    {
      id: 'check-1',
      question: '請求書の PDF 描画を別のクラスに分けると、特にどんな変更が楽になる?',
      choices: [
        { text: '請求書のレイアウトだけを変えたいとき、計算や送信のコードを読まずに済む', explanation: '見た目の変更は描画のクラスだけで完結し、金額の計算を壊す心配もありません。' },
        { text: '送信するメールの本数を減らしたいとき', explanation: 'メール送信の本数は、描画を分けても変わりません。' },
        { text: '金額の計算式を変えたいとき', explanation: '計算式は描画とは別の役割です。描画を分けた効果ではなく、計算を担当するクラスが対象になります。' },
      ],
      answer: 0,
    },
    {
      id: 'check-2',
      question: 'このステージで、受け皿のクラスを自分で作る理由は?',
      choices: [
        { text: '既存のクラスは変更してはいけないから', explanation: '既存のクラスも変更できます。ここでは、受け皿が無ければ作るという判断を練習します。' },
        { text: 'クラスの数が多いほど点数が上がるから', explanation: '点数は数ではなく、行数・責務・結合度などで決まります。' },
        { text: '責務に合う置き場所が無ければ、役割に名前を付けたクラスを新しく作るのが自然だから', explanation: '置き場所が無いときは、無理に既存のクラスへ押し込まず、役割を表すクラスを作ります。' },
      ],
      answer: 2,
    },
  ],
  /** 100点になったときに見せる、この題材で分ける理由。 */
  why: 'PDFの見た目を変えるだけなのに、金額計算や保存、送信まで抱えた請求処理を追うことになります。描画の役割が分かれていれば、レイアウト変更の確認先を絞れます。',
  description:
    '請求書を作って送る InvoiceService。金額の計算・PDFの描画・ストレージへの保存・メール送信・送信履歴の記録を1クラスで抱えている。今回は受け皿のクラスが用意されていない。',
  goal: 'メソッドは16行、クラスは31行・ファイルは65行以内、1クラスの責務は2種類まで。「クラスを追加」で受け皿を作ろう',
  limits: { method: 16, class: 31, file: 65 },
  dependencyLimit: 4,
  responsibilityLimit: 2,
  changeRequests: [
    { id: 'req-pdf-layout', title: '請求書PDFのレイアウトを変えて', description: 'ロゴの位置と明細表の列幅を変更したい。', responsibility: 'rendering', linesPerSite: 10, partName: 'adjustPdfLayout' },
    { id: 'req-rounding', title: '金額の端数処理を変えて', description: '請求金額の端数を、切り捨てから四捨五入にする。', responsibility: 'pricing', linesPerSite: 6, partName: 'roundHalfUp', rumor: { from: '先輩の田中さん', text: '「金額の決め方」を変えたいという話が、いつか出てくるかもしれないらしいです。' } },
    { id: 'req-boss-rendering', title: '請求書の描画を、PDFだけでなくHTMLや多言語まで含めて作り直して', description: '請求書をPDFだけでなくHTMLでも出し、英語版も作ることになった。描画の仕組みをまるごと作り直したい。', responsibility: 'rendering', linesPerSite: 20, boss: true, partName: 'rebuildRendering', rumor: { from: '営業の佐藤さん', text: '請求書の見た目まわりで、大きな刷新があるかもしれないと聞きました。' } },
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
                visibility: 'public', parameters: [{ type: 'List<InvoiceItem>', name: 'items' }, { type: 'decimal', name: 'discountRate' }, { type: 'Invoice', name: 'invoice' }, { type: 'CancellationToken', name: 'cancellationToken' }],
                fragments: [
                  { id: 'frag-sum-items', label: '明細の金額を合計する', lines: 2, responsibility: 'pricing', suggestedName: 'sumItems' , code: { csharp: "var total = items.Sum(item => item.Quantity * item.UnitPrice);\nvar subtotal = decimal.Round(total, 2);" }, variables: { declares: [{ name: 'total', type: { csharp: 'decimal' } }, { name: 'subtotal', type: { csharp: 'decimal' } }], uses: ['items'] }},
                  { id: 'frag-apply-discount', label: '割引を適用する', lines: 2, responsibility: 'pricing', suggestedName: 'applyDiscount' , code: { csharp: "var discount = subtotal * discountRate;\ninvoice.Total = subtotal - discount;" }, variables: { declares: [{ name: 'discount', type: { csharp: 'decimal' } }], uses: ['subtotal', 'discountRate', 'invoice'] }},
                  { id: 'frag-render-pdf', label: '請求書のPDFを描画する', lines: 3, responsibility: 'rendering', suggestedName: 'renderPdf' , code: { csharp: "var page = FakePdfRenderer.CreatePage();\npage.DrawInvoice(invoice);\nvar document = FakePdfRenderer.Render(page);" }, variables: { declares: [{ name: 'page', type: { csharp: 'PdfPage' } }, { name: 'document', type: { csharp: 'PdfDocument' } }], uses: ['invoice'] }},
                  { id: 'frag-store-pdf', label: 'PDFをストレージに保存する', lines: 3, responsibility: 'storage', suggestedName: 'storePdf' , code: { csharp: "var key = $\"invoices/{invoice.Number}.pdf\";\nawait FakeStorage.UploadAsync(key, document, cancellationToken);\nawait FakeStorage.SetMetadataAsync(key, invoice.Number, cancellationToken);" }, variables: { declares: [{ name: 'key', type: { csharp: 'string' } }], uses: ['invoice', 'document', 'cancellationToken'] }},
                ],
              },
              {
                id: 'method-send-invoice',
                name: 'sendInvoice',
                visibility: 'public', parameters: [{ type: 'Invoice', name: 'invoice' }, { type: 'string', name: 'recipient' }, { type: 'string', name: 'body' }, { type: 'CancellationToken', name: 'cancellationToken' }],
                fragments: [
                  { id: 'frag-attach-mail', label: '請求書をメールに添付して送る', lines: 7, responsibility: 'notification', suggestedName: 'mailInvoice' , code: { csharp: "var key = $\"invoices/{invoice.Number}.pdf\";\nvar subject = $\"請求書 {invoice.Number} のご案内\";\nawait using var pdf = await FakeStorage.DownloadAsync(key, cancellationToken);\nvar message = new MailMessage(recipient, subject, body);\nmessage.Attachments.Add(new Attachment(pdf, $\"{invoice.Number}.pdf\", \"application/pdf\"));\nawait FakeMailGateway.SendAsync(message, cancellationToken);\nawait FakeMailAuditLog.RecordSentAsync(message.Id, cancellationToken);" }, variables: { declares: [{ name: 'key', type: { csharp: 'string' } }, { name: 'subject', type: { csharp: 'string' } }, { name: 'pdf', type: { csharp: 'Stream' } }, { name: 'message', type: { csharp: 'MailMessage' } }], uses: ['invoice', 'recipient', 'body', 'cancellationToken'] }},
                  { id: 'frag-record-history', label: '送信履歴を記録する', lines: 4, responsibility: 'storage', suggestedName: 'recordHistory' , code: { csharp: "var history = new InvoiceDeliveryHistory(invoice.Number, recipient, SampleData.Now);\nawait FakeHistoryRepository.AddAsync(history, cancellationToken);\nawait FakeUnitOfWork.CommitAsync(cancellationToken);\nLog.Info($\"請求書 {invoice.Number} の送信履歴を記録しました\");" }, variables: { declares: [{ name: 'history', type: { csharp: 'InvoiceDeliveryHistory' } }], uses: ['invoice', 'recipient', 'cancellationToken'] }},
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
