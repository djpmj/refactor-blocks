# 仕様草案: 「分けすぎ」の減点と、中級9「分けすぎたメソッドを戻す」

- slug: `inline-method-stage`
- 元: `docs/pipeline/inline-method-stage/01-discovered.md`
- 規模の前例: `docs/specs/lone-superclass-scoring.md`(採点ルール1つ + ステージ1件)

## 1. 背景・目的

- 今の採点は `lone-superclass` を除き、分ける・抽出する方向にしか点が動かない。そのため「細かく抽出するほど良い」という癖がつきやすい。
  新卒〜4年目は「メソッドは短く」を覚えた直後に、1〜3行の private メソッドを量産しがちである(Fowler の Inline Method の動機)。
- Inline Method の操作(`src/domain/codebase/inlineMethod.ts`)と、メソッドエディタの「呼び出し元へ戻す」ボタン・E2E はすでにある。
  ただ、それを解き方に使うステージも、「分けすぎ」を数える採点ルールも無い。
- 今回やること:
  1. 採点ルール `over-split` を足す。**Inline Method でゲーム内で直せる、小さすぎる private メソッド**を1件10点で減点する
  2. 模範解答のステップに `inline` を足す。ヒント文も足す
  3. 中級9として、細切れの判定メソッドを戻しつつ、長い処理は意味のあるまとまりで切り出し直すステージを追加する

### 調査で分かったこと(既存の模範解答が100点のままである根拠)

「分けすぎ」の定義(4.1)は、次の4条件をすべて満たすメソッドとする: **private であること、呼び出し行 `<id>:call` があること、
その呼び出し行以外から uses で呼ばれていないこと、ブロックの行数が5行以下であること。**
この定義で、既存の全ステージの模範解答を1つずつ確かめた。

| 模範解答の中の private メソッド | 行数(中身) | 判定 |
|---|---|---|
| チュートリアル・初級・中級1〜8・上級で Extract Method したメソッド全部 | 最小は中級6の `isInTrial`(中身12行) | 5行を大きく超えるので数えない |
| Merge Methods で統合したメソッド(上級1・4・7) | 中身16行以上 | 統合後のIDの `<newId>:call` が無い(`mergeMethods` は呼び出し行のIDを付け替えず、`uses` だけを付け替える)。そのため数えない |
| 中級7の模範解答で private にした `setBalance`・`setDailyWithdrawn` | 5行(中身3行) | 呼び出し行 `:call` が無い。`uses` で呼ばれる getter/setter なので数えない。**`:call` の条件が無いと `setDailyWithdrawn`(呼び出し元1か所・5行)が減点され、中級7が100点でなくなる** |
| 中級2の初期データの `calculateShippingFee`・`addPoints` | 中身50行以上 | 呼び出し行のIDが `frag-call-…` で、`<id>:call` の形ではない。そのため数えない |
| 上級5の `quoteChar` | 6行(中身4行)、protected | private ではないので数えない。行数も5行を超え、`:call` も無い |
| 上級8(`template-method-stage`、実装前)の `parse`・統合した `importOrders` | protected / public | private ではないので数えない |
| 白紙設計(`blankDesignProblems.ts`)の部品 | 全部 public | 数えない |

- 既存ステージの複数の処理を持つメソッドの中に、中身が3行以下の処理は中級2の呼び出し行(1行×2)しかない。
  accessor と stub は、どれも処理1つだけのメソッドで、全部を抽出することはできない。
  つまり、既存ステージでプレイヤーが普通に Extract Method しても、この減点は出ない(チュートリアルの体験は変わらない)。
  これは4.5のカタログテストで機械的に守る。
- 既存の単体テストで、小さなメソッドを抽出してから採点しているのは `score.test.ts` の「越境呼び出し」のケース(1行の `helper`)だけ。
  このテストは `deductions[4]`(visibility)しか見ていないので、影響しない。

### 本当に新しい仕組みが要るか(ponytail)

