# post-perfect-flow: 100点のあとの「手で直す問題 → 変更依頼に挑戦」を順番どおりに進める

## 背景・目的

今は100点を取ると、次の3つが同時に使えるようになり、何から手を付ければよいか分からない。

- 左パネルのカード(見出しが「なぜ分けるのか」に変わる)
- 理解度チェック
- ツールバーの「変更依頼に挑戦」

「もし、この変更が来たら?」の手で直すシミュレーション(`ManualFixPanel`)は、100点になる前で、かつ直す場所が2か所以上あるときにしか出ない。
そのため、分けたあとのコードで「変更が1か所で済む」ことを、自分の手で確かめる機会がない。

さらに、変更依頼をすべて終えると結果画面に切り替わった瞬間にキャンバスが挑戦前のコードへ戻るため、
「置いたメソッドがどこかに消えた」ように見える(`finishImplementation` が `session.base` に戻している)。

そこで、100点のあとの流れを次の順番に固定する。

1. 100点を取る
2. **「もし、この変更が来たら?」**: 分けたあとのコードで、変更依頼(modify)を手で直す問題を解く(直す場所に印を付けてリリースする)
3. 2を正解したら、**「変更依頼に挑戦」**が押せるようになる

あわせて、変更依頼の結果画面では、最後に置いたコードをキャンバスに残す。

## 変更対象ファイル一覧

| 種別 | パス | 層 | 役割 |
| --- | --- | --- | --- |
| 新規 | `src/domain/change/postPerfectStep.ts` | domain | 100点のあとに今どの段階にいるかを返す純粋関数 |
| 新規 | `src/domain/change/postPerfectStep.test.ts` | domain | 上のテスト |
| 新規 | `src/domain/change/checkManualFix.test.ts` への追記(既存ファイルがあればそこへ) | domain | `isManualFixSolved` のテスト |
| 変更 | `src/domain/change/checkManualFix.ts` | domain | `isManualFixSolved(result)` を足す |
| 変更 | `src/presentation/store/useGameStore.ts` | presentation | 手で直す問題を正解したかどうか(`manualFixSolved`)を持つ。結果画面では置いたコードを残す |
| 変更 | `src/presentation/stage/ChangePainCard.tsx` | presentation | 100点のときは「もし、この変更が来たら?」の問題として出し、「実際に直してみる」を常に出す |
| 変更 | `src/presentation/stage/ManualFixPanel.tsx` | presentation | 正解したら「変更依頼に挑戦できるようになりました」と案内する |
| 変更 | `src/presentation/stage/StagePanel.tsx` | presentation | 「変更依頼に挑戦」を、手で直す問題を正解するまで無効にする |
| 変更 | `e2e/refactor.spec.ts` ほか、`change-request-start` を押している E2E | E2E | 先に手で直す問題を解くように直す。新しい流れの E2E を足す |

`application` / `infrastructure` は変更しない。

## データ・型の変更

### domain

```ts
// src/domain/change/checkManualFix.ts
/** 直し忘れも、関係ないメソッドへの印も無ければ正解。(印を全部に付ければ通る、を防ぐため extra も見る) */
export function isManualFixSolved(result: ManualFixResult): boolean;
// result.missed.length === 0 && result.extra.length === 0

// src/domain/change/postPerfectStep.ts
export type PostPerfectStep =
  | 'refactor'      // まだ100点でない
  | 'manual-fix'    // 100点。手で直す問題を解く段階
  | 'change-request'; // 変更依頼に挑戦できる段階

export function postPerfectStep(input: Readonly<{
  /** 今のコードの点数。 */
  score: number;
  /** ステージに modify の変更依頼があるか(painRequestsOf(stage).modify !== undefined)。 */
  hasModifyRequest: boolean;
  /** このステージで手で直す問題を正解したか。 */
  manualFixSolved: boolean;
}>): PostPerfectStep;
```

- `score < 100` → `'refactor'`
- `score >= 100` かつ modify の依頼が無い(extend だけのステージ) → `'change-request'`(手で直す問題は飛ばす)
- `score >= 100` かつ modify の依頼があり、まだ正解していない → `'manual-fix'`
- `score >= 100` かつ正解済み → `'change-request'`

### presentation(ストア)

- `GameState` に `manualFixSolved: boolean` を足す
  - `releaseManualFix` のとき、今の点数が100点で、`isManualFixSolved(checkManualFix(codebase, modify, fixedIds))` なら `true` にする。
    100点になる前のシミュレーションで正解しても `true` にしない(分けたあとのコードで確かめるのが目的のため)
  - ステージを切り替えたとき・「最初に戻す」のときは `false` に戻す
  - 一度 `true` になったら、そのステージにいる間はコードを変えても `false` に戻さない(変更依頼から戻ったあとや、点数が一度下がってまた100点になったときに、もう一度解かせない)
  - 保存(進捗・下書き)はしない。再読み込みしたらもう一度解く
- `finishImplementation` で最後の依頼を終えたとき、`codebase` を `session.base` ではなく `carried`(部品置き場を除いた、置いたあとのコード)にする。
  「リファクタリングに戻る」(`endChangeRequests`)で今までどおり `base` と `baseHistory` に戻す。
  結果画面でキャンバスを触っても、戻るときに捨てる(今の「やめる」と同じ)

## 見た目・動きの仕様

### 左パネルのカード(`ChangePainCard`)

