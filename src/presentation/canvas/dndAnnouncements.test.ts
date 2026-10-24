import { describe, expect, it } from 'vitest';
import type { Codebase } from '../../domain/codebase/Codebase';
import { sampleCodebase } from '../../domain/codebase/testFixtures';
import { createAnnouncements, describeDraggable, describeDroppable, SCREEN_READER_INSTRUCTIONS } from './dndAnnouncements';
import { classDragId, classDropId, fieldDragId, fileDropId, methodDragId } from './dndIds';

function codebaseWithField(): Codebase {
  const base = sampleCodebase();
  const [orderFile, taxFile] = base.files;
  const orderClass = { ...orderFile.classes[0], fields: [{ id: 'field-lines', name: 'lines', visibility: 'private' as const }] };
  return { files: [{ ...orderFile, classes: [orderClass] }, taxFile] };
}

function codebaseWithTwoClassFile(): Codebase {
  const base = sampleCodebase();
  const [orderFile, taxFile] = base.files;
  return { files: [{ ...orderFile, classes: [...orderFile.classes, { id: 'class-point', name: 'PointService', methods: [] }] }, taxFile] };
}

describe('describeDraggable', () => {
  it('メソッドは クラス名.メソッド名() で呼ぶ', () => {
    // Arrange
    const codebase = sampleCodebase();

    // Act
    const text = describeDraggable(codebase, methodDragId('method-place'));

    // Assert
    expect(text).toBe('OrderService.placeOrder()');
  });

  it('フィールドは クラス名.フィールド名 で呼ぶ', () => {
    // Arrange
    const codebase = codebaseWithField();

    // Act
    const text = describeDraggable(codebase, fieldDragId('field-lines'));

    // Assert
    expect(text).toBe('OrderService.lines');
  });

  it('クラスは「クラス 名前」で呼ぶ', () => {
    // Arrange
    const codebase = sampleCodebase();

    // Act
    const text = describeDraggable(codebase, classDragId('class-tax'));

    // Assert
    expect(text).toBe('クラス TaxCalculator');
  });

  it('存在しないIDは「項目」にしてIDを読み上げない', () => {
    // Arrange
    const codebase = sampleCodebase();

    // Act
    const text = describeDraggable(codebase, 'method:unknown-id');

    // Assert
    expect(text).toBe('項目');
  });
});

describe('describeDroppable', () => {
  it('クラスは「クラス 名前」で呼ぶ', () => {
    // Arrange
    const codebase = sampleCodebase();

    // Act
    const text = describeDroppable(codebase, classDropId('class-tax'));

    // Assert
    expect(text).toBe('クラス TaxCalculator');
  });

  it('ファイルは中のクラス名を「・」でつないで呼ぶ', () => {
    // Arrange
    const codebase = codebaseWithTwoClassFile();

    // Act
    const text = describeDroppable(codebase, fileDropId('file-order'));

    // Assert
    expect(text).toBe('OrderService・PointService のファイル');
  });

  it('存在しないIDは「移動先」にしてIDを読み上げない', () => {
    // Arrange
    const codebase = sampleCodebase();

    // Act
    const text = describeDroppable(codebase, 'class:e7b024e0');

    // Assert
    expect(text).toBe('移動先');
  });
});

describe('createAnnouncements', () => {
  const codebase = sampleCodebase();
  const announcements = createAnnouncements(codebase);
  const active = { id: methodDragId('method-place') };
  const over = { id: classDropId('class-tax') };

  it('操作説明は日本語', () => {
    // Arrange
    const instructions = SCREEN_READER_INSTRUCTIONS;

    // Act
    const text = instructions.draggable;

    // Assert
    expect(text).toBe('スペースキーで持ち上げ、矢印キーで動かします。もう一度スペースキーで置き、Esc で取り消します。');
  });

  it('持ち上げたとき', () => {
    // Act
    const text = announcements.onDragStart({ active });

    // Assert
    expect(text).toBe('OrderService.placeOrder() を持ち上げました。');
  });

  it('ドロップ先の上に動かしているとき', () => {
    // Act
    const text = announcements.onDragOver({ active, over });

    // Assert
    expect(text).toBe('OrderService.placeOrder() を クラス TaxCalculator の上に動かしています。');
  });

  it('ドロップ先が無いとき', () => {
    // Act
    const text = announcements.onDragOver({ active, over: null });

    // Assert
    expect(text).toBe('OrderService.placeOrder() はどこの上にもありません。');
  });

  it('ドロップ先に置いたとき', () => {
    // Act
    const text = announcements.onDragEnd({ active, over });

    // Assert
    expect(text).toBe('OrderService.placeOrder() を クラス TaxCalculator に置きました。');
  });

  it('余白に置いたとき', () => {
    // Act
    const text = announcements.onDragEnd({ active, over: null });

    // Assert
    expect(text).toBe('OrderService.placeOrder() を余白に置きました。新しいクラスを作ります。');
  });

  it('フィールドを余白に置いても何も起きないので元の場所に戻ったと伝える', () => {
    // Arrange
    const withField = createAnnouncements(codebaseWithField());

    // Act
    const text = withField.onDragEnd({ active: { id: fieldDragId('field-lines') }, over: null });

    // Assert
    expect(text).toBe('OrderService.lines は元の場所に戻りました。');
  });

  it('取り消したとき', () => {
    // Act
    const text = announcements.onDragCancel({ active, over: null });

    // Assert
    expect(text).toBe('OrderService.placeOrder() の移動を取り消しました。');
  });
});