- 新しいタグ・型のフィールドは要らない。既存の `visibility`・`findCallerOf`(`inlineMethod.ts`)・`uses`・`methodLines`(`lineCount.ts`)で判定できる。
- 「呼び出し行 `:call` があること」を条件にしているので、**減点されたメソッドは必ず「呼び出し元へ戻す」で直せる。** 直す手段の無い減点は作らない
  (`lone-superclass-scoring.md` が Middle Man を見送ったのと同じ方針)。
- 変更依頼の採点(`scoreChange`)に「触ったメソッドの数」の減点は足さない。散らばりはクラス単位のまま変えない。
  Inline の効果は、変更箇所の一覧(`siteNames`・`MethodChip` の印)に出るメソッドの数と、行数の上限超えで見せる(5章)。

## 2. 変更対象ファイル一覧

| 種別 | パス | 層 | 役割 |
|---|---|---|---|
| 新規 | `src/domain/scoring/overSplit.ts` | domain | `findOverSplitMethods`(4.1) |
| 新規 | `src/domain/scoring/overSplit.test.ts` | domain(test) | 4.1 のAAAテスト |
| 変更 | `src/domain/scoring/score.ts` | domain | `ScoreRule`・`counts`・並び順の配列の**末尾**に `'over-split'` を足す(3.2)。JSDoc の列挙に「分けすぎた小さなメソッド」を足す |
| 変更 | `src/domain/scoring/score.test.ts` | domain(test) | 「13ルールとも減点0件」の件数と末尾を更新する。4.2 のケースを足す |
| 変更 | `src/domain/scoring/fileScores.ts` | domain | `violatingTargetIds` に `...findOverSplitMethods(codebase)` を足す(メソッドのIDなので、そのメソッドがあるファイルに数える) |
| 変更 | `src/domain/scoring/fileScores.test.ts` | domain(test) | 4.3 のケースを足す |
| 変更 | `src/domain/stage/sampleAnswer.ts` | domain | `SolutionStep` に `{ readonly inline: string }` を足す。`applyStep` で `inlineMethod` を呼ぶ。`sampleAnswerSteps['intermediate-inline-method']` を足す |
| 変更 | `src/domain/stage/sampleAnswer.test.ts` | domain(test) | 4.4 のケースを足す |
| 変更 | `src/presentation/stage/describeScore.ts` | presentation | `RULE_LABEL` に `'over-split': '分けすぎた小さなメソッド'` を足す(`Record<ScoreRule, string>` なので、足さないと型エラーになる) |
| 変更 | `src/presentation/stage/describeSolutionStep.ts` | presentation | `inline` のヒント文を足す(3.3) |
| 変更 | `src/infrastructure/stages/intermediateStages.ts` | infrastructure | 中級9を `intermediateStages` の**末尾**に足す(5章) |
| 新規 | `src/infrastructure/stages/inlineMethodStage.test.ts` | infrastructure(test) | 中級9の狙いのテスト(4.6)。`featureEnvyStage.test.ts` と同じ形にする |
| 変更 | `src/infrastructure/stages/stageCatalog.test.ts` | infrastructure(test) | 全ステージ共通のテストを1つ足す(4.5)。`shortcuts` に中級9の近道を足す(5.5) |
| 変更 | `e2e/refactor.spec.ts` | E2E | 中級9で「呼び出し元へ戻す」と、分けすぎの減点が減るケースを1つ足す(6章) |

`inlineMethod.ts`・`extractMethod.ts`・`mergeMethods.ts`・`Codebase.ts`・`advancedStages.ts`・既存ステージのデータと模範解答は**変更しない**。
AI講評(`critiqueRequest.ts`)は `fileDeductions` を経由するので、変更しなくても新ルールが入る。
`describeChange.ts` は変更依頼のルール(`ChangeRule`)だけを扱うので、関係しない。

## 3. データ/型の変更

### 3.1 型

永続化スキーマの変更は無い。

```ts
// src/domain/scoring/score.ts
export type ScoreRule =
  | 'line-limit'
  // …既存はそのままの順…
  | 'cohesion'
  | 'over-split'; // 末尾(3.2)

// src/domain/stage/sampleAnswer.ts(値はメソッド名。同名メソッドを区別する fromClass は、要る題材が出るまで作らない)
  | { readonly inline: string }
```

