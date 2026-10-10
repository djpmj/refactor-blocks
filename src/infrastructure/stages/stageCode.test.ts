import { describe, expect, it } from 'vitest';
import { allClasses, fieldsOf } from '../../domain/codebase/Codebase';
import { fragmentLines } from '../../domain/codebase/lineCount';
import { generateClassSource } from '../../domain/codebase/generateClassSource';
import type { Fragment } from '../../domain/codebase/Codebase';
import type { Stage } from '../../domain/stage/Stage';
import { blankDesignProblems } from '../blankDesigns/blankDesignProblems';
import { stages } from './stageCatalog';

const allStageDefinitions = [...stages, ...blankDesignProblems];

function fragmentsOf(stage: Stage): Fragment[] {
  return stage.codebase.files.flatMap((file) => file.classes.flatMap((codeClass) => codeClass.methods.flatMap((method) => method.fragments)));
}

function allFragments(): Fragment[] {
  return allStageDefinitions.flatMap(fragmentsOf);
}

function fragmentById(id: string): Fragment {
  const fragment = allFragments().find((candidate) => candidate.id === id);
  if (fragment === undefined) throw new Error(`Fragment がありません: ${id}`);
  return fragment;
}

function allFields() {
  return allStageDefinitions.flatMap((stage) => allClasses(stage.codebase).flatMap(fieldsOf));
}

function fieldReferenceMismatches(): string[] {
  const mismatches: string[] = [];
  for (const stage of allStageDefinitions) {
    const fields = new Map(allClasses(stage.codebase).flatMap(fieldsOf).map((field) => [field.id, field.name]));
    const fragments = allClasses(stage.codebase).flatMap((codeClass) => codeClass.methods.flatMap((method) => method.fragments));
    for (const fragment of fragments) {
      const fieldIds = [...(fragment.reads ?? []), ...(fragment.writes ?? [])];
      if (fieldIds.some((fieldId) => {
        const fieldName = fields.get(fieldId);
        return fieldName !== undefined && !(fragment.code?.csharp ?? '').includes(fieldName);
      })) mismatches.push(fragment.id);
    }
  }
  return [...new Set(mismatches)];
}

function useReferenceMismatches(): string[] {
  const mismatches: string[] = [];
  for (const stage of allStageDefinitions) {
    const methods = new Map(allClasses(stage.codebase).flatMap((codeClass) => codeClass.methods).map((method) => [method.id, method.name]));
    for (const fragment of fragmentsOf(stage)) {
      if (fragment.responsibility === 'call' && (fragment.uses?.length ?? 0) > 0) continue;
      const code = fragment.code?.csharp ?? '';
      if ((fragment.uses ?? []).some((methodId) => {
        const methodName = methods.get(methodId);
        return methodName !== undefined && !new RegExp(`\\b${methodName}\\s*\\(`).test(code);
      })) mismatches.push(fragment.id);
    }
  }
  return [...new Set(mismatches)];
}

function hasMissingAutoCall(fragment: Fragment, source: string, methods: ReadonlyMap<string, string>): boolean {
  for (const methodId of fragment.uses ?? []) {
    const targetName = methods.get(methodId);
    const argumentsList = fragment.callArguments?.join(', ') ?? '';
    if (targetName !== undefined && !source.includes(`${targetName}(${argumentsList});`)) return true;
  }
  return false;
}

function autoCallMismatchesForStage(stage: Stage): string[] {
  const mismatches: string[] = [];
  const classes = allClasses(stage.codebase);
  const methods = new Map(classes.flatMap((codeClass) => codeClass.methods).map((method) => [method.id, method.name]));
  for (const codeClass of classes) {
    const source = generateClassSource(stage.codebase, codeClass.id, 'csharp');
    for (const method of codeClass.methods) {
      for (const fragment of method.fragments) {
        if (fragment.responsibility === 'call' && hasMissingAutoCall(fragment, source, methods)) {
          mismatches.push(fragment.id);
        }
      }
    }
  }
  return mismatches;
}

function autoCallMismatches(): string[] {
  return allStageDefinitions.flatMap(autoCallMismatchesForStage);
}

