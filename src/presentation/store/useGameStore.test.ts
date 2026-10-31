import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { changePart, withChangePart } from '../../domain/change/changePart';
import { withoutTray } from '../../domain/blank/tray';
import { allClasses, findMethod } from '../../domain/codebase/Codebase';
import { movesSince } from '../../domain/codebase/history';
import { moveMethod } from '../../domain/codebase/moveMethod';
import { checkManualFix } from '../../domain/change/checkManualFix';
import { painRequestsOf } from '../../domain/change/changePain';
import { sampleImplementation } from '../../domain/change/sampleImplementation';
import { stages } from '../../infrastructure/stages/stageCatalog';
import { createGameStore, NOTICE_VISIBLE_MS } from './useGameStore';
import { scoreCodebase } from '../../domain/scoring/score';
import { sampleAnswerCodebase } from '../../domain/stage/sampleAnswer';
import { putDraft } from '../../domain/progress/drafts';
import { blankDesignProblems } from '../../infrastructure/blankDesigns/blankDesignProblems';
import { saveDrafts } from '../../infrastructure/progress/draftStorage';
import { saveLastStageId } from '../../infrastructure/progress/lastStageStorage';
import { operationTimeline } from '../stage/operationTimeline';

const ghost = { kind: 'method' as const, methodId: 'method-example', toClassId: 'class-example' };

describe('ドリルの変更依頼', () => {
  it('100点で呼ばれても、依頼0件ならセッションを開始しない', () => {
    // Arrange
    const stage = stages.find((candidate) => candidate.id === 'drill-extract-tail');
    if (stage === undefined) throw new Error('ドリルが必要です');
    const store = createGameStore([stage], false, false);
    store.setState({ codebase: sampleAnswerCodebase(stage) });

    // Act
    store.getState().startChangeRequests();

    // Assert
    expect(scoreCodebase(store.getState().codebase, stage).total).toBe(100);
    expect(store.getState().changeSession).toBeNull();
  });
});

describe('クリア画面', () => {
  const stage = stages.find((candidate) => candidate.id === 'tutorial-extract-method');
  if (stage === undefined) throw new Error('チュートリアル1が必要です');
  const complete = (store: ReturnType<typeof createGameStore>) => store.getState().extractMethod({ sourceMethodId: 'method-print-monthly-report', fragmentIds: ['frag-aggregate-sales', 'frag-compare-last-month'], newMethodName: 'aggregateSales' });

  it('初めて100点にした操作で一度だけ出し、閉じても記録を残す', () => {
    // Arrange
    const stage = stages.find((candidate) => candidate.title === 'チュートリアル1: 長いメソッドを分ける');
    if (stage === undefined) throw new Error('チュートリアル1が必要です');
    const store = createGameStore([stage], false, false);
    expect(store.getState().clearScreen).toBeNull();

    // Act
    expect(store.getState().extractMethod({ sourceMethodId: 'method-print-monthly-report', fragmentIds: ['frag-aggregate-sales', 'frag-compare-last-month'], newMethodName: 'aggregateSales' })).toBe(true);

    // Assert
    expect(scoreCodebase(store.getState().codebase, stage).total).toBe(100);
    expect(store.getState().clearScreen).toEqual({ stageId: stage.id });
    expect(store.getState().clearShownStages).toEqual([stage.id]);
    store.getState().dismissClearScreen();
    expect(store.getState().clearScreen).toBeNull();
    store.getState().undo();
    store.getState().redo();
    expect(store.getState().clearScreen).toBeNull();
    expect(store.getState().clearShownStages).toEqual([stage.id]);
  });

  it('ツアー中の100点では出さず、ステージ移動では表示だけを閉じる', () => {
    // Arrange
    const first = stages.find((candidate) => candidate.id === 'tutorial-extract-method');
    const second = stages.find((candidate) => candidate.id === 'tutorial-order-service');
    if (first === undefined || second === undefined) throw new Error('チュートリアルが必要です');
    const store = createGameStore([first, second], false, false);
    store.setState({ tourStep: 0 });

    // Act
    store.getState().extractMethod({ sourceMethodId: 'method-print-monthly-report', fragmentIds: ['frag-aggregate-sales', 'frag-compare-last-month'], newMethodName: 'aggregateSales' });

    // Assert
    expect(store.getState().clearScreen).toBeNull();
    expect(store.getState().clearShownStages).toEqual([]);
    store.getState().undo();
    store.setState({ tourStep: null });
    store.getState().extractMethod({ sourceMethodId: 'method-print-monthly-report', fragmentIds: ['frag-aggregate-sales', 'frag-compare-last-month'], newMethodName: 'aggregateSales' });
    expect(store.getState().clearScreen).toEqual({ stageId: first.id });
    store.getState().selectStage(second.id);
    expect(store.getState().clearScreen).toBeNull();
    expect(store.getState().clearShownStages).toEqual([first.id]);
  });

  it('resetStage と redo では100点になっても表示しない', () => {
    // Arrange
    const store = createGameStore([stage], false, false);
    expect(complete(store)).toBe(true);
    store.getState().dismissClearScreen();

    // Act
    store.getState().undo();
    store.getState().redo();
    store.getState().resetStage();

    // Assert
    expect(store.getState().clearScreen).toBeNull();
    expect(store.getState().clearShownStages).toEqual([stage.id]);
  });

  it.each(['manualFix', 'changeSession'] as const)('%s 中に100点にしても表示も記録もしない', (mode) => {
    // Arrange
    const store = createGameStore([stage], false, false);
    if (mode === 'manualFix') {
      store.getState().startManualFix();
      expect(store.getState().manualFix).not.toBeNull();
    } else {
      const codebase = store.getState().codebase;
      store.setState({ changeSession: { index: 0, inspected: null, reviewing: null, outcomes: [], base: codebase, carried: codebase, sampleCarried: codebase, baseHistory: store.getState().history } });
    }

    // Act
    expect(complete(store)).toBe(true);

    // Assert
    expect(scoreCodebase(store.getState().codebase, stage).total).toBe(100);
    expect(store.getState().clearScreen).toBeNull();
    expect(store.getState().clearShownStages).toEqual([]);
  });
});

