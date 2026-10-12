import { describe, expect, it } from 'vitest';
import type { Fragment } from './Codebase';
import { suggestMethodName } from './suggestMethodName';
import { NO_METHOD_NAMING } from './suggestMethodName';

function named(suggestedName?: string): Fragment {
  return { id: suggestedName ?? 'unnamed', label: 'label', lines: 1, responsibility: 'misc', suggestedName };
}

describe('suggestMethodName', () => {
  it('処理を1つ選んだときは、その処理のメソッド名候補をそのまま使う', () => {
    // Arrange
    const fragments = [named('calculateTax')];

    // Act
    const name = suggestMethodName(fragments, []);

    // Assert
    expect(name).toBe('calculateTax');
  });

  it('動詞が同じ処理を複数選んだときは、動詞を1つにまとめて目的語をAndでつなぐ', () => {
    // Arrange
    const fragments = [named('validateItems'), named('validateStock')];

    // Act
    const name = suggestMethodName(fragments, []);

    // Assert
    expect(name).toBe('validateItemsAndStock');
  });

  it('動詞が違う処理を複数選んだときは、メソッド名候補をAndでつなぐ', () => {
    // Arrange
    const fragments = [named('saveOrder'), named('sendConfirmationMail')];

    // Act
    const name = suggestMethodName(fragments, []);

    // Assert
    expect(name).toBe('saveOrderAndSendConfirmationMail');
  });

  it('メソッド名候補を持たない処理は無視し、どれも持たなければ汎用の名前にする', () => {
    // Arrange
    const withCandidate = [named(), named('calculateTax')];
    const withoutCandidate = [named()];

    // Act
    const nameWithCandidate = suggestMethodName(withCandidate, []);
    const nameWithoutCandidate = suggestMethodName(withoutCandidate, []);

    // Assert
    expect(nameWithCandidate).toBe('calculateTax');
    expect(nameWithoutCandidate).toBe('extractedMethod');
  });

  it('同じクラスに同名のメソッドがあるときは、番号を付けて重複を避ける', () => {
    // Arrange
    const fragments = [named('calculateTax')];

    // Act
    const name = suggestMethodName(fragments, ['calculateTax', 'calculateTax2']);

    // Assert
    expect(name).toBe('calculateTax3');
  });

  it('何も選んでいないときは空文字を返す', () => {
    // Arrange & Act
    const name = suggestMethodName([], []);

    // Assert
    expect(name).toBe('');
  });

  it('模範解答と処理IDの集合が一致すれば、順序に関係なくその名前を使う', () => {
    // Arrange
    const fragments = [named('buildHeader'), { ...named('buildRows'), id: 'rows' }, { ...named('print'), id: 'print' }];
    const naming = { groups: [{ fragmentIds: ['print', 'rows', 'buildHeader'], name: 'printReport' }], byResponsibility: {} };

    // Act
    const name = suggestMethodName(fragments, [], naming);

    // Assert
    expect(name).toBe('printReport');
  });

  it('選択が1処理なら模範解答や責務表よりsuggestedNameを優先する', () => {
    // Arrange
    const fragment = named('print');
    const naming = { groups: [{ fragmentIds: [fragment.id], name: 'otherName' }], byResponsibility: { misc: 'responsibilityName' } };

    // Act
    const name = suggestMethodName([fragment], [], naming);

    // Assert
    expect(name).toBe('print');
  });

  it('模範解答のID集合に一部しか一致しなければ責務表を使う', () => {
    // Arrange
    const fragments = [
      { ...named('validateItems'), id: 'items', responsibility: 'validation', lines: 2 },
      { ...named('saveOrder'), id: 'save', responsibility: 'persistence', lines: 3 },
    ];
    const naming = {
      groups: [{ fragmentIds: ['items', 'stock'], name: 'validateOrder' }],
      byResponsibility: { validation: 'validateOrder', persistence: 'saveOrder' },
    };

    // Act
    const name = suggestMethodName(fragments, [], naming);

    // Assert
    expect(name).toBe('saveOrder');
  });

  it('一致する模範解答がなくても、行数が最大の責務名を使う', () => {
    // Arrange
    const fragments = [
      { ...named('buildHeader'), id: 'header', responsibility: 'formatting', lines: 2 },
      { ...named('buildRows'), id: 'rows', responsibility: 'formatting', lines: 3 },
      { ...named('print'), id: 'print', responsibility: 'output', lines: 9 },
    ];
    const naming = { ...NO_METHOD_NAMING, byResponsibility: { formatting: 'buildTable', output: 'printReport' } };

    // Act
    const name = suggestMethodName(fragments, [], naming);

    // Assert
    expect(name).toBe('printReport');
  });

  it('責務の行数が同じなら、先に選んだ責務名を使う', () => {
    // Arrange
    const fragments = [
      { ...named('buildHeader'), responsibility: 'formatting', lines: 3 },
      { ...named('print'), responsibility: 'output', lines: 3 },
    ];
    const naming = { ...NO_METHOD_NAMING, byResponsibility: { formatting: 'buildTable', output: 'printReport' } };

    // Act
    const name = suggestMethodName(fragments, [], naming);

    // Assert
    expect(name).toBe('buildTable');
  });

  it('call責務を集計せず、既存名と重なれば連番を付ける', () => {
    // Arrange
    const fragments = [
      { ...named('callOne'), responsibility: 'call', lines: 50 },
      { ...named('buildHeader'), responsibility: 'formatting', lines: 2 },
    ];
    const naming = { ...NO_METHOD_NAMING, byResponsibility: { formatting: 'buildTable' } };

    // Act
    const name = suggestMethodName(fragments, ['buildTable', 'buildTable2'], naming);

    // Assert
    expect(name).toBe('buildTable3');
  });
});
