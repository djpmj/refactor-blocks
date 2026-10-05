# Inline Method の一般化と Middle Man の採点・ステージ

## 背景・目的

`docs/feature-ideas/IDEAS.md`(2026-10-03)の案6「Inline Method / Inline Class(逆向きの操作)」。分けるだけでなく「戻す」判断も設計の一部だと体験させる。

調査の結果、現状は次のとおり。

- **Inline Method は実装済み**(`src/domain/codebase/inlineMethod.ts`、メソッドエディタの「呼び出し元へ戻す」ボタン)。ただし対象は「Extract Method が残した呼び出し行(id が `<メソッドID>:call`)」を持つprivateメソッドだけ。
- ステージ作者が**最初から用意した「呼び出しを横流しするだけのメソッド」(Middle Man)** は、呼び出し行のIDが規約に沿わず、publicでもあるため戻せない。
- 「やりすぎ検知」(`over-split-scoring.md`)の `trivial-method` / `thin-class` は、呼び出し行だけのメソッドを**意図的に除外**している(「ゲーム内で直す手段がない」ため。`lone-superclass-scoring.md` も同様)。つまり横流しだけのクラスは減点されず、戻す理由がない。
- 戻すのが正解になるステージがない。

対話で確定した方針:

- **Inline Method を一般化する**(Extract由来に限らず、「呼び出し行」を持つメソッドなら戻せる)。**Inline Class 専用の操作は作らない**(YAGNI)。全メソッドを Inline して空になったクラス/ファイルは、既存の `deleteFile`(切り出し済みメソッドを呼び出し元へ戻してから削除する)・`deleteClass` で消せる。
- **新しい採点ルール `middle-man` を全ステージ共通で追加**する(over-split-scoring と同じ「1件10点減点」方式)。
- **新ステージを1つ追加**する(戻すのが正解のステージ)。

## ponytailチェック

1. YAGNI: Inline Class 専用操作は作らない。複数の呼び出し元への一括Inlineは作らない(`multiple-callers` エラーで拒否。ステージがその形を必要としたとき足す)。
2. 既存の再利用: `findCallerOf`/`inlineMethod`・`deleteFile`・`CALL_RESPONSIBILITY`・`Result`・`mapClasses`・`overExtraction.ts` の既存パターン・`stageCatalog.test.ts` の共通テストをそのまま使う。
3. 新しい依存・新しい操作ボタンは作らない。既存の「呼び出し元へ戻す」ボタンの表示条件を変えるだけ。

## 変更対象ファイル一覧

| パス | 層 | 新規/変更 | 役割 |
| --- | --- | --- | --- |
| `src/domain/codebase/inlineMethod.ts` | domain | 変更 | 呼び出し行の判定を「ID規約」から「`responsibility === 'call'` かつ `uses` がちょうど `[methodId]` の処理」に一般化。`not-private` を廃止し、`multiple-callers` を追加 |
| `src/domain/codebase/inlineMethod.test.ts` | domain(test) | 変更 | 下記ケースを追加。`not-private` を期待している既存テストは新仕様に合わせて更新 |
| `src/domain/codebase/deleteClass.test.ts` / `deleteFile.test.ts` | domain(test) | 変更 | 提供済みの横流しメソッド(public)を持つクラス/ファイルを削除すると、呼び出し元へ戻ってから消えるケースを追加 |
| `src/domain/scoring/middleMan.ts` | domain | 新規 | `findMiddleManClasses` |
| `src/domain/scoring/middleMan.test.ts` | domain(test) | 新規 | 上記のテスト |
| `src/domain/scoring/score.ts` | domain | 変更 | `ScoreRule` に `'middle-man'` を足し、`scoreCodebase` で数える(`'thin-class'` の後ろ) |
| `src/domain/scoring/score.test.ts` | domain(test) | 変更 | 減点ケースを足す。依存関係検証用の「呼び出し行だけのメソッド」フィクスチャが意図せず `middle-man` に当たる場合は、検証したい観点を変えずにフィクスチャを調整する |
| `src/domain/scoring/fileScores.ts` / `fileScores.test.ts` | domain | 変更 | `findMiddleManClasses` の対象IDを `violatingTargetIds` に足す |
| `src/presentation/stage/describeScore.ts` | presentation | 変更 | `RULE_LABEL` に `'middle-man'`(「横流しするだけのクラス」)を足す |
| `src/application/RefactorUseCases.ts` | application | 変更 | `INLINE_ERROR_MESSAGES` から `not-private` を外し `multiple-callers` を足す。`inlineMethodUseCase` は構造そのまま |
| `src/application/RefactorUseCases.test.ts` | application(test) | 変更 | 新エラーメッセージ・public横流しメソッドのInlineを確認 |
| `src/presentation/editor/MethodEditor.tsx` | presentation | 変更 | 「呼び出し元へ戻す」ボタンの表示条件を `visibility === 'private'` から「呼び出し行を持つ呼び出し元がある(`findCallerOf`)」へ変更 |
| `src/domain/stage/sampleAnswer.ts` | domain | 変更 | `SolutionStep` に `inline` バリアントを追加し `applyStep` に対応を足す |
| `src/infrastructure/stages/intermediateStages.ts` | infrastructure | 変更 | 新ステージ「中級12」を追加し、`intermediateStages` の末尾に並べる |
| `src/infrastructure/stages/middleManStage.test.ts` | infrastructure(test) | 新規 | 新ステージ固有の確認(初期点<100、模範解答100点) |
| `docs/stages/report.md` | docs | 変更 | `npm run stage-report` で再生成する |
| `e2e/refactor.spec.ts` | presentation(e2e) | 変更 | 横流しメソッドを「呼び出し元へ戻す」で戻す操作を追加 |
| `docs/specs/implemented.md` | docs | 変更 | 実装完了後に1行足す(既存の運用に従う) |

