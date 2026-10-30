import type { Stage } from '../../domain/stage/Stage';

export const drillStages: readonly Stage[] = [
  {
    id: 'drill-extract-tail', level: 'drill', title: 'ドリル1: 後ろのまとまりを抜き出す',
    problem: 'registerMemberの後半にメール送信の処理が続いている',
    description: '会員登録を行う MemberService。保存の後に歓迎メールを組み立てて送っている。',
    why: 'メールの文面を変えるとき、保存の処理を読まずに済みます。',
    goal: 'メソッドは14行以内に。メールの処理2つを選んで「メソッドとして抽出」しよう',
    learns: ['Extract Method'], principles: ['srp'], checks: [], changeRequests: [],
    limits: { method: 14, class: 30, file: 35 }, dependencyLimit: 1, responsibilityLimit: 2,
    classNames: { persistence: 'MemberRepository', notification: 'WelcomeMailer' },
    methodNames: { persistence: 'saveMember', notification: 'sendWelcomeMail' },
    responsibilityNames: { persistence: '会員の保存', notification: '歓迎メール' },
    codebase: { files: [{ id: 'file-drill-member', path: 'src/member/MemberService.ts', classes: [{
      id: 'class-drill-member', name: 'MemberService', methods: [{ id: 'method-drill-register', name: 'registerMember', visibility: 'public', fragments: [
        { id: 'frag-drill-save-member', label: '会員をDBに保存する', lines: 3, responsibility: 'persistence', code: { csharp: 'var member = new Member(name, email);\nawait _repository.SaveAsync(member);\nawait _unitOfWork.CommitAsync();' } },
        { id: 'frag-drill-mail-body', label: '歓迎メールの本文を組み立てる', lines: 3, responsibility: 'notification', code: { csharp: 'var subject = "ようこそ";\nvar body = $"{name}さん、ご登録ありがとうございます";\nvar mail = new MailMessage(email, subject, body);' } },
        { id: 'frag-drill-mail-send', label: '歓迎メールを送る', lines: 3, responsibility: 'notification', code: { csharp: 'await _mailer.SendAsync(mail);\nawait _mailLog.RecordAsync(email);\n_logger.LogInformation("歓迎メールを送信しました");' } },
      ] }],
    }] }] },
  },
  {
    id: 'drill-extract-middle', level: 'drill', title: 'ドリル2: 途中のまとまりを抜き出す',
    problem: 'issueInvoiceの途中に料金計算がまとまっている',
    description: '請求書を発行する InvoiceService。注文の読み込みと保存の間に料金計算がある。',
    why: '料金の計算を変えるとき、読み込みや保存の処理を読まずに済みます。',
    goal: 'メソッドは14行以内に。真ん中の計算2つを選んで「メソッドとして抽出」しよう',
    learns: ['Extract Method'], principles: ['srp'], checks: [], changeRequests: [],
    limits: { method: 14, class: 32, file: 38 }, dependencyLimit: 1, responsibilityLimit: 3,
    classNames: { loading: 'OrderRepository', pricing: 'PriceCalculator', persistence: 'InvoiceRepository' },
    methodNames: { loading: 'loadOrder', pricing: 'calculateInvoiceTotal', persistence: 'saveInvoice' },
    responsibilityNames: { loading: '注文の読み込み', pricing: '料金計算', persistence: '請求書の保存' },
    codebase: { files: [{ id: 'file-drill-invoice', path: 'src/invoice/InvoiceService.ts', classes: [{
      id: 'class-drill-invoice', name: 'InvoiceService', methods: [{ id: 'method-drill-issue', name: 'issueInvoice', visibility: 'public', fragments: [
        { id: 'frag-drill-load-order', label: '注文を読み込む', lines: 2, responsibility: 'loading', code: { csharp: 'var order = await _orders.FindAsync(orderId);\nif (order == null) throw new OrderNotFoundException(orderId);' } },
        { id: 'frag-drill-subtotal', label: '小計を計算する', lines: 3, responsibility: 'pricing', code: { csharp: 'var subtotal = order.Items.Sum(item => item.Price * item.Quantity);\nvar discount = order.Coupon?.Discount ?? 0;\nsubtotal -= discount;' } },
        { id: 'frag-drill-tax', label: '税額を計算する', lines: 3, responsibility: 'pricing', code: { csharp: 'var taxRate = order.IsReducedRate ? 0.08m : 0.10m;\nvar tax = decimal.Round(subtotal * taxRate, 0);\nvar total = subtotal + tax;' } },
        { id: 'frag-drill-save-invoice', label: '請求書を保存する', lines: 2, responsibility: 'persistence', code: { csharp: 'var invoice = new Invoice(orderId, total);\nawait _invoices.SaveAsync(invoice);' } },
      ] }],
    }] }] },
  },
  {
    id: 'drill-move-method', level: 'drill', title: 'ドリル3: メソッドを持ち主のクラスへ移す',
    problem: 'OrderServiceに送料の計算まで入っている',
    description: '注文を確定する OrderService に送料計算も置かれている。送料を担当するクラスは空のまま。',
    why: '送料の計算を変えるとき、注文の処理を読まずに済みます。',
    goal: 'calculateShippingFee を ShippingCalculator へドラッグで移そう',
    learns: ['Move Method'], principles: ['srp'], checks: [], changeRequests: [],
    limits: { method: 14, class: 30, file: 35 }, dependencyLimit: 1, responsibilityLimit: 1,
    classNames: { ordering: 'OrderHandler', shipping: 'ShippingFeeHandler' },
    methodNames: { ordering: 'placeOrder', shipping: 'calculateShippingFee' },
    responsibilityNames: { ordering: '注文の確定', shipping: '送料計算' },
    codebase: { files: [
      { id: 'file-drill-order', path: 'src/order/OrderService.ts', classes: [{ id: 'class-drill-order', name: 'OrderService', methods: [
        { id: 'method-drill-place', name: 'placeOrder', visibility: 'public', fragments: [
          { id: 'frag-drill-validate-order', label: '注文を確認する', lines: 2, responsibility: 'ordering', code: { csharp: 'if (order.Items.Count == 0) throw new InvalidOrderException();\norder.Validate();' } },
          { id: 'frag-drill-place-order', label: '注文を確定する', lines: 2, responsibility: 'ordering', code: { csharp: 'await _orders.SaveAsync(order);\nawait _unitOfWork.CommitAsync();' } },
        ] },
        { id: 'method-drill-shipping', name: 'calculateShippingFee', visibility: 'public', fragments: [
          { id: 'frag-drill-shipping-fee', label: '送料を計算する', lines: 2, responsibility: 'shipping', code: { csharp: 'var fee = distance * ratePerKilometer;\nreturn decimal.Round(fee, 0);' } },
        ] },
      ] }] },
      { id: 'file-drill-shipping', path: 'src/shipping/ShippingCalculator.ts', classes: [{ id: 'class-drill-shipping', name: 'ShippingCalculator', methods: [] }] },
    ] },
  },
];
