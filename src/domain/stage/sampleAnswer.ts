import { addClass } from '../codebase/addClass';
import { addFile } from '../codebase/addFile';
import { allClasses, type Codebase } from '../codebase/Codebase';
import { deleteFile } from '../codebase/deleteFile';
import { extractMethod } from '../codebase/extractMethod';
import { mergeMethods } from '../codebase/mergeMethods';
import { moveClass } from '../codebase/moveClass';
import { moveMethod } from '../codebase/moveMethod';
import { setSuperclass } from '../codebase/setSuperclass';
import type { Result } from '../shared/Result';
import type { Stage } from './Stage';

/** 模範解答の1手。メソッド・クラス・ファイルは、プレイヤーと同じく名前(パス)で指定する。 */
export type SolutionStep =
  | {
      readonly extract: {
        readonly from: string;
        /** 同名メソッドが複数クラスに存在するときだけ指定する、抽出元クラスの名前による絞り込み。 */
        readonly fromClass?: string;
        readonly fragmentIds: readonly string[];
        readonly name: string;
      };
    }
  | { readonly move: { readonly method: string; readonly toClass: string } }
  | {
      readonly merge: {
        readonly methodA: string;
        readonly methodAClass?: string;
        readonly methodB: string;
        readonly methodBClass?: string;
        readonly name: string;
      };
    }
  | { readonly addFile: string }
  | { readonly deleteFile: string }
  | { readonly addClass: { readonly name: string; readonly file: string } }
  | { readonly moveClass: { readonly name: string; readonly toFile: string } }
  | {
      readonly setSuperclass: {
        readonly class: string;
        readonly superclass: string;
        readonly kind?: 'extends' | 'implements';
      };
    };

function unwrap<T, E>(result: Result<T, E>): T {
  if (!result.ok) throw new Error(`模範解答の適用に失敗しました: ${String(result.error)}`);
  return result.value;
}

function classIdByName(codebase: Codebase, name: string): string {
  const found = allClasses(codebase).find((codeClass) => codeClass.name === name);
  if (found === undefined) throw new Error(`クラス ${name} がありません`);
  return found.id;
}

function methodIdByName(codebase: Codebase, name: string, ownerClassName?: string): string {
  const found = allClasses(codebase)
    .filter((codeClass) => ownerClassName === undefined || codeClass.name === ownerClassName)
    .flatMap((codeClass) => codeClass.methods)
    .find((method) => method.name === name);
  if (found === undefined) throw new Error(`メソッド ${name} がありません`);
  return found.id;
}

function fileIdByPath(codebase: Codebase, path: string): string {
  const found = codebase.files.find((file) => file.path === path);
  if (found === undefined) throw new Error(`ファイル ${path} がありません`);
  return found.id;
}

function applyStep(codebase: Codebase, step: SolutionStep, newId: string): Codebase {
  if ('extract' in step) {
    const { from, fromClass, fragmentIds, name } = step.extract;
    const sourceMethodId = methodIdByName(codebase, from, fromClass);
    return unwrap(extractMethod(codebase, { sourceMethodId, fragmentIds, newMethodId: newId, newMethodName: name }));
  }
  if ('move' in step) {
    return unwrap(moveMethod(codebase, methodIdByName(codebase, step.move.method), classIdByName(codebase, step.move.toClass)));
  }
  if ('merge' in step) {
    const { methodA, methodAClass, methodB, methodBClass, name } = step.merge;
    const methodAId = methodIdByName(codebase, methodA, methodAClass);
    const methodBId = methodIdByName(codebase, methodB, methodBClass);
    return unwrap(mergeMethods(codebase, { methodAId, methodBId, newMethodId: newId, newMethodName: name }));
  }
  if ('addFile' in step) return unwrap(addFile(codebase, step.addFile, newId));
  if ('deleteFile' in step) return unwrap(deleteFile(codebase, fileIdByPath(codebase, step.deleteFile)));
  if ('addClass' in step) {
    return unwrap(addClass(codebase, fileIdByPath(codebase, step.addClass.file), step.addClass.name, newId));
  }
  if ('moveClass' in step) {
    const { name, toFile } = step.moveClass;
    return unwrap(moveClass(codebase, classIdByName(codebase, name), fileIdByPath(codebase, toFile)));
  }
  const { class: className, superclass, kind } = step.setSuperclass;
  return unwrap(setSuperclass(codebase, classIdByName(codebase, className), superclass, kind));
}

/** 手順を順番に適用する。新しく振るIDは呼び出し元のIDと衝突しないよう連番にする。 */
export function applySolutionSteps(codebase: Codebase, steps: readonly SolutionStep[]): Codebase {
  return steps.reduce((current, step, index) => applyStep(current, step, `solution-${String(index)}`), codebase);
}

