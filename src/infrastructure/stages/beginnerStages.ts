import type { Stage } from '../../domain/stage/Stage';

/** 初級1: 保存とメール送信まで抱えた UserController から、用意されたクラスへ処理を移す。 */
const userControllerStage: Stage = {
  id: 'beginner-user-controller',
  level: 'beginner',
  title: '初級1: 何でも屋の UserController',
  learns: ['責務の分離', 'Move Method'],
  checks: [
    {
      id: 'check-1',
      question: 'UserController から DB 保存やメール送信を UserRepository・Mailer に任せる、いちばんの理由は?',
      choices: [
        { text: 'コントローラーの行数を短くするため', explanation: '行数は結果です。短くなっても、別の理由で変わる処理が同居していれば変更しにくいままです。' },
        { text: 'クラスを増やすと良い設計になるから', explanation: '増やすこと自体が目的ではありません。変わる理由で分けるから意味があります。' },
        { text: 'メールの変更やDBの変更が、リクエストの処理に影響しないようにするため', explanation: '正解です。リクエストの受け口は、保存方法やメール文面が変わるたびに修正されずに済みます。' },
      ],
      answer: 2,
    },
    {
      id: 'check-2',
      question: '1クラスの責務を1種類に絞ると、どんなときに助かる?',
      choices: [
        { text: 'クラス名を短くできるとき', explanation: 'クラス名の長さは責務の数とは関係ありません。' },
        { text: 'バグがあったとき、疑う場所をそのクラスの役割に絞れるとき', explanation: '正解です。役割が1つなら、どの変更も見る場所がそのクラスだと分かります。' },
        { text: '継承を使いたいとき', explanation: '責務を絞ることと継承は別の話です。継承を使うために分けるわけではありません。' },
      ],
      answer: 1,
    },
  ],
  /** 100点になったときに見せる、この題材で分ける理由。 */
  why: 'メールの案内を変えるだけでも、ユーザー登録や削除の処理に埋もれた送信箇所を探す必要があります。通知をまとめれば、メールの変更を通知処理に集められます。',
  description:
    'Web APIでユーザー登録・削除のリクエストを受ける UserController。本来の仕事はリクエストの検証とレスポンスの組み立てなのに、DBへの保存・削除やメール送信まで自分でやっている。',
  goal: 'メソッドは11行・クラスは23行・ファイルは24行以内、1クラスの責務は1種類まで。DBとメールの処理は UserRepository と Mailer に任せよう',
  limits: { method: 11, class: 23, file: 24 },
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
                  { id: 'frag-validate-input', label: '入力値を検証する', lines: 2, responsibility: 'http', suggestedName: 'validateInput' , code: { csharp: "if (string.IsNullOrWhiteSpace(input.Name)) throw new ValidationException(\"名前が必要です\");\nif (!EmailAddress.TryParse(input.Email, out _)) throw new ValidationException(\"メールアドレスが不正です\");" }},
                  { id: 'frag-save-user', label: 'ユーザーをDBに保存する', lines: 3, responsibility: 'persistence', suggestedName: 'saveUser' , code: { csharp: "var user = User.Create(input.Name, input.Email);\nawait _repository.SaveAsync(user, cancellationToken);\nawait _unitOfWork.CommitAsync(cancellationToken);" }},
                  { id: 'frag-welcome-mail', label: 'ようこそメールを送る', lines: 3, responsibility: 'notification', suggestedName: 'sendWelcomeMail' , code: { csharp: "var message = new MailMessage(user.Email, \"ようこそ\", $\"{user.Name} さん、登録ありがとうございます\");\nawait _mailer.SendAsync(message, cancellationToken);\nawait _mailAuditLog.RecordSentAsync(message.Id, cancellationToken);" }},
                  { id: 'frag-register-response', label: 'レスポンスを組み立てる', lines: 3, responsibility: 'http', suggestedName: 'buildResponse' , code: { csharp: "var response = new ApiResponse(user.Id, user.Name, user.Email);\n_logger.LogDebug(\"登録済みユーザー {UserId} を返します\", user.Id);\nreturn Results.Created($\"/users/{user.Id}\", response);" }},
                ],
              },
              {
                id: 'method-delete-user',
                name: 'deleteUser',
                visibility: 'public',
                fragments: [
                  { id: 'frag-delete-user', label: 'ユーザーをDBから削除する', lines: 3, responsibility: 'persistence', suggestedName: 'removeUserRecord' , code: { csharp: "cancellationToken.ThrowIfCancellationRequested();\nawait _repository.DeleteAsync(userId, cancellationToken);\nawait _unitOfWork.CommitAsync(cancellationToken);" }},
                  { id: 'frag-farewell-mail', label: 'お別れメールを送る', lines: 3, responsibility: 'notification', suggestedName: 'sendFarewellMail' , code: { csharp: "var message = new MailMessage(recipient, subject, body);\nawait _mailer.SendAsync(message, cancellationToken);\nawait _mailAuditLog.RecordSentAsync(message.Id, cancellationToken);" }},
                  { id: 'frag-delete-response', label: 'レスポンスを組み立てる', lines: 3, responsibility: 'http', suggestedName: 'buildDeleteResponse' , code: { csharp: "if (input is null) throw new ArgumentNullException(nameof(input));\nvar response = new ApiResponse(statusCode, message);\nreturn Results.Json(response, statusCode: statusCode);" }},
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
  learns: ['クラスの追加', '責務の分離'],
  checks: [
    {
      id: 'check-1',
      question: '請求書の PDF 描画を別のクラスに分けると、特にどんな変更が楽になる?',
      choices: [
        { text: '請求書のレイアウトだけを変えたいとき、計算や送信のコードを読まずに済む', explanation: '正解です。見た目の変更は描画のクラスだけで完結し、金額の計算を壊す心配もありません。' },
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
        { text: '責務に合う置き場所が無ければ、役割に名前を付けたクラスを新しく作るのが自然だから', explanation: '正解です。置き場所が無いときは、無理に既存のクラスへ押し込まず、役割を表すクラスを作ります。' },
      ],
      answer: 2,
    },
  ],
  /** 100点になったときに見せる、この題材で分ける理由。 */
  why: 'PDFの見た目を変えるだけなのに、金額計算や保存、送信まで抱えた請求処理を追うことになります。描画の役割が分かれていれば、レイアウト変更の確認先を絞れます。',
  description:
    '請求書を作って送る InvoiceService。金額の計算・PDFの描画・ストレージへの保存・メール送信・送信履歴の記録を1クラスで抱えている。今回は受け皿のクラスが用意されていない。',
  goal: 'メソッドは11行、クラスは22行・ファイルは50行以内、1クラスの責務は2種類まで。「クラスを追加」で受け皿を作ろう',
  limits: { method: 11, class: 22, file: 50 },
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
                  { id: 'frag-sum-items', label: '明細の金額を合計する', lines: 2, responsibility: 'pricing', suggestedName: 'sumItems' , code: { csharp: "var total = items.Sum(item => item.Quantity * item.UnitPrice);\nsubtotal = decimal.Round(total, 2);" }},
                  { id: 'frag-apply-discount', label: '割引を適用する', lines: 2, responsibility: 'pricing', suggestedName: 'applyDiscount' , code: { csharp: "var discount = subtotal * discountRate;\ninvoice.Total = subtotal - discount;" }},
                  { id: 'frag-render-pdf', label: '請求書のPDFを描画する', lines: 3, responsibility: 'rendering', suggestedName: 'renderPdf' , code: { csharp: "var page = _pdfRenderer.CreatePage();\npage.DrawInvoice(invoice);\nvar document = _pdfRenderer.Render(page);" }},
                  { id: 'frag-store-pdf', label: 'PDFをストレージに保存する', lines: 3, responsibility: 'storage', suggestedName: 'storePdf' , code: { csharp: "var key = $\"invoices/{invoice.Number}.pdf\";\nawait _storage.UploadAsync(key, document, cancellationToken);\nawait _storage.SetMetadataAsync(key, invoice.Number, cancellationToken);" }},
                ],
              },
              {
                id: 'method-send-invoice',
                name: 'sendInvoice',
                visibility: 'public',
                fragments: [
                  { id: 'frag-attach-mail', label: '請求書をメールに添付して送る', lines: 6, responsibility: 'notification', suggestedName: 'mailInvoice' , code: { csharp: "var key = $\"invoices/{invoice.Number}.pdf\";\nawait using var pdf = await _storage.DownloadAsync(key, cancellationToken);\nvar message = new MailMessage(recipient, subject, body);\nmessage.Attachments.Add(new Attachment(pdf, $\"{invoice.Number}.pdf\", \"application/pdf\"));\nawait _mailer.SendAsync(message, cancellationToken);\nawait _mailAuditLog.RecordSentAsync(message.Id, cancellationToken);" }},
                  { id: 'frag-record-history', label: '送信履歴を記録する', lines: 3, responsibility: 'storage', suggestedName: 'recordHistory' , code: { csharp: "var history = new InvoiceDeliveryHistory(invoice.Number, recipient, DateTimeOffset.UtcNow);\nawait _historyRepository.AddAsync(history, cancellationToken);\nawait _unitOfWork.CommitAsync(cancellationToken);" }},
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
