import { describe, expect, it } from 'vitest';
import { changeKindOf, type ChangeRequest } from '../../domain/change/ChangeRequest';
import { findChangeSites } from '../../domain/change/findChangeSites';
import { measureChange } from '../../domain/change/measureChange';
import { measureExtendPain, measurePain, painRequestsOf } from '../../domain/change/changePain';
import { averageScore, scoreChange } from '../../domain/change/scoreChange';
import { allClasses, fieldsOf, isAbstractLike, isInterfaceLike, touchedFieldIds, type Codebase } from '../../domain/codebase/Codebase';
import { methodLines } from '../../domain/codebase/lineCount';
import { scoreCodebase } from '../../domain/scoring/score';
import { behaviorTests, runBehaviorTests } from '../../domain/testing/behaviorTests';
import type { Result } from '../../domain/shared/Result';
import { applySolutionSteps, sampleAnswerSteps, solutionSnapshots, type SolutionStep } from '../../domain/stage/sampleAnswer';
import type { Stage } from '../../domain/stage/Stage';
import { blankDesignProblems } from '../blankDesigns/blankDesignProblems';
import { validateCheck } from '../../domain/stage/conceptCheck';
import { stages } from './stageCatalog';

/** 赤になっているテストの失敗。onlyNonCompile なら、コンパイルエラー以外だけ。 */
function redFailures(stage: Stage, snapshot: Codebase, onlyNonCompile: boolean) {
  return runBehaviorTests(stage, snapshot).flatMap((result) =>
    result.failures.filter((failure) => !onlyNonCompile || failure.kind !== 'compile').map((failure) => ({ entry: result.test.entryMethodId, failure })),
  );
}

/** 各手の後のコードの、コンパイルエラー以外で赤になっているテスト。 */
function redFailuresAcross(stage: Stage, snapshots: readonly Codebase[]) {
  return snapshots.flatMap((snapshot) => redFailures(stage, snapshot, true));
}

const templateSolution = sampleAnswerSteps['advanced-template-method'] ?? [];

describe('初期違反の種類', () => {
  it.each([
    ['tutorial-extract-method', ['line-limit']],
    ['tutorial-order-service', ['line-limit', 'responsibility', 'empty']],
    ['beginner-user-controller', ['line-limit', 'responsibility', 'empty']],
    ['beginner-invoice-service', ['line-limit', 'responsibility']],
    ['intermediate-cyclic-dependency', ['line-limit', 'cycle', 'responsibility']],
    ['intermediate-god-file', ['line-limit', 'responsibility']],
    ['intermediate-misplaced-private', ['line-limit', 'coupling', 'visibility']],
    ['intermediate-volatile-tax', ['line-limit', 'responsibility']],
    ['intermediate-volatile-format', ['line-limit', 'responsibility']],
    ['intermediate-feature-envy', ['line-limit', 'responsibility', 'feature-envy', 'encapsulation']],
    ['intermediate-anemic-domain-model', ['line-limit', 'feature-envy', 'encapsulation', 'cohesion']],
    ['intermediate-extract-class', ['line-limit', 'cohesion']],
    ['intermediate-copy-paste-tax', ['line-limit', 'responsibility', 'empty']],
    ['intermediate-member-rank-branching', ['line-limit']],
    ['intermediate-layered-order-api', ['line-limit', 'responsibility', 'empty']],
    ['advanced-notifier-hierarchy', ['line-limit', 'responsibility', 'empty']],
    ['advanced-payment-gateway-interface', ['line-limit', 'contract']],
    ['advanced-discount-strategy', ['line-limit', 'responsibility']],
    ['advanced-report-factory', ['line-limit', 'responsibility', 'empty']],
    ['advanced-collapse-hierarchy', ['coupling', 'cycle', 'visibility', 'lone-superclass']],
    ['advanced-interface-segregation', ['stub']],
    ['advanced-value-object', ['line-limit', 'responsibility', 'feature-envy']],
    ['advanced-template-method', ['line-limit', 'coupling', 'responsibility']],
  ] as const)('%s keeps the baseline initial violation rule types', (stageId, expectedRules) => {
    // Arrange
    const stage = stages.find((candidate) => candidate.id === stageId);
    if (stage === undefined) throw new Error(`ステージがありません: ${stageId}`);

    // Act
    const score = scoreCodebase(stage.codebase, stage);
    const actualRules = score.deductions.filter((deduction) => deduction.count > 0).map((deduction) => deduction.rule);

    // Assert
    expect(new Set(actualRules)).toEqual(new Set(expectedRules));
  });
});

