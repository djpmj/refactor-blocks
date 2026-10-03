# 白紙設計モード

## 背景・目的

今のステージは、どれも「わざと設計が悪いコード」を渡して直させる形式になっている。悪い設計を見分けて直す力は
鍛えられるが、実務のもう半分である**白紙の状態から要求を読んでクラス構成を決める**力は鍛えられない。

そこで、既存コードを見せない別モード「白紙設計」を追加する。プレイヤーには要求文と、要求を実現する
**処理の部品**(メソッド)だけを渡す。プレイヤーはクラスを作り、どの部品をどのクラスに置くかを決める。
答え合わせでは、プレイヤーの設計と模範解答の設計に**同じ採点ルールと同じ変更依頼**を当てて、点数を並べて見せる。

**ponytail**:

- 新しい操作UIは作らない。今のキャンバスは「部品を余白へドラッグすると新しいクラスができる」
  (`moveMethodToNewClass`)、「部品を別のクラスへドラッグ」(`moveMethod`)、右クリックでのクラス追加・名前の変更・削除、
  取り消し、をすでに持っている。白紙設計は「全部品が1つの**部品置き場**に入ったコードベース」から始めるだけで、
  この操作がそのまま使える
- 問題データは `Stage` 型をそのまま使う(`level` を含む)。ストアとキャンバスが `Stage` 前提で書かれているので、
  別の型を作るとストアとキャンバスを両方書き直すことになる。**ステージ一覧(`stageCatalog`)・ステージ選択・進捗には入れない**
  ので、プレイヤーから見て既存ステージと混ざることはない
- 採点は `scoreCodebase`、変更依頼の判定は `measureChange` / `scoreChange` / `averageScore` をそのまま使う。
  模範解答は既存の `SolutionStep` / `applySolutionSteps` で書く
- 模範解答との「形の一致度」(同じ部品が同じクラスに入っているか)は作らない。設計の正解は1つではないので、
  一致度で減点すると別解を不当に減点するため。同じ採点ルールで数値を並べれば比較には足りる

## 変更対象ファイル一覧

| パス | 層 | 新規/変更 | 役割 |
| --- | --- | --- | --- |
| `src/domain/blank/BlankDesignProblem.ts` | domain | 新規 | 白紙設計の問題の型 |
| `src/domain/blank/tray.ts` | domain | 新規 | 部品置き場を作る・取り除く・未配置の部品を探す純粋関数 |
| `src/domain/blank/tray.test.ts` | domain | 新規 | 上記のテスト |
| `src/domain/blank/reviewBlankDesign.ts` | domain | 新規 | 答え合わせ(プレイヤーと模範解答を同じルールで採点する)純粋関数 |
| `src/domain/blank/reviewBlankDesign.test.ts` | domain | 新規 | 上記のテスト |
| `src/infrastructure/blankDesigns/blankDesignProblems.ts` | infrastructure | 新規 | 問題の一覧(1問) |
| `src/infrastructure/blankDesigns/blankDesignProblems.test.ts` | infrastructure | 新規 | 全問題の模範解答が100点になること等のテスト |
| `src/presentation/store/useGameStore.ts` | presentation | 変更 | ストアを `createGameStore(stages)` で複数作れるようにし、Reactのcontextで切り替える(下記) |
| `src/presentation/canvas/CanvasContextMenu.tsx` | presentation | 変更 | `useGameStore.getState()` を `useGameStoreApi().getState()` に置き換える |
| `src/presentation/useUndoRedoShortcut.ts` | presentation | 変更 | `useGameStore.getState()` を `useGameStoreApi().getState()` に置き換える(引数は変えない) |
| `src/presentation/stage/describeScore.ts` | presentation | 新規 | `StagePanel.tsx` の `RULE_LABEL` と `describeScore` を移す(白紙設計の答え合わせでも使うため) |
| `src/presentation/stage/StagePanel.tsx` | presentation | 変更 | 上記を import する(見た目は変えない) |
| `src/presentation/blank/BlankDesignView.tsx` | presentation | 新規 | 白紙設計モードの画面全体。白紙設計用のストアを Provider で渡す |
| `src/presentation/blank/BlankDesignPanel.tsx` | presentation | 新規 | 上部の要求文・未配置の数・答え合わせボタン |
| `src/presentation/blank/BlankDesignResultPanel.tsx` | presentation | 新規 | 答え合わせの結果(サイドパネル) |
| `src/presentation/App.tsx` | presentation | 変更 | モードに「白紙設計」を足す。取り消しショートカットの呼び出しを各ビューの中へ移す |
| `src/index.css` | presentation | 変更 | 必要なら結果パネルのスタイルを足す(既存の `app__body` / `app__canvas` / `stage-panel` を使い回し、足す量は最小にする) |
| `e2e/blank.spec.ts` | — | 新規 | E2Eテスト |