function multiStatementLines(): Array<{ readonly fragment: string; readonly line: number; readonly text: string }> {
  const violations: Array<{ readonly fragment: string; readonly line: number; readonly text: string }> = [];
  for (const fragment of allFragments()) {
    const codeLines = (fragment.code?.csharp ?? '').split('\n');
    codeLines.forEach((text, index) => {
      const codeOnly = text.replace(/"(?:\\.|[^"\\])*"/g, '""');
      if ([...codeOnly.matchAll(/;/g)].length > 1 && !/^\s*for\s*\(/.test(text)) {
        violations.push({ fragment: fragment.id, line: index + 1, text });
      }
    });
  }
  return violations;
}

function lineLimitTextMismatches(): string[] {
  const mismatches: string[] = [];
  for (const stage of allStageDefinitions) {
    const text = `${stage.goal} ${stage.description}`;
    const expected = { メソッド: stage.limits.method, クラス: stage.limits.class, ファイル: stage.limits.file };
    for (const match of text.matchAll(/(メソッド|クラス|ファイル)は?(\d+)行/g)) {
      const scope = match[1];
      const number = Number(match[2]);
      let limit = expected.ファイル;
      if (scope === 'メソッド') limit = expected.メソッド;
      else if (scope === 'クラス') limit = expected.クラス;
      if (number !== limit) mismatches.push(`${stage.id}: ${scope} ${number} != ${limit}`);
    }
  }
  return mismatches;
}

function nonterminalReturns(): string[] {
  const returns: string[] = [];
  for (const stage of allStageDefinitions) {
    for (const codeClass of allClasses(stage.codebase)) {
      for (const method of codeClass.methods) {
        returns.push(...nonterminalReturnsOfMethod(stage.id, method));
      }
    }
  }
  return returns;
}

function nonterminalReturnsOfMethod(stageId: string, method: Stage['codebase']['files'][number]['classes'][number]['methods'][number]): string[] {
  const returned = method.fragments.slice(0, -1).filter((fragment) => fragment.code?.csharp?.split('\n').some((line) => /^\s*return\b/.test(line)));
  return returned.map((fragment) => `${stageId}: ${method.name}/${fragment.id}`);
}

