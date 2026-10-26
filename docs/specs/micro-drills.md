# micro-drills: 1操作で終わる3分ドリルを3本足し、ステージ一覧の「ドリル」区分に出す

## 背景・目的

ステージは全36本ある。ただし、どのステージも模範解答が数手〜十数手ある。100点のあとには理解度チェック・変更依頼まで続く(`post-perfect-flow` / `clear-means-learned`)。
そのため、「抽出だけ」「移動だけ」を短く繰り返して手に馴染ませる場が無い(`docs/specs` に「ドリル」の記載は無い)。

そこで、Extract Method または Move Method の**1操作だけ**で100点になるドリルを3本足す。
3分で終わるよう、理解度チェックと変更依頼は付けない。
ステージ一覧(`StageRoadmapDialog`)には、新しい区分「ドリル」として出す。

本当に新しい仕組みが要るかも確かめた。結論として、ドリル専用の型・画面・保存は要らない。

- 一覧は `Stage.level` ごとに区分を作っている(`StageRoadmapDialog` の `StageLevels`)。`StageLevel` に `'drill'` を1つ足せば、区分の見出しが出る
- クリアの扱いは `clear-means-learned` の `remainingMilestones`(`src/domain/progress/milestones.ts`)をそのまま使う。
  理解度チェック0問・変更依頼0件のステージには残りの段階が無い。そのため100点で `✅ クリア` になり、`conceptMastery` の習得数にも数えられる(どちらも既存のコードのまま)
- ステージ定義は、既存の `tutorialStages.ts` と同じ形のファイルを1つ足すだけで済む

## 変更対象ファイル一覧

| 種別 | パス | 層 | 役割 |
| --- | --- | --- | --- |
| 変更 | `src/domain/stage/Stage.ts` | domain | `StageLevel` に `'drill'` を足す。`checks` / `changeRequests` のコメントに「ドリルは0件」と書き足す |
| 変更 | `src/domain/stage/sampleAnswer.ts` | domain | `sampleAnswerSteps` に、ドリル3本の模範解答(各1手)を足す |
| 新規 | `src/infrastructure/stages/drillStages.ts` | infrastructure | ドリル3本の定義(`drillStages: readonly Stage[]`) |
| 新規 | `src/infrastructure/stages/drillStages.test.ts` | infrastructure | ドリルの決まり(下の TDD対象)を先に書く |
| 変更 | `src/infrastructure/stages/stageCatalog.ts` | infrastructure | `[...tutorialStages, ...beginnerStages, ...intermediateStages, ...advancedStages, ...drillStages]`(ドリルは最後) |
| 変更 | `src/infrastructure/stages/stageCatalog.test.ts` | infrastructure | 下の「既存テストの扱い」のとおり、ドリルの分を直す |
| 変更 | `src/infrastructure/stages/stageReport.ts` | infrastructure | レベルの表・見出し・手数の目安に `drill` を足す。中央値の比較からはドリルを外す |
| 変更 | `src/infrastructure/stages/stageReport.test.ts` | infrastructure | 上の2点のテスト |
| 変更 | `src/infrastructure/story/storyChapters.test.ts` | infrastructure | 「今の全ステージに章がある」から `level === 'drill'` を除く |
| 変更 | `docs/stages/report.md` | (生成物) | `npm run stage-report` で作り直す(手で書かない) |
| 変更 | `src/presentation/stage/levelLabel.ts` | presentation | `drill: 'ドリル'` |
| 変更 | `src/presentation/stage/StagePanel.tsx` | presentation | `ConceptCheckPanel` は `stage.checks.length > 0` のときだけ出す。「変更依頼に挑戦」ボタンは `stage.changeRequests.length > 0` のときだけ出す |
| 変更 | `src/presentation/store/useGameStore.ts` | presentation | `startChangeRequests` は、依頼が0件のステージでは何もしない(上のボタンを消した上での守り) |
| 変更 | `src/presentation/store/useGameStore.test.ts` | presentation | 上のテスト |
| 新規 | `e2e/micro-drills.spec.ts` | E2E | 受け入れ基準1〜5 |
| 変更 | `e2e/roadmap.spec.ts` | E2E | 「学べることごと」のテストの準備に、Extract Method のドリル2本の100点も入れる(下の「既存テストの扱い」) |

application 層・`roadmap.ts`・`milestones.ts`・`progressStorage.ts`・保存形式は変更しない。新しい依存は足さない。

## データ・型の変更

```ts
// src/domain/stage/Stage.ts
/** ステージの区分。ステージ選択ではこの順に並べる。drill は1操作で終わる短い練習(理解度チェック・変更依頼なし)。 */
export type StageLevel = 'tutorial' | 'beginner' | 'intermediate' | 'advanced' | 'drill';
```