application 層にはユースケースを作らない。答え合わせは副作用のない domain の純粋関数1つで済み、
presentation が domain を直接呼ぶ既存の書き方(設計くらべの `judgeComparison`、`StagePanel` の `scoreCodebase`)に合わせる。
部品の配置などの編集は、既存の `RefactorUseCases` をストア経由でそのまま使う。

## データ/型の変更

### 問題の型

```ts
// src/domain/blank/BlankDesignProblem.ts
import type { SolutionStep } from '../stage/sampleAnswer';
import type { Stage } from '../stage/Stage';

/**
 * 白紙設計の問題。Stage の各項目は次の意味で使う。
 * - description: 要求文(何を作るか。どこが変わりやすいかもここでほのめかす)
 * - goal: 行数・責務・依存の上限と「全部品を配置しよう」
 * - codebase: 部品置き場だけのコードベース(trayCodebase で作る)
 * - changeRequests: 答え合わせで当てる変更依頼。遊んでいる間は見せない
 */
export type BlankDesignProblem = Stage & {
  /** 模範解答。codebase(部品置き場だけの状態)から適用する手順。部品置き場のファイルは残したままでよい。 */
  readonly modelAnswer: readonly SolutionStep[];
  /** 答え合わせで出す、模範解答の狙い(1〜3文)。 */
  readonly explanation: string;
};
```

### 部品置き場

```ts
// src/domain/blank/tray.ts
export const TRAY_FILE_ID = 'file-blank-tray';

/** 全部品を1つのクラスに入れた、部品置き場だけのコードベース。ファイルのパスとクラス名は「部品置き場」。 */
export function trayCodebase(parts: readonly Method[]): Codebase;

/** 部品置き場のファイルを取り除いたコードベース。採点の前に使う(空になった部品置き場を「空の入れ物」で減点しないため)。 */
export function withoutTray(codebase: Codebase): Codebase;

/**
 * まだ配置されていない部品の名前を、initial での並び順で返す。
 * 部品 = initial の全メソッド。部品の Fragment がひとつでも withoutTray(current) に見つからなければ未配置とする
 * (部品置き場に残っている・クラスごと削除した、のどちらも未配置になる。Extract Method で分けても Fragment のIDは残るので配置済み)。
 */
export function findUnplacedParts(initial: Codebase, current: Codebase): string[];
```

- 部品置き場は `TRAY_FILE_ID` のファイルで判定する。プレイヤーが部品置き場のファイルにクラスを足して部品を置いても未配置扱い
  (「部品置き場のファイルの中にあるものは未配置」という1つの規則にする)
- 部品置き場の**クラス**をほかのファイルへ移した場合、それは普通のクラスとして扱う(特別扱いしない)

### 答え合わせ

```ts
// src/domain/blank/reviewBlankDesign.ts
export type DesignReview = {
  /** 採点したコードベース(部品置き場を取り除いたもの)。減点理由のクラス名・メソッド名の表示に使う。 */
  readonly codebase: Codebase;
  readonly score: Score;
  /** problem.changeRequests と同じ順。調査の減点はなし(scoreChange の第2引数は省略)。 */
  readonly changes: readonly ChangeAssessment[];
  /** changes の点数の平均(averageScore)。 */
  readonly changeScore: number;
};

export type BlankDesignReview = { readonly player: DesignReview; readonly model: DesignReview };

export type ReviewError = 'unplaced-parts' | ChangeError;

/** 模範解答を適用して部品置き場を取り除いたコードベース。「模範解答の図」にも使う。 */
export function modelAnswerCodebase(problem: BlankDesignProblem): Codebase;

export function reviewBlankDesign(problem: BlankDesignProblem, codebase: Codebase): Result<BlankDesignReview, ReviewError>;
```

- `findUnplacedParts(problem.codebase, codebase)` が空でなければ `err('unplaced-parts')`
- プレイヤー側・模範解答側とも `withoutTray` したコードベースに `scoreCodebase(design, problem)` と、各変更依頼の
  `measureChange(design, request, problem.limits)` → `scoreChange(impact)` を当てる。`measureChange` が失敗したらそのエラーを返す