- `sampleAnswer.ts` と `describeSolutionStep.ts` の `StructuralStep` は、`Exclude` に `{ readonly inline: unknown }` を足す
  (足さないと `applyStructuralStep` の最後の `step.setSuperclass` が型エラーになるので、漏れは型チェックで分かる)。
- `applyStep` には `if ('inline' in step) return unwrap(inlineMethod(codebase, methodIdByName(codebase, step.inline)));` を足す。`newId` は使わない。

### 3.2 `duplicate-code-scoring` との並行作業(どちらが先にマージされても通るように)

`duplicate-code-scoring`(`docs/pipeline/duplicate-code-scoring/02-draft-spec.md`)も、同じ5か所の末尾に `'duplicate-code'` を1件ずつ足す。
5か所とは、`ScoreRule` のユニオン、`counts`、並び順の配列、`RULE_LABEL`、`fileDeductions` の `violatingTargetIds` である。

- **追加位置の決まり: マージする時点で、並びの一番後ろに足す。** 相手が先に入っていれば、`'duplicate-code'` の後ろに `'over-split'` を足す。
  rebase で起きる衝突は、同じ行の末尾への追記だけになる。両方を残せば解ける。
- 並びは、`score.test.ts` が `deductions[0]`〜`deductions[11]` の**位置**で取り出しているので、途中に挟まない。
  新ルールのテストは位置ではなく `deductions.find((d) => d.rule === 'over-split')` で取り出す(相手の有無で位置が変わるため)。
- `score.test.ts` の「違反がなければ100点で、13ルールとも減点0件を返す」は、マージ時点のルール数(14 または 15)に合わせてタイトルと末尾を更新する。
- **ルールは互いに独立している。** `over-split` は `visibility`・`:call`・`uses`・行数だけを見て、`duplicateGroup` を見ない。
  `duplicate-code` は `duplicateGroup` だけを見る。
  - 中級9のデータには `duplicateGroup` が無い。どちらの順でマージしても、初期60点・模範解答100点は変わらない
  - 上級1・4・7(と上級8)の模範解答には、中身5行以下で `:call` を持つ private メソッドが無い(1章の表)。
    `duplicate-code` がある場合もない場合も、`over-split` は0件で、100点のまま
  - 相手の近道(上級1・4の「統合せずに移す」)に出てくる抽出メソッドは、中身が22行以上ある。このルールは点数を変えない
- 中級9は `intermediateStages.ts` の末尾に置く。`template-method-stage` が触る `advancedStages.ts` とは衝突しない。

### 3.3 ヒント文

`describeSolutionStep` の `inline` は次の文にする。

`${method} は中身が短く、呼び出し元も1か所だけ。メソッドエディタの「呼び出し元へ戻す」で戻そう(Inline Method)`

`describeSolutionStep` は今の循環的複雑度が11ほどある。分岐を1つ足して上限12を超えたら、`deleteMethod` などと同じく小さな関数に出す。

## 4. TDD対象の純粋関数

### 4.1 `findOverSplitMethods(codebase: Codebase): string[]`(`src/domain/scoring/overSplit.ts`)

```ts
/**
 * 分けすぎた小さなメソッド(Inline Method で戻すべきもの)のIDを返す。次をすべて満たすもの:
 * - private(public/protected は外から・子から使われる約束の一部なので、小さくても数えない。上級5の quoteChar など)
 * - 呼び出し行 `<id>:call` がある(= 「呼び出し元へ戻す」で直せる。getter/setter のように uses で呼ばれるだけのものは数えない)
 * - その呼び出し行のほかに、uses で呼んでいる処理が無い(呼び出し元が1か所だけ)
 * - ブロックの行数(methodLines)が OVER_SPLIT_MAX_LINES 以下
 */
export function findOverSplitMethods(codebase: Codebase): string[];
```