describe('ステージのC#コード', () => {
  it('請求書メールは保存済みPDFを添付し、メールを送る', () => {
    const code = fragmentById('frag-attach-mail').code?.csharp ?? '';

    expect(code).toContain('_storage.DownloadAsync');
    expect(code).toContain('message.Attachments.Add');
    expect(code).toContain('_mailer.SendAsync');
  });

  it('通知文の組み立てとメール/SMS送信を分け、SMSはSMSクライアントへ送る', () => {
    const emailBody = fragmentById('frag-build-body-email').code?.csharp ?? '';
    const smsBody = fragmentById('frag-build-body-sms').code?.csharp ?? '';
    const smsDelivery = fragmentById('frag-send-sms').code?.csharp ?? '';

    expect(emailBody).toContain('var body =');
    expect(emailBody).not.toContain('_mailer.SendAsync');
    expect(smsBody).toContain('var body =');
    expect(smsBody).not.toContain('_mailer.SendAsync');
    expect(smsDelivery).toContain('SmsMessage');
    expect(smsDelivery).toContain('_smsClient.SendAsync');
  });

  it('割引計算の前に注文内容と会員ランクを検証する', () => {
    const code = fragmentById('frag-validate-order').code?.csharp ?? '';

    expect(code).toMatch(/Items|items/);
    expect(code).toContain('Count == 0');
    expect(code).toContain('MemberRank');
    expect(code).toContain('Enum.IsDefined(');
    expect(code).not.toContain('ApplyDiscount');
  });

  it('登録・注文・決済の入力検証は対象の入力を検証する', () => {
    const userValidation = fragmentById('frag-validate-input').code?.csharp ?? '';
    const placeValidation = fragmentById('frag-place-parse').code?.csharp ?? '';
    const cancelValidation = fragmentById('frag-cancel-parse').code?.csharp ?? '';
    const paymentValidation = fragmentById('frag-validate-payment').code?.csharp ?? '';

    expect(userValidation).toMatch(/user\.(Name|Email)|input\.(Name|Email)/);
    expect(placeValidation).toMatch(/orderId|customerId/);
    expect(cancelValidation).toMatch(/orderId/);
    expect(paymentValidation).toMatch(/card(Number|Token)|paymentToken/);
  });

  it('注文・請求・見積もり処理は取得または作成した値を後続へ渡す', () => {
    expect(fragmentById('frag-list-lines').code?.csharp).toMatch(/GetLinesAsync/);
    expect(fragmentById('frag-invoice-build').code?.csharp).toMatch(/InvoiceLine/);
    expect(fragmentById('frag-invoice-issue').code?.csharp).toMatch(/IssueAsync|SendAsync/);
    expect(fragmentById('frag-quote-estimate').code?.csharp).toMatch(/Sum\(|Total/);
    expect(fragmentById('frag-quote-save').code?.csharp).toContain('SaveAsync(aggregate');
  });

  it('決済プロバイダー設定とCSVヘッダー作成は固有の値を構成・返却する', () => {
    expect(fragmentById('frag-stripe-api-call').code?.csharp).toContain('_stripeClient');
    expect(fragmentById('frag-paypal-api-call').code?.csharp).toContain('_paypalClient');
    expect(fragmentById('frag-configure-stripe').code?.csharp).toContain('STRIPE_API_KEY');
    expect(fragmentById('frag-configure-paypal').code?.csharp).toContain('PAYPAL_CLIENT_SECRET');
    expect(fragmentById('frag-decide-header').code?.csharp).toMatch(/return header|Write.*header/);
  });

  it('発送状況の更新は注文IDと発送状態を永続化する', () => {
    const code = fragmentById('frag-blank-update-shipping-status').code?.csharp ?? '';
    expect(code).toContain('orderId');
    expect(code).toContain('UpdateStatusAsync');
    expect(code).toContain('Shipped');
  });

  it('アップロードは形式を分岐して対応するimporterを一つだけ実行する', () => {
    const csv = fragmentById('frag-dispatch-csv').code?.csharp ?? '';
    const json = fragmentById('frag-dispatch-json').code?.csharp ?? '';
    expect(csv).toMatch(/format == ".csv"/);
    expect(csv).toMatch(/importOrders/);
    expect(csv).not.toMatch(/throw.*CSVではありません/);
    expect(json).toMatch(/format == ".json"/);
    expect(json).toMatch(/importOrders/);
    expect(json).toMatch(/return/);
  });

  it('キャンセル要求検証と業務ルールは同じ状態を許可する', () => {
    const request = fragmentById('frag-cancel-parse').code?.csharp ?? '';
    const rule = fragmentById('frag-cancel-rule').code?.csharp ?? '';
    expect(request).toMatch(/Pending/);
    expect(rule).toMatch(/Pending/);
    expect(request).toMatch(/Confirmed/);
    expect(rule).toMatch(/Confirmed/);
    expect(rule).not.toContain('status != "Active"');
  });

  it('CSV/JSONの検証はorders全件を走査し、各注文を検証する', () => {
    for (const id of ['frag-csv-validate', 'frag-json-validate']) {
      const code = fragmentById(id).code?.csharp ?? '';
      expect(code).toMatch(/foreach \(var order in orders\)/);
      expect(code).toContain('order.Items');
      expect(code).toContain('order.Total');
    }
  });

  it('請求書の合計から割引後の同じinvoiceをPDF化し、保存する', () => {
    const sum = fragmentById('frag-sum-items').code?.csharp ?? '';
    const discount = fragmentById('frag-apply-discount').code?.csharp ?? '';
    const render = fragmentById('frag-render-pdf').code?.csharp ?? '';
    const store = fragmentById('frag-store-pdf').code?.csharp ?? '';
    expect(sum).toContain('subtotal =');
    expect(discount).toContain('invoice.Total =');
    expect(render).toContain('DrawInvoice(invoice)');
    expect(store).toContain('UploadAsync(key, document');
  });

  it('注文・請求・見積の税額を同じ集計値へ適用して保存する', () => {
    const taxCodes = ['frag-order-tax', 'frag-invoice-tax', 'frag-quote-tax'].map((id) => fragmentById(id).code?.csharp ?? '');
    expect(new Set(taxCodes).size).toBe(1);
    expect(taxCodes[0]).toContain('roundedTax');
    for (const id of ['frag-order-save', 'frag-invoice-issue', 'frag-quote-save']) {
      expect(fragmentById(id).code?.csharp).toContain('aggregate.ApplyTax(roundedTax)');
    }
  });

  it('注文CSV出力はsalesからrowsを作り同じwriterへheaderとdataを書き込む', () => {
    const output = fragmentById('frag-output-csv').code?.csharp ?? '';
    const header = fragmentById('frag-decide-header').code?.csharp ?? '';
    const rows = fragmentById('frag-write-rows').code?.csharp ?? '';
    expect(output).toContain('sales.Select');
    expect(output).toContain('prepareExport(writer, rows)');
    expect(output).toContain('writeRows(writer, rows)');
    expect(header).toContain('writer.WriteLineAsync(header');
    expect(rows).toContain('writer.WriteLineAsync');
  });

  it('注文サービスは丸めた小計から税を計算し、同じ注文を保存して通知する', () => {
    const subtotal = fragmentById('frag-subtotal').code?.csharp ?? '';
    const tax = fragmentById('frag-tax').code?.csharp ?? '';
    const save = fragmentById('frag-save').code?.csharp ?? '';
    const mail = fragmentById('frag-mail').code?.csharp ?? '';
    expect(subtotal).toContain('order.Subtotal = decimal.Round(total, 2)');
    expect(tax).toContain('order.Subtotal * taxRate');
    expect(tax).toContain('order.Total');
    expect(save).toContain('SaveAsync(order');
    expect(mail).toContain('order.Id');
  });

  it('利用者登録は作成したuserを保存し、同じuserから通知と応答を作る', () => {
    expect(fragmentById('frag-save-user').code?.csharp).toContain('User.Create(');
    expect(fragmentById('frag-save-user').code?.csharp).toContain('SaveAsync(user');
    expect(fragmentById('frag-welcome-mail').code?.csharp).toContain('user.Email');
    expect(fragmentById('frag-register-response').code?.csharp).toContain('user.Id');
  });

  it('会員割引後の金額を決済し、住所変更は宣言した3フィールドを更新する', () => {
    expect(fragmentById('frag-pay').code?.csharp).toContain('ChargeAsync(discountedTotal');
    const address = fragmentById('frag-update-address');
    expect(address.code?.csharp).toContain('postalCode =');
    expect(address.code?.csharp).toContain('prefecture =');
    expect(address.code?.csharp).toContain('addressLine =');
    expect(address.writes).toEqual(['field-postal-code', 'field-prefecture', 'field-address-line']);
  });

  it('MemberRankと送料から注文を作り、作成した注文を保存する', () => {
    expect(fragmentById('frag-checkout-rank').code?.csharp).toContain('new Order(items, total)');
    expect(fragmentById('frag-checkout-save').code?.csharp).toContain('SaveAsync(order');
    expect(fragmentById('frag-place-price').code?.csharp).toContain('var total =');
    expect(fragmentById('frag-place-save').code?.csharp).toContain('new Order(items, total)');
    expect(fragmentById('frag-place-save').code?.csharp).toContain('SaveAsync(order');
    expect(fragmentById('frag-cancel-save').code?.csharp).toContain('Cancel(refundAmount)');
  });

  it('割引計算でitemsからsubtotalを作り、復旧確認後だけincident taskを完了する', () => {
    expect(fragmentById('frag-validate-order').code?.csharp).toContain('subtotal = items.Sum');
    expect(fragmentById('frag-branch-premium').code?.csharp).toContain('subtotal');
    const completion = fragmentById('frag-incident-dispatch-complete').code?.csharp ?? '';
    expect(completion).toContain('incident.IsRecovered');
    expect(completion).toContain('completeTask');
  });

  it('JSON parseはnull・空データを検証し、注文検証前にordersを確定する', () => {
    const parse = fragmentById('frag-json-parse').code?.csharp ?? '';
    const validate = fragmentById('frag-json-validate').code?.csharp ?? '';
    expect(parse).toContain('Deserialize<List<Order>>() ?? throw');
    expect(parse).toContain('orders.Count == 0');
    expect(validate).toContain('foreach (var order in orders)');
  });

  it('shipping fee returns the calculated fee and cart checkout passes one priced order through its calls', () => {
    const shipping = fragmentById('frag-shipping-fee').code?.csharp ?? '';
    const subtotal = fragmentById('frag-cart-subtotal').code?.csharp ?? '';
    const shippingCall = fragmentById('frag-call-shipping-fee').code?.csharp ?? '';
    const pointsCall = fragmentById('frag-call-add-points').code?.csharp ?? '';
    expect(shipping).toContain('order.Total += shippingFee');
    expect(subtotal).toContain('new Order(items, roundedTotal)');
    expect(shippingCall).toBe('');
    expect(pointsCall).toBe('');
    expect(fragmentById('frag-add-points').code?.csharp).toContain('order.Total / pointsUnit');
  });

  it('payroll uses total pay for deductions and the transfer amount', () => {
    const overtime = fragmentById('frag-overtime-pay').code?.csharp ?? '';
    const withholding = fragmentById('frag-withholding').code?.csharp ?? '';
    const transfer = fragmentById('frag-pay-transfer').code?.csharp ?? '';
    expect(overtime).toContain('totalPay = baseSalary + overtimePay');
    expect(withholding).toContain('totalPay');
    expect(transfer).toContain('payroll.NetSalary');
    expect(transfer).not.toMatch(/\bwithholding\b/);
  });

  it('mailing label formats the declared address fields without mutating them', () => {
    const label = fragmentById('frag-format-address').code?.csharp ?? '';
    expect(label).toContain('{normalizedPostalCode} {prefecture} {addressLine}');
    expect(label).toContain('return label');
    expect(label).not.toMatch(/(?:postalCode|prefecture|addressLine)\s*=/);
  });

  it('member rank price and shipping branches avoid duplicate local declarations', () => {
    const price = ['frag-price-regular', 'frag-price-premium', 'frag-price-vip']
      .map((id) => fragmentById(id).code?.csharp ?? '').join('\n');
    const shipping = ['frag-shipping-regular', 'frag-shipping-premium', 'frag-shipping-vip']
      .map((id) => fragmentById(id).code?.csharp ?? '').join('\n');
    const declared = (code: string, name: string) => [...code.matchAll(new RegExp(`var ${name}\\s*=`, 'g'))].length;
    expect(declared(price, 'total')).toBeLessThanOrEqual(1);
    expect(declared(price, 'discountedTotal')).toBeLessThanOrEqual(1);
    expect(declared(shipping, 'zone')).toBeLessThanOrEqual(1);
    expect(declared(shipping, 'shippingFee')).toBeLessThanOrEqual(1);
  });

  it('premium and VIP discounts use distinct locals in the shared method scope', () => {
    const premium = fragmentById('frag-branch-premium').code?.csharp ?? '';
    const vip = fragmentById('frag-branch-vip').code?.csharp ?? '';
    expect(premium).toContain('discountedTotal');
    expect(vip).toContain('vipDiscountedTotal');
  });

  it('blank order flow forwards the taxed amount into persistence before notifying', () => {
    const place = fragmentById('frag-blank-place-order').code?.csharp ?? '';
    const tax = fragmentById('frag-blank-calculate-order-tax').code?.csharp ?? '';
    const save = fragmentById('frag-blank-save-order').code?.csharp ?? '';
    expect(place).toContain('var taxedAmount = calculateOrderTax(amount)');
    expect(place).toContain('saveOrder(taxedAmount)');
    expect(place).toContain('sendOrderConfirmMail');
    expect(tax).toContain('return amount + taxAmount');
    expect(save).toContain('Order.FromAmount(amount)');
    expect(save).toContain('SaveAsync(entity');
  });

  it('payroll transfer uses the net salary already applied to the payroll aggregate', () => {
    const transfer = fragmentById('frag-pay-transfer').code?.csharp ?? '';
    expect(transfer).toContain('payroll.NetSalary');
    expect(transfer).not.toMatch(/\bwithholding\b/);
    expect(transfer).toContain('new BankTransfer(bankAccount, netPay)');
  });

  it('cart shipping updates the same order total before points are calculated', () => {
    const subtotal = fragmentById('frag-cart-subtotal').code?.csharp ?? '';
    const shipping = fragmentById('frag-shipping-fee').code?.csharp ?? '';
    const pointsHelper = fragmentById('frag-add-points').code?.csharp ?? '';
    const shippingCall = fragmentById('frag-call-shipping-fee').code?.csharp;
    const points = fragmentById('frag-call-add-points').code?.csharp;
    expect(subtotal).toContain('new Order(items, roundedTotal)');
    expect(shipping).toContain('order.Total += shippingFee');
    expect(pointsHelper).toContain('order.Total / pointsUnit');
    expect(shippingCall).toBeUndefined();
    expect(points).toBeUndefined();
  });

  it('generated cart calls pass the order into both helpers and declare it in each signature', () => {
    const stage = allStageDefinitions.find((candidate) => candidate.id === 'intermediate-god-file');
    if (stage === undefined) throw new Error('CartService stage がありません');
    const cartClass = allClasses(stage.codebase).find((codeClass) => codeClass.id === 'class-cart-service');
    if (cartClass === undefined) throw new Error('CartService がありません');
    const source = generateClassSource(stage.codebase, cartClass.id, 'csharp');

    expect(source).toContain('calculateShippingFee(order);');
    expect(source).toContain('addPoints(order);');
    expect(source).toContain('void calculateShippingFee(Order order)');
    expect(source).toContain('void addPoints(Order order)');
  });

  it('call fragments with uses leave their C# code for automatic call generation', () => {
    const explicitCalls = allFragments().filter((fragment) => fragment.responsibility === 'call'
      && (fragment.uses?.length ?? 0) > 0
      && fragment.code?.csharp !== undefined);
    expect(explicitCalls.map((fragment) => fragment.id)).toEqual([]);

    expect(autoCallMismatches()).toEqual([]);
  });

  it('each C# statement occupies its own physical line', () => {
    expect(multiStatementLines()).toEqual([]);
  });

  it('goal / description に書かれた行数上限はlimitsと一致する', () => {
    expect(lineLimitTextMismatches()).toEqual([]);
  });

  it('後続Fragmentがあるコードに無条件のreturnがない', () => {
    expect(nonterminalReturns()).toEqual([]);
  });

  it.each(allStageDefinitions)('$title: 全クラスのコード表示に未入力がない', (stage) => {
    // Arrange
    const sources = allClasses(stage.codebase).map((codeClass) => generateClassSource(stage.codebase, codeClass.id, 'csharp'));

    // Act
    const missingCode = sources.filter((source) => source.includes('未入力'));

    // Assert
    expect(missingCode).toEqual([]);
  });

  it.each(allStageDefinitions)('$title: コードを持つFragmentのlinesが実際の行数と一致する', (stage) => {
    // Arrange
    const fragments = fragmentsOf(stage);

    // Act
    const mismatches = fragments.filter((fragment) => fragment.code?.csharp !== undefined
      && fragment.lines !== fragmentLines(fragment));

    // Assert
    expect(mismatches.map((fragment) => fragment.id)).toEqual([]);
  });

  it('同じduplicateGroupを持つFragmentのC#コードは完全一致する', () => {
    // Arrange
    const groups = new Map<string, string[]>();
    const missingCode: string[] = [];
    for (const fragment of allFragments()) {
      if (fragment.duplicateGroup === undefined) continue;
      const code = fragment.code?.csharp;
      if (code === undefined) {
        missingCode.push(fragment.id);
        continue;
      }
      groups.set(fragment.duplicateGroup, [...(groups.get(fragment.duplicateGroup) ?? []), code]);
    }

    // Act
    const mismatches = [...groups.entries()].filter(([, codes]) => new Set(codes).size > 1);

    // Assert
    expect(missingCode).toEqual([]);
    expect(mismatches.map(([group]) => group)).toEqual([]);
  });

  it('reads / writes で宣言したフィールドをコード内で参照する', () => {
    expect(fieldReferenceMismatches()).toEqual([]);
  });

  it('uses で宣言したメソッドをコード内で呼び出す', () => {
    expect(useReferenceMismatches()).toEqual([]);
  });

  it('全ステージのフィールドにC#型がある', () => {
    // Arrange
    const fields = allFields();

    // Act
    const missingTypes = fields.filter((field) => field.type?.csharp === undefined);

    // Assert
    expect(missingTypes.map((field) => field.id)).toEqual([]);
  });
});