- `modelAnswerCodebase` は `withoutTray(applySolutionSteps(problem.codebase, problem.modelAnswer))`。
  模範解答は信頼できるデータなので、適用に失敗したら `applySolutionSteps` の例外のままでよい(infrastructure のテストで検出する)

### ストア(`useGameStore.ts`)

白紙設計のキャンバスは、リファクタリングのキャンバスと**別の状態**(コードベース・取り消し履歴・選択中のメソッド)を持つ必要がある。
キャンバス・クラスノード・メソッドチップ・右クリックメニュー・メソッドエディタは `useGameStore(selector)` で状態を読んでいるので、
呼び出し側を変えずにストアを差し替えられるよう、Zustand の vanilla store と React の context に切り替える。

```ts
export type GameStore = StoreApi<GameState>;

/** stages の先頭のステージから始まるストアを作る。selectStage も引数の stages から探す。 */
export function createGameStore(stages: readonly Stage[]): GameStore;

/** 既定値はリファクタリング用のストア(stageCatalog の stages で作る)。Provider がない所では今まで通りこれを使う。 */
export const GameStoreContext: Context<GameStore>;

export function useGameStoreApi(): GameStore;
export function useGameStore<T>(selector: (state: GameState) => T): T; // useStore(useGameStoreApi(), selector)
```

- 今の `create<GameState>(...)` の中身を `createStore<GameState>(...)`(`zustand` の vanilla API)で作る関数に移す。
  **`selectStage` が今はモジュールの `stages` を直接見ている(`selectStageState(stages, stageId)`)ので、引数の stages を使うように直す**
- リファクタリングの画面は Provider なしで既定のストアを使うので、既存コンポーネントのコードは `getState()` を使う3か所以外は変わらない
- `CanvasContextMenu` の `menuItemsFor` はコンポーネントの外の関数なので、呼び出し側で `useGameStoreApi()` を取り、
  必要なアクションを引数で渡す
- 白紙設計のストアは `BlankDesignView.tsx` のモジュールの定数として `createGameStore(blankDesignProblems)` で1つ作る(export しない)。
  `progress` / `recordProgress` / `critique` / `changeSession` もストアには入るが、白紙設計の画面からは呼ばない
  (進捗に白紙設計の問題IDが混ざらないようにするため、`StagePanel` と `CritiquePanel` は白紙設計の画面に置かない)

## TDD対象の純粋関数

テスト用の小さな部品(3つ程度。責務はすべて別、1つが別の部品を `uses` で呼ぶ)をテストファイル内で作る。

### `tray.ts`(`tray.test.ts`)

- `trayCodebase`: ファイルが1つ(ID は `TRAY_FILE_ID`、パスは「部品置き場」)、その中にクラスが1つ(名前は「部品置き場」)、
  メソッドは渡した部品と同じ並び
- `withoutTray`: 部品置き場のファイルだけが消え、ほかのファイルはそのまま残る
- `withoutTray`: 部品置き場のファイルがないコードベースなら、同じ内容を返す
- `findUnplacedParts`: 初期状態なら全部品の名前を返す
- `findUnplacedParts`: 1つを別ファイルのクラスへ移すと、残りの部品の名前だけを返す
- `findUnplacedParts`: 全部品を移すと空配列を返す(部品置き場の空のクラス・ファイルが残っていてもよい)
- `findUnplacedParts`: 部品を移したクラスを削除すると、その部品が未配置に戻る
- `findUnplacedParts`: 部品置き場のファイルに足したクラスへ部品を移しても、未配置のまま
- `findUnplacedParts`: 配置済みの部品から Extract Method しても、配置済みのまま(Fragment が複数ある部品で確かめる)

### `reviewBlankDesign.ts`(`reviewBlankDesign.test.ts`)

- 正常系: 全部品を配置したコードベースで `ok`。`player.score` は `scoreCodebase(withoutTray(codebase), problem)` と一致する
- 正常系: 部品置き場の空のクラス・ファイルが残っていても、`player.score` の `empty` の減点は0
- 正常系: `player.changes` / `model.changes` は変更依頼と同じ数・同じ順で、`changeScore` はその平均
- 正常系: `player.codebase` / `model.codebase` に部品置き場のファイルがない
- 正常系: 部品を全部1クラスに入れた設計より、責務ごとに分けた模範解答のほうが `score.total` が高い
- 異常系: 部品が部品置き場に残っていると `err('unplaced-parts')`
- 異常系: どの部品も持たない責務の変更依頼があると `err('no-sites')`
- `modelAnswerCodebase`: 模範解答の手順を適用し、部品置き場を取り除いたコードベースを返す