describe('move visibility notice', () => {
  it('抽出メソッドを別クラスへ移すとpublic化を知らせ、undoでprivateと通知を戻す', () => {
    // Arrange
    const stage = stages.find((candidate) => candidate.title === 'チュートリアル2: 太った placeOrder');
    if (stage === undefined) throw new Error('チュートリアル2のステージが必要です');
    const store = createGameStore([stage], false, false);

    // Act
    expect(store.getState().extractMethod({ sourceMethodId: 'method-place-order', fragmentIds: ['frag-tax'], newMethodName: 'calculateTax' })).toBe(true);
    const method = allClasses(store.getState().codebase).flatMap((codeClass) => codeClass.methods).find((candidate) => candidate.name === 'calculateTax');
    if (method === undefined) throw new Error('抽出した calculateTax が必要です');
    store.getState().moveMethod(method.id, 'class-tax-calculator');

    // Assert
    expect(findMethod(store.getState().codebase, method.id)?.visibility).toBe('public');
    expect(store.getState().notice).toBe('calculateTax() は TaxCalculator の外(OrderService)から呼ばれるようになったので、public にしました');

    // Act: undo treats the move and visibility change as one history entry
    store.getState().undo();

    // Assert
    expect(findMethod(store.getState().codebase, method.id)?.visibility).toBe('private');
    expect(store.getState().notice).toBeNull();
  });

  it('複数の越境メソッドは、名前を順序どおり並べて知らせる', () => {
    // Arrange
    const stage = stages.find((candidate) => candidate.title === 'チュートリアル2: 太った placeOrder');
    if (stage === undefined) throw new Error('チュートリアル2のステージが必要です');
    const codebase = { files: [{ id: 'file', path: 'sample.ts', classes: [
      { id: 'caller', name: 'OrderController', methods: [{ id: 'call-tax', name: 'callTax', visibility: 'public' as const, fragments: [{ id: 'call-tax-fragment', label: 'call', lines: 1, responsibility: 'misc', uses: ['tax'] }] }] },
      { id: 'source', name: 'OrderService', methods: [
        { id: 'tax', name: 'calculateTax', visibility: 'private' as const, fragments: [{ id: 'tax-call', label: 'call', lines: 1, responsibility: 'misc', uses: ['save'] }] },
        { id: 'save', name: 'saveOrder', visibility: 'protected' as const, fragments: [{ id: 'save-body', label: 'body', lines: 1, responsibility: 'misc' }] },
      ] },
      { id: 'target', name: 'TaxCalculator', methods: [] },
    ] }] };
    const store = createGameStore([{ ...stage, codebase, visibilityEnforced: false }], false, false);

    // Act
    store.getState().moveMethod('tax', 'target');

    // Assert
    expect(store.getState().notice).toBe('外のクラスから呼ばれるようになったので、calculateTax()・saveOrder() を public にしました');
  });

  it('子孫からの呼び出しでprivateをprotectedにしたと知らせる', () => {
    // Arrange
    const stage = stages.find((candidate) => candidate.title === 'チュートリアル2: 太った placeOrder');
    if (stage === undefined) throw new Error('チュートリアル2のステージが必要です');
    const codebase = { files: [{ id: 'file', path: 'sample.ts', classes: [
      { id: 'parent', name: 'Parent', methods: [{ id: 'hidden', name: 'hidden', visibility: 'private' as const, fragments: [{ id: 'body', label: 'body', lines: 1, responsibility: 'misc' }] }] },
      { id: 'child', name: 'Child', superclassId: 'parent', methods: [
        { id: 'moved', name: 'moved', visibility: 'public' as const, fragments: [{ id: 'call-target', label: 'call', lines: 1, responsibility: 'misc' }] },
        { id: 'child-caller', name: 'callHidden', visibility: 'public' as const, fragments: [{ id: 'call-hidden', label: 'call', lines: 1, responsibility: 'misc', uses: ['hidden'] }] },
      ] },
      { id: 'target', name: 'Target', methods: [] },
    ] }] };
    const store = createGameStore([{ ...stage, codebase, visibilityEnforced: false }], false, false);

    // Act
    store.getState().moveMethod('moved', 'target');

    // Assert
    expect(findMethod(store.getState().codebase, 'hidden')?.visibility).toBe('protected');
    expect(store.getState().notice).toBe('hidden() は Parent の外(Child)から呼ばれるようになったので、protected にしました');
  });
});

describe('delete inline notice', () => {
  const stage = stages.find((candidate) => candidate.title === '中級12: 横流しするだけの OrderManager');

  it('ファイル削除で呼び出し元へ戻した処理を案内し、dismissとundoで消す', () => {
    // Arrange
    if (stage === undefined) throw new Error('中級12のステージが必要です');
    const store = createGameStore([stage], false, false);

    // Act
    expect(store.getState().deleteFile('file-order-manager')).toBe(true);

    // Assert
    expect(store.getState().notice).toBe('削除する前に、処理を呼び出し元へ戻しました: OrderManager.placeOrder() → OrderController.placeOrder()、OrderManager.cancelOrder() → OrderController.cancelOrder()');
    expect(store.getState().message).toBeNull();
    expect(scoreCodebase(store.getState().codebase, stage).total).toBe(100);
    store.getState().dismissMessage();
    expect(store.getState().notice).toBeNull();

    // Act: a fresh deletion followed by undo clears the notice
    store.getState().deleteFile('file-order-manager');
    store.getState().undo();

    // Assert
    expect(store.getState().notice).toBeNull();
  });

  it('失敗はnoticeを消してエラーだけを残す', () => {
    // Arrange
    if (stage === undefined) throw new Error('中級12のステージが必要です');
    const store = createGameStore([stage], false, false);
    store.setState({ notice: '以前のお知らせ' });

    // Act
    expect(store.getState().deleteClass('class-order-controller')).toBe(false);

    // Assert
    expect(store.getState().message).toBe('処理が残っているクラスは削除できません。先にメソッドを別のクラスへ移してください');
    expect(store.getState().notice).toBeNull();
  });

  it('変更依頼の実装に失敗したときも、noticeではなくエラーだけを残す', () => {
    // Arrange
    const store = createGameStore(stages, false, false);
    store.getState().startChangeRequests();
    store.setState({ notice: '以前のお知らせ' });

    // Act
    store.getState().finishImplementation();

    // Assert
    expect(store.getState().message).toBe('部品がまだ部品置き場にあります。置き場所へドラッグしてください');
    expect(store.getState().notice).toBeNull();
  });

  it('メソッド・フィールド選択、ステージ切替、最初に戻す操作でnoticeを消す', () => {
    // Arrange
    if (stage === undefined) throw new Error('中級12のステージが必要です');
    const store = createGameStore([stage, stages[0]], false);
    store.setState({ notice: '案内' });

    // Act / Assert
    store.getState().selectMethod('method-place-order');
    expect(store.getState().notice).toBeNull();
    store.setState({ notice: '案内' });
    store.getState().selectField('field-order-status');
    expect(store.getState().notice).toBeNull();
    store.setState({ notice: '案内' });
    store.getState().selectStage(stages[0].id);
    expect(store.getState().notice).toBeNull();
    store.setState({ notice: '案内' });
    store.getState().resetStage();
    expect(store.getState().notice).toBeNull();
  });
});