```ts
// src/presentation/stage/levelLabel.ts と src/infrastructure/stages/stageReport.ts の LEVEL_LABEL
drill: 'ドリル',
```

```ts
// src/infrastructure/stages/stageReport.ts
/** 難易度の順。中央値の手数が前より少ないかの比較はここだけで行う(ドリルは難易度ではないので比べない)。 */
const DIFFICULTY_LEVELS: readonly StageLevel[] = ['tutorial', 'beginner', 'intermediate', 'advanced'];
const LEVELS: readonly StageLevel[] = [...DIFFICULTY_LEVELS, 'drill'];
const MAX_STEPS: Record<StageLevel, number> = { tutorial: 3, beginner: 8, intermediate: 15, advanced: 25, drill: 1 };
// easierThanPreviousLevels は DIFFICULTY_LEVELS を回す。levelMedians・summaryLines は LEVELS のまま
// warningsOf の「依頼が機能追加だけ」は stage.changeRequests.length > 0 のときだけ判定する(依頼0件のドリルに出さない)
```

### ドリル3本(`src/infrastructure/stages/drillStages.ts`)

共通の決まりは次のとおり。

- `level: 'drill'`、`checks: []`、`changeRequests: []`
- ファイルは1〜2個、処理(Fragment)は合計6個以下
- 模範解答は1手。初期の減点は、その1手で消えるものだけにする
- `classNames` / `methodNames` / `responsibilityNames` は既存ステージと同じく、全責務を覆う(クラス名・メソッド名は自動命名に任せる。プレイヤーに名前を考えさせる・採点する要素は足さない)
- 全 Fragment に `code.csharp` を書き、`lines` をその行数と一致させる(`stageCode.test.ts` の既存の決まり)
- `goal` に書く行数の上限は `limits` と一致させる

下の行数・上限は設計の目安である。実装時に `METHOD_OVERHEAD_LINES` と呼び出し行の行数で数え直し、「初期は下表の減点だけ」「模範解答の1手で100点」「下表の失敗例では100点にならない」が `drillStages.test.ts` で通るように調整してよい。

| ID | タイトル | learns | 題材 | 模範解答(1手) | 初期の減点 | 1手で済まない失敗例(100点にならない) |
| --- | --- | --- | --- | --- | --- | --- |
| `drill-extract-tail` | `ドリル1: 後ろのまとまりを抜き出す` | `['Extract Method']` | `MemberService.registerMember`: 会員をDBに保存する(3行, `persistence`)→ ウェルカムメールの本文を組み立てる(3行, `notification`)→ ウェルカムメールを送る(3行, `notification`)。上限の目安は method 14 / class 30 / file 35、`responsibilityLimit: 2`、`dependencyLimit: 1` | 後ろの2つ(本文・送信)を抽出 | `line-limit` だけ | 送信だけ抽出(元メソッドが上限超えのまま)/保存と本文を抽出(`mixed-method`) |
| `drill-extract-middle` | `ドリル2: 途中のまとまりを抜き出す` | `['Extract Method']` | `InvoiceService.issueInvoice`: 注文を読み込む(2行, `loading`)→ 小計を計算する(3行, `pricing`)→ 税額を計算する(3行, `pricing`)→ 請求書を保存する(2行, `persistence`)。上限の目安は method 14 / class 32 / file 38、`responsibilityLimit: 3`、`dependencyLimit: 1` | 真ん中の2つ(小計・税額)を抽出 | `line-limit` だけ | 小計だけ抽出(上限超えのまま)/読み込みと小計を抽出(`mixed-method`) |
| `drill-move-method` | `ドリル3: メソッドを持ち主のクラスへ移す` | `['Move Method']` | `src/order/OrderService.ts` の `OrderService` に、`placeOrder`(`ordering` の処理2つ)と `calculateShippingFee`(`shipping` の処理1つ, public)がある。`placeOrder` は `calculateShippingFee` を呼ばない。`src/shipping/ShippingCalculator.ts` の `ShippingCalculator` は空(`methods: []`。`roleResponsibilities` は付けない)。`responsibilityLimit: 1`、`dependencyLimit: 1` | `calculateShippingFee` を `ShippingCalculator` へ移動 | `responsibility` と `empty` | 新しいファイル・クラスを足してそこへ移す(`ShippingCalculator` が空のまま `empty` が残る) |

- `problem` は60文字以内で、コード識別子はそのステージのクラス名・メソッド名だけにする。
  例: `registerMemberの後半にメール送信の処理が続いている`
- `description` には、どんなコードかを1〜2文で書く
- `why` は100点の画面に出す1文。例: 「メールの文面を変えるとき、保存の処理を読まずに済みます」
- `goal` には操作をそのまま書く。例: 「メソッドは14行以内に。メールの処理2つを選んで『メソッドとして抽出』しよう」。
  ドリル3は「`calculateShippingFee` を ShippingCalculator へドラッグで移そう」