### `blankDesignProblems.test.ts`(全問題に `describe.each`)

- 問題IDは重複しない
- `codebase` は部品置き場だけ(ファイル1つ、ID が `TRAY_FILE_ID`)。白紙から始まることを固定する
- `findUnplacedParts(problem.codebase, modelAnswerCodebase(problem))` が空(模範解答が全部品を配置している)
- `reviewBlankDesign(problem, modelAnswerCodebase(problem))` が `ok` で、`model.score.total` が100
- `blank-order-shipping` だけ: 「注文と発送」という**機能ごとに分けた設計**(下記の手順をテストファイル内に書く)は、
  模範解答より `score.total` も `changeScore` も低い。この問題が教えたいこと(変わる理由ごとに分ける)をテストで固定する

## 問題の一覧(`blankDesignProblems.ts`)

v1 は1問だけ。2問目を足すときに、問題の選択欄を足す(1問では選ぶものがないので今は作らない)。

### 白紙1: 注文と発送(`blank-order-shipping`)

- `level: 'beginner'`、`title: '白紙1: 注文と発送'`
- `description`(要求文):
  「ネットショップの注文と発送の機能を、白紙から設計する。お客さんが注文を確定したら、注文金額に消費税を足し、注文をDBに保存して、
  注文確認メールを送る。倉庫が商品を発送したら、発送状況をDBに記録して、発送完了メールを送る。
  なお、消費税は軽減税率への対応が近いうちに入る予定。メールには、全通共通の文言の追加がよく頼まれる。」
- `goal`: 「部品置き場の7つの部品を、すべて自分で作ったクラスに配置しよう。メソッドは40行・クラスは80行以内、
  1クラスの責務は1種類、依存先は3クラスまで」
- `limits: { method: 40, class: 80, file: 200 }`、`dependencyLimit: 3`、`responsibilityLimit: 1`(`visibilityEnforced` は省略)
- 部品(すべて `public`、処理は1つずつ。ID は `method-blank-*` / `frag-blank-*` の形にする)

| 部品(メソッド名) | 処理のラベル | 行数 | responsibility | uses |
| --- | --- | --- | --- | --- |
| `placeOrder` | 注文を受け付け、税の計算・保存・確認メールを順に呼ぶ | 10 | `order-flow` | `calculateOrderTax`, `saveOrder`, `sendOrderConfirmMail` |
| `shipOrder` | 発送を受け付け、発送状況の記録・発送メールを順に呼ぶ | 10 | `order-flow` | `updateShippingStatus`, `sendShippedMail` |
| `calculateOrderTax` | 注文金額に消費税を足す | 18 | `tax` | — |
| `saveOrder` | 注文をDBに保存する | 20 | `persistence` | — |
| `updateShippingStatus` | 発送状況をDBに記録する | 16 | `persistence` | — |
| `sendOrderConfirmMail` | 注文確認メールを送る | 20 | `notification` | — |
| `sendShippedMail` | 発送完了メールを送る | 18 | `notification` | — |

- `changeRequests`
  - `req-blank-mail-footer`: 「メールに配信停止の案内を付けて」/ 送るメールすべての末尾に配信停止の案内を入れる / `notification` / `linesPerSite: 5`
  - `req-blank-reduced-tax`: 「軽減税率に対応して」/ 食品は8%、それ以外は10%で計算する / `tax` / `linesPerSite: 20`
- `modelAnswer`(部品置き場から):
  `addFile` で `src/order/OrderService.ts` / `src/order/TaxCalculator.ts` / `src/order/OrderRepository.ts` / `src/mail/OrderMailer.ts` を作り、
  それぞれに同名のクラスを `addClass` し、次のように `move` する
  - `OrderService`: `placeOrder`, `shipOrder`(20行。依存先は TaxCalculator・OrderRepository・OrderMailer の3つ)
  - `TaxCalculator`: `calculateOrderTax`(18行)
  - `OrderRepository`: `saveOrder`, `updateShippingStatus`(36行)
  - `OrderMailer`: `sendOrderConfirmMail`, `sendShippedMail`(38行)
