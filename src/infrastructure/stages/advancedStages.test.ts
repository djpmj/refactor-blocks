import { describe, expect, it } from 'vitest';
import { changeKindOf } from '../../domain/change/ChangeRequest';
import { withChangePart } from '../../domain/change/changePart';
import { measureChange } from '../../domain/change/measureChange';
import { measurePlacement } from '../../domain/change/measurePlacement';
import { scorePlacement, type PlacementScore } from '../../domain/change/scorePlacement';
import { deleteMethod } from '../../domain/codebase/deleteMethod';
import { moveMethod } from '../../domain/codebase/moveMethod';
import { moveMethodToNewClass } from '../../domain/codebase/moveToNewHome';
import { addInterface } from '../../domain/codebase/setSuperclass';
import { allClasses, findClass, findInterfaces, findSuperclass, isStubMethod, type CodeClass, type Codebase } from '../../domain/codebase/Codebase';
import { classDependencies } from '../../domain/codebase/dependencies';
import { scoreCodebase } from '../../domain/scoring/score';
import { applySolutionSteps, sampleAnswerCodebase, type SolutionStep } from '../../domain/stage/sampleAnswer';
import type { Result } from '../../domain/shared/Result';
import { advancedStages } from './advancedStages';

function openClosedCount(score: PlacementScore): number | undefined {
  return score.deductions.find((deduction) => deduction.rule === 'open-closed')?.count;
}