/** ステージの狙いを飛ばした手順。これで100点になってしまうなら、ステージの数値の作りが甘い。 */
const shortcuts: ReadonlyArray<{ readonly stageId: string; readonly description: string; readonly steps: readonly SolutionStep[] }> = [
  {
    stageId: 'advanced-template-method',
    description: '共通3手順だけ親へ移し、骨組みを子に残す',
    steps: templateSolution.filter((step) => !('merge' in step && step.merge.name === 'importOrders')
      && !('move' in step && step.move.method === 'importOrders')),
  },
  {
    stageId: 'advanced-template-method',
    description: 'parse を private のまま骨組みを親へ移す',
    steps: templateSolution.filter((step) => !('changeVisibility' in step)),
  },
  {
    stageId: 'beginner-user-controller',
    description: 'Mailer を使わず、DBとメールの処理をまとめて UserRepository へ移す',
    steps: [
      { extract: { from: 'registerUser', fragmentIds: ['frag-save-user', 'frag-welcome-mail'], name: 'saveAndWelcome' } },
      { extract: { from: 'deleteUser', fragmentIds: ['frag-delete-user', 'frag-farewell-mail'], name: 'deleteAndFarewell' } },
      { move: { method: 'saveAndWelcome', toClass: 'UserRepository' } },
      { move: { method: 'deleteAndFarewell', toClass: 'UserRepository' } },
    ],
  },
  {
    stageId: 'intermediate-cyclic-dependency',
    description: 'countOrdersOf だけを Customer へ移す',
    steps: [
      { move: { method: 'countOrdersOf', toClass: 'Customer' } },
      { extract: { from: 'checkout', fragmentIds: ['frag-reserve-stock', 'frag-order-total'], name: 'prepareOrder' } },
    ],
  },
  {
    stageId: 'intermediate-cyclic-dependency',
    description: 'calculateOrderTotal だけを Order へ移す',
    steps: [
      { move: { method: 'calculateOrderTotal', toClass: 'Order' } },
      { extract: { from: 'checkout', fragmentIds: ['frag-reserve-stock', 'frag-order-total'], name: 'prepareOrder' } },
    ],
  },
  {
    stageId: 'intermediate-misplaced-private',
    description: 'sendMail・logDeliveryを抽出し、renderTemplateをpublicにするだけ',
    steps: [
      { extract: { from: 'notifyShipment', fragmentIds: ['frag-send-mail'], name: 'sendMail' } },
      { extract: { from: 'notifyShipment', fragmentIds: ['frag-log-delivery'], name: 'logDelivery' } },
      { changeVisibility: { method: 'renderTemplate', class: 'TemplateEngine', visibility: 'public' } },
    ],
  },
  {
    stageId: 'advanced-collapse-hierarchy',
    description: '継承を外すだけで、メソッドを1クラスにまとめない',
    steps: [{ setSuperclass: { class: 'CsvExporter', superclass: null } }],
  },
  {
    stageId: 'advanced-collapse-hierarchy',
    description: 'prepareExport だけを CsvExporter へ移して継承を外す(escapeValue は BaseExporter に残る)',
    steps: [
      { move: { method: 'prepareExport', toClass: 'CsvExporter' } },
      { setSuperclass: { class: 'CsvExporter', superclass: null } },
    ],
  },
  {
    stageId: 'advanced-collapse-hierarchy',
    description: 'prepareExport だけを CsvExporter へ移し、継承を implements に書き換える',
    steps: [
      { move: { method: 'prepareExport', toClass: 'CsvExporter' } },
      { setSuperclass: { class: 'CsvExporter', superclass: null } },
      { addInterface: { class: 'CsvExporter', interface: 'BaseExporter' } },
    ],
  },
  {
    stageId: 'advanced-collapse-hierarchy',
    description: '「CSVを出力する」を抽出して CsvExporter へ移し、継承を外す',
    steps: [
      { extract: { from: 'downloadSalesCsv', fragmentIds: ['frag-output-csv'], name: 'outputCsv' } },
      { move: { method: 'outputCsv', toClass: 'CsvExporter' } },
      { setSuperclass: { class: 'CsvExporter', superclass: null } },
    ],
  },
  {
    stageId: 'advanced-interface-segregation',
    description: 'インターフェースを分けて実装先も付け替えたが、空実装を消さない',
    steps: [
      { renameClass: { name: 'CollaborationTool', newName: 'ChatClient' } },
      { addFile: 'src/integration/TaskTracker.ts' },
      { addClass: { name: 'TaskTracker', file: 'src/integration/TaskTracker.ts' } },
      { move: { method: 'createTask', fromClass: 'ChatClient', toClass: 'TaskTracker' } },
      { move: { method: 'completeTask', fromClass: 'ChatClient', toClass: 'TaskTracker' } },
      { addInterface: { class: 'BacklogClient', interface: 'TaskTracker' } },
      { removeInterface: { class: 'BacklogClient', interface: 'ChatClient' } },
      { addInterface: { class: 'ChatworkClient', interface: 'TaskTracker' } },
    ],
  },
  {
    stageId: 'advanced-interface-segregation',
    description: 'インターフェースを分けずに空実装だけ消す',
    steps: [
      { deleteMethod: { method: 'createTask', fromClass: 'SlackClient' } },
      { deleteMethod: { method: 'completeTask', fromClass: 'SlackClient' } },
      { deleteMethod: { method: 'createTask', fromClass: 'TeamsClient' } },
      { deleteMethod: { method: 'completeTask', fromClass: 'TeamsClient' } },
      { deleteMethod: { method: 'postMessage', fromClass: 'BacklogClient' } },
    ],
  },
  {
    stageId: 'advanced-interface-segregation',
    description: 'Slack・Teams・Backlog の CollaborationTool の実装を外して空実装を消す(Chatwork だけが実装し続ける)',
    steps: [
      { removeInterface: { class: 'SlackClient', interface: 'CollaborationTool' } },
      { removeInterface: { class: 'TeamsClient', interface: 'CollaborationTool' } },
      { removeInterface: { class: 'BacklogClient', interface: 'CollaborationTool' } },
      { deleteMethod: { method: 'createTask', fromClass: 'SlackClient' } },
      { deleteMethod: { method: 'completeTask', fromClass: 'SlackClient' } },
      { deleteMethod: { method: 'createTask', fromClass: 'TeamsClient' } },
      { deleteMethod: { method: 'completeTask', fromClass: 'TeamsClient' } },
      { deleteMethod: { method: 'postMessage', fromClass: 'BacklogClient' } },
    ],
  },
  {
    stageId: 'advanced-interface-segregation',
    description: '分けたが、Chatwork には ChatClient しか実装させない',
    steps: [
      { renameClass: { name: 'CollaborationTool', newName: 'ChatClient' } },
      { addFile: 'src/integration/TaskTracker.ts' },
      { addClass: { name: 'TaskTracker', file: 'src/integration/TaskTracker.ts' } },
      { move: { method: 'createTask', fromClass: 'ChatClient', toClass: 'TaskTracker' } },
      { move: { method: 'completeTask', fromClass: 'ChatClient', toClass: 'TaskTracker' } },
      { addInterface: { class: 'BacklogClient', interface: 'TaskTracker' } },
      { removeInterface: { class: 'BacklogClient', interface: 'ChatClient' } },
      { deleteMethod: { method: 'createTask', fromClass: 'SlackClient' } },
      { deleteMethod: { method: 'completeTask', fromClass: 'SlackClient' } },
      { deleteMethod: { method: 'createTask', fromClass: 'TeamsClient' } },
      { deleteMethod: { method: 'completeTask', fromClass: 'TeamsClient' } },
      { deleteMethod: { method: 'postMessage', fromClass: 'BacklogClient' } },
    ],
  },
  {
    stageId: 'advanced-interface-segregation',
    description: '契約メソッド createTask・completeTask を IncidentService へ移し、Slack・Teams の空実装を消す',
    steps: [
      { move: { method: 'createTask', fromClass: 'CollaborationTool', toClass: 'IncidentService' } },
      { move: { method: 'completeTask', fromClass: 'CollaborationTool', toClass: 'IncidentService' } },
      { deleteMethod: { method: 'createTask', fromClass: 'SlackClient' } },
      { deleteMethod: { method: 'completeTask', fromClass: 'SlackClient' } },
      { deleteMethod: { method: 'createTask', fromClass: 'TeamsClient' } },
      { deleteMethod: { method: 'completeTask', fromClass: 'TeamsClient' } },
    ],
  },
  {
    stageId: 'advanced-interface-segregation',
    description: 'Backlog の空実装 postMessage を新しいファイルのクラスへ移してからそのファイルを消す',
    steps: [
      { addFile: 'src/integration/Trash.ts' },
      { addClass: { name: 'Trash', file: 'src/integration/Trash.ts' } },
      { move: { method: 'postMessage', fromClass: 'BacklogClient', toClass: 'Trash' } },
      { deleteFile: 'src/integration/Trash.ts' },
    ],
  },
  {
    stageId: 'intermediate-feature-envy',
    description: '3つとも抽出するが、どれも Subscription へ移さない',
    steps: [
      { extract: { from: 'renewSubscription', fragmentIds: ['frag-check-trial'], name: 'isInTrial' } },
      { extract: { from: 'renewSubscription', fragmentIds: ['frag-calc-fee'], name: 'monthlyFee' } },
      { extract: { from: 'cancelSubscription', fragmentIds: ['frag-check-cancelable', 'frag-mark-canceled'], name: 'cancel' } },
    ],
  },
  {
    stageId: 'intermediate-feature-envy',
    description: 'メソッドは3つとも移すが、trialDays を Move Field しない',
    steps: [
      { extract: { from: 'renewSubscription', fragmentIds: ['frag-check-trial'], name: 'isInTrial' } },
      { move: { method: 'isInTrial', toClass: 'Subscription' } },
      { extract: { from: 'renewSubscription', fragmentIds: ['frag-calc-fee'], name: 'monthlyFee' } },
      { move: { method: 'monthlyFee', toClass: 'Subscription' } },
      { extract: { from: 'cancelSubscription', fragmentIds: ['frag-check-cancelable', 'frag-mark-canceled'], name: 'cancel' } },
      { move: { method: 'cancel', toClass: 'Subscription' } },
    ],
  },
  {
    stageId: 'intermediate-feature-envy',
    description: 'trialDays は移すが、isInTrial を BillingService に残す',
    steps: [
      { extract: { from: 'renewSubscription', fragmentIds: ['frag-check-trial'], name: 'isInTrial' } },
      { moveField: { field: 'trialDays', fromClass: 'BillingService', toClass: 'Subscription' } },
      { extract: { from: 'renewSubscription', fragmentIds: ['frag-calc-fee'], name: 'monthlyFee' } },
      { move: { method: 'monthlyFee', toClass: 'Subscription' } },
      { extract: { from: 'cancelSubscription', fragmentIds: ['frag-check-cancelable', 'frag-mark-canceled'], name: 'cancel' } },
      { move: { method: 'cancel', toClass: 'Subscription' } },
    ],
  },
  {
    stageId: 'intermediate-feature-envy',
    description: 'データをサービスへ寄せる: Subscription の5つのフィールドを BillingService へ Move Field し、空のファイルを削除する',
    steps: [
      { moveField: { field: 'status', fromClass: 'Subscription', toClass: 'BillingService' } },
      { moveField: { field: 'startedAt', fromClass: 'Subscription', toClass: 'BillingService' } },
      { moveField: { field: 'seats', fromClass: 'Subscription', toClass: 'BillingService' } },
      { moveField: { field: 'unitPrice', fromClass: 'Subscription', toClass: 'BillingService' } },
      { moveField: { field: 'canceledAt', fromClass: 'Subscription', toClass: 'BillingService' } },
      { deleteFile: 'src/billing/Subscription.ts' },
      { extract: { from: 'renewSubscription', fragmentIds: ['frag-check-trial'], name: 'isInTrial' } },
      { extract: { from: 'renewSubscription', fragmentIds: ['frag-calc-fee'], name: 'monthlyFee' } },
      { extract: { from: 'cancelSubscription', fragmentIds: ['frag-check-cancelable', 'frag-mark-canceled'], name: 'cancel' } },
    ],
  },
  {
    stageId: 'intermediate-feature-envy',
    description: 'renewSubscription・cancelSubscription をメソッドごと Subscription へ移す',
    steps: [
      { move: { method: 'renewSubscription', toClass: 'Subscription' } },
      { move: { method: 'cancelSubscription', toClass: 'Subscription' } },
    ],
  },
  {
    stageId: 'intermediate-anemic-domain-model',
    description: 'debit・credit を抽出するが AccountService に残す',
    steps: [
      { extract: { from: 'withdraw', fragmentIds: ['frag-withdraw-check-status', 'frag-check-withdrawable', 'frag-debit-balance'], name: 'debit' } },
      { extract: { from: 'deposit', fragmentIds: ['frag-deposit-check-status', 'frag-credit-balance'], name: 'credit' } },
    ],
  },
  {
    stageId: 'intermediate-anemic-domain-model',
    description: '残高の更新だけを抽出して Account へ移し(public にし)、チェックはサービスに残す',
    steps: [
      { extract: { from: 'withdraw', fragmentIds: ['frag-debit-balance'], name: 'debitBalance' } },
      { move: { method: 'debitBalance', toClass: 'Account' } },
      { changeVisibility: { method: 'debitBalance', class: 'Account', visibility: 'public' } },
    ],
  },
  {
    stageId: 'intermediate-anemic-domain-model',
    description: 'getter/setter 5つを AccountService へ移す',
    steps: [
      { move: { method: 'getBalance', toClass: 'AccountService' } },
      { move: { method: 'setBalance', toClass: 'AccountService' } },
      { move: { method: 'getStatus', toClass: 'AccountService' } },
      { move: { method: 'getDailyWithdrawn', toClass: 'AccountService' } },
      { move: { method: 'setDailyWithdrawn', toClass: 'AccountService' } },
    ],
  },
  {
    stageId: 'intermediate-anemic-domain-model',
    description: 'withdraw・deposit をメソッドごと Account へ移す',
    steps: [
      { move: { method: 'withdraw', toClass: 'Account' } },
      { move: { method: 'deposit', toClass: 'Account' } },
    ],
  },
  {
    stageId: 'intermediate-anemic-domain-model',
    description: '模範解答から setter を private にする2手を抜く',
    steps: [
      { extract: { from: 'withdraw', fragmentIds: ['frag-withdraw-check-status', 'frag-check-withdrawable', 'frag-debit-balance'], name: 'debit' } },
      { move: { method: 'debit', toClass: 'Account' } },
      { changeVisibility: { method: 'debit', class: 'Account', visibility: 'public' } },
      { extract: { from: 'deposit', fragmentIds: ['frag-deposit-check-status', 'frag-credit-balance'], name: 'credit' } },
      { move: { method: 'credit', toClass: 'Account' } },
      { changeVisibility: { method: 'credit', class: 'Account', visibility: 'public' } },
    ],
  },
  {
    stageId: 'intermediate-anemic-domain-model',
    description: '模範解答から debit・credit を public にする2手を抜く',
    steps: [
      { extract: { from: 'withdraw', fragmentIds: ['frag-withdraw-check-status', 'frag-check-withdrawable', 'frag-debit-balance'], name: 'debit' } },
      { move: { method: 'debit', toClass: 'Account' } },
      { extract: { from: 'deposit', fragmentIds: ['frag-deposit-check-status', 'frag-credit-balance'], name: 'credit' } },
      { move: { method: 'credit', toClass: 'Account' } },
      { changeVisibility: { method: 'setBalance', class: 'Account', visibility: 'private' } },
      { changeVisibility: { method: 'setDailyWithdrawn', class: 'Account', visibility: 'private' } },
    ],
  },
  {
    stageId: 'intermediate-extract-class',
    description: 'withholdTaxes を抽出するだけ',
    steps: [{ extract: { from: 'calculateMonthlyPay', fragmentIds: ['frag-withholding'], name: 'withholdTaxes' } }],
  },
  {
    stageId: 'intermediate-extract-class',
    description: '違う切り口で分ける: withholdTaxes と buildTransferData を抽出し、新しいクラス PayTransfer に bankAccount と buildTransferData を移す',
    steps: [
      { extract: { from: 'calculateMonthlyPay', fragmentIds: ['frag-withholding'], name: 'withholdTaxes' } },
      { extract: { from: 'calculateMonthlyPay', fragmentIds: ['frag-pay-transfer'], name: 'buildTransferData' } },
      { addFile: 'src/hr/PayTransfer.ts' },
      { addClass: { name: 'PayTransfer', file: 'src/hr/PayTransfer.ts' } },
      { moveField: { field: 'bankAccount', fromClass: 'Employee', toClass: 'PayTransfer' } },
      { move: { method: 'buildTransferData', toClass: 'PayTransfer' } },
    ],
  },
  {
    stageId: 'intermediate-extract-class',
    description: 'Address を作ってメソッドだけ移し、フィールドは残す',
    steps: [
      { addFile: 'src/hr/Address.ts' },
      { addClass: { name: 'Address', file: 'src/hr/Address.ts' } },
      { move: { method: 'formatMailingAddress', toClass: 'Address' } },
      { move: { method: 'changeAddress', toClass: 'Address' } },
    ],
  },
  {
    stageId: 'intermediate-extract-class',
    description: 'Address を作ってフィールドだけ移し、メソッドは残す',
    steps: [
      { addFile: 'src/hr/Address.ts' },
      { addClass: { name: 'Address', file: 'src/hr/Address.ts' } },
      { moveField: { field: 'postalCode', fromClass: 'Employee', toClass: 'Address' } },
      { moveField: { field: 'prefecture', fromClass: 'Employee', toClass: 'Address' } },
      { moveField: { field: 'addressLine', fromClass: 'Employee', toClass: 'Address' } },
    ],
  },
  {
    stageId: 'advanced-value-object',
    description: '統合せずに6つとも Money へ移す(抽出名はクラスごとに変える)',
    steps: [
      { extract: { from: 'submitExpense', fragmentIds: ['frag-apply-validate-money'], name: 'validateApplyMoney' } },
      { extract: { from: 'submitExpense', fragmentIds: ['frag-apply-format-money'], name: 'formatApplyMoney' } },
      { extract: { from: 'approveMonthlyExpenses', fragmentIds: ['frag-approve-validate-money'], name: 'validateApproveMoney' } },
      { extract: { from: 'approveMonthlyExpenses', fragmentIds: ['frag-approve-sum-money'], name: 'sumApproveMoney' } },
      { extract: { from: 'payOut', fragmentIds: ['frag-payout-sum-money'], name: 'sumPayoutMoney' } },
      { extract: { from: 'payOut', fragmentIds: ['frag-payout-format-money'], name: 'formatPayoutMoney' } },
      { addFile: 'src/expense/Money.ts' },
      { addClass: { name: 'Money', file: 'src/expense/Money.ts' } },
      { moveField: { field: 'amount', fromClass: 'Expense', toClass: 'Money' } },
      { moveField: { field: 'currency', fromClass: 'Expense', toClass: 'Money' } },
      { move: { method: 'validateApplyMoney', toClass: 'Money' } },
      { move: { method: 'formatApplyMoney', toClass: 'Money' } },
      { move: { method: 'validateApproveMoney', toClass: 'Money' } },
      { move: { method: 'sumApproveMoney', toClass: 'Money' } },
      { move: { method: 'sumPayoutMoney', toClass: 'Money' } },
      { move: { method: 'formatPayoutMoney', toClass: 'Money' } },
    ],
  },
  {
    stageId: 'advanced-value-object',
    description: 'validate の1組だけ統合し、残りの4つは統合せずに Money へ移す',
    steps: [
      { extract: { from: 'submitExpense', fragmentIds: ['frag-apply-validate-money'], name: 'validateMoney' } },
      { extract: { from: 'submitExpense', fragmentIds: ['frag-apply-format-money'], name: 'formatApplyMoney' } },
      { extract: { from: 'approveMonthlyExpenses', fragmentIds: ['frag-approve-validate-money'], name: 'validateMoney' } },
      { extract: { from: 'approveMonthlyExpenses', fragmentIds: ['frag-approve-sum-money'], name: 'sumApproveMoney' } },
      { extract: { from: 'payOut', fragmentIds: ['frag-payout-sum-money'], name: 'sumPayoutMoney' } },
      { extract: { from: 'payOut', fragmentIds: ['frag-payout-format-money'], name: 'formatPayoutMoney' } },
      { merge: { methodA: 'validateMoney', methodAClass: 'ExpenseApplicationService', methodB: 'validateMoney', methodBClass: 'ApprovalService', name: 'validate' } },
      { addFile: 'src/expense/Money.ts' },
      { addClass: { name: 'Money', file: 'src/expense/Money.ts' } },
      { moveField: { field: 'amount', fromClass: 'Expense', toClass: 'Money' } },
      { moveField: { field: 'currency', fromClass: 'Expense', toClass: 'Money' } },
      { move: { method: 'validate', toClass: 'Money' } },
      { move: { method: 'formatApplyMoney', toClass: 'Money' } },
      { move: { method: 'sumApproveMoney', toClass: 'Money' } },
      { move: { method: 'sumPayoutMoney', toClass: 'Money' } },
      { move: { method: 'formatPayoutMoney', toClass: 'Money' } },
    ],
  },
  {
    stageId: 'advanced-value-object',
    description: 'Money を作らず、統合した3つを Expense へ移す',
    steps: [
      { extract: { from: 'submitExpense', fragmentIds: ['frag-apply-validate-money'], name: 'validateMoney' } },
      { extract: { from: 'submitExpense', fragmentIds: ['frag-apply-format-money'], name: 'formatMoney' } },
      { extract: { from: 'approveMonthlyExpenses', fragmentIds: ['frag-approve-validate-money'], name: 'validateMoney' } },
      { extract: { from: 'approveMonthlyExpenses', fragmentIds: ['frag-approve-sum-money'], name: 'sumMoney' } },
      { extract: { from: 'payOut', fragmentIds: ['frag-payout-sum-money'], name: 'sumMoney' } },
      { extract: { from: 'payOut', fragmentIds: ['frag-payout-format-money'], name: 'formatMoney' } },
      { merge: { methodA: 'validateMoney', methodAClass: 'ExpenseApplicationService', methodB: 'validateMoney', methodBClass: 'ApprovalService', name: 'validate' } },
      { merge: { methodA: 'sumMoney', methodAClass: 'ApprovalService', methodB: 'sumMoney', methodBClass: 'PayoutService', name: 'add' } },
      { merge: { methodA: 'formatMoney', methodAClass: 'ExpenseApplicationService', methodB: 'formatMoney', methodBClass: 'PayoutService', name: 'format' } },
      { move: { method: 'validate', toClass: 'Expense' } },
      { move: { method: 'add', toClass: 'Expense' } },
      { move: { method: 'format', toClass: 'Expense' } },
    ],
  },
  {
    stageId: 'advanced-value-object',
    description: 'Money を作ってメソッドを3つ移すが、amount・currency は Expense に残す',
    steps: [
      { extract: { from: 'submitExpense', fragmentIds: ['frag-apply-validate-money'], name: 'validateMoney' } },
      { extract: { from: 'submitExpense', fragmentIds: ['frag-apply-format-money'], name: 'formatMoney' } },
      { extract: { from: 'approveMonthlyExpenses', fragmentIds: ['frag-approve-validate-money'], name: 'validateMoney' } },
      { extract: { from: 'approveMonthlyExpenses', fragmentIds: ['frag-approve-sum-money'], name: 'sumMoney' } },
      { extract: { from: 'payOut', fragmentIds: ['frag-payout-sum-money'], name: 'sumMoney' } },
      { extract: { from: 'payOut', fragmentIds: ['frag-payout-format-money'], name: 'formatMoney' } },
      { merge: { methodA: 'validateMoney', methodAClass: 'ExpenseApplicationService', methodB: 'validateMoney', methodBClass: 'ApprovalService', name: 'validate' } },
      { merge: { methodA: 'sumMoney', methodAClass: 'ApprovalService', methodB: 'sumMoney', methodBClass: 'PayoutService', name: 'add' } },
      { merge: { methodA: 'formatMoney', methodAClass: 'ExpenseApplicationService', methodB: 'formatMoney', methodBClass: 'PayoutService', name: 'format' } },
      { addFile: 'src/expense/Money.ts' },
      { addClass: { name: 'Money', file: 'src/expense/Money.ts' } },
      { move: { method: 'validate', toClass: 'Money' } },
      { move: { method: 'add', toClass: 'Money' } },
      { move: { method: 'format', toClass: 'Money' } },
    ],
  },
];