- `drill-move-method` に `roleResponsibilities` を付けないのは、`stageCatalog.test.ts` の「役割タグを付けた全クラスは9個」を変えないため。
  移動で消す減点は、責務の混在(`responsibility`)と空のクラス(`empty`)にする(チュートリアル2と同じ仕組み)

```ts
// src/domain/stage/sampleAnswer.ts の sampleAnswerSteps に足す
'drill-extract-tail': [{ extract: { from: 'registerMember', fragmentIds: ['<本文のID>', '<送信のID>'], name: '<methodNames の notification>' } }],
'drill-extract-middle': [{ extract: { from: 'issueInvoice', fragmentIds: ['<小計のID>', '<税額のID>'], name: '<methodNames の pricing>' } }],
'drill-move-method': [{ move: { method: 'calculateShippingFee', toClass: 'ShippingCalculator' } }],
```

## 動きの仕様

### ステージ一覧

- 一覧の「ステージ順」で、上級の下に見出し `ドリル` の区分が出て、ドリル1〜3のカードが並ぶ。
  カードの中身(タイトル・学べることのタグ・状態)は既存のカードと同じ
- 状態は既存の `stageStatus` のまま。ドリルは残りの段階が無いので、100点で `✅ クリア` になる。
  `100点(あと: …)` は出ない
- 「次のおすすめ」(`recommendNextStage`)は並び順で決まる。ドリルは最後に並ぶので、本編の未クリアのステージが先におすすめされる(既存のまま)
- 「学べることごと」では、Extract Method の件数にドリル1・2が、Move Method の件数にドリル3が加わる。100点で、クリアした数に数える(既存の `conceptMastery` のまま)

### ドリルを遊んでいるとき

- 理解度チェックの欄(`ConceptCheckPanel`)は出さない(`stage.checks.length === 0`)
- ツールバーの「変更依頼に挑戦」ボタン(`data-testid="change-request-start"`)は出さない(`stage.changeRequests.length === 0`)。
  `startChangeRequests` を呼ばれても、`changeSession` は `null` のまま
- 変更の痛みカード・手直し・噂は、依頼が0件だと既存のコードが何も出さない(`ChangePainCard` / `ManualFixPanel` / `RumorPopover` / `OpeningFixBanner`)。変更は要らない
- ストーリーの章は無い。そのため `StoryIntro` / `StoryOutro` は出ず、100点では `NextStageCard` が見出し `ステージクリア` で出る(ストーリーのオン・オフどちらでも)
- ヒント・解答例の再生・取り消し・最初に戻す・下書きの保存は、既存ステージと同じく使える

## 設計判断(確定)

1. **ドリルは `Stage` のまま、`level: 'drill'` で区別する。** 専用の型や画面を作らず、一覧の区分・採点・保存を既存のまま使う。
   `StageLevel` は「難易度」から「区分」に意味が少し広がる。そのため、型のコメントを直す。
2. **ドリルには理解度チェックも変更依頼も付けない(0件)。** 「3分・1操作」を守るためである。
   `clear-means-learned` の `remainingMilestones` は0件の段階を求めないので、100点がそのまま `✅ クリア` と習得数になる。
   一覧(`stageStatus`)と習得数(`conceptMastery` は `isStageCleared` = 100点)の判定もずれない。
3. **ドリルはカタログの最後に並べる。** 先頭や初級の前に置くと、`recommendNextStage` が本編より先にドリルを勧め、初めての人の流れ(チュートリアル → 初級)を変えてしまう。
4. **3本の内訳は、Extract Method 2本(後ろのまとまり/途中のまとまり)と Move Method 1本にする。**
   抽出は「どこからどこまで選ぶか」が操作の要点なので、選ぶ位置の違う2本にする。
   移動はドラッグ先を選ぶだけなので1本で足りる。
5. **ステージカタログの既存テストのうち、「理解度チェック2〜3問」「依頼2件以上」「模範解答で変更コストが下がる」と、ストーリーの「全ステージに章がある」はドリルを除いて回す。**
   ほかの全ステージ共通の決まり(ID重複なし・初期に減点がある・模範解答で100点・振る舞いのテストが緑・命名表・コード表示)は、ドリルにもそのまま課す。
6. **レポートの「中央値の手数が前のレベルより少ない」の比較からドリルを外す。** ドリルは1手なので、比べると必ず警告が出てしまう。
   ドリルは難易度の段ではないため、比較から外す。

## 既存テストの扱い

