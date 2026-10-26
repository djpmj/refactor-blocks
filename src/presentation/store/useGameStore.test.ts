import { afterEach, describe, expect, it, vi } from 'vitest';
import { changePart, withChangePart } from '../../domain/change/changePart';
import { withoutTray } from '../../domain/blank/tray';
import { allClasses, findMethod } from '../../domain/codebase/Codebase';
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

const ghost = { kind: 'method' as const, methodId: 'method-example', toClassId: 'class-example' };

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