function unwrap<T, E>(result: Result<T, E>): T {
  if (!result.ok) throw new Error(`操作に失敗しました: ${String(result.error)}`);
  return result.value;
}

function longestMethodLines(codebase: Codebase): number {
  const methods = allClasses(codebase).flatMap((codeClass) => codeClass.methods);
  return Math.max(...methods.map((method) => methodLines(method)));
}

/** コストで測るのは「ルールの変更」だけ。「機能の追加」は置き方で測る。 */
function modifyRequests(stage: Stage): ChangeRequest[] {
  return stage.changeRequests.filter((request) => changeKindOf(request) === 'modify');
}

function changeReadiness(stage: Stage, codebase: Codebase): number {
  const scores = modifyRequests(stage).map((request) => scoreChange(unwrap(measureChange(codebase, request, stage.limits))));
  return averageScore(scores);
}

function classesTouchedPerRequest(stage: Stage, codebase: Codebase): number[] {
  return modifyRequests(stage).map((request) => unwrap(measureChange(codebase, request, stage.limits)).classesTouched);
}

function isNoWorse(before: readonly number[], after: readonly number[]): boolean {
  return after.every((count, index) => count <= (before[index] ?? 0));
}

function allRequestsHaveSites(stage: Stage): boolean {
  return modifyRequests(stage).every((request) => findChangeSites(stage.codebase, request).length > 0);
}

