import { describe, expect, it } from 'vitest';
import { allClasses, findClass, findSuperclass, type CodeClass, type Codebase } from '../../domain/codebase/Codebase';
import { classDependencies } from '../../domain/codebase/dependencies';
import { scoreCodebase } from '../../domain/scoring/score';
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

  it('模範解答では、統合された送信ログ記録処理だけがNotifierBaseに集まる(通知文の組み立ては各クラスに残る)', () => {
    // Arrange
    const solved = sampleAnswerCodebase(stage);

    // Act
    const notifierBase = findClass(solved, 'class-notifier-base');
    const methodNames = notifierBase?.methods.map((method) => method.name) ?? [];
    const emailMethodNames = classNamed(solved, 'EmailNotifier').methods.map((method) => method.name);
    const smsMethodNames = classNamed(solved, 'SmsNotifier').methods.map((method) => method.name);

    // Assert
    expect(methodNames).toEqual(['logNotification']);
    expect(emailMethodNames).toContain('buildEmailBody');
    expect(smsMethodNames).toContain('buildSmsBody');
  });

  it('模範解答では、NotifierBaseに移した処理はprivateのままにならず、継承した子クラスから呼べるprotectedになる', () => {
    // Arrange
    const solved = sampleAnswerCodebase(stage);

    // Act
    const notifierBase = findClass(solved, 'class-notifier-base');
    const visibilities = notifierBase?.methods.map((method) => method.visibility) ?? [];

    // Assert
    expect(visibilities).toEqual(['protected']);
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

  it('初期状態から、PaymentServiceはPaymentGateway(抽象)にだけ依存している(具象クラスを直接名指ししない)', () => {
    // Arrange
    const { codebase } = stage;

    // Act
    const dependencies = classDependencies(codebase);

    // Assert
    expect(dependencies).toEqual([{ from: 'class-payment-service', to: 'class-payment-gateway', cyclic: false }]);
  });

  it('初期状態では、まだ実装関係が結ばれていない', () => {
    // Arrange
    const { codebase } = stage;

    // Act
    const superclasses = allClasses(codebase).map((codeClass) => findSuperclass(codebase, codeClass.id));

    // Assert
    expect(superclasses.every((superclass) => superclass === undefined)).toBe(true);
  });

  it('初期状態から、PaymentGatewayは処理本体を持たない契約メソッド charge を1つだけ宣言している', () => {
    // Arrange
    const { codebase } = stage;

    // Act
    const paymentGateway = classNamed(codebase, 'PaymentGateway');

    // Assert
    expect(paymentGateway.methods.map((method) => method.name)).toEqual(['charge']);
    expect(paymentGateway.methods[0]?.fragments).toEqual([]);
  });

  it('初期状態から、StripeGateway・PaypalGatewayとも決済API呼び出し側のメソッド名がPaymentGatewayと同じchargeになっている(UML風のインターフェース実現)', () => {
    // Arrange
    const { codebase } = stage;

    // Act
    const stripeMethodNames = classNamed(codebase, 'StripeGateway').methods.map((method) => method.name);
    const paypalMethodNames = classNamed(codebase, 'PaypalGateway').methods.map((method) => method.name);

    // Assert
    expect(stripeMethodNames).toContain('charge');
    expect(paypalMethodNames).toContain('charge');
  });

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

  it('模範解答では、決済処理の実体はPaymentGatewayへ吸収されず、StripeGateway・PaypalGateway自身に残る', () => {
    // Arrange
    const solved = sampleAnswerCodebase(stage);

    // Act
    const stripeMethodNames = classNamed(solved, 'StripeGateway').methods.map((method) => method.name);
    const paypalMethodNames = classNamed(solved, 'PaypalGateway').methods.map((method) => method.name);
    const paymentGateway = findClass(solved, 'class-payment-gateway');

    // Assert
    expect(stripeMethodNames).toEqual(expect.arrayContaining(['charge', 'logStripePayment']));
    expect(paypalMethodNames).toEqual(expect.arrayContaining(['charge', 'logPaypalPayment']));
    expect(paymentGateway?.methods.map((method) => method.name)).toEqual(['charge']);
    expect(paymentGateway?.methods[0]?.fragments).toEqual([]);
  });

  it('模範解答を適用しても、PaymentServiceの依存本数は実装内容によらず変わらない(本物のDIPの性質)', () => {
    // Arrange
    const solved = sampleAnswerCodebase(stage);

    // Act
    const dependencies = classDependencies(solved);

    // Assert
    expect(dependencies).toEqual([{ from: 'class-payment-service', to: 'class-payment-gateway', cyclic: false }]);
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

  it('初期状態では、DiscountStrategyが実装すべきメソッド calculate を1つ宣言している(処理本体はない)', () => {
    // Arrange
    const { codebase } = stage;

    // Act
    const discountStrategy = classNamed(codebase, 'DiscountStrategy');

    // Assert
    expect(discountStrategy.methods.map((method) => method.name)).toEqual(['calculate']);
    expect(discountStrategy.methods[0]?.fragments).toEqual([]);
  });

  it('模範解答では、RegularDiscount・PremiumDiscount・VipDiscountが同じメソッド名(calculate)でDiscountStrategyを実装する', () => {
    // Arrange
    const solved = sampleAnswerCodebase(stage);

    // Act
    const regular = classNamed(solved, 'RegularDiscount');
    const premium = classNamed(solved, 'PremiumDiscount');
    const vip = classNamed(solved, 'VipDiscount');

    // Assert
    expect(regular.methods.map((method) => method.name)).toEqual(['calculate']);
    expect(premium.methods.map((method) => method.name)).toEqual(['calculate']);
    expect(vip.methods.map((method) => method.name)).toEqual(['calculate']);
  });
});

/**
 * 採点(line-limit/coupling/cycle/responsibility)は継承の有無を見ないので、
 * 「模範解答で100点になる」だけでは継承を使わずに解けているかを確認できない。
 * この上級ステージの狙いそのもの(重複した生成処理をFactoryへ委譲でまとめる、継承は使わない)を別途確認する。
 */
describe('advanced-report-factory', () => {
  const stage = advancedStages.find((candidate) => candidate.id === 'advanced-report-factory');
  if (stage === undefined) throw new Error('advanced-report-factory ステージが見つかりません');

  it('初期状態では、ReportFactoryにまだ何も移されていない', () => {
    // Arrange
    const { codebase } = stage;

    // Act
    const reportFactory = classNamed(codebase, 'ReportFactory');

    // Assert
    expect(reportFactory.methods).toEqual([]);
  });

  it('初期状態では、レポートを組み立てる処理がWeeklyReportController・MonthlyReportControllerの両方に重複している', () => {
    // Arrange
    const { codebase } = stage;

    // Act
    const weeklyResponsibilities = fragmentResponsibilities(classNamed(codebase, 'WeeklyReportController'));
    const monthlyResponsibilities = fragmentResponsibilities(classNamed(codebase, 'MonthlyReportController'));

    // Assert
    expect(weeklyResponsibilities).toContain('report-building');
    expect(monthlyResponsibilities).toContain('report-building');
  });

  it('模範解答では、統合されたレポート組み立て処理だけがReportFactoryに集まる', () => {
    // Arrange
    const solved = sampleAnswerCodebase(stage);

    // Act
    const reportFactory = classNamed(solved, 'ReportFactory');
    const weeklyResponsibilities = fragmentResponsibilities(classNamed(solved, 'WeeklyReportController'));
    const monthlyResponsibilities = fragmentResponsibilities(classNamed(solved, 'MonthlyReportController'));

    // Assert
    expect(reportFactory.methods.map((method) => method.name)).toEqual(['buildReport']);
    expect(weeklyResponsibilities).not.toContain('report-building');
    expect(monthlyResponsibilities).not.toContain('report-building');
  });

  it('模範解答を適用しても、継承・実装関係は一切結ばれない(委譲だけで解ける)', () => {
    // Arrange
    const solved = sampleAnswerCodebase(stage);

    // Act
    const superclasses = allClasses(solved).map((codeClass) => findSuperclass(solved, codeClass.id));

    // Assert
    expect(superclasses.every((superclass) => superclass === undefined)).toBe(true);
  });

  it('模範解答では、WeeklyReportController・MonthlyReportControllerがどちらもReportFactoryへ依存する', () => {
    // Arrange
    const solved = sampleAnswerCodebase(stage);

    // Act
    const dependencies = classDependencies(solved);
    const targets = dependencies.map((dependency) => dependency.to);

    // Assert
    const reportFactoryId = classNamed(solved, 'ReportFactory').id;
    expect(dependencies).toHaveLength(2);
    expect(targets.every((target) => target === reportFactoryId)).toBe(true);
  });
});

describe('advanced-collapse-hierarchy', () => {
  const stage = advancedStages.find((candidate) => candidate.id === 'advanced-collapse-hierarchy');
  if (stage === undefined) throw new Error('advanced-collapse-hierarchy ステージが見つかりません');

  it('初期状態では、子が1つだけの BaseExporter が減点されている', () => {
    // Arrange
    const { codebase } = stage;

    // Act
    const score = scoreCodebase(codebase, stage);

    // Assert
    expect(score.deductions).toContainEqual({ rule: 'lone-superclass', count: 1, points: 10 });
  });

  it('模範解答では、CSVの処理が CsvExporter 1クラスにまとまり、継承がなくなる', () => {
    // Arrange
    const solved = sampleAnswerCodebase(stage);

    // Act
    const csvExporter = classNamed(solved, 'CsvExporter');

    // Assert
    expect(csvExporter.superclassId).toBeUndefined();
    expect(csvExporter.methods.map((method) => method.name)).toEqual(['writeRows', 'quoteChar', 'prepareExport', 'escapeValue']);
    expect(allClasses(solved).map((codeClass) => codeClass.name)).not.toContain('BaseExporter');
  });
});
