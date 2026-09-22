import { addClass } from '../codebase/addClass';
import { addFile } from '../codebase/addFile';
import { allClasses, type Codebase } from '../codebase/Codebase';
import { extractMethod } from '../codebase/extractMethod';
import { moveClass } from '../codebase/moveClass';
import { moveMethod } from '../codebase/moveMethod';
import { setSuperclass } from '../codebase/setSuperclass';
import type { Result } from '../shared/Result';
import type { Stage } from './Stage';

/** 模範解答の1手。メソッド・クラス・ファイルは、プレイヤーと同じく名前(パス)で指定する。 */
export type SolutionStep =
  | { readonly extract: { readonly from: string; readonly fragmentIds: readonly string[]; readonly name: string } }
  | { readonly move: { readonly method: string; readonly toClass: string } }
  | { readonly addFile: string }
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

function methodIdByName(codebase: Codebase, name: string): string {
  const found = allClasses(codebase)
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
    const { from, fragmentIds, name } = step.extract;
    const sourceMethodId = methodIdByName(codebase, from);
    return unwrap(extractMethod(codebase, { sourceMethodId, fragmentIds, newMethodId: newId, newMethodName: name }));
  }
  if ('move' in step) {
    return unwrap(moveMethod(codebase, methodIdByName(codebase, step.move.method), classIdByName(codebase, step.move.toClass)));
  }
  if ('addFile' in step) return unwrap(addFile(codebase, step.addFile, newId));
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
  ],
  'advanced-notifier-hierarchy': [
    { extract: { from: 'notifyByEmail', fragmentIds: ['frag-build-body-email'], name: 'buildEmailBody' } },
    { extract: { from: 'notifyByEmail', fragmentIds: ['frag-log-email'], name: 'logEmailNotification' } },
    { move: { method: 'buildEmailBody', toClass: 'NotifierBase' } },
    { move: { method: 'logEmailNotification', toClass: 'NotifierBase' } },
    { setSuperclass: { class: 'EmailNotifier', superclass: 'NotifierBase' } },
    { extract: { from: 'notifyBySms', fragmentIds: ['frag-build-body-sms'], name: 'buildSmsBody' } },
    { extract: { from: 'notifyBySms', fragmentIds: ['frag-log-sms'], name: 'logSmsNotification' } },
    { move: { method: 'buildSmsBody', toClass: 'NotifierBase' } },
    { move: { method: 'logSmsNotification', toClass: 'NotifierBase' } },
    { setSuperclass: { class: 'SmsNotifier', superclass: 'NotifierBase' } },
  ],
  'advanced-payment-gateway-interface': [
    { move: { method: 'chargeStripe', toClass: 'PaymentGateway' } },
    { move: { method: 'chargePaypal', toClass: 'PaymentGateway' } },
    { setSuperclass: { class: 'StripeGateway', superclass: 'PaymentGateway', kind: 'implements' } },
    { setSuperclass: { class: 'PaypalGateway', superclass: 'PaymentGateway', kind: 'implements' } },
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