function partNames(stage: Stage): string[] {
  return stage.changeRequests.map((request) => request.partName ?? '');
}

function blankPartNames(stage: Stage): string[] {
  return partNames(stage).filter((name) => name.trim() === '');
}

function methodNamesOf(stage: Stage): string[] {
  return allClasses(stage.codebase).flatMap((codeClass) => codeClass.methods.map((method) => method.name));
}

/** インターフェース役・抽象クラスが宣言している契約メソッド名。extendの部品名がこれと同じなら、実装を宣言する意図の一致で許される。 */
function contractMethodNamesOf(stage: Stage): string[] {
  return allClasses(stage.codebase)
    .filter((owner) => isInterfaceLike(owner) || isAbstractLike(owner))
    .flatMap((codeClass) => codeClass.methods.filter((method) => method.fragments.length === 0).map((method) => method.name));
}

/** modifyの依頼は、部品名が初期コードのどのメソッド名とも重ならない。 */
function clashingModifyPartNames(stage: Stage): string[] {
  const methodNames = methodNamesOf(stage);
  return modifyRequests(stage)
    .map((request) => request.partName ?? '')
    .filter((name) => methodNames.includes(name));
}

/** extendの依頼は、部品名がインターフェース役・抽象クラスの契約名と同じか、どのメソッド名とも重ならないかのどちらか。 */
function invalidExtendPartNames(stage: Stage): string[] {
  const methodNames = methodNamesOf(stage);
  const contractNames = contractMethodNamesOf(stage);
  return stage.changeRequests
    .filter((request) => changeKindOf(request) === 'extend')
    .map((request) => request.partName ?? '')
    .filter((name) => methodNames.includes(name) && !contractNames.includes(name));
}

