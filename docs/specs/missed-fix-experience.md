# コピペ由来の「直し忘れ」を体験する(手で直すシミュレーション+中級9)

> **前提**: `why-split-change-pain`(Issue #60)のマージ後に実装する。`ChangePainCard` と `measurePain`(`src/domain/change/changePain.ts`)に足す形で作る。

## 背景・目的

重複コード(コピペ)をまとめる理由が、プレイヤーに伝わっていない。`merge-duplicate-methods` で統合の**操作**はできるが、
「なぜまとめるのか」を体験する場所が無い。実務で重複コードが怖いのは、**仕様変更のときに1か所だけ直して、同じ処理の別のコピーを直し忘れる**ことが
本番のバグになるから。

今の変更の痛みカード(#60)は「直す場所が何か所か」を数字で見せるだけで、**直し忘れ**は起きない。
そこで、変更依頼を「手で直す」シミュレーションを用意する。プレイヤーが「直した」と思うメソッドに印を付けて「リリース」すると、
印の付け漏れ(直し忘れ)が本番バグとして報告される。コピーが複数あるコードでは、見落としが現実に起きる。

あわせて、このシミュレーションが映える題材として、**コピペされた消費税計算**が3か所にある中級9を足す。

採点・既存の変更依頼(挑戦・結果表示)・#60 のカードの既存の表示は変えない。

## 変更対象ファイル一覧

| パス | 層 | 新規/変更 | 役割 |
| --- | --- | --- | --- |
| `src/domain/change/checkManualFix.ts` + `.test.ts` | domain | 新規 | `checkManualFix`: 「直した」印と変更箇所を照合する純粋関数(TDD、下記) |
| `src/presentation/store/useGameStore.ts` | presentation | 変更 | `manualFix: { fixedIds: readonly string[]; released: boolean } \| null` と `startManualFix` / `toggleFixed` / `releaseManualFix` / `endManualFix`(下記) |
| `src/presentation/stage/ManualFixPanel.tsx` | presentation | 新規 | 手で直すシミュレーションのパネル(下記) |
| `src/presentation/stage/ChangePainCard.tsx` | presentation | 変更 | 「実際に直してみる」ボタンを足す(下記) |
| `src/presentation/canvas/MethodChip.tsx` | presentation | 変更 | `manualFix` 中のクリックは、メソッドの選択ではなく「直した」印の切り替えにする。印の見た目 |
| `src/index.css` | presentation | 変更 | `.method-chip--fixed` と `.manual-fix` のスタイル |
| `src/infrastructure/stages/intermediateStages.ts` / `stageCatalog.ts` | infrastructure | 変更 | 中級9「コピペされた消費税計算」を足す(下記) |
| `src/infrastructure/stages/stageCatalog.test.ts` | infrastructure | 変更 | 新ステージの検証(下記) |
| `e2e/manual-fix.spec.ts` | E2E | 新規 | 印を付けてリリースすると直し忘れが出る、全部付けると出ない |

`application` 層の変更は無い(ストアが `checkManualFix` を直接呼ぶ。`checkInvestigation` と同じ置き方は使わず、新しいユースケースは作らない)。

## 見た目・内容の仕様

### 「実際に直してみる」ボタン(`ChangePainCard`)

- 100点未満・100点以上のどちらでも、カードの対象の変更依頼(#60 の `painRequestOf`)について、**今のコードの変更箇所が2か所以上**のときだけ出す
  (1か所なら直し忘れは起きないため)。変更依頼の調査・実装中(`changeSession !== null`)、すでに `manualFix` 中のときは出さない
- 押すと `startManualFix`。キャンバスを今の編集のまま使える(コードは変えない)

### 手で直すシミュレーション(`ManualFixPanel`)

`ChangePainCard` の下に出す(`manualFix !== null` のとき)。

1. **直すとき**(`released === false`)
   - 依頼文: 「`request.title`: `request.description`」
   - 案内: 「直す必要がありそうなメソッドをクリックして『直した』印を付けてください。付け終えたらリリースします」
   - 「直した印: N 個」と、「リリースする」ボタン、「やめる」ボタン
   - どの変更箇所かのヒント(答え)は出さない。プレイヤーが処理の名前・ラベル(「消費税を計算する」など)から探す
2. **リリース後**(`released === true`)
   - 全部の変更箇所に印が付いている(`missed` が空): 「✅ 直し忘れなし。N か所すべてを直せました」
   - 漏れがある: 「⚠ 直し忘れ M か所。本番でバグになります」と、漏れた `クラス名.メソッド名` の一覧
   - 変更箇所でないメソッドに印がある(`extra`): 「関係のないメソッドに印を付けていました: …」(参考として出す。点数は無い)
   - 締めの1行(`changeSites >= 2` のとき): 「今のコードでは、この変更を入れるのに N か所を直す必要があります。1か所にまとめれば、直し忘れは起きません」
   - 「もう一度やる」(印を消して直すときへ)と「閉じる」(`endManualFix`)

- 印は `manualFix` 中だけ有効。リリース後は印の切り替えができない
- 印の見た目: メソッドチップに緑の縁取りと「✔」(色だけに頼らない)
- 変更箇所がコードの編集で変わっても(メソッドを移した・抽出した)、`fixedIds` は ID のまま持つ。存在しなくなった ID は照合のとき無視する
- `manualFix` 中にステージを切り替えたり「最初に戻す」を押したら、`manualFix` は `null` に戻る
- `manualFix` 中の `MethodChip` のクリックは、右サイドバーのメソッド選択(`selectMethod`)を**行わず**、印の切り替えだけを行う。ドラッグ操作は変えない

### 中級9「コピペされた消費税計算」

- `id: 'intermediate-copy-paste-tax'`、`level: 'intermediate'`、`title: '中級9: コピペされた消費税計算を1か所にまとめる'`
- 題材: 注文確定(`OrderService.confirm`)・請求書発行(`InvoiceService.issue`)・見積作成(`QuoteService.create`)の3クラスに、
  **ほぼ同じ「消費税を計算する」処理(`responsibility: 'tax'`・`duplicateGroup: 'tax-calc'`)がコピペされている**。
  各メソッドには別の責務(`'ordering'` / `'invoicing'` / `'quoting'` など)の処理も同居している
- `goal`: 「消費税の計算が3か所にコピペされています。1か所にまとめて、変更に強くしよう」
- 解き方: Extract Method で消費税の処理を抜き出し(各クラス)、`mergeMethods`(重複メソッドの統合)で1つにまとめ、`TaxCalculator`(用意されている空クラス)へ移す。既存の操作だけで解ける
- 制限値・`dependencyLimit`・`responsibilityLimit` は、模範解答で100点にでき、初期状態では100点にならない値にする
- `changeRequests`: 1件目に `{ responsibility: 'tax', kind: 'modify' }`(「軽減税率8%に対応して」など)、2件目は別の責務の `modify`。`partName` を全件に書く
- `why`(#60 の必須項目): 「税率が変わるたびに3か所を同じように直す必要があり、1か所でも直し忘れると請求額が合わなくなります。1か所にまとめれば、直すのは1か所だけで、直し忘れが起きません」
- `description` など、ステージに必要な他の項目は既存の中級ステージ(中級8など)に倣う。ヒントは `useHints` が既存の仕組みで出す。模範解答の手順は `stageCatalog.test.ts` で検証する
- 中級4「変わるのは税の計算」とは別題材にする(あちらは変わる場所の切り分けが主題。こちらはコピペの重複が主題)

## データ・型の変更

`src/domain/change/checkManualFix.ts`:

```ts
export type ManualFixResult = {
  /** 変更箇所なのに印が無い(直し忘れ)メソッドのID。 */
  readonly missed: readonly string[];
  /** 変更箇所ではないのに印があるメソッドのID(コードに存在するものだけ)。 */
  readonly extra: readonly string[];
  /** 変更箇所の数。 */
  readonly sites: number;
};

export function checkManualFix(codebase: Codebase, request: ChangeRequest, fixedIds: readonly string[]): ManualFixResult;
```

`useGameStore` に `manualFix: { fixedIds: readonly string[]; released: boolean } | null`(初期値 `null`)。
`changeSession` とは排他(どちらかが非 `null` のときは、もう一方を始められない)。`undo`/`redo`・編集は `manualFix` 中も許す。

## TDD対象の純粋関数

### `checkManualFix`

1. 変更箇所すべてに印がある → `missed` が空、`extra` が空、`sites` が変更箇所の数
2. 変更箇所の一部にしか印が無い → `missed` に、印の無い変更箇所のIDが、変更箇所の出現順に入る
3. 印が1つも無い → `missed` が全変更箇所
4. 変更箇所でないメソッドに印がある → `extra` にそのIDが入る(`missed` には影響しない)
5. コードに存在しないIDの印は、`extra` にも入れず無視する
6. 同じIDが `fixedIds` に重複していても1つとして扱う
7. 依頼の責務の処理が1つも無い(`no-sites`)ときは `sites: 0`、`missed: []`
8. 抽出・統合などで変更箇所が変わったコードでは、そのときの変更箇所で照合する

### ステージカタログ(`stageCatalog.test.ts`)

1. 中級9の初期状態は100点にならない。模範解答の手順(Extract Method → 統合 → 移動)を実行すると100点になる
2. 初期状態で、`tax` の責務の変更箇所が3メソッド以上ある(`findChangeSites`)。3つが `duplicateGroup: 'tax-calc'` を共有する
3. `measurePain` が `undefined` でない。`why` が空でない

## 受け入れ基準

- `npm run check` が通る
- `npm run test:e2e` が通る(`MethodChip` のクリック・ドラッグの既存E2Eが壊れない)
- 変更箇所が2か所以上のステージ(中級9など)で、カードに「実際に直してみる」が出る。1か所のコードでは出ない
- ボタンを押すと、メソッドをクリックして「直した」印が付く・外れる。このとき右サイドバーのメソッド選択は変わらない
- 一部にしか印を付けずにリリースすると、「⚠ 直し忘れ M か所」と、漏れたメソッド名の一覧が出る。全部付けると「✅ 直し忘れなし」が出る
- 中級9で、消費税計算の3つのコピーを3つとも見つけて印を付けないと、直し忘れが出る
- 中級9を解いて(1か所にまとめて)から再び「実際に直してみる」を押すと、変更箇所は1か所なのでボタンが出ない(締めの文言は、2か所以上のときだけ)
- ステージ切り替え・「最初に戻す」・変更依頼の開始で、`manualFix` が `null` に戻る。`changeSession` 中はボタンが出ない
- 中級9が既存のステージ選択に並ぶ。他のステージの採点・点数・進捗が変わらない
- 印は色だけに頼らない(「✔」の文字がある)。印の切り替えはキーボード(Enter/Space)でもできる

## スコープ外

- 印を付ける操作の点数化(直し忘れの減点など。あくまで体験)
- 実際にコードを書き換える・テストを実行する本物のシミュレーション
- 変更箇所のヒント表示・「正解を見る」ボタン
- 変更依頼の「実装」(置き方の採点)の仕組みの変更
- 中級9以外のステージへの重複コードの追加(必要になった時点で別の仕様にする)
- 白紙設計モード・設計くらべクイズへの適用