function unwrap<T, E>(result: Result<T, E>): T {
  if (!result.ok) throw new Error(`操作に失敗しました: ${String(result.error)}`);
  return result.value;
}

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
    const interfaceLists = allClasses(codebase).map((codeClass) => findInterfaces(codebase, codeClass.id));

    // Assert
    expect(interfaceLists.every((interfaces) => interfaces.length === 0)).toBe(true);
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
    const stripeInterfaces = findInterfaces(solved, 'class-stripe-gateway').map((codeClass) => codeClass.name);
    const paypalInterfaces = findInterfaces(solved, 'class-paypal-gateway').map((codeClass) => codeClass.name);

    // Assert
    expect(stripeInterfaces).toEqual(['PaymentGateway']);
    expect(paypalInterfaces).toEqual(['PaymentGateway']);
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

  describe('req-add-paypay(機能の追加)', () => {
    const request = stage.changeRequests.find((candidate) => candidate.id === 'req-add-paypay');
    if (request === undefined) throw new Error('req-add-paypay がありません');
    const partId = 'method-part-req-add-paypay';
    const starts = [
      ['初期状態', stage.codebase],
      ['模範解答のあと', sampleAnswerCodebase(stage)],
    ] as const;

    it('kind は extend', () => {
      // Arrange / Act
      const kind = changeKindOf(request);

      // Assert
      expect(kind).toBe('extend');
    });

    it.each(starts)('%s: 新しいクラスで PaymentGateway を実装すると100点になる', (_name, base) => {
      // Arrange
      const moved = unwrap(moveMethodToNewClass(withChangePart(base, request), partId, { classId: 'class-paypay', fileId: 'file-paypay' }));
      const implemented = unwrap(addInterface(moved, 'class-paypay', 'PaymentGateway'));

      // Act
      const placement = unwrap(measurePlacement(base, implemented, request));

      // Assert
      expect(scorePlacement(placement, 'extend').total).toBe(100);
    });

    it.each(starts)('%s: PaymentService へ置くと100点未満で、既存クラスの修正が1つ数えられる', (_name, base) => {
      // Arrange
      const implemented = unwrap(moveMethod(withChangePart(base, request), partId, 'class-payment-service'));

      // Act
      const score = scorePlacement(unwrap(measurePlacement(base, implemented, request)), 'extend');

      // Assert
      expect(score.total).toBeLessThan(100);
      expect(openClosedCount(score)).toBe(1);
    });
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
    expect(findInterfaces(solved, regular.id).map((codeClass) => codeClass.name)).toEqual(['DiscountStrategy']);
    expect(findInterfaces(solved, premium.id).map((codeClass) => codeClass.name)).toEqual(['DiscountStrategy']);
    expect(findInterfaces(solved, vip.id).map((codeClass) => codeClass.name)).toEqual(['DiscountStrategy']);
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
    const interfaceLists = allClasses(solved).map((codeClass) => findInterfaces(solved, codeClass.id));

    // Assert
    expect(superclasses.every((superclass) => superclass === undefined)).toBe(true);
    expect(interfaceLists.every((interfaces) => interfaces.length === 0)).toBe(true);
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

/**
 * 採点(line-limit/coupling/cycle/responsibility)だけでは「役割ごとに分けたか」を確認できないので、
 * この上級ステージの狙いそのもの(太ったインターフェースを2つに分け、必要なクラスだけが実装する)を別途確認する。
 */
describe('advanced-interface-segregation', () => {
  const stage = advancedStages.find((candidate) => candidate.id === 'advanced-interface-segregation');
  if (stage === undefined) throw new Error('advanced-interface-segregation ステージが見つかりません');

  it('初期状態の減点は空実装5件だけで、50点になる', () => {
    // Arrange
    const { codebase } = stage;

    // Act
    const score = scoreCodebase(codebase, stage);

    // Assert
    expect(score.total).toBe(50);
    expect(score.deductions.filter((deduction) => deduction.count > 0)).toEqual([{ rule: 'stub', count: 5, points: 50 }]);
  });

  it('模範解答では、AlertNotifierの依存先はChatClientだけ、IncidentServiceの依存先はTaskTrackerだけになる', () => {
    // Arrange
    const solved = sampleAnswerCodebase(stage);

    // Act
    const dependencies = classDependencies(solved);
    const alertTargets = dependencies.filter((dependency) => dependency.from === 'class-alert-notifier').map((dependency) => dependency.to);
    const incidentTargets = dependencies.filter((dependency) => dependency.from === 'class-incident-service').map((dependency) => dependency.to);

    // Assert
    expect(alertTargets).toEqual([classNamed(solved, 'ChatClient').id]);
    expect(incidentTargets).toEqual([classNamed(solved, 'TaskTracker').id]);
  });

  it('模範解答では、Chatworkだけが両方のインターフェースを実装し、空実装がなくなる', () => {
    // Arrange
    const solved = sampleAnswerCodebase(stage);

    // Act
    const chatworkInterfaces = findInterfaces(solved, 'class-chatwork-client').map((codeClass) => codeClass.name);
    const slackInterfaces = findInterfaces(solved, 'class-slack-client').map((codeClass) => codeClass.name);
    const teamsInterfaces = findInterfaces(solved, 'class-teams-client').map((codeClass) => codeClass.name);
    const backlogInterfaces = findInterfaces(solved, 'class-backlog-client').map((codeClass) => codeClass.name);
    const stubMethods = allClasses(solved)
      .flatMap((codeClass) => codeClass.methods)
      .filter((method) => isStubMethod(method));

    // Assert
    expect(chatworkInterfaces).toEqual(['ChatClient', 'TaskTracker']);
    expect(slackInterfaces).toEqual(['ChatClient']);
    expect(teamsInterfaces).toEqual(['ChatClient']);
    expect(backlogInterfaces).toEqual(['TaskTracker']);
    expect(stubMethods).toEqual([]);
  });

  it('初期状態で、本物の処理を持つ SlackClient.postMessage は空実装ではないので削除できない', () => {
    // Arrange
    const { codebase } = stage;
    const slack = classNamed(codebase, 'SlackClient');
    const postMessage = slack.methods.find((method) => method.name === 'postMessage');
    if (postMessage === undefined) throw new Error('postMessage がありません');

    // Act
    const result = deleteMethod(codebase, postMessage.id);

    // Assert
    expect(result).toEqual({ ok: false, error: 'not-stub' });
  });

  it('空実装のメソッドのIDは、どのFragmentのusesにも出てこない(呼ばれない前提)', () => {
    // Arrange
    const { codebase } = stage;
    const stubMethodIds = new Set(
      allClasses(codebase)
        .flatMap((codeClass) => codeClass.methods)
        .filter((method) => isStubMethod(method))
        .map((method) => method.id),
    );
    const usedIds = allClasses(codebase)
      .flatMap((codeClass) => codeClass.methods)
      .flatMap((method) => method.fragments)
      .flatMap((fragment) => fragment.uses ?? []);

    // Act
    const usedStubIds = usedIds.filter((id) => stubMethodIds.has(id));

    // Assert
    expect(usedStubIds).toEqual([]);
  });

  it('変更依頼2件とも、模範解答のあとで変更が必要なクラス数が減る', () => {
    // Arrange
    const solved = sampleAnswerCodebase(stage);
    const taskAssignee = stage.changeRequests.find((candidate) => candidate.id === 'req-task-assignee');
    const threadReply = stage.changeRequests.find((candidate) => candidate.id === 'req-thread-reply');
    if (taskAssignee === undefined || threadReply === undefined) throw new Error('依頼が見つかりません');

    // Act
    const taskAssigneeBefore = unwrap(measureChange(stage.codebase, taskAssignee, stage.limits));
    const taskAssigneeAfter = unwrap(measureChange(solved, taskAssignee, stage.limits));
    const threadReplyBefore = unwrap(measureChange(stage.codebase, threadReply, stage.limits));
    const threadReplyAfter = unwrap(measureChange(solved, threadReply, stage.limits));

    // Assert
    expect(taskAssigneeBefore.classesTouched).toBe(4);
    expect(taskAssigneeAfter.classesTouched).toBe(2);
    expect(threadReplyBefore.classesTouched).toBe(4);
    expect(threadReplyAfter.classesTouched).toBe(3);
  });

  it('空実装を消して ChatworkClient を継承元にしても、具象クラスからの借用で100点にならない', () => {
    // Arrange
    const steps: SolutionStep[] = [
      { deleteMethod: { method: 'createTask', fromClass: 'SlackClient' } },
      { deleteMethod: { method: 'completeTask', fromClass: 'SlackClient' } },
      { deleteMethod: { method: 'createTask', fromClass: 'TeamsClient' } },
      { deleteMethod: { method: 'completeTask', fromClass: 'TeamsClient' } },
      { deleteMethod: { method: 'postMessage', fromClass: 'BacklogClient' } },
      { setSuperclass: { class: 'SlackClient', superclass: 'ChatworkClient' } },
      { setSuperclass: { class: 'TeamsClient', superclass: 'ChatworkClient' } },
      { setSuperclass: { class: 'BacklogClient', superclass: 'ChatworkClient' } },
    ];
    const codebase = applySolutionSteps(stage.codebase, steps);

    // Act
    const score = scoreCodebase(codebase, stage);

    // Assert
    expect(score.total).toBe(50);
    expect(score.deductions.filter((deduction) => deduction.count > 0)).toEqual([{ rule: 'contract', count: 5, points: 50 }]);
  });
});
