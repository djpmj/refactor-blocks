import { describe, expect, it } from 'vitest';
import { allClasses, findClass, findSuperclass, type CodeClass, type Codebase } from '../../domain/codebase/Codebase';
import { sampleAnswerCodebase } from '../../domain/stage/sampleAnswer';
import { advancedStages } from './advancedStages';

function classNamed(codebase: Codebase, name: string) {
  const found = allClasses(codebase).find((codeClass) => codeClass.name === name);
  if (found === undefined) throw new Error(`クラス ${name} がありません`);
  return found;
}

function fragmentResponsibilities(codeClass: CodeClass): string[] {
  return codeClass.methods.flatMap((method) => method.fragments.map((fragment) => fragment.responsibility));
}

/**
 * 採点(line-limit/coupling/cycle/responsibility)は継承の有無を見ないので、
 * 「模範解答で100点になる」だけでは継承が実際に使われているかを確認できない。
 * この上級ステージの狙いそのもの(継承元の設定)を別途確認する。
 */
describe('advanced-notifier-hierarchy', () => {
  const [stage] = advancedStages;

  it('模範解答では、EmailNotifier・SmsNotifierの継承元がどちらもNotifierBaseになる', () => {
    // Arrange
    const solved = sampleAnswerCodebase(stage);

    // Act
    const emailSuperclass = findSuperclass(solved, 'class-email-notifier');
    const smsSuperclass = findSuperclass(solved, 'class-sms-notifier');

    // Assert
    expect(emailSuperclass?.name).toBe('NotifierBase');
    expect(smsSuperclass?.name).toBe('NotifierBase');
  });

  it('模範解答では、共通処理(通知文の組み立て・ログ記録)がNotifierBaseに集まる', () => {
    // Arrange
    const solved = sampleAnswerCodebase(stage);

    // Act
    const notifierBase = findClass(solved, 'class-notifier-base');
    const methodNames = notifierBase?.methods.map((method) => method.name) ?? [];

    // Assert
    expect(methodNames).toEqual(['buildEmailBody', 'logEmailNotification', 'buildSmsBody', 'logSmsNotification']);
  });

  it('初期状態では、まだ継承関係が結ばれていない', () => {
    // Arrange
    const { codebase } = stage;

    // Act
    const superclasses = allClasses(codebase).map((codeClass) => findSuperclass(codebase, codeClass.id));

    // Assert
    expect(superclasses.every((superclass) => superclass === undefined)).toBe(true);
  });
});

/**
 * 採点(line-limit/coupling/cycle/responsibility)は実装関係の有無を見ないので、
 * 「模範解答で100点になる」だけでは実装関係が実際に使われているかを確認できない。
 * この上級ステージの狙いそのもの(実装先の設定)を別途確認する。
 */
describe('advanced-payment-gateway-interface', () => {
  const stage = advancedStages.find((candidate) => candidate.id === 'advanced-payment-gateway-interface');
  if (stage === undefined) throw new Error('advanced-payment-gateway-interface ステージが見つかりません');

  it('模範解答では、StripeGateway・PaypalGatewayの実装先がどちらもPaymentGatewayになり、実装(implements)として記録される', () => {
    // Arrange
    const solved = sampleAnswerCodebase(stage);

    // Act
    const stripeSuperclass = findSuperclass(solved, 'class-stripe-gateway');
    const paypalSuperclass = findSuperclass(solved, 'class-paypal-gateway');
    const stripeClass = findClass(solved, 'class-stripe-gateway');
    const paypalClass = findClass(solved, 'class-paypal-gateway');

    // Assert
    expect(stripeSuperclass?.name).toBe('PaymentGateway');
    expect(paypalSuperclass?.name).toBe('PaymentGateway');
    expect(stripeClass?.superclassKind).toBe('implements');
    expect(paypalClass?.superclassKind).toBe('implements');
  });

  it('模範解答では、決済API呼び出しがPaymentGatewayに集まる', () => {
    // Arrange
    const solved = sampleAnswerCodebase(stage);

    // Act
    const paymentGateway = findClass(solved, 'class-payment-gateway');
    const methodNames = paymentGateway?.methods.map((method) => method.name) ?? [];

    // Assert
    expect(methodNames).toEqual(['chargeStripe', 'chargePaypal']);
  });

  it('初期状態では、まだ実装関係が結ばれていない', () => {
    // Arrange
    const { codebase } = stage;

    // Act
    const superclasses = allClasses(codebase).map((codeClass) => findSuperclass(codebase, codeClass.id));

    // Assert
    expect(superclasses.every((superclass) => superclass === undefined)).toBe(true);
  });
});

/**
 * 採点(line-limit/coupling/cycle/responsibility)は実装関係の有無を見ないので、
 * 「模範解答で100点になる」だけでは実装関係が実際に使われているかを確認できない。
 * この上級ステージの狙いそのもの(if分岐をStrategyパターンへ組み替える)を別途確認する。
 */
describe('advanced-discount-strategy', () => {
  const stage = advancedStages.find((candidate) => candidate.id === 'advanced-discount-strategy');
  if (stage === undefined) throw new Error('advanced-discount-strategy ステージが見つかりません');

  it('初期状態では、ランクごとの割引クラスが存在しない', () => {
    // Arrange
    const { codebase } = stage;

    // Act
    const classNames = allClasses(codebase).map((codeClass) => codeClass.name);

    // Assert
    expect(classNames).not.toContain('RegularDiscount');
    expect(classNames).not.toContain('PremiumDiscount');
    expect(classNames).not.toContain('VipDiscount');
  });

  it('模範解答では、RegularDiscount・PremiumDiscount・VipDiscountがすべてDiscountStrategyをimplementsする', () => {
    // Arrange
    const solved = sampleAnswerCodebase(stage);

    // Act
    const regular = classNamed(solved, 'RegularDiscount');
    const premium = classNamed(solved, 'PremiumDiscount');
    const vip = classNamed(solved, 'VipDiscount');

    // Assert
    expect(findSuperclass(solved, regular.id)?.name).toBe('DiscountStrategy');
    expect(findSuperclass(solved, premium.id)?.name).toBe('DiscountStrategy');
    expect(findSuperclass(solved, vip.id)?.name).toBe('DiscountStrategy');
    expect(regular.superclassKind).toBe('implements');
    expect(premium.superclassKind).toBe('implements');
    expect(vip.superclassKind).toBe('implements');
  });

  it('模範解答では、DiscountServiceの中に割引ロジックの処理が残らない', () => {
    // Arrange
    const solved = sampleAnswerCodebase(stage);

    // Act
    const responsibilities = fragmentResponsibilities(classNamed(solved, 'DiscountService'));

    // Assert
    expect(responsibilities).not.toContain('discount-regular');
    expect(responsibilities).not.toContain('discount-premium');
    expect(responsibilities).not.toContain('discount-vip');
  });
});