| テスト | 直し方 |
| --- | --- |
| `stageCatalog.test.ts` 「チュートリアル・初級・中級・上級の順に…」 | 期待値を `['tutorial', 'beginner', 'intermediate', 'advanced', 'drill']` にし、名前にドリルを足す |
| 同 「初期違反の種類」の `it.each` | ドリル3本の行を足す(`line-limit` / `line-limit` / `responsibility`+`empty`) |
| 同 「理解度チェックが2〜3問」「IDが重複せず、正解の位置が…」「解説は正誤を書かない」 | `checkTargets` からドリルを除く(白紙設計の分はそのまま) |
| 同 `describe.each` 内の「依頼が2件以上あり…」「模範解答にすると、変更依頼のコストが…下がる」 | `stage.level === 'drill'` なら代わりに `expect(stage.changeRequests).toEqual([])` を確かめる |
| `storyChapters.test.ts` 「今の全ステージに章がある」 | `level === 'drill'` を除く(「章の並びが stages の並びと同じ順」はそのまま通る) |
| `e2e/roadmap.spec.ts` 「学べることごとの表示で…」 | 準備の `refactor-blocks:progress` に `drill-extract-tail` と `drill-extract-middle` の100を足し、Extract Method の行の期待を `4件中4件クリア` にする(`✅ すべてクリア` の確認は残す) |
| `stageReport.test.ts` の `docs/stages/report.md` スナップショット | `npm run stage-report` で作り直す |

## TDD対象

### `drillStages.test.ts`(infrastructure。ステージ定義の決まり)

- `stages` のうち `level === 'drill'` は3本で、カタログの最後に連続して並ぶ
- どのドリルも `checks` と `changeRequests` が空で、`learns` は `['Extract Method']` か `['Move Method']` のどちらか
- どのドリルも `sampleAnswerSteps[id]` がちょうど1手で、その手は `extract` か `move`
- どのドリルも初期は100点未満で、模範解答の1手を当てると `scoreCodebase(...).total === 100`
- 処理(Fragment)は合計6個以下、ファイルは2個以下
- 上の表の「失敗例」の手順では100点にならない(1本につき1〜2件。`stageCatalog.test.ts` の `shortcuts` と同じ書き方)
- `remainingMilestones(drill, {})` が `[]`(=100点で `✅ クリア` になる)

### `stageReport`(infrastructure)

- 手数1のドリルを上級の後ろに並べても、どの行にも「レベルの中央値の手数が前のレベルより少ない」が付かない
- 依頼0件のステージには「依頼が機能追加だけ」が付かない。依頼がありルール変更が0件のステージには、今どおり付く
- 集計表に `ドリル` の行が出る

### ストア(`useGameStore.test.ts`)

- 依頼0件のステージで100点にして `startChangeRequests()` を呼んでも、`changeSession` は `null` のまま

## 受け入れ基準

1. `localStorage` をまっさらにして開き、ステージ一覧を開く。上級の下に見出し `ドリル` があり、`ドリル1: 後ろのまとまりを抜き出す`・`ドリル2: 途中のまとまりを抜き出す`・`ドリル3: メソッドを持ち主のクラスへ移す` の3枚が `未挑戦` で並ぶ。
   「次のおすすめ」はチュートリアル1のまま
2. ドリル1を選び、`registerMember` をクリックする。後ろの2つの処理を選んで「選んだ処理をメソッドとして抽出」を1回押すと `100点` になる。
   理解度チェックの欄と「変更依頼に挑戦」ボタンは出ない。左パネルに見出し `ステージクリア` のカードが出る
3. 続けてステージ一覧を開くと、ドリル1は `✅ クリア` になっている。「学べることごと」の Extract Method の行は、クリアの件数が1増えている。
   再読み込みしても `✅ クリア` のまま
4. ドリル2で真ん中の2つを1回抽出すると100点になる。真ん中の1つだけを抽出したときは100点にならない
5. ドリル3で `calculateShippingFee` を `ShippingCalculator` のクラスへドラッグで1回移すと100点になる(dnd-kit の操作。E2E で守る)
6. 既存のステージ(チュートリアル1など)では、今までどおり理解度チェックの欄と「変更依頼に挑戦」ボタンが出る
7. `npm run stage-report` で作り直した `docs/stages/report.md` に、ドリル3本の行と集計の `ドリル` 行があり、ドリルの行に警告が無い
8. `npm run check` と `npm run test:e2e` が通る

## スコープ外

- ドリル専用の制限時間・タイマー・連続挑戦(次のドリルへ自動で進む)・回数の記録
- ドリルの数を増やすこと、Extract / Move 以外の操作(統合・フィールド移動・可視性・継承など)のドリル
- ドリル用のストーリーの章、理解度チェック、変更依頼
- 「次のおすすめ」や100点のカードで、次のドリルを優先して勧めること(並び順のまま)
- ドリルを本編の途中(チュートリアルの後など)に差し込むこと
- 白紙設計モード・設計比較クイズへの影響(変更しない)
- クラス名・メソッド名をプレイヤーに付けさせる・採点する要素
