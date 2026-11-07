import { describe, expect, it } from 'vitest';
import { splitInlineCode } from './splitInlineCode';

describe('splitInlineCode', () => {
  it.each([
    ['', []],
    ['注文の計算', [{ kind: 'text', text: '注文の計算' }]],
    ['`A` → `B` → `A`。', [
      { kind: 'code', text: 'A' }, { kind: 'text', text: ' → ' },
      { kind: 'code', text: 'B' }, { kind: 'text', text: ' → ' },
      { kind: 'code', text: 'A' }, { kind: 'text', text: '。' },
    ]],
    ['`Manager.save()` が `Repository.save()` を呼ぶだけ。', [
      { kind: 'code', text: 'Manager.save()' }, { kind: 'text', text: ' が ' },
      { kind: 'code', text: 'Repository.save()' }, { kind: 'text', text: ' を呼ぶだけ。' },
    ]],
    ['処理を移したあとに残った `Helper` クラス。', [
      { kind: 'text', text: '処理を移したあとに残った ' },
      { kind: 'code', text: 'Helper' }, { kind: 'text', text: ' クラス。' },
    ]],
    ['`CreditPayment extends Payment`。', [
      { kind: 'code', text: 'CreditPayment extends Payment' }, { kind: 'text', text: '。' },
    ]],
    ['`a``b`', [{ kind: 'code', text: 'a' }, { kind: 'code', text: 'b' }]],
    ['片側だけ `A の例', [{ kind: 'text', text: '片側だけ `A の例' }]],
    ['空の `` は文字のまま', [{ kind: 'text', text: '空の `` は文字のまま' }]],
  ])('%s', (input, expected) => {
    // Arrange: ケース表の入力と期待値
    // Act
    const actual = splitInlineCode(input);
    // Assert
    expect(actual).toEqual(expected);
  });
});