## データ/型の変更

```ts
// src/domain/codebase/inlineMethod.ts
export type InlineMethodError = 'method-not-found' | 'call-not-found' | 'multiple-callers';
// 'not-private' は廃止する。
```

```ts
// src/domain/scoring/score.ts
export type ScoreRule = /* 既存 */ | 'thin-class' | 'middle-man' | 'layer';
```

```ts
// src/domain/stage/sampleAnswer.ts(SolutionStep に追加)
| { readonly inline: { readonly method: string; /** 同名メソッドが複数クラスにあるとき */ readonly fromClass?: string } }
```

`Fragment`・`Method`・`CodeClass` など既存の型は変更しない(新しい隠しタグは作らない。「横流し」は `responsibility: 'call'` と `uses` から判定できる)。

## 仕様

### 呼び出し行の判定(`findCallerOf`/`inlineMethod`)

- メソッド M の**呼び出し行** = `responsibility === 'call'` かつ `uses` がちょうど `[M.id]` の処理。Extract Method が作る呼び出し行(`responsibility: 'call'`, `uses: [newMethodId]`)はこの条件を満たすため、既存の動作は変わらない。
- `findCallerOf(codebase, M.id)`: 呼び出し行を持つメソッドを返す(複数あれば最初の1つ。無ければ `undefined`)。
- `inlineMethod(codebase, M.id)`:
  1. M が無い → `method-not-found`
  2. 呼び出し行を持つメソッドが0個 → `call-not-found`
  3. 2個以上 → `multiple-callers`(ponytail: 呼び出し元が複数のInlineは未対応。ステージがその形を要求したとき、全呼び出し元の呼び出し行を置き換える実装にする。IDの重複に注意)
  4. 成立したら、呼び出し元の呼び出し行を M の `fragments` で置き換え、M をクラスから取り除く(既存の挙動)。**可視性は問わない**(public でもよい)。元のCodebaseは変更しない。
- 結果として、`Controller.placeOrder` が `Manager.placeOrder` を呼び、`Manager.placeOrder` が `Service.place` を呼ぶだけ、という形では、`Manager.placeOrder` をInlineすると Controller の呼び出し行が「`Service.place` を呼ぶ行」に置き換わり、Controller → Service の直接呼び出しになる。
- `deleteClass`/`deleteFile` の `inlineBeforeDelete` は `findCallerOf`/`inlineMethod` をそのまま使うので、横流しメソッドを持つクラス/ファイルの削除でも(publicでも)呼び出し元へ戻ってから消える。処理は消えずに呼び出し元へ移るだけなので、削除ガードの趣旨(コードを黙って失わない)は保たれる。

### `findMiddleManClasses(codebase): string[]`(`src/domain/scoring/middleMan.ts`)

次をすべて満たすクラスのIDを返す(横流しだけで価値を足していないクラス)。