describe('change-request lifecycle and ghost state', () => {
  it('チュートリアル2で部品を積み重ねても3件目の変更コストは挑戦前の設計で測る', () => {
    // Arrange
    const stage = stages.find((candidate) => candidate.id === 'tutorial-order-service');
    if (stage === undefined) throw new Error('チュートリアル2が必要です');
    const design = sampleAnswerCodebase(stage);
    const store = createGameStore([stage], false, false);
    store.setState({ codebase: design });
    store.getState().startChangeRequests();

    // Act
    for (const request of stage.changeRequests.slice(0, 2)) {
      const part = changePart(request);
      const withPart = withChangePart(store.getState().codebase, request);
      const placed = moveMethod(withPart, part.id, 'class-order-service');
      if (!placed.ok) throw new Error('OrderServiceへ配置できるはず');
      store.setState({ codebase: placed.value });
      store.getState().finishImplementation();
      store.getState().advanceChangeRequest();
    }
    const thirdRequest = stage.changeRequests[2];
    const thirdWithPart = withChangePart(store.getState().codebase, thirdRequest);
    const thirdPart = moveMethod(thirdWithPart, changePart(thirdRequest).id, 'class-order-service');
    if (!thirdPart.ok) throw new Error('OrderServiceへ配置できるはず');
    store.setState({ codebase: thirdPart.value });
    store.getState().finishImplementation();
    store.getState().advanceChangeRequest();

    // Assert
    const outcome = store.getState().changeSession?.outcomes.at(-1);
    expect(outcome?.current?.score.total).toBeGreaterThanOrEqual(outcome?.initial?.score.total ?? 0);
  });

  it('clears the active ghost when a change request starts', () => {
    // Arrange
    const store = createGameStore(stages, false, false);
    store.setState({ ghost });
    // Act
    store.getState().startChangeRequests();
    // Assert
    expect(store.getState().ghost).toBeNull();
  });

  it('clears the active ghost when implementation advances', () => {
    // Arrange
    const stage = stages[0];
    const request = stage.changeRequests[0];
    const sample = sampleImplementation(stage.codebase, request);
    if (sample === undefined || sample.target.kind !== 'existing-class') throw new Error('An existing-class sample placement is required');
    const targetName = sample.target.className;
    const target = allClasses(stage.codebase).find((item) => item.name === targetName);
    if (target === undefined) throw new Error('The sample target class is required');
    const placed = moveMethod(withChangePart(stage.codebase, request), changePart(request).id, target.id);
    if (!placed.ok) throw new Error('The sample part should be placeable');
    const store = createGameStore([stage], false, false);
    store.getState().startChangeRequests();
    store.setState({ codebase: placed.value });
    store.setState({ ghost });
    // Act
    store.getState().finishImplementation();
    // Assert
    expect(store.getState().ghost).toBeNull();
  });

  it('clears the active ghost when change requests end', () => {
    // Arrange
    const store = createGameStore(stages, false, false);
    store.getState().startChangeRequests();
    store.setState({ ghost });
    // Act
    store.getState().endChangeRequests();
    // Assert
    expect(store.getState().ghost).toBeNull();
  });

  it('最後の依頼を終えた画面には配置後のコードを残し、戻ると挑戦前へ戻す', () => {
    const stage = stages[0];
    const index = stage.changeRequests.length - 1;
    const request = stage.changeRequests[index];
    const sample = sampleImplementation(stage.codebase, request);
    if (sample === undefined) throw new Error('a sample implementation is required');
    const targetName = sample.target.kind === 'existing-class' ? sample.target.className : '';
    if (targetName.length === 0) throw new Error('an existing-class sample placement is required');
    const target = allClasses(stage.codebase).find((item) => item.name === targetName);
    if (target === undefined) throw new Error('the sample target class is required');
    const placed = moveMethod(withChangePart(stage.codebase, request), changePart(request).id, target.id);
    if (!placed.ok) throw new Error('the sample part should be placeable');
    const store = createGameStore([stage], false, false);
    const base = store.getState().codebase;
    store.setState({
      codebase: placed.value,
      changeSession: { index, inspected: null, reviewing: null, outcomes: [], base, carried: base, sampleCarried: base, baseHistory: store.getState().history },
    });

    store.getState().finishImplementation();
    store.getState().advanceChangeRequest();
    expect(store.getState().codebase).toEqual(withoutTray(placed.value));
    store.getState().endChangeRequests();
    expect(store.getState().codebase).toEqual(base);
  });
});

describe('change-request step feedback', () => {
  function startAndPlaceFirst() {
    const stage = stages[0];
    const request = stage.changeRequests[0];
    const sample = sampleImplementation(stage.codebase, request);
    if (sample === undefined || sample.target.kind !== 'existing-class') throw new Error('An existing-class sample placement is required');
    const targetName = sample.target.className;
    const target = allClasses(stage.codebase).find((item) => item.name === targetName);
    if (target === undefined) throw new Error('The sample target class is required');
    const store = createGameStore([stage], false, false);
    store.getState().startChangeRequests();
    const started = store.getState().codebase;
    const placed = moveMethod(started, changePart(request).id, target.id);
    if (!placed.ok) throw new Error('The sample part should be placeable');
    store.setState({ codebase: placed.value });
    return { store, started, placed: placed.value, stage };
  }

  it('実装を終えるとその依頼の結果がreviewingに入り、indexはまだ進まない', () => {
    // Arrange
    const { store } = startAndPlaceFirst();

    // Act
    store.getState().finishImplementation();

    // Assert
    const session = store.getState().changeSession;
    expect(session?.reviewing?.request.id).toBe(store.getState().stage.changeRequests[0].id);
    expect(session?.index).toBe(0);
    expect(session?.outcomes).toHaveLength(0);
  });

  it('置き直すとreviewingがnullに戻り、コードがその依頼の開始時点に戻る', () => {
    // Arrange
    const { store, started } = startAndPlaceFirst();
    store.getState().finishImplementation();

    // Act
    store.getState().retryChangeRequest();

    // Assert
    const session = store.getState().changeSession;
    expect(session?.reviewing).toBeNull();
    expect(session?.index).toBe(0);
    expect(session?.outcomes).toHaveLength(0);
    expect(store.getState().codebase).toEqual(started);
  });

  it('次の依頼へ進むとoutcomesに結果が足されindexが1進む', () => {
    // Arrange
    const { store, placed } = startAndPlaceFirst();
    store.getState().finishImplementation();
    const reviewing = store.getState().changeSession?.reviewing;

    // Act
    store.getState().advanceChangeRequest();

    // Assert
    const session = store.getState().changeSession;
    expect(session?.reviewing).toBeNull();
    expect(session?.index).toBe(1);
    expect(session?.outcomes).toEqual([reviewing]);
    expect(session?.carried).toEqual(withoutTray(placed));
  });

  it('結果を見ていないときは置き直すも次の依頼へも何もしない', () => {
    // Arrange
    const { store } = startAndPlaceFirst();
    const before = store.getState().changeSession;

    // Act
    store.getState().retryChangeRequest();
    store.getState().advanceChangeRequest();

    // Assert
    expect(store.getState().changeSession).toBe(before);
  });
});

