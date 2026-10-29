import { describe, expect, it } from 'vitest';
import { modelAnswerCodebase, reviewBlankDesign } from '../../domain/blank/reviewBlankDesign';
import { applySolutionSteps } from '../../domain/stage/sampleAnswer';
import { findUnplacedParts, TRAY_FILE_ID } from '../../domain/blank/tray';
import { blankDesignProblems } from './blankDesignProblems';
import { autoNameClasses } from '../../domain/codebase/autoNameClasses';
import { moveMethodToNewClass } from '../../domain/codebase/moveToNewHome';
import { validateBlankDesignProblem } from '../../domain/blank/validateBlankDesignProblem';

function partResponsibilities(problem: (typeof blankDesignProblems)[number]): Set<string> {
  const responsibilities = partMethods(problem).flatMap((method) => method.fragments).map((fragment) => fragment.responsibility);
  return new Set(responsibilities.filter((responsibility) => responsibility !== 'call'));
}

function partMethods(problem: (typeof blankDesignProblems)[number]) {
  return problem.codebase.files.flatMap((file) => file.classes).flatMap((codeClass) => codeClass.methods);
}

function partWithResponsibility(problem: (typeof blankDesignProblems)[number], responsibility: string | undefined) {
  return partMethods(problem).find((method) => method.fragments.some((fragment) => fragment.responsibility === responsibility));
}

describe.each(blankDesignProblems)('$id', (problem) => {
  it('部品の責務をすべて模範解答のクラス名へ対応づける', () => {
    // Arrange
    const responsibilities = partResponsibilities(problem);
    const modelClassNames = modelAnswerCodebase(problem).files.flatMap((file) => file.classes).map((codeClass) => codeClass.name);

    // Act
    const configuredClassNames = Object.entries(problem.classNames);

    // Assert
    expect(new Set(configuredClassNames.map(([responsibility]) => responsibility))).toEqual(responsibilities);
    expect(configuredClassNames.every(([, className]) => modelClassNames.includes(className))).toBe(true);
  });

  it('プレイヤー操作で作ったクラスには部品の責務から模範解答の名前が付く', () => {
    // Arrange
    const responsibility = problem.changeRequests[0].responsibility;
    const part = partWithResponsibility(problem, responsibility);
    if (part === undefined) throw new Error('責務のある部品が見つかりません');
    const moved = moveMethodToNewClass(problem.codebase, part.id, { classId: 'new-class', fileId: 'new-file' });
    if (!moved.ok) throw new Error(moved.error);

    // Act
    const named = autoNameClasses(moved.value, problem.classNames);

    // Assert
    const expectedClassName = problem.classNames[responsibility];
    expect(named.files.flatMap((file) => file.classes).find((codeClass) => codeClass.id === 'new-class')?.name).toBe(expectedClassName);
  });

  it('validateBlankDesignProblem が ok を返す', () => {
    // Arrange & Act
    const result = validateBlankDesignProblem(problem);

    // Assert
    expect(result.ok).toBe(true);
  });

  it('問題IDは重複しない', () => {
    // Arrange & Act
    const matches = blankDesignProblems.filter((candidate) => candidate.id === problem.id);

    // Assert
    expect(matches).toHaveLength(1);
  });

  it('codebase は部品置き場だけ(ファイル1つ、IDがTRAY_FILE_ID)', () => {
    // Arrange & Act & Assert
    expect(problem.codebase.files).toHaveLength(1);
    expect(problem.codebase.files[0].id).toBe(TRAY_FILE_ID);
  });

  it('模範解答が全部品を配置している', () => {
    // Arrange & Act
    const unplaced = findUnplacedParts(problem.codebase, modelAnswerCodebase(problem));

    // Assert
    expect(unplaced).toEqual([]);
  });

  it('模範解答は100点になる', () => {
    // Arrange & Act
    const result = reviewBlankDesign(problem, modelAnswerCodebase(problem));

    // Assert
    if (!result.ok) throw new Error(result.error);
    expect(result.value.model.score.total).toBe(100);
  });
});