- `explanation`: 「"注文"と"発送"という機能の流れで分けると、メールやDBの処理が両方のクラスに散らばり、メール共通の変更で2クラスを直すことになる。
  変わる理由(税・保存・メール)ごとにクラスを分け、流れを組み立てる OrderService から呼ぶ形にすると、1つの変更が1つのクラスに収まる。
  模範解答と同じ形でなくても、点数が同じなら同じくらい良い設計。」

期待される数値(実装時に`reviewBlankDesign`で実測。以下は実測値。仕様検討時の見積もりとは、機能ごとに分けた設計のメール依頼が
実際には行数の上限超えも重なり90点ではなく80点になった点、それに伴い変更のしやすさが90点ではなく85点になった点がずれていた):

| 設計 | 設計スコア | メール依頼 | 軽減税率依頼 | 変更のしやすさ |
| --- | --- | --- | --- | --- |
| 模範解答 | 100 | 95(波及: OrderService) | 95(波及: OrderService) | 95 |
| 機能ごとに分けた設計(テスト用) | 80(責務の混在×2) | 80(散らばり + 上限超え: OrderServiceが83行 > 80行) | 90(上限超え: 68+20 > 80) | 85 |

機能ごとに分けた設計の手順(テストファイル内だけに書く): `src/order/OrderService.ts` に `OrderService`(`placeOrder`, `calculateOrderTax`,
`saveOrder`, `sendOrderConfirmMail`)、`src/shipping/ShippingService.ts` に `ShippingService`(`shipOrder`, `updateShippingStatus`, `sendShippedMail`)。

## 画面

- `App` のモード切り替えに「白紙設計」(`data-testid="mode-blank"`)を足す。並びは「リファクタリング」「設計くらべ」「白紙設計」
- 白紙設計の画面は、設計くらべと同じく**初めて開いたときにマウント**し、以後は `hidden` で隠す(配置・履歴・ファイルの位置を残す。
  見えないまま fitView が走ると表示がずれるため)
- 取り消しショートカット: `useUndoRedoShortcut(active)` を `App` から `RefactorView` と `BlankDesignView` の中へ移す。
  それぞれ自分のストアの undo/redo を呼び、隠れている間は無効
- `BlankDesignView({ active })`(`data-testid="blank-view"`)
  - `GameStoreContext.Provider` で白紙設計のストアを渡し、その中に次を並べる。レイアウトは `RefactorView` と同じ
    (上に `BlankDesignPanel`、下に `app__body` でキャンバスとサイドパネル)
  - キャンバスは既存の `CodebaseCanvas active={active}` をそのまま使う
  - サイドパネルは、答え合わせを開いている間は `BlankDesignResultPanel`、それ以外は既存の `MethodEditor`
    (部品をクリックすると、その処理のラベルと行数が見られる)
- `BlankDesignPanel`
  - 問題の title(見出し)、description(要求文、`data-testid="blank-requirement"`)、goal
  - 操作の案内を1行:「部品をキャンバスの空いている所へドラッグすると新しいクラスができる。右クリックでクラス名の変更やクラスの追加ができる」
  - 未配置の数(`data-testid="blank-unplaced"`、`aria-live="polite"`): 「部品置き場に残っている部品: あとN個」/ 0個なら「全部品を配置しました」
  - 「答え合わせ」ボタン(`data-testid="blank-review"`)。未配置が1個以上なら無効(理由は上の未配置の表示で文字で伝わる)
  - 「元に戻す」「やり直し」「最初に戻す」(既存ストアの `undo` / `redo` / `resetStage`)
  - 変更依頼は遊んでいる間は見せない(要求文から「変わりそうな所」を読むのがこのモードの練習なので)
- `BlankDesignResultPanel`(`data-testid="blank-result"`)
  - 開いている間は、今のコードベースで `reviewBlankDesign` を計算し直して表示する(配置を変えると結果も変わる)。
    部品を未配置に戻したら「部品置き場に部品が残っています」とだけ出す
  - 開いたら見出しへフォーカスを移す。「閉じる」(`data-testid="blank-result-close"`)で閉じたら「答え合わせ」ボタンへフォーカスを戻す
  - 設計スコア: 「あなたの設計」「模範解答」を並べ、`describeScore` の文言(減点の内訳付き)で出す
    (`data-testid="blank-score-player"` / `blank-score-model`)
  - 変更のしやすさ: 両者の `changeScore`
  - 変更依頼ごと(`data-testid="blank-change-<依頼ID>"`): 依頼の title・description、両者それぞれの点数・
    「変更が必要: メソッド名(◯クラス・◯ファイル・+◯行)」・減点理由。既存の `siteNames` / `describeDeductions` に
    `DesignReview.changes[i]` と `DesignReview.codebase` を渡す
  - `explanation`
  - 「模範解答の図を見る」ボタン → 既存の `CodebasePreviewDialog`(`codebase` は `review.model.codebase`)