describe('opening and closing manual-fix flow', () => {
  const stage = stages.find((candidate) => candidate.title === '中級9: コピペされた消費税計算を1か所にまとめる');

  it('冒頭のリリース前は編集を止め、誤答でリリースすれば編集できる', () => {
    if (stage === undefined) throw new Error('tax stage is required');
    const store = createGameStore([stage], false);
    const initial = store.getState().codebase;
    expect(store.getState().extractMethod({ sourceMethodId: 'method-confirm-order', fragmentIds: ['frag-order-tax'], newMethodName: 'tax' })).toBe(false);
    expect(store.getState().codebase).toBe(initial);
    expect(store.getState().message).toContain('まず「もし、この変更が来たら?」');

    store.getState().startManualFix();
    store.getState().releaseManualFix();
    expect(store.getState().openingFixes[stage.id]).toEqual({ missed: 3, extra: 0, sites: 3, fixedIds: [] });
    expect(store.getState().extractMethod({ sourceMethodId: 'method-confirm-order', fragmentIds: ['frag-order-tax'], newMethodName: 'tax' })).toBe(true);
  });

  it('仕上げは正解でのみ解除し、resetは冒頭結果を残して仕上げを再設定する', () => {
    if (stage === undefined) throw new Error('tax stage is required');
    const store = createGameStore([stage], false);
    store.setState({ openingFixes: { [stage.id]: { missed: 2, extra: 0, sites: 3, fixedIds: [] } }, codebase: sampleAnswerCodebase(stage) });
    store.getState().startManualFix();
    store.getState().releaseManualFix();
    expect(store.getState().closingFixSolved).toBe(false);
    store.getState().restartManualFix();
    const request = painRequestsOf(stage).modify;
    if (request === undefined) throw new Error('modify request is required');
    const sites = checkManualFix(store.getState().codebase, request, []).missed;
    for (const id of sites) store.getState().toggleFixed(id);
    store.getState().releaseManualFix();
    expect(store.getState().closingFixSolved).toBe(true);

    store.getState().resetStage();
    expect(store.getState().openingFixes[stage.id]).toEqual({ missed: 2, extra: 0, sites: 3, fixedIds: [] });
    expect(store.getState().closingFixSolved).toBe(false);
  });

  it('0点のまま減点の合計が減ると成功演出を出し、増える操作では出さない', () => {
    if (stage === undefined) throw new Error('tax stage is required');
    const store = createGameStore([stage], false, false);
    const fileId = stage.codebase.files[0].id;

    // Arrange: 初期の減点100に空クラスを足して120にする
    const beforeClassIds = new Set(allClasses(store.getState().codebase).map(({ id }) => id));
    expect(store.getState().addClass(fileId, 'TemporaryEmpty')).toBe(true);
    const addedClass = allClasses(store.getState().codebase).find(({ id }) => !beforeClassIds.has(id));
    if (addedClass === undefined) throw new Error('added class is required');
    expect(scoreCodebase(store.getState().codebase, stage)).toMatchObject({ total: 0, deducted: 120 });
    expect(store.getState().celebration).toBeNull();

    // Act
    expect(store.getState().deleteClass(addedClass.id)).toBe(true);

    // Assert
    expect(scoreCodebase(store.getState().codebase, stage)).toMatchObject({ total: 0, deducted: 100 });
    expect(store.getState().celebration).toMatchObject({ scoreBefore: 0, scoreAfter: 0, deductedBefore: 120, deductedAfter: 100 });

    // Act: 減点を増やす操作では新しい成功演出を作らない
    const sequence = store.getState().celebration?.seq;
    expect(store.getState().addClass(fileId, 'AnotherTemporaryEmpty')).toBe(true);

    // Assert
    expect(scoreCodebase(store.getState().codebase, stage)).toMatchObject({ total: 0, deducted: 120 });
    expect(store.getState().celebration?.seq).toBe(sequence);
  });
});

describe('impact review dialog state', () => {
  it('open/close actions change the state and selecting another stage closes it', () => {
    const first = stages[0];
    const second = stages[1];
    const store = createGameStore([first, second], false);

    store.getState().openImpactReview();
    expect(store.getState().impactReviewOpen).toBe(true);
    store.getState().closeImpactReview();
    expect(store.getState().impactReviewOpen).toBe(false);
    store.getState().openImpactReview();
    store.getState().selectStage(second.id);
    expect(store.getState().impactReviewOpen).toBe(false);
  });
});

describe('opening-fix lock regressions', () => {
  const stage = stages.find((candidate) => painRequestsOf(candidate).modify !== undefined);

  it('opening-fix中はclass/file削除も止めて案内を表示する', () => {
    if (stage === undefined) throw new Error('tax stage is required');
    const store = createGameStore([stage], false);
    const initial = store.getState().codebase;
    const classId = stage.codebase.files[0]?.classes[0]?.id;
    const fileId = stage.codebase.files[0]?.id;

    expect(store.getState().deleteClass(classId)).toBe(false);
    expect(store.getState().codebase).toBe(initial);
    expect(store.getState().message).toContain('もし、この変更が来たら?');
    store.getState().dismissMessage();

    expect(store.getState().deleteFile(fileId)).toBe(false);
    expect(store.getState().codebase).toBe(initial);
    expect(store.getState().message).toContain('もし、この変更が来たら?');
  });

  it('startChangeRequests自体もclosing-fixが済むまでは拒否する', () => {
    if (stage === undefined) throw new Error('tax stage is required');
    const store = createGameStore([stage], false);
    store.setState({ codebase: sampleAnswerCodebase(stage) });

    store.getState().startChangeRequests();
    expect(store.getState().changeSession).toBeNull();
    expect(store.getState().message).toContain('もし、この変更が来たら?');

    store.setState({ openingFixes: { [stage.id]: { missed: 1, extra: 0, sites: 3, fixedIds: [] } } });
    store.getState().startChangeRequests();
    expect(store.getState().changeSession).toBeNull();
    expect(store.getState().message).toContain('手直しと組み替え');

    store.setState({ closingFixSolved: true });
    store.getState().startChangeRequests();
    expect(store.getState().changeSession).not.toBeNull();
  });

  it('draftへ戻っても同じタブで記録した冒頭結果を保つ', () => {
    if (stage === undefined) throw new Error('tax stage is required');
    const otherStage = stages.find((candidate) => candidate.id !== stage.id);
    if (otherStage === undefined) throw new Error('a second stage is required');
    const previousDrafts = localStorage.getItem('refactor-blocks:drafts');
    try {
      localStorage.clear();
      saveDrafts(putDraft({}, stage, sampleAnswerCodebase(stage)));
      const store = createGameStore([stage, otherStage]);
      const openingResult = { missed: 2, extra: 0, sites: 3, fixedIds: [] } as const;
      store.setState({ openingFixes: { [stage.id]: openingResult } });

      store.getState().selectStage(otherStage.id);
      store.getState().selectStage(stage.id);

      expect(store.getState().restoredDraft).toBe(true);
      expect(store.getState().openingFixes[stage.id]).toEqual(openingResult);
    } finally {
      if (previousDrafts === null) localStorage.removeItem('refactor-blocks:drafts');
      else localStorage.setItem('refactor-blocks:drafts', previousDrafts);
    }
  });

  it('blank-design storeではopening-fix gateを使わない', () => {
    const store = createGameStore(blankDesignProblems, false, false);
    const initial = store.getState().codebase;
    const fileId = initial.files[0]?.id;
    expect(store.getState().addClass(fileId, 'BlankGroup')).toBe(true);
    expect(store.getState().codebase).not.toBe(initial);
    expect(store.getState().message).toBeNull();
  });
});

describe('extract draft lifecycle', () => {
  const draft = { sourceMethodId: 'method-print-monthly-report', fragmentIds: ['frag-aggregate-sales'], newMethodName: 'aggregateSales' };

  it('clears the draft when a different method is selected', () => {
    // Arrange
    const store = createGameStore(stages, false, false);
    store.getState().setExtractDraft(draft);

    // Act
    store.getState().selectMethod('method-place-order');

    // Assert
    expect(store.getState().extractDraft).toBeNull();
  });

  it('clears the draft on undo, stage change, and reset', () => {
    // Arrange
    const store = createGameStore(stages, false, false);
    store.getState().selectStage(stages[1].id);
    store.setState({ openingFixes: { [stages[1].id]: null } });
    store.getState().extractMethod({ sourceMethodId: 'method-place-order', fragmentIds: ['frag-validate-items'], newMethodName: 'validateItems' });
    store.getState().setExtractDraft(draft);

    // Act
    store.getState().undo();

    // Assert
    expect(store.getState().extractDraft).toBeNull();
    store.getState().setExtractDraft(draft);
    store.getState().selectStage(stages[0].id);
    expect(store.getState().extractDraft).toBeNull();

    // Act
    store.getState().setExtractDraft(draft);
    store.getState().resetStage();

    // Assert
    expect(store.getState().extractDraft).toBeNull();
  });

  it('keeps preview state outside the codebase and undo history', () => {
    // Arrange
    const store = createGameStore(stages, false);
    const codebase = store.getState().codebase;
    const history = store.getState().history;

    // Act
    store.getState().setExtractDraft(draft);

    // Assert
    expect(store.getState().extractDraft).toEqual(draft);
    expect(store.getState().codebase).toBe(codebase);
    expect(store.getState().history).toBe(history);
  });
});