function allIds(stage: Stage): string[] {
  const { files } = stage.codebase;
  const classes = allClasses(stage.codebase);
  const methods = classes.flatMap((codeClass) => codeClass.methods);
  const fragments = methods.flatMap((method) => method.fragments);
  const fields = classes.flatMap((codeClass) => fieldsOf(codeClass));
  return [...files, ...classes, ...methods, ...fragments, ...fields].map((item) => item.id);
}

/** ステージ内のフィールドID一覧(打ち間違いの検査に使う)。 */
function fieldIdsOf(stage: Stage): Set<string> {
  return new Set(allClasses(stage.codebase).flatMap((codeClass) => fieldsOf(codeClass).map((field) => field.id)));
}

/** 処理の reads/writes が、そのステージに実在しないフィールドIDを指していないか。 */
function danglingFieldRefs(stage: Stage): string[] {
  const fieldIds = fieldIdsOf(stage);
  return allClasses(stage.codebase)
    .flatMap((codeClass) => codeClass.methods)
    .flatMap((method) => method.fragments)
    .flatMap((fragment) => touchedFieldIds(fragment))
    .filter((fieldId) => !fieldIds.has(fieldId));
}

describe('stageCatalog', () => {
  it('チュートリアル・初級・中級・上級の順に、それぞれ1つ以上のステージが並んでいる', () => {
    // Arrange
    const expectedOrder = ['tutorial', 'beginner', 'intermediate', 'advanced'];

    // Act
    const levels = [...new Set(stages.map((stage) => stage.level))];

    // Assert
    expect(levels).toEqual(expectedOrder);
  });

  it('ステージIDは重複しない', () => {
    // Arrange
    const ids = stages.map((stage) => stage.id);

    // Act
    const unique = new Set(ids);

    // Assert
    expect(unique.size).toBe(ids.length);
  });

  it.each(stages.map((stage) => [stage.title, stage.learns] as const))('%s: 学べること(learns)が1〜3個あり、どれも空でない', (_title, learns) => {
    // Arrange
    const blanks = learns.filter((item) => item.trim() === '');

    // Act
    const count = learns.length;

    // Assert
    expect(count).toBeGreaterThanOrEqual(1);
    expect(count).toBeLessThanOrEqual(3);
    expect(blanks).toEqual([]);
  });

  const checkTargets = [...stages, ...blankDesignProblems].map((stage) => [stage.title, stage.checks] as const);

  it.each(checkTargets)('%s: 理解度チェックが2〜3問あり、すべて書き方の決まりを満たす', (_title, checks) => {
    // Arrange
    const results = checks.map(validateCheck);

    // Act
    const errors = results.filter((result) => !result.ok);

    // Assert
    expect(checks.length).toBeGreaterThanOrEqual(2);
    expect(checks.length).toBeLessThanOrEqual(3);
    expect(errors).toEqual([]);
  });

  it.each(checkTargets)('%s: 理解度チェックのIDが重複せず、正解の位置が全問同じにならない', (_title, checks) => {
    // Arrange
    const ids = checks.map((check) => check.id);

    // Act
    const answers = new Set(checks.map((check) => check.answer));

    // Assert
    expect(new Set(ids).size).toBe(ids.length);
    expect(answers.size).toBeGreaterThan(1);
  });

  describe.each(stages.map((stage) => [stage.title, stage] as const))('%s', (_title, stage) => {
    it('変更の痛みカード用の理由と初期集計がある', () => {
      // Arrange
      const reason = stage.why.trim();

      // Act
      const pain = painRequestsOf(stage).modify === undefined ? undefined : measurePain(stage, stage.codebase);

      // Assert
      expect(reason).not.toBe('');
      if (painRequestsOf(stage).modify !== undefined) expect(pain).toBeDefined();
    });

    it('extendの依頼があれば、機能の追加の痛みが出せる', () => {
      // Arrange
      const { extend } = painRequestsOf(stage);

      // Act
      const pain = extend === undefined ? undefined : measureExtendPain(stage, stage.codebase, extend);

      // Assert
      if (extend !== undefined) expect(pain).toBeDefined();
    });

    it('ステージ内のファイル・クラス・メソッド・処理のIDは重複しない', () => {
      // Arrange
      const ids = allIds(stage);

      // Act
      const unique = new Set(ids);

      // Assert
      expect(unique.size).toBe(ids.length);
    });

    it('処理の reads / writes は、そのステージにあるフィールドIDだけを指す', () => {
      // Arrange / Act
      const dangling = danglingFieldRefs(stage);

      // Assert
      expect(dangling).toEqual([]);
    });

    it('どんなコードを表しているかの説明がある', () => {
      // Arrange
      const { description } = stage;

      // Act
      const trimmed = description.trim();

      // Assert
      expect(trimmed).not.toBe('');
    });

    it('メソッドの行数を実コードから集計している', () => {
      // Arrange
      const { codebase } = stage;

      // Act
      const longest = longestMethodLines(codebase);

      // Assert
      if (stage.id === 'tutorial-extract-method') expect(longest).toBe(30);
      else expect(longest).toBeGreaterThan(3);
    });

    it('行数の上限は メソッド < クラス < ファイル の順に大きい', () => {
      // Arrange
      const { method, class: classLimit, file } = stage.limits;

      // Act
      const ascending = method < classLimit && classLimit < file;

      // Assert
      expect(ascending).toBe(true);
    });

    it('初期状態では減点がある', () => {
      // Arrange
      const { codebase } = stage;

      // Act
      const score = scoreCodebase(codebase, stage);

      // Assert
      expect(score.total).toBeLessThan(100);
    });

    it('模範解答どおりに操作すると100点になる', () => {
      // Arrange
      expect(sampleAnswerSteps[stage.id]).toBeDefined();

      // Act
      const solved = applySolutionSteps(stage.codebase, sampleAnswerSteps[stage.id] ?? []);

      // Assert
      expect(scoreCodebase(solved, stage)).toEqual(expect.objectContaining({ total: 100 }));
    });

    it('solutionSnapshotsは手順の数+1個を返し、最後は100点になる', () => {
      // Arrange
      const steps = sampleAnswerSteps[stage.id] ?? [];

      // Act
      const snapshots = solutionSnapshots(stage.codebase, steps);

      // Assert
      expect(snapshots).toHaveLength(steps.length + 1);
      expect(scoreCodebase(snapshots[snapshots.length - 1], stage).total).toBe(100);
    });

    it('模範解答のどの手の後も、振る舞いのテストが全部緑(途中で private のまま別クラスへ移した一時的なコンパイルエラーを除く)', () => {
      // Arrange
      const steps = sampleAnswerSteps[stage.id] ?? [];
      const snapshots = solutionSnapshots(stage.codebase, steps);

      // Act
      const reds = redFailuresAcross(stage, snapshots);

      // Assert
      // 抽出したメソッドは private なので、移した直後(public にする前)は『呼べない』コンパイルエラーが正しく出る。最終形は完全に緑
      expect(reds).toEqual([]);
      expect(redFailures(stage, snapshots[snapshots.length - 1], false)).toEqual([]);
    });

    it('依頼が2件以上あり、ルール変更の依頼は初期のコードに変更箇所がある', () => {
      // Arrange
      const changeRequests = modifyRequests(stage);

      // Act
      const everyRequestHasSites = allRequestsHaveSites(stage);

      // Assert
      expect(stage.changeRequests.length).toBeGreaterThanOrEqual(2);
      expect(changeRequests.length).toBeGreaterThanOrEqual(1);
      expect(everyRequestHasSites).toBe(true);
    });

    it('全依頼に、空でない partName がある', () => {
      // Arrange / Act
      const blanks = blankPartNames(stage);

      // Assert
      expect(blanks).toEqual([]);
    });

    it('modifyの依頼は、partName が初期コードのメソッド名と重ならない', () => {
      // Arrange / Act
      const clashes = clashingModifyPartNames(stage);

      // Assert
      expect(clashes).toEqual([]);
    });

    it('extendの依頼は、partName が初期コードのインターフェース役・抽象クラスの契約名と同じか、どのメソッド名とも重ならない', () => {
      // Arrange / Act
      const invalid = invalidExtendPartNames(stage);

      // Assert
      expect(invalid).toEqual([]);
    });

    it('模範解答にすると、変更依頼のコストが初期状態より下がる(変更容易性スコアが上がる)', () => {
      // Arrange
      const solved = applySolutionSteps(stage.codebase, sampleAnswerSteps[stage.id] ?? []);

      // Act
      const before = changeReadiness(stage, stage.codebase);
      const after = changeReadiness(stage, solved);

      // Assert
      expect(after).toBeGreaterThan(before);
    });

    it('模範解答にしても、変更が必要なクラスの数は初期状態より増えない', () => {
      // Arrange
      const solved = applySolutionSteps(stage.codebase, sampleAnswerSteps[stage.id] ?? []);

      // Act
      const before = classesTouchedPerRequest(stage, stage.codebase);
      const after = classesTouchedPerRequest(stage, solved);

      // Assert
      expect(isNoWorse(before, after)).toBe(true);
    });
  });

  it.each(shortcuts)('$stageId: 「$description」では100点にならない', ({ stageId, steps }) => {
    // Arrange
    const stage = stages.find((candidate) => candidate.id === stageId);
    if (stage === undefined) throw new Error(`ステージ ${stageId} がありません`);

    // Act
    const played = applySolutionSteps(stage.codebase, steps);

    // Assert
    expect(scoreCodebase(played, stage).total).toBeLessThan(100);
  });

  it('入口のあるステージが大半を占める', () => {
    // Arrange & Act
    const withTests = stages.filter((stage) => behaviorTests(stage).length > 0);

    // Assert
    // 入口が0になるのは、全メソッドが他から呼ばれる輪になっているなど特殊な題材だけ
    expect(withTests.length).toBeGreaterThan(stages.length / 2);
  });
});
