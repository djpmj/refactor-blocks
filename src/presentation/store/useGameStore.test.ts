import { describe, expect, it } from 'vitest';
import { changePart, withChangePart } from '../../domain/change/changePart';
import { allClasses } from '../../domain/codebase/Codebase';
import { moveMethod } from '../../domain/codebase/moveMethod';
import { sampleImplementation } from '../../domain/change/sampleImplementation';
import { stages } from '../../infrastructure/stages/stageCatalog';
import { createGameStore } from './useGameStore';
import { scoreCodebase } from '../../domain/scoring/score';

const ghost = { kind: 'method' as const, methodId: 'method-example', toClassId: 'class-example' };

describe('delete inline notice', () => {
  const stage = stages.find((candidate) => candidate.title === '中級12: 横流しするだけの OrderManager');

  it('ファイル削除で呼び出し元へ戻した処理を案内し、dismissとundoで消す', () => {
    // Arrange
    if (stage === undefined) throw new Error('中級12のステージが必要です');
    const store = createGameStore([stage], false);

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
    const store = createGameStore([stage], false);
    store.setState({ notice: '以前のお知らせ' });

    // Act
    expect(store.getState().deleteClass('class-order-controller')).toBe(false);

    // Assert
    expect(store.getState().message).toBe('処理が残っているクラスは削除できません。先にメソッドを別のクラスへ移してください');
    expect(store.getState().notice).toBeNull();
  });

  it('変更依頼の実装に失敗したときも、noticeではなくエラーだけを残す', () => {
    // Arrange
    const store = createGameStore(stages, false);
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
    const store = createGameStore(stages, false);
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
    const store = createGameStore([stage], false);
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
    const store = createGameStore(stages, false);
    store.getState().startChangeRequests();
    store.setState({ ghost });
    // Act
    store.getState().endChangeRequests();
    // Assert
    expect(store.getState().ghost).toBeNull();
  });
});

describe('extract draft lifecycle', () => {
  const draft = { sourceMethodId: 'method-print-monthly-report', fragmentIds: ['frag-aggregate-sales'], newMethodName: 'aggregateSales' };

  it('clears the draft when a different method is selected', () => {
    // Arrange
    const store = createGameStore(stages, false);
    store.getState().setExtractDraft(draft);

    // Act
    store.getState().selectMethod('method-place-order');

    // Assert
    expect(store.getState().extractDraft).toBeNull();
  });

  it('clears the draft on undo, stage change, and reset', () => {
    // Arrange
    const store = createGameStore(stages, false);
    store.getState().selectStage(stages[1].id);
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
});