- `OVER_SPLIT_MAX_LINES = 5`(未決事項1のA)。コメントには、中身が3行以下であり、Extract Method で増える行数(シグネチャと閉じ括弧の2行 + 呼び出し1行)と同じか少ない、と書く。
- 呼び出し元は `findCallerOf`(`inlineMethod.ts`)で探す。クラスはまたいでよい(未決事項4のA)。
- 「呼び出し元が1か所」は、`uses` にそのIDを含む処理を全メソッドから数え、1つ(呼び出し行だけ)であることで判定する。数え方は `findUnusedPrivateMethods`(`leftovers.ts`)に合わせる。
- 実装の目安は15行ほど。

テストケース(AAA。`sampleCodebase` と `extractMethod` を使い、実際の操作で作った形で確かめる):

1. 正常系: `placeOrder` から中身3行の処理を Extract Method すると、そのメソッドのIDを返す(5行 = 境界の内側)
2. 境界: 中身4行(6行)の処理を抽出したときは返さない
3. 正常系: 抽出したメソッドを Move Method で別クラスへ移しても返す(呼び出し元が別クラス)
4. 除外: 1と同じ形で、`visibility` が `public`・`protected` のときは返さない
5. 除外: `:call` の呼び出し行が無く、別の処理から `uses` で呼ばれるだけの5行の private メソッド(中級7の `setDailyWithdrawn` の形)は返さない
6. 除外: 呼び出し行のほかに、別の処理からも `uses` で呼ばれている5行の private メソッドは返さない
7. 直せる: 1の状態で `inlineMethod` すると `[]` になる(このルールがゲーム内で直せることの回帰テスト)
8. 正常系: 該当するメソッドが無い `sampleCodebase()` では `[]`

### 4.2 `scoreCodebase`(`score.test.ts`)

- 違反なしのテストを、マージ時点のルール数に更新する(3.2)
- 分けすぎた小さなメソッド1件につき10点減点する: 4.1 の1の形 → `find((d) => d.rule === 'over-split')` が `{ rule: 'over-split', count: 1, points: 10 }`

### 4.3 `fileDeductions`(`fileScores.test.ts`)

- 分けすぎたメソッドは、そのメソッドがあるファイルの減点になる(Move Method で別ファイルのクラスへ移した場合、呼び出し元のファイルは0点)
- そのコードベースで、全ファイルの合計が `scoreCodebase` の減点の合計と一致する

### 4.4 `applySolutionSteps`(`sampleAnswer.test.ts`)

- `{ extract: … }` のあとに `{ inline: '<抽出した名前>' }` を適用すると、抽出したメソッドが消え、元のメソッドの処理の並びが抽出前に戻る
- 存在しないメソッド名の `inline` は例外を投げる(既存の `methodIdByName` のとおり)

### 4.5 全ステージ共通(`stageCatalog.test.ts` の `describe.each` に1つ足す)

- **「模範解答を1手ずつ適用しても、分けすぎ(`findOverSplitMethods`)の件数は増えない」**
  - 既存の全ステージで、Extract Method の直後を含め、模範解答の途中で一度も減点が出ないことを守る(チュートリアルの体験が変わらないことの保証)
  - 中級9では 3 → 2 → 1 → 0 → 0 と減っていくことも同時に守る
  - 「模範解答で100点」の既存テストと合わせて、既存ステージでこのルールが0件であることを、ステージを名指しせずに守る

### 4.6 中級9のテスト(`inlineMethodStage.test.ts`)

1. 初期状態は60点(行数1件・分けすぎ3件)
2. 模範解答を適用すると、`ShippingFeeCalculator` のメソッドは `calculateFee` と `measurePackage` の2つだけになり、分けすぎは0件
3. 料金表の改定(`req-revise-shipping-rates`)の変更箇所: 初期は4メソッドで75点(巻き込み-5・上限超え-20)。模範解答後は1メソッドで100点
4. **Inline の効果だけを取り出す**: 模範解答の4手目(Extract)だけを当てた状態(細切れは残す)では、同じ依頼が4メソッドになる。
   クラスが上限を超えて90点になる。模範解答後(100点)より低い

## 5. 中級9のステージ

### 5.1 概要

