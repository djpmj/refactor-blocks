import { describe, expect, it } from 'vitest';
import { addClass } from '../../domain/codebase/addClass';
import { addFile } from '../../domain/codebase/addFile';
import { allClasses, type Codebase } from '../../domain/codebase/Codebase';
import { extractMethod } from '../../domain/codebase/extractMethod';
import { moveClass } from '../../domain/codebase/moveClass';
import { moveMethod } from '../../domain/codebase/moveMethod';
import type { Result } from '../../domain/shared/Result';
import { scoreCodebase } from '../../domain/scoring/score';
import type { Stage } from '../../domain/stage/Stage';
import { stages } from './stageCatalog';

/** 模範解答の1手。メソッド・クラス・ファイルは、プレイヤーと同じく名前(パス)で指定する。 */
type Step =
  | { readonly extract: { readonly from: string; readonly fragmentIds: readonly string[]; readonly name: string } }
  | { readonly move: { readonly method: string; readonly toClass: string } }
  | { readonly addFile: string }
  | { readonly addClass: { readonly name: string; readonly file: string } }
  | { readonly moveClass: { readonly name: string; readonly toFile: string } };

/** 各ステージを100点にできる手順。ステージの数値を変えて解けなくなったら、このテストが落ちる。 */
const solutions: Record<string, readonly Step[]> = {
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
};

/** ステージの狙いを飛ばした手順。これで100点になってしまうなら、ステージの数値の作りが甘い。 */
const shortcuts: ReadonlyArray<{ readonly stageId: string; readonly description: string; readonly steps: readonly Step[] }> = [
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
];

function unwrap<T, E>(result: Result<T, E>): T {
  if (!result.ok) throw new Error(`操作に失敗しました: ${String(result.error)}`);
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

function applyStep(codebase: Codebase, step: Step, newId: string): Codebase {
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
  const { name, toFile } = step.moveClass;
  return unwrap(moveClass(codebase, classIdByName(codebase, name), fileIdByPath(codebase, toFile)));
}

function applySteps(stage: Stage, steps: readonly Step[]): Codebase {
  return steps.reduce((codebase, step, index) => applyStep(codebase, step, `solution-${String(index)}`), stage.codebase);
}

function allIds(stage: Stage): string[] {
  const { files } = stage.codebase;
  const classes = allClasses(stage.codebase);
  const methods = classes.flatMap((codeClass) => codeClass.methods);
  const fragments = methods.flatMap((method) => method.fragments);
  return [...files, ...classes, ...methods, ...fragments].map((item) => item.id);
}

describe('stageCatalog', () => {
  it('チュートリアル・初級・中級の順に、それぞれ1つ以上のステージが並んでいる', () => {
    // Arrange
    const expectedOrder = ['tutorial', 'beginner', 'intermediate'];

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

  describe.each(stages.map((stage) => [stage.title, stage] as const))('%s', (_title, stage) => {
    it('ステージ内のファイル・クラス・メソッド・処理のIDは重複しない', () => {
      // Arrange
      const ids = allIds(stage);

      // Act
      const unique = new Set(ids);

      // Assert
      expect(unique.size).toBe(ids.length);
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
      expect(solutions[stage.id]).toBeDefined();

      // Act
      const solved = applySteps(stage, solutions[stage.id] ?? []);

      // Assert
      expect(scoreCodebase(solved, stage)).toEqual(expect.objectContaining({ total: 100 }));
    });
  });

  it.each(shortcuts)('$stageId: 「$description」では100点にならない', ({ stageId, steps }) => {
    // Arrange
    const stage = stages.find((candidate) => candidate.id === stageId);
    if (stage === undefined) throw new Error(`ステージ ${stageId} がありません`);

    // Act
    const played = applySteps(stage, steps);

    // Assert
    expect(scoreCodebase(played, stage).total).toBeLessThan(100);
  });
});