describe('manual fix method viewer state', () => {
  it('tracks the last clicked method without changing the editor selection', () => {
    // Arrange
    const store = createGameStore(stages, false);
    store.getState().selectMethod('method-place-order');

    // Act
    store.getState().startManualFix();
    store.getState().toggleFixed('method-confirm-order');

    // Assert
    expect(store.getState().manualFix?.viewedMethodId).toBe('method-confirm-order');
    expect(store.getState().manualFix?.fixedIds).toContain('method-confirm-order');
    expect(store.getState().selectedMethodId).toBe('method-place-order');
  });

  it('keeps the viewed method when its fixed mark is removed and changes it for another method', () => {
    // Arrange
    const store = createGameStore(stages, false);
    store.getState().startManualFix();

    // Act
    store.getState().toggleFixed('method-a');
    store.getState().toggleFixed('method-a');
    store.getState().toggleFixed('method-b');

    // Assert
    expect(store.getState().manualFix?.fixedIds).toEqual(['method-b']);
    expect(store.getState().manualFix?.viewedMethodId).toBe('method-b');
  });

  it('does not change fixed marks or the viewed method when toggling after release', () => {
    // Arrange
    const store = createGameStore(stages, false);
    store.getState().startManualFix();
    store.getState().toggleFixed('method-a');
    store.getState().releaseManualFix();

    // Act
    store.getState().toggleFixed('method-b');

    // Assert
    expect(store.getState().manualFix?.fixedIds).toEqual(['method-a']);
    expect(store.getState().manualFix?.viewedMethodId).toBe('method-a');
  });

  it('views a method without touching fixed marks, even when read repeatedly', () => {
    // Arrange
    const store = createGameStore(stages, false);
    store.getState().startManualFix();

    // Act
    store.getState().viewManualFixMethod('method-a');
    store.getState().viewManualFixMethod('method-a');

    // Assert
    expect(store.getState().manualFix?.viewedMethodId).toBe('method-a');
    expect(store.getState().manualFix?.fixedIds).toEqual([]);
  });

  it('keeps a fixed mark when the method is read again', () => {
    // Arrange
    const store = createGameStore(stages, false);
    store.getState().startManualFix();
    store.getState().toggleFixed('method-a');

    // Act
    store.getState().viewManualFixMethod('method-a');

    // Assert
    expect(store.getState().manualFix?.fixedIds).toEqual(['method-a']);
  });

  it('does not change the selected method when viewing during manual fix', () => {
    // Arrange
    const store = createGameStore(stages, false);
    store.getState().selectMethod('method-place-order');
    store.getState().startManualFix();

    // Act
    store.getState().viewManualFixMethod('method-confirm-order');

    // Assert
    expect(store.getState().selectedMethodId).toBe('method-place-order');
  });

  it('can view a method after release without changing fixed marks, and does nothing when inactive', () => {
    // Arrange
    const store = createGameStore(stages, false);
    store.getState().startManualFix();
    store.getState().toggleFixed('method-a');
    store.getState().releaseManualFix();

    // Act
    store.getState().viewManualFixMethod('method-b');

    // Assert
    expect(store.getState().manualFix?.viewedMethodId).toBe('method-b');
    expect(store.getState().manualFix?.fixedIds).toEqual(['method-a']);
    store.getState().endManualFix();
    store.getState().viewManualFixMethod('method-c');
    expect(store.getState().manualFix).toBeNull();
  });

  it('clears the viewed method when restarted and does nothing when inactive', () => {
    // Arrange
    const store = createGameStore(stages, false);
    store.getState().startManualFix();
    store.getState().toggleFixed('method-a');

    // Act
    store.getState().restartManualFix();

    // Assert
    expect(store.getState().manualFix?.viewedMethodId).toBeNull();

    // Act
    store.getState().toggleFixed('method-b');

    // Assert
    expect(store.getState().manualFix?.viewedMethodId).toBe('method-b');
    store.getState().endManualFix();
    store.getState().toggleFixed('method-c');
    expect(store.getState().manualFix).toBeNull();
  });

  it('locks canvas move-to-new-container actions until the opening fix is released', () => {
    const stage = stages.find((candidate) => painRequestsOf(candidate).modify !== undefined);
    if (stage === undefined) throw new Error('a modify stage is required');
    const store = createGameStore([stage], false);
    const initial = store.getState().codebase;
    const firstClass = stage.codebase.files[0].classes[0];
    const classId = firstClass.id;
    const methodId = firstClass.methods[0].id;

    expect(store.getState().moveClassToNewFile(classId)).toBeNull();
    expect(store.getState().codebase).toBe(initial);
    expect(store.getState().message).toContain('まず「もし、この変更が来たら?」');
    store.getState().dismissMessage();

    expect(store.getState().moveMethodToNewClass(methodId)).toBeNull();
    expect(store.getState().codebase).toBe(initial);
    expect(store.getState().message).toContain('まず「もし、この変更が来たら?」');
  });
});

describe('recordProgress', () => {
  it('ステージを開いた直後の点数(初期点)は自己ベストとして記録しない', () => {
    // Arrange
    const stage = stages[0];
    const store = createGameStore([stage], false, false);
    const initial = scoreCodebase(stage.codebase, stage).total;

    // Act
    store.getState().recordProgress(stage.id, initial);

    // Assert
    expect(store.getState().progress[stage.id]).toBeUndefined();
  });

  it('初期点を超えた点数は記録し、その後に点数が下がっても自己ベストは下がらない', () => {
    // Arrange
    const stage = stages[0];
    const store = createGameStore([stage], false, false);
    const initial = scoreCodebase(stage.codebase, stage).total;

    // Act
    store.getState().recordProgress(stage.id, initial + 10);
    store.getState().recordProgress(stage.id, initial);

    // Assert
    expect(store.getState().progress[stage.id]).toBe(initial + 10);
  });

  it('存在しないステージの点数は記録しない', () => {
    // Arrange
    const store = createGameStore(stages, false, false);

    // Act
    store.getState().recordProgress('no-such-stage', 80);

    // Assert
    expect(store.getState().progress['no-such-stage']).toBeUndefined();
  });
});