- id: `intermediate-inline-method`、title: `中級9: 分けすぎたメソッドを戻す`
- level: `intermediate`(`intermediateStages` の末尾)
- ファイル冒頭のコメント: 中級1〜8はどれも「分ける・移す」題材で、ここだけが「戻す」題材であること。
  `<id>:call` の呼び出し行を初期データに置いているのは Inline Method を最初から使えるようにするため(`extractMethod.ts` の `callFragmentId` と同じ形)、と一言書く
- description(案):
  「送料を計算する ShippingFeeCalculator。『メソッドは短く』を守ろうとした前任者が、離島かどうか・クール便の追加料金・送料無料になるかの判定を、
  1〜3行ずつ private メソッドに切り出した。どれも calculateFee から1回呼ばれるだけで、読むたびに定義へ飛ぶことになる。
  その一方で、荷物のサイズ区分を決める長い処理は、calculateFee に残ったままになっている。」
- goal(案):
  「中身が短く、1か所からしか呼ばれない private メソッド(5行以下)は、名前を付けても読みやすくならない。
  メソッドエディタの『呼び出し元へ戻す』(Inline Method)で戻し、代わりに意味のあるまとまりを Extract Method しよう。
  メソッドは60行・クラスは115行以内、1クラスの責務は2種類まで」
- `limits: { method: 60, class: 115, file: 300 }`、`dependencyLimit: 1`、`responsibilityLimit: 2`、`visibilityEnforced` は省略
  - クラスの上限115は、料金表の改定で「細切れ4か所それぞれに6行ずつ足すと上限を超え、1か所なら収まる」ように決めた値(4.6の4)

### 5.2 初期コード

1ファイル・1クラス。ファイルは `src/shipping/ShippingFeeCalculator.ts`(id `file-shipping-fee-calculator`)、クラスは `ShippingFeeCalculator`(id `class-shipping-fee-calculator`)。

| メソッド(可視性, id) | 処理(id / label / lines / responsibility / その他) |
|---|---|
| `calculateFee`(public, `method-calculate-fee`) | `frag-measure-package` / 荷物の重さと3辺の合計からサイズ区分を決める / 36 / `package` / suggestedName `measurePackage`<br>`frag-look-up-base-fee` / 配送先の地域とサイズ区分から基本料金を料金表で引く / 40 / `fee-rule` / suggestedName `lookUpBaseFee`<br>`method-is-remote-island:call` / isRemoteIsland() を呼び出す / 1 / `call` / uses `method-is-remote-island`<br>`method-add-cool-fee:call` / addCoolFee() を呼び出す / 1 / `call` / uses `method-add-cool-fee`<br>`method-is-free-shipping:call` / isFreeShipping() を呼び出す / 1 / `call` / uses `method-is-free-shipping` |
| `isRemoteIsland`(private, `method-is-remote-island`) | `frag-remote-island-check` / 配送先の郵便番号が離島の一覧にあるか判定する / 2 / `fee-rule` |
| `addCoolFee`(private, `method-add-cool-fee`) | `frag-cool-fee` / クール便なら追加料金を足す / 3 / `fee-rule` |
| `isFreeShipping`(private, `method-is-free-shipping`) | `frag-free-shipping-threshold` / 購入金額が送料無料の基準以上か判定する / 1 / `fee-rule` |

- `calculateFee` は 79 + 2 = 81行で、「80行以上のメソッドがある」を満たす
- 細切れの3つは3〜5行で、分けすぎの条件をすべて満たす
- クラス = 2 + 81 + 4 + 5 + 3 = 95行
- 初期の減点: 行数(`calculateFee` 81 > 60)-10、分けすぎ3件 -30 → **60点**
  - 責務は `package`・`fee-rule` の2種類(`call` は数えない)で、上限内

### 5.3 変更依頼(どちらも modify)

| id | title / description | responsibility | linesPerSite | partName |
|---|---|---|---|---|
| `req-revise-shipping-rates` | 送料の料金表を改定して / 運送会社の値上げで、基本料金・離島の追加料金・クール便の料金・送料無料になる金額を、まとめて見直すことになった。 | `fee-rule` | 6 | `reviseShippingRates` |
| `req-add-size-160` | 160サイズの荷物も受け付けて / 大型の家具も扱うことになり、サイズ区分に160サイズを足したい。 | `package` | 6 | `addSize160` |

