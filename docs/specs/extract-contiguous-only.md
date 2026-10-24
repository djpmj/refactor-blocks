# extract-contiguous-only: 離れた処理は1つのメソッドに抽出できない

## 背景・目的

メソッドエディタでは、処理(Fragment)のチェックボックスを自由に選んで「メソッドとして抽出」できる。実機で初級1の `registerUser()` の
「入力値を検証する」(1番目)と「レスポンスを組み立てる」(4番目)だけを選ぶと、間にある「DBに保存する」「メールを送る」を飛び越えて、
`handleRequest` という1つのメソッドとして抽出できてしまう(プレビューも出る)。

実際のリファクタリング(Extract Method)では、離れた処理を1つにまとめると**実行順が変わる**ので、そのままでは安全に抽出できない。
学習ゲームが「できてしまう」と、現実では危ない操作を覚えさせてしまう。そこで、**元のメソッドの中で連続した処理だけ**を抽出できるようにする。

## 変更対象ファイル一覧

| 種別 | パス | 層 | 役割 |
| --- | --- | --- | --- |
| 変更 | `src/domain/codebase/extractMethod.ts` | domain | 選んだ処理が連続していなければ `err('non-contiguous-fragments')` を返す |
| 変更 | `src/domain/codebase/extractMethod.test.ts` | domain | 上のテスト |
| 変更 | `src/application/RefactorUseCases.ts` | application | 新しいエラーの日本語メッセージ。抽出プレビューも同じ検証を通す |
| 変更 | `src/presentation/editor/MethodEditor.tsx` | presentation | 連続していない選び方のとき、ボタンを押せなくして理由を出す(`extractDisabledReason`) |
| 変更 | ステージの定義・解答例(`src/infrastructure/stages/*.ts`、`src/domain/stage/sampleAnswer.ts`) | infrastructure / domain | 離れた処理の抽出に頼っているものがあれば、処理の並びか解答例の選び方を直す(下の「受け入れ基準」3) |
| 新規/変更 | `e2e/extract-contiguous-only.spec.ts` | E2E | 受け入れ基準を確かめる |

## データ・型の変更

```ts
// src/domain/codebase/extractMethod.ts
export type ExtractMethodError =
  | 'method-not-found'
  | 'no-fragments-selected'
  | 'fragment-not-in-method'
  | 'cannot-extract-all-fragments'
  | 'empty-method-name'
  | 'duplicate-method-name'
  | 'non-contiguous-fragments'; // 追加
```

- 「連続」は、抽出元メソッドの `fragments` の並びで、選んだ処理のインデックスが途切れずに並んでいること(選んだ順ではなく、並びの順で判定する)
- 検証の順序: 既存の検証(メソッドの存在・選択が空・メソッド内にある・全部は抽出できない)のあとで連続を調べ、そのあとで名前の検証をする

## 動きの仕様

- メソッドエディタで、選んだ処理が連続していないとき:
  - 「メソッドとして抽出」ボタンは押せない
  - ボタンの下の説明文(今の `処理を1つ以上選ぶと押せます` のところ)に、`間の処理も選ぶか、選ぶ処理を連続させてください(離れた処理をまとめると実行順が変わります)` と出す
  - プレビュー(`抽出すると: …`)は出さない
- 連続して選んだときは、今までどおり抽出できる
- 1つだけ選ぶ・全体の途中の連続する複数を選ぶ・先頭や末尾の連続は、すべて抽出できる
- 抽出後に元のメソッドへ入る呼び出し行(`xxx() を呼び出す`)は、元の連続した範囲の位置に入る(今の `replaceWithCall` の動きのまま)

## TDD対象

### `extractMethod`(domain)

- fragments `[a, b, c, d]` から `[b, c]` → 成功
- `[a, d]`(間に b, c) → `err('non-contiguous-fragments')`
- `[a, b]`・`[c, d]`(先頭・末尾の連続) → 成功
- 選ぶ順が逆 `['c', 'b']` でも、並びで連続していれば成功
- `[a, c]` のあと `[]` など、既存のエラーが先に返る(選択なし・全部抽出)ことが変わらない

### application

- 抽出プレビューも、連続していない選び方では失敗を返す(プレビューを出さない)
- 新しいエラーのメッセージが日本語で返る

## 受け入れ基準

1. 初級1の `registerUser()` で「入力値を検証する」と「レスポンスを組み立てる」だけを選ぶと、「メソッドとして抽出」が押せず、理由が出る。間の処理も選ぶと押せる
2. 連続した処理の抽出は、今までどおり成功する(チュートリアル1・2、初級1の解答例どおりの手順が通る)
3. 全ステージの解答例の再生(`sampleAnswer`)・ステージのテスト(`stageCatalog.test.ts` など)が通る。離れた処理の抽出に頼っていたステージがあれば、処理(Fragment)の並びを、同じ責務が隣り合うよう入れ替えて直す(責務の種類・行数・採点が変わらないこと)。直したステージを PR の説明に書く
4. `npm run check` と `npm run test:e2e` が通る

## スコープ外

- 離れた処理を、順序を保ったまま自動で並べ替えてから抽出する機能
- 処理の並べ替え操作そのもの
- 抽出名の入力欄の検証(別の仕様 `extract-name-inline-error` で扱う)