/** 中級4・中級5の共通の前半。税と整形の両方をメソッドへ抽出する(どちらを別クラスへ出すかだけが違う)。 */
const salesReportExtractions: readonly SolutionStep[] = [
  { extract: { from: 'generateMonthlyReport', fragmentIds: ['frag-monthly-tax'], name: 'calculateMonthlyTax' } },
  { extract: { from: 'generateMonthlyReport', fragmentIds: ['frag-monthly-format'], name: 'formatMonthlyReport' } },
  { extract: { from: 'generateQuarterlyReport', fragmentIds: ['frag-quarterly-tax'], name: 'calculateQuarterlyTax' } },
  { extract: { from: 'generateQuarterlyReport', fragmentIds: ['frag-quarterly-format'], name: 'formatQuarterlyReport' } },
];

/**
 * ステージを100点にできる模範解答の手順。キーは Stage['id']。
 * ステージの数値(行数上限など)を変えて解けなくなったら stageCatalog.test.ts が落ちる。
 */
export const sampleAnswerSteps: Partial<Record<string, readonly SolutionStep[]>> = {
  'tutorial-extract-method': [
    { extract: { from: 'printMonthlyReport', fragmentIds: ['frag-aggregate-sales', 'frag-compare-last-month'], name: 'aggregateSales' } },
  ],
  'tutorial-order-service': [
    { extract: { from: 'placeOrder', fragmentIds: ['frag-validate-items', 'frag-validate-stock'], name: 'validateOrder' } },
    { extract: { from: 'placeOrder', fragmentIds: ['frag-tax'], name: 'calculateTax' } },
    { extract: { from: 'placeOrder', fragmentIds: ['frag-save'], name: 'saveOrder' } },
    { move: { method: 'calculateTax', toClass: 'TaxCalculator' } },
  ],
  'beginner-user-controller': [
    { extract: { from: 'registerUser', fragmentIds: ['frag-save-user'], name: 'saveUser' } },
    { extract: { from: 'registerUser', fragmentIds: ['frag-welcome-mail'], name: 'sendWelcomeMail' } },
    { extract: { from: 'deleteUser', fragmentIds: ['frag-delete-user'], name: 'removeUserRecord' } },
    { extract: { from: 'deleteUser', fragmentIds: ['frag-farewell-mail'], name: 'sendFarewellMail' } },
    { move: { method: 'saveUser', toClass: 'UserRepository' } },
    { move: { method: 'removeUserRecord', toClass: 'UserRepository' } },
    { move: { method: 'sendWelcomeMail', toClass: 'Mailer' } },
    { move: { method: 'sendFarewellMail', toClass: 'Mailer' } },
  ],
  'beginner-invoice-service': [
    { extract: { from: 'issueInvoice', fragmentIds: ['frag-render-pdf'], name: 'renderPdf' } },
    { extract: { from: 'issueInvoice', fragmentIds: ['frag-store-pdf'], name: 'storePdf' } },
    { extract: { from: 'sendInvoice', fragmentIds: ['frag-attach-mail'], name: 'mailInvoice' } },
    { addClass: { name: 'InvoicePdfRenderer', file: 'src/invoice/InvoiceService.ts' } },
    { addClass: { name: 'InvoiceStorage', file: 'src/invoice/InvoiceService.ts' } },
    { addClass: { name: 'InvoiceMailer', file: 'src/invoice/InvoiceService.ts' } },
    { move: { method: 'renderPdf', toClass: 'InvoicePdfRenderer' } },
    { move: { method: 'storePdf', toClass: 'InvoiceStorage' } },
    { move: { method: 'mailInvoice', toClass: 'InvoiceMailer' } },
  ],
  'intermediate-cyclic-dependency': [
    { move: { method: 'calculateOrderTotal', toClass: 'Order' } },
    { move: { method: 'countOrdersOf', toClass: 'Customer' } },
    { extract: { from: 'checkout', fragmentIds: ['frag-reserve-stock', 'frag-order-total'], name: 'prepareOrder' } },
  ],
  'intermediate-god-file': [
    { move: { method: 'calculateShippingFee', toClass: 'ShippingService' } },
    { move: { method: 'addPoints', toClass: 'PointService' } },
    { addFile: 'src/shipping/ShippingService.ts' },
    { addFile: 'src/point/PointService.ts' },
    { moveClass: { name: 'ShippingService', toFile: 'src/shipping/ShippingService.ts' } },
    { moveClass: { name: 'PointService', toFile: 'src/point/PointService.ts' } },
  ],
  'intermediate-misplaced-private': [
    { extract: { from: 'notifyShipment', fragmentIds: ['frag-send-mail'], name: 'sendMail' } },
    { extract: { from: 'notifyShipment', fragmentIds: ['frag-log-delivery'], name: 'logDelivery' } },
    { move: { method: 'renderTemplate', toClass: 'NotificationService' } },
    { deleteFile: 'src/notification/TemplateEngine.ts' },
  ],
  'intermediate-volatile-tax': [
    ...salesReportExtractions,
    { addClass: { name: 'TaxCalculator', file: 'src/report/SalesReportService.ts' } },
    { move: { method: 'calculateMonthlyTax', toClass: 'TaxCalculator' } },
    { move: { method: 'calculateQuarterlyTax', toClass: 'TaxCalculator' } },
  ],
  'intermediate-volatile-format': [
    ...salesReportExtractions,
    { addClass: { name: 'ReportFormatter', file: 'src/report/SalesReportService.ts' } },
    { move: { method: 'formatMonthlyReport', toClass: 'ReportFormatter' } },
    { move: { method: 'formatQuarterlyReport', toClass: 'ReportFormatter' } },
  ],
  'advanced-notifier-hierarchy': [
    { extract: { from: 'notifyByEmail', fragmentIds: ['frag-build-body-email'], name: 'buildEmailBody' } },
    { extract: { from: 'notifyByEmail', fragmentIds: ['frag-log-email'], name: 'logEmailNotification' } },
    { extract: { from: 'notifyBySms', fragmentIds: ['frag-build-body-sms'], name: 'buildSmsBody' } },
    { extract: { from: 'notifyBySms', fragmentIds: ['frag-log-sms'], name: 'logSmsNotification' } },
    { merge: { methodA: 'logEmailNotification', methodB: 'logSmsNotification', name: 'logNotification' } },
    { move: { method: 'logNotification', toClass: 'NotifierBase' } },
    { setSuperclass: { class: 'EmailNotifier', superclass: 'NotifierBase' } },
    { setSuperclass: { class: 'SmsNotifier', superclass: 'NotifierBase' } },
  ],
  'advanced-payment-gateway-interface': [
    // StripeGateway・PaypalGatewayとも決済API呼び出し側のメソッド名が最初から同じ(charge)なので、
    // fromClassでクラスを指定してどちらのchargeから抽出するかを曖昧さなく指定する。
    { extract: { from: 'charge', fromClass: 'StripeGateway', fragmentIds: ['frag-log-payment-stripe'], name: 'logStripePayment' } },
    { extract: { from: 'charge', fromClass: 'PaypalGateway', fragmentIds: ['frag-log-payment-paypal'], name: 'logPaypalPayment' } },
    { setSuperclass: { class: 'StripeGateway', superclass: 'PaymentGateway', kind: 'implements' } },
    { setSuperclass: { class: 'PaypalGateway', superclass: 'PaymentGateway', kind: 'implements' } },
  ],
  'advanced-discount-strategy': [
    // 3つとも同じ名前(calculate)で抽出するため、Extract Methodの「同じクラス内で名前が重複できない」制約に
    // 従い、次の抽出の前に必ず直前のcalculateを移動して DiscountService から追い出す(抽出→移動を1組ずつ行う)。
    { addFile: 'src/pricing/RegularDiscount.ts' },
    { addFile: 'src/pricing/PremiumDiscount.ts' },
    { addFile: 'src/pricing/VipDiscount.ts' },
    { addClass: { name: 'RegularDiscount', file: 'src/pricing/RegularDiscount.ts' } },
    { addClass: { name: 'PremiumDiscount', file: 'src/pricing/PremiumDiscount.ts' } },
    { addClass: { name: 'VipDiscount', file: 'src/pricing/VipDiscount.ts' } },
    { extract: { from: 'calculateDiscount', fragmentIds: ['frag-branch-regular'], name: 'calculate' } },
    { move: { method: 'calculate', toClass: 'RegularDiscount' } },
    { extract: { from: 'calculateDiscount', fragmentIds: ['frag-branch-premium'], name: 'calculate' } },
    { move: { method: 'calculate', toClass: 'PremiumDiscount' } },
    { extract: { from: 'calculateDiscount', fragmentIds: ['frag-branch-vip'], name: 'calculate' } },
    { move: { method: 'calculate', toClass: 'VipDiscount' } },
    { setSuperclass: { class: 'RegularDiscount', superclass: 'DiscountStrategy', kind: 'implements' } },
    { setSuperclass: { class: 'PremiumDiscount', superclass: 'DiscountStrategy', kind: 'implements' } },
    { setSuperclass: { class: 'VipDiscount', superclass: 'DiscountStrategy', kind: 'implements' } },
  ],
  'advanced-report-factory': [
    { extract: { from: 'exportWeeklyReport', fragmentIds: ['frag-build-report-weekly'], name: 'buildWeeklyReport' } },
    { extract: { from: 'exportMonthlyReport', fragmentIds: ['frag-build-report-monthly'], name: 'buildMonthlyReport' } },
    { merge: { methodA: 'buildWeeklyReport', methodB: 'buildMonthlyReport', name: 'buildReport' } },
    { move: { method: 'buildReport', toClass: 'ReportFactory' } },
  ],
};

/** ステージの模範解答を適用した最終形のコードベース。「解答例の図」に使う。 */
export function sampleAnswerCodebase(
  stage: Pick<Stage, 'id' | 'codebase'>,
  steps: Partial<Record<string, readonly SolutionStep[]>> = sampleAnswerSteps,
): Codebase {
  const solution = steps[stage.id];
  if (solution === undefined) throw new Error(`ステージ ${stage.id} の模範解答が定義されていません`);
  return applySolutionSteps(stage.codebase, solution);
}