- メソッドが1個以上ある
- フィールドが0個
- **すべてのメソッド**が、処理をちょうど1つだけ持ち、その処理が `responsibility === 'call'`・`uses.length === 1`・呼び先メソッドが**別のクラス**にある

複数の呼び出しをまとめる窓口(Facade。処理が2つ以上)や、自分のクラス内を呼ぶだけのメソッドは対象外。`trivial-method`(呼び出し行だけは除外)・`thin-class`(実処理が必要)とは条件が排他的なので重複して数えない。

### 採点(`scoreCodebase`)

- `middle-man` を `counts` と `deductions` の配列に足し、1件10点。ラベルは「横流しするだけのクラス」。

### 新ステージ「中級12: 横流しするだけの OrderManager」

ステージ定義(`intermediate-middle-man`)。`level: 'intermediate'`。

- コードベース(3ファイル、いずれもフィールドなし):
  - `src/order/OrderController.ts` の `OrderController`: `placeOrder`(public: 「リクエストを検証する」http 10行 → 「OrderManager.placeOrder() を呼び出す」call 1行 `uses: [OrderManager.placeOrder]` → 「レスポンスを組み立てる」http 8行)、`cancelOrder`(同様に http 8行・call 1行・http 6行)
  - `src/order/OrderManager.ts` の `OrderManager`: `placeOrder`・`cancelOrder`(ともに public、処理は call 1行だけで `uses` は `OrderService` の対応メソッド)
  - `src/order/OrderService.ts` の `OrderService`: `place`(order-rule: 「在庫を確認する」18行・「送料込みの金額を計算する」22行)、`cancel`(order-rule: 「キャンセルできるか判定し、返金額を計算する」16行)
- `limits: { method: 50, class: 100, file: 300 }`、`dependencyLimit: 2`、`responsibilityLimit: 2`。
- 初期状態は `OrderManager` が `middle-man` に当たり100点にならない(90点)。
- 模範解答(`sampleAnswerSteps`):
  ```ts
  'intermediate-middle-man': [
    { inline: { method: 'placeOrder', fromClass: 'OrderManager' } },
    { inline: { method: 'cancelOrder', fromClass: 'OrderManager' } },
    { deleteFile: 'src/order/OrderManager.ts' },
  ],
  ```
  Inline 後は `OrderManager` が空クラスになるため `empty` 減点が残る。`deleteFile` で消して100点になる。
- `changeRequests`: `order-rule` と `http` の責務を使う2件(例: 「在庫確認のルールを変えて」「レスポンスの形式を変えて」。`linesPerSite` は小さめ)。`allRequestsHaveSites` を満たすこと。
- `learns`: `['Middle Man', 'Inline Method / Inline Class']`、`checks` は2問(例: 「呼び出しを横流しするだけのクラスが、避けたほうがよいと言われるのはなぜ?」「Extract Method / Extract Class と Inline はどう使い分ける?」)。`why`・`description`・`goal` の文言は実装者が既存ステージに倣って書く(振る舞いに影響しないため裁量でよい)。goal には「分けすぎ・横流しだけの層は、戻して消すのも設計の判断」「メソッドエディタの『呼び出し元へ戻す』を使う」旨を入れる。

## TDD対象の純粋関数

### `inlineMethod`(`src/domain/codebase/inlineMethod.ts`)

- 正常系: Extract Method の呼び出し行(`:call`)を持つprivateメソッドを戻せる(既存テストがそのまま通る)
- 正常系: **public** の横流しメソッド(呼び出し元の呼び出し行 `uses: [methodId]`, `responsibility: 'call'`)を戻すと、呼び出し元の呼び出し行が、そのメソッドの fragments に置き換わり、メソッドは消える
- 正常系: 別クラスにあるメソッドも戻せる(呼び出し元は別クラス)
- 異常系: 存在しないメソッドID → `method-not-found`
- 異常系: 呼び出し行を持つメソッドがない → `call-not-found`
- 異常系: `uses` が `[methodId]` を含んでも、`responsibility` が `'call'` でない処理、または `uses` が2つ以上の処理は呼び出し行と見なさない → `call-not-found`(誤爆防止)
- 異常系: 呼び出し行を持つメソッドが2つ以上 → `multiple-callers`
- 元のCodebaseを変更しない

### `findCallerOf`