describe('blank-order-shipping', () => {
  const problem = blankDesignProblems.find((candidate) => candidate.id === 'blank-order-shipping');
  if (problem === undefined) throw new Error('blank-order-shipping が見つかりません');

  it('機能(注文・発送)ごとに分けた設計は、模範解答より設計スコアも変更容易性スコアも低い', () => {
    // Arrange: 「注文」「発送」という機能の流れで、税・保存・メールの処理をまとめてしまった設計
    const functionGrouped = applySolutionSteps(problem.codebase, [
      { addFile: 'src/order/OrderService.ts' },
      { addFile: 'src/shipping/ShippingService.ts' },
      { addClass: { name: 'OrderService', file: 'src/order/OrderService.ts' } },
      { addClass: { name: 'ShippingService', file: 'src/shipping/ShippingService.ts' } },
      { move: { method: 'placeOrder', toClass: 'OrderService' } },
      { move: { method: 'calculateOrderTax', toClass: 'OrderService' } },
      { move: { method: 'saveOrder', toClass: 'OrderService' } },
      { move: { method: 'sendOrderConfirmMail', toClass: 'OrderService' } },
      { move: { method: 'shipOrder', toClass: 'ShippingService' } },
      { move: { method: 'updateShippingStatus', toClass: 'ShippingService' } },
      { move: { method: 'sendShippedMail', toClass: 'ShippingService' } },
    ]);

    // Act
    const grouped = reviewBlankDesign(problem, functionGrouped);
    const model = reviewBlankDesign(problem, modelAnswerCodebase(problem));

    // Assert
    if (!grouped.ok || !model.ok) throw new Error('unexpected error');
    // OrderService・ShippingServiceとも、流れ・税(または保存)・メールの3責務が同居して責務の混在×2(-20点)になる
    expect(grouped.value.player.score.total).toBe(80);
    expect(model.value.player.score.total).toBe(100);
    expect(grouped.value.player.score.total).toBeLessThan(model.value.player.score.total);
    expect(grouped.value.player.changeScore).toBeLessThanOrEqual(model.value.player.changeScore);
  });
});

type FunctionGroup = { readonly file: string; readonly cls: string; readonly methods: readonly string[] };

function moveStepsOf(group: FunctionGroup) {
  return group.methods.map((method) => ({ move: { method, toClass: group.cls } }));
}

describe.each([
  {
    id: 'blank-room-reservation',
    groups: [
      { file: 'src/reservation/ReservationService.ts', cls: 'ReservationService', methods: ['reserveRoom', 'checkRoomAvailability', 'saveReservation', 'addToCalendar'] },
      { file: 'src/reservation/CancellationService.ts', cls: 'CancellationService', methods: ['cancelReservation', 'deleteReservation', 'removeFromCalendar'] },
    ],
  },
  {
    id: 'blank-attendance',
    groups: [
      { file: 'src/attendance/ClockInService.ts', cls: 'ClockInService', methods: ['clockIn', 'saveClockIn'] },
      { file: 'src/attendance/ClockOutService.ts', cls: 'ClockOutService', methods: ['clockOut', 'saveClockOut', 'calculateOvertime', 'alertOvertime', 'summarizeMonthlyOvertime'] },
    ],
  },
])('$id', ({ id, groups }) => {
  const problem = blankDesignProblems.find((candidate) => candidate.id === id);
  if (problem === undefined) throw new Error(`${id} が見つかりません`);

  it('機能ごとに部品をまとめた設計は、模範解答より設計スコアも変更容易性スコアも低い', () => {
    // Arrange: 機能の流れ(2グループ)で、責務の違う部品をまとめてしまった設計
    const functionGrouped = applySolutionSteps(problem.codebase, [
      ...groups.map((group) => ({ addFile: group.file })),
      ...groups.map((group) => ({ addClass: { name: group.cls, file: group.file } })),
      ...groups.flatMap(moveStepsOf),
    ]);

    // Act
    const grouped = reviewBlankDesign(problem, functionGrouped);
    const model = reviewBlankDesign(problem, modelAnswerCodebase(problem));

    // Assert
    if (!grouped.ok || !model.ok) throw new Error('unexpected error');
    expect(grouped.value.player.score.total).toBeLessThan(model.value.player.score.total);
    expect(grouped.value.player.changeScore).toBeLessThanOrEqual(model.value.player.changeScore);
  });
});