describe('最後に開いたステージから始める', () => {
  const [first, second] = stages;

  afterEach(() => {
    localStorage.clear();
  });

  it('保存IDが2番目のステージのとき、stage は2番目のステージになる', () => {
    // Arrange
    saveLastStageId(second.id);

    // Act
    const store = createGameStore(stages, true, false);

    // Assert
    expect(store.getState().stage.id).toBe(second.id);
  });

  it('保存IDが stages に無いとき、先頭のステージになる', () => {
    // Arrange
    saveLastStageId('no-such-stage');

    // Act
    const store = createGameStore(stages, true, false);

    // Assert
    expect(store.getState().stage.id).toBe(first.id);
  });

  it('saveDraftsOn = false のときは、保存IDがあっても先頭のステージになる', () => {
    // Arrange
    saveLastStageId(second.id);

    // Act
    const store = createGameStore(stages, false, false);

    // Assert
    expect(store.getState().stage.id).toBe(first.id);
  });

  it('selectStage で切り替えたステージのIDが保存される', () => {
    // Arrange
    const store = createGameStore(stages, true, false);

    // Act
    store.getState().selectStage(second.id);

    // Assert
    expect(createGameStore(stages, true, false).getState().stage.id).toBe(second.id);
  });
});

describe('役目を終えたトーストを消す', () => {
  const stage = stages.find((candidate) => candidate.title === '中級9: コピペされた消費税計算を1か所にまとめる');
  const OPENING_MESSAGE = 'まず「もし、この変更が来たら?」';

  function storeWithMessage() {
    if (stage === undefined) throw new Error('tax stage is required');
    const store = createGameStore([stage], false);
    expect(store.getState().extractMethod({ sourceMethodId: 'method-confirm-order', fragmentIds: ['frag-order-tax'], newMethodName: 'tax' })).toBe(false);
    expect(store.getState().message).toContain(OPENING_MESSAGE);
    return store;
  }

  afterEach(() => {
    vi.useRealTimers();
  });

  it('messageを出した操作自身では、messageは残る', () => {
    // Arrange
    const store = storeWithMessage();

    // Act
    store.setState({ message: 'エラー', selectedMethodId: 'method-confirm-order' });

    // Assert
    expect(store.getState().message).toBe('エラー');
  });

  it('messageが出たあと、codebaseが変わるとmessageはnullになる', () => {
    // Arrange
    const store = storeWithMessage();

    // Act
    store.setState({ codebase: { files: [] } });

    // Assert
    expect(store.getState().message).toBeNull();
  });

  it('messageが出たあと、selectedMethodIdが変わるとmessageはnullになる', () => {
    // Arrange
    const store = storeWithMessage();

    // Act
    store.setState({ selectedMethodId: 'method-confirm-order' });

    // Assert
    expect(store.getState().message).toBeNull();
  });

  it('messageが出たあと、manualFixが始まるとmessageはnullになる', () => {
    // Arrange
    const store = storeWithMessage();

    // Act
    store.getState().startManualFix();

    // Assert
    expect(store.getState().manualFix).not.toBeNull();
    expect(store.getState().message).toBeNull();
  });

  it('noticeは、状況が変わっても時間までは消えず、8秒で消える', () => {
    // Arrange
    vi.useFakeTimers();
    const store = storeWithMessage();
    store.setState({ message: null, notice: 'お知らせ' });

    // Act
    store.setState({ selectedMethodId: 'method-confirm-order' });
    vi.advanceTimersByTime(NOTICE_VISIBLE_MS - 1);

    // Assert
    expect(store.getState().notice).toBe('お知らせ');

    // Act
    vi.advanceTimersByTime(1);

    // Assert
    expect(store.getState().notice).toBeNull();
  });

  it('noticeが置き換わると8秒を数え直す', () => {
    // Arrange
    vi.useFakeTimers();
    const store = storeWithMessage();
    store.setState({ message: null, notice: '最初' });
    vi.advanceTimersByTime(5000);

    // Act
    store.setState({ notice: '次' });
    vi.advanceTimersByTime(5000);

    // Assert
    expect(store.getState().notice).toBe('次');

    // Act
    vi.advanceTimersByTime(3000);

    // Assert
    expect(store.getState().notice).toBeNull();
  });
});

describe('コードが変わったらヒントの光りを消す', () => {
  const target = { fileIds: [], classIds: [], methodIds: ['method-place-order'] };
  const extraction = { sourceMethodId: 'method-place-order', fragmentIds: ['frag-tax'], newMethodName: 'calculateTax' };

  function storeWithHint() {
    const stage = stages.find((candidate) => candidate.title === 'チュートリアル2: 太った placeOrder');
    if (stage === undefined) throw new Error('チュートリアル2のステージが必要です');
    const store = createGameStore([stage], false, false);
    store.getState().focusHint(target, 'hint-1');
    return store;
  }

  it('抽出に成功すると hintTarget / hintTargetKey が null になる', () => {
    // Arrange
    const store = storeWithHint();

    // Act
    store.getState().extractMethod(extraction);

    // Assert
    expect(store.getState().hintTarget).toBeNull();
    expect(store.getState().hintTargetKey).toBeNull();
  });

  it('メソッドの移動に成功すると null になる', () => {
    // Arrange
    const store = storeWithHint();
    store.getState().extractMethod(extraction);
    const method = allClasses(store.getState().codebase).flatMap((codeClass) => codeClass.methods).find((candidate) => candidate.name === 'calculateTax');
    if (method === undefined) throw new Error('抽出した calculateTax が必要です');
    store.getState().focusHint(target, 'hint-1');

    // Act
    store.getState().moveMethod(method.id, 'class-tax-calculator');

    // Assert
    expect(store.getState().hintTarget).toBeNull();
    expect(store.getState().hintTargetKey).toBeNull();
  });

  it('元に戻す・やり直しで null になる', () => {
    // Arrange
    const store = storeWithHint();
    store.getState().extractMethod(extraction);

    // Act
    store.getState().focusHint(target, 'hint-1');
    store.getState().undo();

    // Assert
    expect(store.getState().hintTarget).toBeNull();
    expect(store.getState().hintTargetKey).toBeNull();

    // Act
    store.getState().focusHint(target, 'hint-1');
    store.getState().redo();

    // Assert
    expect(store.getState().hintTarget).toBeNull();
    expect(store.getState().hintTargetKey).toBeNull();
  });

  it('失敗する抽出では hintTarget が残る', () => {
    // Arrange
    const store = storeWithHint();

    // Act
    const succeeded = store.getState().extractMethod({ ...extraction, newMethodName: 'placeOrder' });

    // Assert
    expect(succeeded).toBe(false);
    expect(store.getState().hintTarget).toBe(target);
    expect(store.getState().hintTargetKey).toBe('hint-1');
  });

  it('ヒントを入れていないとき、操作しても hintTarget は null のまま', () => {
    // Arrange
    const store = storeWithHint();
    store.getState().focusHint(null);

    // Act
    store.getState().extractMethod(extraction);

    // Assert
    expect(store.getState().hintTarget).toBeNull();
    expect(store.getState().hintTargetKey).toBeNull();
  });

  it('「どこが問題?」の光り(focusedRule)も、抽出に成功すると消える', () => {
    // Arrange
    const store = storeWithHint();
    store.getState().focusRule('line-limit');

    // Act
    store.getState().extractMethod(extraction);

    // Assert
    expect(store.getState().focusedRule).toBeNull();
  });

  it('focusedRule は失敗する抽出では残り、元に戻す・やり直しでは消える', () => {
    // Arrange
    const store = storeWithHint();
    store.getState().extractMethod(extraction);
    store.getState().focusRule('line-limit');

    // Act
    store.getState().extractMethod({ ...extraction, newMethodName: 'placeOrder' });

    // Assert
    expect(store.getState().focusedRule).toBe('line-limit');

    // Act
    store.getState().undo();

    // Assert
    expect(store.getState().focusedRule).toBeNull();

    // Act
    store.getState().focusRule('line-limit');
    store.getState().redo();

    // Assert
    expect(store.getState().focusedRule).toBeNull();
  });
});

