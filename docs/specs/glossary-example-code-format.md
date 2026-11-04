# glossary-example-code-format: 用語ツールチップの例文にバッククォートがそのまま出る

小さな不具合修正。`_template-bugfix.md` の型で書く。

## 症状

クリア条件・減点の内訳・ステージ一覧のタグに出る用語(点線の下線)にマウスを重ねる/フォーカスすると出るポップオーバーで、
例文の Markdown のバッククォートが文字のまま出る。

- 再現: 「中級3: 越境する private メソッド」を選び、サイドバーを開いてクリア条件の「結合度」にマウスを重ねる
- 見えるもの: 「例: `` `OrderService` が5つのクラスを呼んでいれば、依存先は5クラス。``」(バッククォート付き)
- 同様に「例: `` `Manager.save()` が `Repository.save()` を呼ぶだけ。``」など

## 原因

- `src/infrastructure/glossary/glossaryTerms.ts` の用語データは、コード片を `` `...` `` で書いている。
  `example` 26件中20件と、`definition` 1件(`interface` の「`` `implements` ``」)が該当する
- 描画は `src/presentation/glossary/GlossaryText.tsx` の `GlossaryTermButton` 1か所だけで、
  `{term.definition}` / `{term.example}` を文字列のまま出している(48〜49行目)
- `grep` で確認した範囲では、`term.definition` / `term.example` を描く箇所は他に無い
  (`ClearConditionList.tsx` / `StageRoadmapDialog.tsx` は `GlossaryText`、`ScoreBreakdown.tsx` は `GlossaryTermsRow` 経由で、すべて同じ `GlossaryTermButton` を通る)。
  直す場所は1か所で足りる

データ側からバッククォートを消す案は取らない。コード片であることが見た目で分からなくなるため。

## 修正

### 1. 純粋関数(presentation 層・新規)

`src/presentation/glossary/splitInlineCode.ts`

```ts
export type InlineSegment =
  | { readonly kind: 'text'; readonly text: string }
  | { readonly kind: 'code'; readonly text: string };

/** バッククォートで囲まれた部分を code、それ以外を text に分ける。対にならないバッククォートは文字のまま text に残す。 */
export function splitInlineCode(text: string): readonly InlineSegment[];
```

- 実装は正規表現 `` /`([^`]+)`/g `` を1本走らせ、一致の前後を text、中身を code にする程度で足りる
- 空の text 断片は出さない(先頭・末尾・code が連続する場合)
- `` `` ``(中身が空)は対として扱わず、文字のまま text に残す(正規表現の `+` でそうなる)
- Markdown の他の記法(`**`・リンク・エスケープ `` \` ``)は扱わない。用語データに無いため(YAGNI)
- 置き場所: 表示用の整形なので domain ではなく `presentation/glossary/`(`presentation/**/describe*.ts` と同じ扱い)

### 2. 描画(`src/presentation/glossary/GlossaryText.tsx`・変更)

- 同ファイル内に小さなコンポーネント `InlineCodeText({ text })` を置き、`splitInlineCode(text)` の各断片を
  text はそのまま、code は `<code>` で描く。key は既存の `Segment` と同じく `` `${String(index)}-${segment.text}` ``
- `GlossaryTermButton` のポップオーバーで `term.definition` と `term.example` の両方をこれで包む。
  `<strong>{term.name}</strong>` は変えない(名前にバッククォートは無い)

### 3. 見た目(`src/index.css`・変更)

- `.glossary-term__popover code { font-family: ui-monospace, SFMono-Regular, Consolas, monospace; font-size: inherit; }` を1行足す。
  背景色や枠は付けない(最大幅 240px のポップオーバーで折り返しを崩さないため)

新しい依存(Markdown ライブラリ)は足さない。React の要素として組み立てるので `dangerouslySetInnerHTML` も使わない。

## テスト

先に書いて Red を確認してから実装する。

### Vitest: `src/presentation/glossary/splitInlineCode.test.ts`(新規・ケース表 `it.each`)

| 入力 | 期待 |
| --- | --- |
| `''` | `[]` |
| `'注文の計算'`(バッククォート無し) | `[text '注文の計算']` |
| `` '`A` → `B` → `A`。' `` | `[code 'A', text ' → ', code 'B', text ' → ', code 'A', text '。']` |
| `` '`Manager.save()` が `Repository.save()` を呼ぶだけ。' `` | `[code 'Manager.save()', text ' が ', code 'Repository.save()', text ' を呼ぶだけ。']` |
| `` '処理を移したあとに残った `Helper` クラス。' ``(途中に1つ) | `[text '処理を移したあとに残った ', code 'Helper', text ' クラス。']` |
| `` '`CreditPayment extends Payment`。' ``(先頭・空白入り) | `[code 'CreditPayment extends Payment', text '。']` |
| `` '`a``b`' ``(code が連続) | `[code 'a', code 'b']`(間に空の text を挟まない) |
| `` '片側だけ `A の例' ``(対にならない) | `[text '片側だけ `A の例']` |
| `` '空の `` は文字のまま' `` | `[text '空の `` は文字のまま']` |

### Vitest: `src/infrastructure/glossary/glossaryTerms.test.ts`(既存に1件追加)

- 全用語の `definition` と `example` を `splitInlineCode` に通すと、text 断片にバッククォートが残らない
  (= データ側に閉じ忘れが無い)。いま閉じ忘れは無いので、追加時点で Green でよい(データの回帰防止)

### E2E: `e2e/glossary.spec.ts`(既存に1件追加)

- 「中級3: 越境する private メソッド」でサイドバーを開き、クリア条件の `glossary-term-coupling` にマウスを重ねる
- `glossary-popover-coupling` が見え、`not.toContainText('`')` であること
- ポップオーバー内の `code` 要素が `OrderService` というテキストを持つこと

## 受け入れ基準

1. 症状の再現手順で、例文が「例: OrderService が5つのクラスを呼んでいれば、依存先は5クラス。」と出て、`OrderService` が等幅で表示され、バッククォートが見えない
2. 「インターフェース」の定義文の `implements` も同様に等幅で出て、バッククォートが見えない
3. 上記の Vitest(ケース表・データ検査)と E2E が追加され、通る
4. 新しい npm 依存が増えていない(`package.json` 不変)
5. `npm run check` と `npm run test:e2e` が通る

## スコープ外

- 用語データ(`glossaryTerms.ts`)の文言の書き換え
- バッククォート以外の Markdown 記法(太字・リンク・エスケープ)への対応
- ポップオーバー以外の文字列(クリア条件本文・講評・変更依頼など)への `splitInlineCode` の適用。
  今回 grep した範囲でバッククォートが表示されているのはポップオーバーだけ。他で見つかったら別 Issue にする
- `<code>` の背景色・色分け・コピー用ボタン