- 呼び出し行を持つメソッドを返す。呼び出し行がなければ `undefined`。

### `deleteClass` / `deleteFile`

- 提供済みの public な横流しメソッドだけを持つクラス(ファイル)を削除すると、呼び出し元の呼び出し行に処理が戻り、クラス(ファイル)が消える

### `findMiddleManClasses`(`src/domain/scoring/middleMan.ts`)

- 正常系: 他クラスへ呼び出し1行だけを横流しするメソッド1つ・フィールド0のクラス → 返す
- 正常系: そのようなメソッドが複数あるクラス(すべて横流し) → 返す
- 境界: 横流しでないメソッドが1つでも混ざる → 返さない
- 境界: フィールドが1つ以上ある → 返さない
- 境界: 処理が2つ以上のメソッド(複数の呼び出しをまとめる窓口) → 返さない
- 境界: 呼び先が同じクラス内のメソッド → 返さない
- 境界: `uses` が空、または2つ以上の `call` 処理 → 返さない
- 境界: メソッドが0個(空クラス) → 返さない(`findEmptyContainers` の担当)
- 境界: `fragments: []`(インターフェースの契約宣言) → 返さない

### `scoreCodebase`(`score.ts`)

- 横流しだけのクラスが1つあると `middle-man` の減点が10点になる
- 既存の全ステージの模範解答が100点のまま(`stageCatalog.test.ts` の共通テスト。新ルールで減点されないこと)

### `applyStep`(`sampleAnswer.ts`)

- `inline` ステップが名前(+`fromClass`)で指定したメソッドをInlineする。見つからなければ例外(既存ステップと同じ扱い)。

### アプリケーション層

- `inlineMethodUseCase`: public横流しメソッドで成功し、`callerId` が呼び出し元を指す。`describeInlineError` が `multiple-callers` に文言を返す。

## 受け入れ基準

1. 上記の純粋関数について、AAAパターンのユニットテストがあり、`npm run check` が通る。
2. `stageCatalog.test.ts` の共通テストが、既存ステージ+新ステージすべてで通る(模範解答で100点、他)。既存ステージの初期点・模範解答後の点が変わらない。
3. 新ステージの初期点が100未満(`middle-man` 1件で90点)、模範解答で100点。
4. 画面: 新ステージで `OrderManager.placeOrder` を選ぶと「呼び出し元へ戻す」ボタンが表示され、押すと `OrderController.placeOrder` の呼び出し行がなくなり `OrderManager.placeOrder` が消える。採点の内訳に「横流しするだけのクラス」が出る(戻す前)/消える(戻した後)。
5. 画面: ステージの初期状態に存在しない呼び出し行(`call` でない処理)しかないメソッドでは、ボタンが出ない(従来のprivate+`:call` の Extract 由来メソッドでは従来どおり出る)。
6. E2E: 新ステージで2つの横流しメソッドを戻し、`OrderManager` を削除すると100点になる。ドラッグ&ドロップに変更はないが、メソッドエディタの操作変更なので `e2e/` に追加する。
7. `npm run stage-report` で `docs/stages/report.md` を再生成し、差分がコミットに含まれる。
8. `npm run check` と `npm run test:e2e` が通る。

## スコープ外

- Inline Class 専用の操作・ボタン(全メソッドを Inline して `deleteFile`/`deleteClass` で消せるため)。
- 呼び出し元が複数あるメソッドの一括Inline(`multiple-callers` で拒否。必要になったら別仕様)。
- インターフェース実装メソッド・親クラスの宣言を実装するメソッドをInlineしたときの扱いの特別対応(Inline後に `contract` 採点が違反として検出するので追加のガードは作らない)。
- Facade(複数の呼び出しをまとめる窓口)を減点しない設計の境界を試すステージ(IDEAS案2の担当。今回は `middle-man` が Facade を誤検知しないことだけを保証する)。
- 引数・戻り値の受け渡しの表現(このゲームのFragmentはコード本体を持たないため、Inline時の変数のぶつかりなどは扱わない)。
- Inline ドラッグ&ドロップUI(既存のボタンで足りる)。

## 未決事項

なし。操作の範囲・採点・ステージの有無は対話で確定済み。ステージの `why`/`description`/`goal`/`checks` の文言と `changeRequests` の中身は実装者の裁量(振る舞いに影響しない)。