試算(実装者は 4.6 のテストで確かめる。数値は満点・近道が成り立つ範囲で微調整してよい):

| 依頼 | 初期 | 模範解答後 |
|---|---|---|
| 料金表の改定 | 変更箇所4メソッド。巻き込み1(`calculateFee` に `package` が同居)-5。上限超え2(`calculateFee` 87行・クラス119行)-20 → 75点 | 変更箇所は `calculateFee` の1つ。55行・クラス95行 → 100点 |
| 160サイズ | 変更箇所は `calculateFee`。巻き込み1 -5。上限超え1(87行)-10 → 85点 | 変更箇所は `measurePackage`(44行)→ 100点 |

- 変更容易性は 80 → 100 に上がる。変更が必要なクラス数は、どちらも1 → 1 で増えない
- 料金表の改定は、変更箇所の一覧(`siteNames`)が「calculateFee、isRemoteIsland、addCoolFee、isFreeShipping」から「calculateFee」になる。
  「細切れにすると、ルールの変更で触るブロックが増える」ことが、画面で分かる

### 5.4 模範解答(`sampleAnswerSteps['intermediate-inline-method']`)

1. `{ inline: 'isRemoteIsland' }`
2. `{ inline: 'addCoolFee' }`
3. `{ inline: 'isFreeShipping' }`
4. `{ extract: { from: 'calculateFee', fragmentIds: ['frag-measure-package'], name: 'measurePackage' } }`

最終形の行数は次のとおり。

- `calculateFee`: 呼び出し1 + 40 + 2 + 3 + 1 = 47 → 49行
- `measurePackage`(private): 36 → 38行
- クラス: 89行

減点は0件で、100点になる。

`fee-rule` の処理(基本料金 + 戻した3つ)を1つにまとめて抽出する解き方(例: `calculateBaseFee` 48行)でも100点になる。
これは許容する(どちらを切り出すかは名前の問題で、「意味のあるまとまりで切る」点は同じため)。

### 5.5 `stageCatalog.test.ts` の `shortcuts` に足すもの

どれも100点にならないことを確かめる(試算の点数はPRの説明に書く)。

- 「細切れは残したまま、サイズ区分だけを抽出する」: 5.4 の4手目だけ → 分けすぎ3件で70点
- 「細切れを新しいクラスへ移して、サイズ区分を抽出する」:
  - 手順: `addFile: 'src/shipping/FeeRules.ts'` → `addClass FeeRules` → 3つを `move` → 5.4 の4手目
  - 結果: 分けすぎ3件が残って70点(呼び出し元が別クラスでも数えることの保証。未決事項4のA)
- 「細切れを戻すだけで、長い処理を分けない」: 5.4 の1〜3手目だけ → `calculateFee` 84行で90点

## 6. 受け入れ基準

1. `findOverSplitMethods` に 4.1 のケースを含むAAAのユニットテストがあり、通る(`inlineMethod` で戻すと0件になるケースを含む)
2. `scoreCodebase` が `over-split` を並びの末尾の減点として返し、1件10点で引く。既存ルールの並び順は変わらない
3. `fileDeductions` が分けすぎたメソッドを持ち主のファイルに数え、全ファイルの合計が `scoreCodebase` の減点の合計と一致する
4. 採点パネルの内訳に `分けすぎた小さなメソッド -30` のように出る(`RULE_LABEL`)
5. `SolutionStep` の `inline` で模範解答を書け、行き詰まりヒントに 3.3 の文が出る
6. `stageCatalog.test.ts` の全ステージのテストが通る。特に次の3つ:
   - 「模範解答で100点」(既存ステージは点数が変わらない)
   - 「模範解答を1手ずつ適用しても分けすぎは増えない」(4.5)
   - 中級9の近道(5.5)