describe('recordMilestone', () => {
  const stage = stages[0];

  beforeEach(() => {
    localStorage.clear();
  });

  function placeLikeSample(store: ReturnType<typeof createGameStore>): void {
    const session = store.getState().changeSession;
    const request = session === null ? undefined : stage.changeRequests[session.index];
    if (session === null || request === undefined) throw new Error('変更依頼の最中が必要です');
    const sample = sampleImplementation(session.sampleCarried, request);
    if (sample === undefined) throw new Error('解答例が必要です');
    store.setState({ codebase: sample.codebase });
    store.getState().finishImplementation();
  }

  it('同じ段階を2回記録しても参照が変わらない', () => {
    // Arrange
    const store = createGameStore([stage], false, false);
    store.getState().recordMilestone(stage.id, 'concept-check');
    const before = store.getState().milestones;

    // Act
    store.getState().recordMilestone(stage.id, 'concept-check');

    // Assert
    expect(before[stage.id]).toEqual(['concept-check']);
    expect(store.getState().milestones).toBe(before);
  });

  it('変更依頼を全件解答例どおりに置いて最後まで確定すると記録される', () => {
    // Arrange
    const store = createGameStore([stage], false, false);
    store.setState({ codebase: sampleAnswerCodebase(stage) });
    store.getState().startChangeRequests();

    // Act
    for (let i = 0; i < stage.changeRequests.length; i += 1) {
      placeLikeSample(store);
      store.getState().advanceChangeRequest();
    }

    // Assert
    expect(store.getState().milestones[stage.id]).toContain('change-request');
  });

  it('途中で endChangeRequests すると記録されない', () => {
    // Arrange
    const store = createGameStore([stage], false, false);
    store.setState({ codebase: sampleAnswerCodebase(stage) });
    store.getState().startChangeRequests();
    placeLikeSample(store);
    store.getState().advanceChangeRequest();

    // Act
    store.getState().endChangeRequests();

    // Assert
    expect(store.getState().milestones[stage.id]).toBeUndefined();
  });
});

describe('operation result (増えた・消えた減点)', () => {
  const tutorial = stages.find((candidate) => candidate.id === 'tutorial-extract-method');
  if (tutorial === undefined) throw new Error('tutorial-extract-method が見つからない');
  const source = 'method-print-monthly-report';
  const tableAndPrint = { sourceMethodId: source, fragmentIds: ['frag-table-header', 'frag-table-rows', 'frag-print'], newMethodName: 'renderReport' };
  const renderReportId = (store: ReturnType<typeof createGameStore>) => allClasses(store.getState().codebase).flatMap((codeClass) => codeClass.methods).find((method) => method.name === 'renderReport')?.id ?? '';
  const newStore = () => createGameStore([tutorial, stages[1]], false, false);

  it('3回目の抽出で初めてクラスの上限を超え、次の段階を表示し、Undoで消す', () => {
    // Arrange
    const store = newStore();
    const extracts = [
      { fragmentIds: ['frag-print'], newMethodName: 'printSalesReport' },
      { fragmentIds: ['frag-aggregate-sales'], newMethodName: 'aggregateSales' },
      { fragmentIds: ['frag-compare-last-month'], newMethodName: 'compareLastMonth' },
    ];
    // Act & Assert
    for (const [index, input] of extracts.entries()) {
      expect(store.getState().extractMethod({ sourceMethodId: source, ...input })).toBe(true);
      if (index < 2) expect(store.getState().operationResult?.nextStep).toBeUndefined();
    }
    expect(store.getState().operationResult?.lines).toContain('「行数」の減点が1件増えました(-10)');
    expect(store.getState().operationResult?.nextStep).toBe('クラスが 54行 → 60行 になり、上限(54行)を超えます。分けたメソッドは、次の段階で受け皿のクラスへ移しましょう');
    store.getState().undo();
    expect(store.getState().operationResult).toBeNull();
  });

  it('抽出に失敗したときは次の段階を追加しない', () => {
    // Arrange
    const store = newStore();
    // Act
    const succeeded = store.getState().extractMethod({ sourceMethodId: 'no-such-method', fragmentIds: ['frag-print'], newMethodName: 'printSalesReport' });
    // Assert
    expect(succeeded).toBe(false);
    expect(store.getState().operationResult?.nextStep).toBeUndefined();
  });

  it('操作の結果が null のときは次の段階を追加しない', () => {
    // Arrange
    const store = newStore();
    const codebase = store.getState().codebase;
    store.setState({ changeSession: { index: 0, inspected: null, reviewing: null, outcomes: [], base: codebase, carried: codebase, sampleCarried: codebase, baseHistory: store.getState().history } });
    for (const input of [
      { fragmentIds: ['frag-print'], newMethodName: 'printSalesReport' },
      { fragmentIds: ['frag-aggregate-sales'], newMethodName: 'aggregateSales' },
      { fragmentIds: ['frag-compare-last-month'], newMethodName: 'compareLastMonth' },
    ]) {
      // Act & Assert
      expect(store.getState().extractMethod({ sourceMethodId: source, ...input })).toBe(true);
      expect(store.getState().operationResult).toBeNull();
    }
  });

  it('表の組み立てと出力を1つにまとめると、責務の混ざったメソッドの増加が出る', () => {
    // Arrange
    const store = newStore();
    // Act
    store.getState().extractMethod(tableAndPrint);
    // Assert
    expect(store.getState().operationResult?.lines).toContain('「責務の混ざったメソッド」の減点が1件増えました(-10)');
  });

  it('集計だけを抽出すると better で、「増えました」の行がない', () => {
    // Arrange
    const store = newStore();
    // Act
    store.getState().extractMethod({ sourceMethodId: source, fragmentIds: ['frag-aggregate-sales', 'frag-compare-last-month'], newMethodName: 'aggregate' });
    // Assert
    const result = store.getState().operationResult;
    expect(result?.tone).toBe('better');
    expect(result?.lines.some((line) => line.includes('増えました'))).toBe(false);
  });

  it('減点が変わらない操作の後は null になる', () => {
    // Arrange
    const store = newStore();
    store.getState().extractMethod(tableAndPrint);
    // Act
    store.getState().renameClass('class-report-service', 'Renamed');
    // Assert
    expect(store.getState().operationResult).toBeNull();
  });

  it('undo / redo の後は null', () => {
    // Arrange
    const store = newStore();
    store.getState().extractMethod(tableAndPrint);
    // Act & Assert
    store.getState().undo();
    expect(store.getState().operationResult).toBeNull();
    store.getState().redo();
    expect(store.getState().operationResult).toBeNull();
  });

  it('resetStage・selectStage の後は null', () => {
    // Arrange
    const store = newStore();
    store.getState().extractMethod(tableAndPrint);
    // Act
    store.getState().resetStage();
    // Assert
    expect(store.getState().operationResult).toBeNull();
    store.getState().extractMethod(tableAndPrint);
    store.getState().selectStage(stages[1].id);
    expect(store.getState().operationResult).toBeNull();
  });

  it('失敗した操作・selectMethod では前の結果が残り、dismissOperationResult で消える', () => {
    // Arrange
    const store = newStore();
    store.getState().extractMethod(tableAndPrint);
    const result = store.getState().operationResult;
    // Act
    store.getState().extractMethod({ sourceMethodId: 'no-such-method', fragmentIds: ['x'], newMethodName: 'y' });
    // Assert
    expect(store.getState().message).not.toBeNull();
    expect(store.getState().operationResult).toBe(result);
    store.getState().selectMethod(source);
    expect(store.getState().operationResult).toBe(result);
    store.getState().dismissOperationResult();
    expect(store.getState().operationResult).toBeNull();
  });

  describe('自動で消える', () => {
    beforeEach(() => { vi.useFakeTimers(); });
    afterEach(() => { vi.useRealTimers(); });

    it('NOTICE_VISIBLE_MS 後に null になり、置き換わると数え直す', () => {
      // Arrange
      const store = newStore();
      store.getState().extractMethod(tableAndPrint);
      vi.advanceTimersByTime(NOTICE_VISIBLE_MS - 1000);
      // Act
      store.getState().inlineMethod(renderReportId(store));
      vi.advanceTimersByTime(NOTICE_VISIBLE_MS - 1000);
      // Assert
      expect(store.getState().operationResult).not.toBeNull();
      vi.advanceTimersByTime(1000);
      expect(store.getState().operationResult).toBeNull();
    });
  });
});

