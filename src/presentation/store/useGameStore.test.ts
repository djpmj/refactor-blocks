import { describe, expect, it } from 'vitest';
import { changePart, withChangePart } from '../../domain/change/changePart';
import { withoutTray } from '../../domain/blank/tray';
import { allClasses } from '../../domain/codebase/Codebase';
import { moveMethod } from '../../domain/codebase/moveMethod';
import { checkManualFix } from '../../domain/change/checkManualFix';
import { painRequestsOf } from '../../domain/change/changePain';
import { sampleImplementation } from '../../domain/change/sampleImplementation';
import { stages } from '../../infrastructure/stages/stageCatalog';
import { createGameStore } from './useGameStore';
import { scoreCodebase } from '../../domain/scoring/score';
import { sampleAnswerCodebase } from '../../domain/stage/sampleAnswer';
import { putDraft } from '../../domain/progress/drafts';
import { blankDesignProblems } from '../../infrastructure/blankDesigns/blankDesignProblems';
import { saveDrafts } from '../../infrastructure/progress/draftStorage';

const ghost = { kind: 'method' as const, methodId: 'method-example', toClassId: 'class-example' };

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
      changeSession: { index, inspected: null, outcomes: [], base, carried: base, baseHistory: store.getState().history },
    });

    store.getState().finishImplementation();
    expect(store.getState().codebase).toEqual(withoutTray(placed.value));
    store.getState().endChangeRequests();
    expect(store.getState().codebase).toEqual(base);
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
    expect(store.getState().openingFixes[stage.id]).toEqual({ missed: 3, extra: 0, sites: 3 });
    expect(store.getState().extractMethod({ sourceMethodId: 'method-confirm-order', fragmentIds: ['frag-order-tax'], newMethodName: 'tax' })).toBe(true);
  });

  it('仕上げは正解でのみ解除し、resetは冒頭結果を残して仕上げを再設定する', () => {
    if (stage === undefined) throw new Error('tax stage is required');
    const store = createGameStore([stage], false);
    store.setState({ openingFixes: { [stage.id]: { missed: 2, extra: 0, sites: 3 } }, codebase: sampleAnswerCodebase(stage) });
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
    expect(store.getState().openingFixes[stage.id]).toEqual({ missed: 2, extra: 0, sites: 3 });
    expect(store.getState().closingFixSolved).toBe(false);
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

    store.setState({ openingFixes: { [stage.id]: { missed: 1, extra: 0, sites: 3 } } });
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
      const openingResult = { missed: 2, extra: 0, sites: 3 } as const;
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

  it('updates the viewed method after release without changing fixed marks', () => {
    // Arrange
    const store = createGameStore(stages, false);
    store.getState().startManualFix();
    store.getState().toggleFixed('method-a');
    store.getState().releaseManualFix();

    // Act
    store.getState().toggleFixed('method-b');

    // Assert
    expect(store.getState().manualFix?.fixedIds).toEqual(['method-a']);
    expect(store.getState().manualFix?.viewedMethodId).toBe('method-b');
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