7. 中級9がステージ選択の中級の末尾に出る。初期60点で、模範解答どおりに操作すると100点になる。4.6 のテストが通る
8. `blankDesignProblems.test.ts` の「模範解答は100点」、上級7などの点数を固定したテストが、変更なしで通る
9. `duplicate-code-scoring` が先にマージされていても、されていなくても、上の2〜8が成り立つ(3.2)
10. E2E(`refactor.spec.ts`)のケースを1つ足す。内容は次のとおり:
    - 中級9を開くと、`score` に `分けすぎた小さなメソッド -30` が出る
    - `isRemoteIsland` を選んで「呼び出し元へ戻す」と、`-20` になり、`method-isRemoteIsland` が消える
11. `npm run check` と `npm run test:e2e` が通る。`domain`/`application` のカバレッジの閾値を割らない

## 7. スコープ外

- public / protected の小さなメソッドの減点(公開APIやフックは、小さくても正当なことが多い。上級5の `quoteChar`、中級7の getter/setter)
- 呼び出し行 `:call` を持たない小さなメソッドの減点(ゲーム内で Inline できないため)
- `inlineMethod` 自体の強化。今の `inlineMethod` は、呼び出し行のほかに `uses` で呼んでいる処理があっても、確かめずに消してしまう。
  このルールはそういうメソッドを数えないので、減点に従って戻したプレイヤーが呼び出しを壊すことは無い。
  ただし、操作そのものの安全策は別の機会に足す
- 変更依頼の採点で、触ったメソッドの数を減点すること(散らばりはクラス単位のまま)
- Lazy Class(小さすぎるクラス)・Middle Man の減点
- 設計くらべクイズ(`comparisonQuizzes.ts`)への問題の追加、AI講評のプロンプトでの「分けすぎ」の言い回しの調整
- 既存ステージの goal・description の文言の見直し

## 未決事項

### 未決事項1: 「分けすぎ」とみなすメソッドの大きさ(ブロックに出る行数)

- 選択肢A(推奨): 5行以下(中身3行以下)。抽出で増える行数(シグネチャ2行 + 呼び出し1行)と同じか少ない中身、と説明できる。既存ステージの処理でこの大きさになるのは中級2の呼び出し行だけなので、最も安全
- 選択肢B: 7行以下(中身5行以下)。題材の幅は広がる。既存ステージの模範解答はこれでも100点のまま(抽出したメソッドの最小は中身12行)。ただ、今後のステージで「小さいが正当な抽出」を作りにくくなる

### 未決事項2: Extract Method した直後のメソッドも数えるか

- 選択肢A(推奨): 数える。初期データにあったか、プレイヤーが抽出したかを区別しない。区別するための状態やタグが要らない。既存ステージで普通に抽出しても出ないことは、4.5 のカタログテストで守る
- 選択肢B: 初期データにあったメソッドだけ数える。プレイヤーが細かく抽出しすぎても減点されない。そのため中級9で「戻してから1行だけ抽出し直す」が満点になる。印として新しいタグ(例: `Method.legacy`)が要る

### 未決事項3: 中級9で、長いメソッドの Extract Method もさせるか

- 選択肢A(推奨): させる(5章の案)。細切れ3つを戻し、長い処理は意味のあるまとまり(サイズ区分)で切り出し直す。「分ける場所の判断」を1ステージで対にして学べる。変更依頼で、Inline と Extract の両方の効果が見える
- 選択肢B: Inline だけで解ける形にする。メソッドの上限を90行ほどにして `calculateFee` を上限内に収める(上級5と同じ作り)。ステージは単純になる。ただ「80行を超えるメソッドは残してよいのに、3行のメソッドは戻す」ことの説明が難しい

### 未決事項4: 呼び出し元が別クラスにある小さな private メソッドも数えるか

- 選択肢A(推奨): 数える。`inlineMethod` はクラスをまたいで戻せるので、直す手段がある。数えないと「細切れを別クラスへ移すだけ」で減点を逃れる近道が残る(5.5の2つ目)
- 選択肢B: 同じクラスの中から呼ばれているときだけ数える。「別クラスの private を呼ぶ」ことは、`visibilityEnforced` のステージではアクセス制御の違反として別に減点されるので、二重に減点しない