describe('move count', () => {
  const tutorial1 = () => {
    const stage = stages.find((candidate) => candidate.id === 'tutorial-extract-method');
    if (stage === undefined) throw new Error('チュートリアル1が必要です');
    return stage;
  };

  it('抽出1回で1手、最初に戻すと0手、undoで1手に戻る', () => {
    // Arrange
    const stage = tutorial1();
    const store = createGameStore([stage], false, false);
    const moves = () => movesSince(store.getState().history, store.getState().codebase, stage.codebase);

    // Act
    store.getState().extractMethod({ sourceMethodId: 'method-print-monthly-report', fragmentIds: ['frag-aggregate-sales', 'frag-compare-last-month'], newMethodName: 'aggregateSales' });

    // Assert
    expect(moves()).toBe(1);

    // Act
    store.getState().resetStage();

    // Assert
    expect(moves()).toBe(0);

    // Act
    store.getState().undo();

    // Assert
    expect(moves()).toBe(1);
  });

  it('自己ベストは少ないほうを残し、localStorageにも保存する', () => {
    // Arrange
    localStorage.removeItem('refactor-blocks:move-bests');
    const store = createGameStore([tutorial1()], false, false);

    // Act
    store.getState().recordMoveBest('x', 3);
    store.getState().recordMoveBest('x', 5);

    // Assert
    expect(store.getState().moveBests.x).toBe(3);
    expect(localStorage.getItem('refactor-blocks:move-bests')).toBe('{"x":3}');
  });

  it('振り返りメモを保存し、空白だけなら消す', () => {
    // Arrange
    localStorage.removeItem('refactor-blocks:reflection-notes');
    const store = createGameStore([tutorial1()], false, false);

    // Act
    store.getState().saveReflectionNote('x', ' メモ ');

    // Assert
    expect(store.getState().reflectionNotes.x).toBe('メモ');
    expect(localStorage.getItem('refactor-blocks:reflection-notes')).toBe('{"x":"メモ"}');

    // Act・Assert
    store.getState().saveReflectionNote('x', '  ');
    expect(store.getState().reflectionNotes.x).toBeUndefined();
    expect(localStorage.getItem('refactor-blocks:reflection-notes')).toBe('{}');
  });
});

describe('operationLabels (操作の記録の操作名)', () => {
  const tutorial = stages.find((candidate) => candidate.id === 'tutorial-extract-method');
  if (tutorial === undefined) throw new Error('tutorial-extract-method が見つからない');
  const aggregate = { sourceMethodId: 'method-print-monthly-report', fragmentIds: ['frag-aggregate-sales', 'frag-compare-last-month'], newMethodName: 'aggregate' };
  const newStore = () => createGameStore([tutorial, stages[1]], false, false);

  it('抽出すると、そのあとのコードベースに「メソッドの抽出」が記録される', () => {
    // Arrange
    const store = newStore();
    // Act
    store.getState().extractMethod(aggregate);
    // Assert
    expect(store.getState().operationLabels.get(store.getState().codebase)).toBe('メソッドの抽出');
  });

  it('抽出 → クラス名の変更のあと、操作の記録は操作名がその順に並ぶ', () => {
    // Arrange
    const store = newStore();
    store.getState().extractMethod(aggregate);
    // Act
    store.getState().renameClass('class-report-service', 'Renamed');
    // Assert
    const { history, codebase, operationLabels, stage } = store.getState();
    const entries = operationTimeline(history, codebase, (c) => scoreCodebase(c, stage), (c) => operationLabels.get(c));
    expect(entries.map(({ label }) => label)).toEqual(['メソッドの抽出', 'クラス名の変更']);
  });

  it('undo / redo では operationLabels を変えず、undo 後の今のコードの操作名も保たれる', () => {
    // Arrange
    const store = newStore();
    store.getState().extractMethod(aggregate);
    store.getState().renameClass('class-report-service', 'Renamed');
    const labels = store.getState().operationLabels;
    // Act
    store.getState().undo();
    // Assert
    expect(store.getState().operationLabels).toBe(labels);
    expect(store.getState().operationLabels.get(store.getState().codebase)).toBe('メソッドの抽出');
    store.getState().redo();
    expect(store.getState().operationLabels).toBe(labels);
  });

  it('最初に戻すと、今のコードの操作名が「最初に戻す」になる', () => {
    // Arrange
    const store = newStore();
    store.getState().extractMethod(aggregate);
    // Act
    store.getState().resetStage();
    // Assert
    expect(store.getState().operationLabels.get(store.getState().codebase)).toBe('最初に戻す');
  });

  it('失敗した操作では operationLabels が変わらない', () => {
    // Arrange
    const store = newStore();
    const labels = store.getState().operationLabels;
    // Act
    const succeeded = store.getState().extractMethod({ ...aggregate, sourceMethodId: 'no-such-method' });
    // Assert
    expect(succeeded).toBe(false);
    expect(store.getState().operationLabels).toBe(labels);
  });

  it('ステージを切り替えると空になる', () => {
    // Arrange
    const store = newStore();
    store.getState().extractMethod(aggregate);
    // Act
    store.getState().selectStage(stages[1].id);
    // Assert
    expect(store.getState().operationLabels.size).toBe(0);
  });

  it('変更依頼を始めて終えたあとも、挑戦前の手の操作名が残る', () => {
    // Arrange
    const store = newStore();
    store.getState().extractMethod(aggregate);
    const before = store.getState().codebase;
    // Act
    store.getState().startChangeRequests();
    store.getState().endChangeRequests();
    // Assert
    expect(store.getState().codebase).toBe(before);
    expect(store.getState().operationLabels.get(before)).toBe('メソッドの抽出');
  });
});