## 受け入れ基準

- `npm run check` が通る
- `tray.test.ts` / `reviewBlankDesign.test.ts` / `blankDesignProblems.test.ts` が上記のケースを持ち、通る。
  `vite.config.ts` のカバレッジ閾値を下回らない
- `e2e/blank.spec.ts`(白紙設計の画面の要素は `page.getByTestId('blank-view')` の中で探す。リファクタリングの画面にも
  `class-OrderService` などの同じ testid が出ることがあるため):
  - 「白紙設計」に切り替えると、要求文と、部品置き場に7つの部品が表示され、「答え合わせ」は押せない
  - 部品を1つキャンバスの空いている所へドラッグすると、新しいクラス(`NewClass`)にその部品が入り、未配置が「あと6個」になる
  - 全部品を配置すると「答え合わせ」が押せ、押すと `blank-result` に両者の設計スコアと2件の変更依頼の結果が出る。
    「模範解答の図を見る」で `OrderMailer` を含む図が開く
  - 白紙設計で部品を動かしてから Ctrl+Z すると白紙設計の操作だけが戻る。リファクタリングに切り替えて Ctrl+Z しても、
    白紙設計の配置は変わらない(ストアが別であること)
  - リファクタリングで操作 → 白紙設計で操作 → リファクタリングに戻ると、リファクタリングのコードベースがそのまま残っている。
    白紙設計に戻ると配置も残っている
  - キーボードだけで、モードの切り替え・答え合わせ・結果を閉じる操作ができる(配置はマウスで済ませてからでよい)
- 既存の E2E(`refactor.spec.ts` / `quiz.spec.ts` / `preview.spec.ts` / `critique.spec.ts`)が通る
  (ストアを context に変えた影響がない)
- ステージ選択の一覧に白紙設計の問題が出ない。白紙設計で遊んでも進捗(localStorage)に白紙設計の問題IDが書かれない

## スコープ外

- 2問目以降の問題と、問題の選択欄(2問目を足すときに作る)
- 白紙設計の結果の保存(localStorage)とクリア表示
- 模範解答との形の一致度による採点(理由は背景・目的を参照)
- 変更依頼の「調査」(変更が必要なメソッドをプレイヤーに選ばせる流れ)。答え合わせでは依頼を自動で当てるだけにする
- AI講評を白紙設計で使うこと
- 部品そのものをプレイヤーが新しく作る機能(メソッドの新規作成・名前の変更)。責務の隠しタグを持たない部品は採点できないため
- 部品置き場のファイルに出る減点の印(⚠️)を消すこと。`FileNode` に白紙設計用の分岐が要る。遊んでみて邪魔なら足す
- キャンバス操作(ドラッグ・右クリックメニュー)のキーボード対応の拡充。既存のリファクタリングと同じ水準のまま(別タスクで両モードまとめて直す)
- public / private・継承を問題に使うこと(v1の部品はすべて public、`visibilityEnforced` なし)

## 未決事項

実装はこの仕様の既定どおりに進めてよい。以下は遊んでもらってから見直す点。

- **`Stage` 型の流用**: 依頼は「既存ステージ形式に混ぜない」だったが、型は `Stage` を流用し、一覧・選択・進捗を分けることで
  「混ぜない」を満たす判断にした。別の型に分けたい場合は、ストアとキャンバスを `Stage` 以外でも動くように直す別作業になる
- **変更依頼を事前に見せるか**: v1 は要求文でほのめかすだけにし、答え合わせで初めて出す。難しすぎるようなら、
  問題の画面に「今後来そうな変更」として依頼の title だけを出す案がある
- **答え合わせを開いたまま結果が変わること**: v1 は開いている間ずっと計算し直す(試行錯誤しやすいため)。
  模範解答を見てから写すだけになるようなら、答え合わせ後は編集できなくする案がある