- `postPerfectStep` が `'manual-fix'` のとき
  - 見出しは「もし、この変更が来たら?」(`cardHeading` の100点時の分岐を変える)。`details` は開いた状態
  - 本文の先頭に `stage.why` を出し、続けて「分けたあとのコードで、この変更を入れるにはどこを直せばよいでしょう? 直す場所に印を付けてリリースしてください」と出す
  - 今の `ModifyAfter`(○か所→○か所)は、答えになってしまうので正解するまで出さない
  - 「実際に直してみる」ボタンを、直す場所の数(`siteIds.length >= 2`)に関係なく出す
- `'change-request'` のとき(正解後、または modify の依頼が無いステージ)
  - 見出しは今の「なぜ分けるのか」。本文も今と同じ(`ModifyAfter` を含む)で、最後に「「変更依頼に挑戦」で、実際に確かめてみましょう」
- `'refactor'`(100点前)は今のまま

### 手で直すパネル(`ManualFixPanel`)

- 100点のときにリリースして正解したら、`✅ 直し忘れなし` に続けて「次は「変更依頼に挑戦」で、新しい機能を実際に足してみましょう」と出す
- 100点のときに不正解なら、今の直し忘れ・関係のない印の表示に加えて「もう一度やる」で解き直すよう促す。`extra` があるときも不正解として扱う

### ツールバー(`StagePanel` の `ActionToolbar`)

- 「変更依頼に挑戦」は `postPerfectStep` が `'change-request'` のときだけ押せる
- 押せないときの `title`:
  - 100点前: 今と同じ「点数が100点になると挑戦できます」
  - `'manual-fix'`: 「先に「もし、この変更が来たら?」の問題を解いてください」
- 一度挑戦した後の「もう一度挑戦」も同じ条件(正解済みなので押せる)

### 変更依頼の結果画面

- 最後の依頼の「実装を終える」を押して結果画面になったとき、キャンバスには置いたあとのコードが残る(部品置き場は出さない)
- 「リファクタリングに戻る」を押すと、挑戦前のコードと取り消し履歴に戻る(今と同じ)

## TDD対象の純粋関数

### `isManualFixSolved`(`domain/change/checkManualFix.ts`)

- 正常系: `missed` も `extra` も空 → `true`
- 異常系: `missed` がある → `false`
- 異常系: `missed` は空だが `extra` がある → `false`
- 境界: 変更箇所が1か所で、その1か所だけに印 → `checkManualFix` と組み合わせて `true`

### `postPerfectStep`(`domain/change/postPerfectStep.ts`)

- `score: 99` → `'refactor'`(`manualFixSolved` が `true` でも)
- `score: 100`、`hasModifyRequest: true`、`manualFixSolved: false` → `'manual-fix'`
- `score: 100`、`hasModifyRequest: true`、`manualFixSolved: true` → `'change-request'`
- `score: 100`、`hasModifyRequest: false`、`manualFixSolved: false` → `'change-request'`

ストアの `finishImplementation` が最後の依頼のあと `carried` を残すことは、`useGameStore.test.ts` にテストを足す
(最後の依頼を終えた直後の `codebase` が `withoutTray(置いたあとのコード)` と等しく、`endChangeRequests` のあとは `base` と等しい)。
`manualFixSolved` の切り替え(100点で正解 → `true`、100点前の正解 → `false` のまま、ステージ切り替えで `false`)も同じファイルでテストする。

## 受け入れ基準

1. 100点を取った直後、「変更依頼に挑戦」は無効で、`title` が「先に「もし、この変更が来たら?」の問題を解いてください」になっている(modify の依頼があるステージ)
2. 100点のとき、左パネルのカードの見出しが「もし、この変更が来たら?」で、「実際に直してみる」が押せる。正解前は「○か所 → ○か所」の答えが出ていない
3. 直す場所すべてに、関係ないメソッドには付けずに印を付けてリリースすると正解になり、「変更依頼に挑戦」が押せるようになる。カードの見出しは「なぜ分けるのか」に変わる
4. 直し忘れがある・関係ないメソッドに印を付けた状態でリリースすると不正解で、「変更依頼に挑戦」は無効のまま
5. modify の依頼が無い(extend だけの)ステージでは、100点になったらすぐ「変更依頼に挑戦」が押せる
6. 正解したあと、変更依頼に挑戦して「リファクタリングに戻る」で戻っても、「もう一度挑戦」は押せる(もう一度解かせない)
7. ステージを切り替える・「最初に戻す」を押すと、手で直す問題はもう一度解く必要がある
8. 変更依頼の最後の依頼を終えて結果画面になったとき、キャンバスに置いたメソッド(新しいクラスを含む)が残っている。「リファクタリングに戻る」を押すと挑戦前のコードに戻る
9. 上の1〜8を確かめる E2E を足し、`change-request-start` を押している既存の E2E(`refactor.spec.ts`・`change-pain.spec.ts`・`concept-check.spec.ts`・`preview.spec.ts`・`story-mode.spec.ts`)は、先に手で直す問題を解く手順(共通のヘルパー)を挟んで通るようにする
10. `npm run check` と `npm run test:e2e` が通る

## スコープ外

- 理解度チェックの順番への組み込み(今までどおり100点で出す。順番の強制はしない)
- 手で直す問題の正解・進捗の保存(再読み込みしたらもう一度解く)
- 結果画面のキャンバスを読み取り専用にすること(触っても戻るときに捨てる)
- extend(新しい種類を足す)依頼の手で直す問題(modify の依頼だけを対象にする)
- 「次はこれ」と段階を示すステッパーなどの新しいUI部品
- 正解・不正解の演出(`answer-feedback-animation` で扱う)
