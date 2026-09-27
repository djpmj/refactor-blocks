# 仕様草案: ステージの採点の上限値を、ステージデータから組み立てて一覧で見せる

- slug: `stage-rules-summary`
- 元: `docs/pipeline/stage-rules-summary/01-discovered.md`

## 1. 背景・目的

- リファクタリング画面では、採点に使う上限値のうち `dependencyLimit`・`responsibilityLimit`・`visibilityEnforced` がどこにも出ない。
  行数(`limits`)も、行数のバッジが上限を超えると赤くなるだけで、上限の数字は出ない。
  プレイヤーが数字を知る手段は手書きの `goal` だけで、書かれていないステージが多い(01 の表を参照)。
  そのため「結合度 -10」と出ても、何本まで減らせばよいかが分からない。
- 設計くらべクイズは、すでに `limits` から「行数の上限: メソッド◯行・クラス◯行・ファイル◯行」を組み立てて出している
  (`src/presentation/quiz/ComparisonQuizView.tsx` 88〜90行目)。今回は同じ考え方をリファクタリング画面に広げる。
  あわせて、依存先・責務・アクセス制御の上限も出す。
- ステージデータから組み立てるので、今後マージされるステージ(`template-method-stage`・`inline-method-stage`・`utils-class-split-stage`)にも、
  何も書かずに同じ表示が付く。

### 調査で分かったこと

- **上限の意味(「〜まで」と書いてよいか)**: どの判定も「上限を**超えたら**減点」である。そのため、表示はすべて「◯まで」で正しい。
  - 行数: `findLineLimitViolations` の `item.lines > item.limit`
  - 結合度: `findCouplingViolations` の `count > dependencyLimit`。1クラスごとの依存先クラスの数で判定する
  - 責務の混在: `findResponsibilityViolations` の `responsibilities > limit`。1クラスごとの責務の種類数で判定する
- **`visibilityEnforced` は「アクセス制御を採点するか」ではない(01 の表の訂正)。**
  `countedVisibilityViolations`(`src/domain/scoring/visibility.ts` 43〜50行目)は次のように数える。
  - protected の越境: 全ステージで数える(ユーザー決定済み)
  - private の越境: `visibilityEnforced: true` のときだけ数える

  そのため、`visibilityEnforced` が無いステージで「アクセス制御: 採点しない」と出すと誤りになる(未決事項2)。
- **表示先**: `StagePanel.tsx` の `stage-panel__heading`(タイトル → `goal` → 「どんなコード?」の `<details>`)。
  `score-deduction-locations` は、`data-testid="score"` の直後(105〜107行目の後)と JSDoc(74行目)を変える予定である。
  本件は `goal` の `<p>`(98行目)の直後に要素を1つ足すだけにし、相手の変更箇所と離す。
- **ステージの値(E2E で使う2つ)**。どちらも他パイプラインが変更しない既存ステージである。

  | ステージ | method / class / file | dependencyLimit | responsibilityLimit | visibilityEnforced |
  |---|---|---|---|---|
  | チュートリアル1(初期表示) | 50 / 200 / 300 | 2 | 3 | なし |
  | 中級3: 越境する private メソッド | 50 / 200 / 300 | 0 | 4 | true |

- **変更依頼の実装中**: 実装中も同じステージのルールなので、表示は出したままにする。条件分岐は足さない(新しい判断は不要)。

### 本当に新しい仕組みが要るか(ponytail)

- 値はすべて `Stage` にある。ルール名は `describeScore.ts` の `RULE_LABEL` で揃えられる。
  そのため、新しいドメインロジック・状態・依存・ステージデータの変更は要らない。
- 要るのは、`Stage` から表示の文を組み立てる純粋関数1つと、`StagePanel.tsx` への数行だけである。
  - 新しい React コンポーネントのファイルは**作らない**(`<ul>` を数行書けば足りる)
  - 関数を `describeScore.ts` に足すと `score-deduction-locations` と競合するため、関数は新しいファイルに置く
- `goal` 内の数字との食い違いの検査、白紙設計への表示、行数バッジの「N / 上限」化は、今回作らない(7章)。

## 2. 変更対象ファイル一覧

| 種別 | パス | 層 | 役割 |
|---|---|---|---|
| 新規 | `src/presentation/stage/describeStageRules.ts` | presentation | `describeStageRules`(4章)。`Stage` の上限値から、表示する行の配列を組み立てる純粋関数 |
| 新規 | `src/presentation/stage/describeStageRules.test.ts` | presentation(test) | 4章の AAA テスト |
| 変更 | `src/presentation/stage/StagePanel.tsx` | presentation | import を1行と、`goal` の `<p>` の直後に一覧の `<ul>`(5章)を足す。JSDoc・`score` の周り・`CritiquePanel`/`HintPanel` の行は触らない |
| 変更 | `src/index.css` | presentation | `.stage-panel__rules` を1〜2行足す(5章) |
| 新規 | `e2e/stage-rules.spec.ts` | E2E | 2つのステージで表示の数字がステージデータどおりになることを確かめる(6章)。`refactor.spec.ts` には足さない |

次のファイルは**変更しない**。

- `src/domain/`・`src/application/`・`src/infrastructure/`(ステージ定義・`stageCatalog.test.ts`・`sampleAnswer.ts` を含む)
- `describeScore.ts`(`RULE_LABEL` は文言を合わせる先として読むだけ。import もしない。4章の注)
- `ComparisonQuizView.tsx`・`BlankDesignPanel.tsx`・`useGameStore.ts`・キャンバス系のコンポーネント・`workers/critique/`

## 3. データ/型の変更

なし。永続化スキーマ・`Stage` 型・`Score` 型は変えない。

関数の引数は、採点(`scoreCodebase`・`fileDeductions`)と同じ `Pick` にする。
白紙設計(`BlankDesignProblem`)へ後から広げるときも、そのまま渡せる形にするためである。型の別名は作らない。

```ts
// src/presentation/stage/describeStageRules.ts
/** 採点に使う上限値を、ルール名(RULE_LABEL と同じ言い回し)ごとの1行にして返す。並びは 行数 → 結合度 → 責務の混在 → アクセス制御。 */
export function describeStageRules(
  stage: Pick<Stage, 'limits' | 'dependencyLimit' | 'responsibilityLimit' | 'visibilityEnforced'>,
): string[];
```

## 4. TDD対象の純粋関数

### `describeStageRules`(`describeStageRules.test.ts`)

以下は、推奨案(未決事項1〜3のA)で書いた場合の文言である。確定した選択肢に応じて期待値を差し替える。

| 項目 | 文言 | 例 |
|---|---|---|
| 行数 | `行数: メソッド{method}行・クラス{class}行・ファイル{file}行まで` | `行数: メソッド50行・クラス200行・ファイル300行まで` |
| 結合度(1以上) | `結合度: 依存先は1クラスにつき{n}クラスまで` | `結合度: 依存先は1クラスにつき2クラスまで` |
| 結合度(0) | `結合度: 他のクラスに依存しない` | 中級3 |
| 責務の混在 | `責務の混在: 1クラスに{n}種類まで` | `責務の混在: 1クラスに3種類まで` |
| アクセス制御(`visibilityEnforced: true`) | `アクセス制御: private・protected のメソッドを届かないクラスから呼ばない` | 中級3・中級7 |
| アクセス制御(それ以外) | `アクセス制御: protected のメソッドを届かないクラスから呼ばない` | その他 |

- ルール名の部分(`行数`・`結合度`・`責務の混在`・`アクセス制御`)は `RULE_LABEL` と同じ文字列にする。
  ただし `RULE_LABEL` は import せず、文字列を直接書く。理由は次のとおり。
  - `describeScore.ts` の依存を増やさない
  - 4行のために `Record` を引くより読みやすい
  - `RULE_LABEL` の値が変わったら、本テストの期待値が古いことで気付ける
- `visibilityEnforced` の判定は `stage.visibilityEnforced === true` にする。省略時(`undefined`)は `false` と同じ扱い。

テストケース(AAA。`Stage` 全体は作らず、`Pick` の4項目だけのオブジェクトを渡す):

1. 正常系: チュートリアル1の値(50/200/300・依存2・責務3・`visibilityEnforced` なし)で、上の表どおりの4行をこの順で返す
2. 正常系(行数): `limits` の3つの数字がそれぞれの位置に入る。3つとも別の値(例: 60/150/300)にして、取り違えが無いことを確かめる
3. 端の値(依存0): `dependencyLimit: 0` のとき、結合度の行が `結合度: 他のクラスに依存しない` になる
4. 端の値(依存1): `dependencyLimit: 1` のとき、`…1クラスにつき1クラスまで` になる(0の特別扱いが1に漏れていないこと)
5. アクセス制御: `visibilityEnforced: true` なら private・protected の文言、`false` と省略時はどちらも protected だけの文言
6. 並び: 返す配列の長さは常に4で、並びは 行数 → 結合度 → 責務の混在 → アクセス制御

presentation 層なので、`vite.config.ts` のカバレッジ閾値の対象外である。それでも CLAUDE.md の TDD の方針に従い、テストを先に書く
(`layoutCodebase.test.ts`・`clampMenuPosition.test.ts` と同じ扱い)。

## 5. 画面(`StagePanel.tsx`・`index.css`)

- `goal` の `<p className="stage-panel__goal">`(98行目)の**直後**に、次の要素を置く(未決事項4の推奨案)。
  各行は `<li key={line}>` で出す。

  ```tsx
  <ul className="stage-panel__rules" data-testid="stage-rules" aria-label="採点の上限">
    {describeStageRules(stage).map((line) => <li key={line}>{line}</li>)}
  </ul>
  ```

  4行は常に中身が違うので、`key={line}` で重複しない。
- `useMemo` は付けない。4行の文字列を組み立てるだけなので要らない。
- `aria-live` は付けない。値が変わるのはステージを切り替えたときだけで、タイトルと一緒に変わるためである。
- import は `import { describeStageRules } from './describeStageRules';` を `HintPanel` の import(9行目)の**後**に足す。
  `score-deduction-locations` は8行目(`describeScore` の import)を書き換える予定なので、隣接行の競合を避ける。
  この import の並びは lint で強制されていない(`eslint.config.js` に import 順のルールは無い)。
- CSS は `.stage-panel__goal`(66行目)の直後に足す。見た目は `goal` と同じ小さな灰色の文字にし、横に詰めて折り返す。

  ```css
  .stage-panel__rules { display: flex; flex-wrap: wrap; gap: 0 12px; margin: 2px 0 0; padding: 0; list-style: none; color: var(--muted); font-size: 12px; }
  ```

- 変更依頼の実装中(`investigating`)も、そのまま出す。

## 6. 受け入れ基準

1. `describeStageRules.test.ts` に 4章のケースがあり、AAA のユニットテストが通る
2. リファクタリング画面の `data-testid="stage-rules"` に、選択中のステージの上限値が4行で出る。ステージを切り替えると追従する
3. E2E(新規 `e2e/stage-rules.spec.ts`)
   - 初期表示(チュートリアル1)で、`stage-rules` に次が含まれる
     - `メソッド50行・クラス200行・ファイル300行`
     - `2クラスまで`
     - `3種類まで`
   - 同じテストで、`stage-rules` に `private` が**含まれない**
   - `getByLabel('ステージ').selectOption({ label: '中級3: 越境する private メソッド' })` で切り替えると、`stage-rules` に次が含まれる
     - `他のクラスに依存しない`
     - `4種類まで`
     - `private`
   - 同じテストで、`2クラスまで` が**含まれない**
   - 文字列は確定した文言(未決事項1〜3)に合わせる
4. `StagePanel.tsx` の差分は次の2か所だけである。JSDoc・`score` の要素・`CritiquePanel`/`HintPanel`/`PreviewButtons` の行に差分が無い
   - import 1行
   - `goal` 直後の `<ul>`
5. `src/domain/`・`src/application/`・`src/infrastructure/`・`describeScore.ts`・`useGameStore.ts` に差分が無い。点数はどのステージでも変わらない
6. `npm run check` と `npm run test:e2e` が通る

## 7. スコープ外

- 白紙設計の上部パネル(`BlankDesignPanel.tsx`)への同じ表示
  - `blank-design-second-problem` が同じファイルを触るため、マージ後に回す
  - `describeStageRules` は `Pick` を受けるので、そのとき呼ぶだけで足せる
- `goal` の文から手書きの上限値を消す・書き方を揃えること(ステージ定義ファイルは他の3件が触る)。今回は `goal` を変えない。
  そのため、同じ数字が `goal` と一覧の2か所に出るステージがある
- `goal` 内の数字と上限値の食い違いを検査するテスト
  - 01 の時点で食い違いは見つかっていない
  - 書式がばらばらな自由文を読み取るテストは、後から入る新ステージの `goal` の書き方まで縛る
  - 実際に食い違いが起きてから検討する
- 行数のバッジを「N / 上限 行」にする(`MethodChip.tsx`・`ClassNode.tsx`・`FileNode.tsx` に差分が出る)
- 閾値を持たないルール(循環依存・Feature Envy・凝集度・空のクラスなど)の説明や用語集(`operation-guide` のマージ後に検討)
- 設計くらべクイズ(`ComparisonQuizView.tsx`)の表示を `describeStageRules` に置き換えること。クイズは行数しか採点に使わず、今の1行で足りている
- 上限を超えそうなときの警告・色分け(採点表示と `score-deduction-locations` の役割)

## 未決事項

### 未決事項1: 結合度(`dependencyLimit`)の行をどう書くか

- 選択肢A(推奨): `結合度: 依存先は1クラスにつき{n}クラスまで`。0のときだけ `結合度: 他のクラスに依存しない`。
  - 判定が「クラスごと」であることが分かる(全体の矢印の本数と誤解されにくい)
  - 0を自然な日本語にできる。0の分岐は三項演算子1つで済む
- 選択肢B: `結合度: 依存先は{n}クラスまで`(0も `0クラスまで`)。
  - 分岐が無く、中級3の `goal`(「依存先は0クラス」)の書き方とも揃う
  - ただし「コードベース全体で◯クラス」と読まれるおそれがある
- 選択肢C: ルール名を付けず、`goal` の書き方に揃える(`依存先は2クラスまで`)。
  - ただし、減点表示の「結合度 -10」と結び付けにくくなる

### 未決事項2: アクセス制御の行をどう出すか

`visibilityEnforced` が無いステージでも、protected の越境は数えている(1章「調査で分かったこと」)。

- 選択肢A(推奨): 全ステージで出し、`visibilityEnforced` の有無で文言を変える。
  - `true` のとき: `アクセス制御: private・protected のメソッドを届かないクラスから呼ばない`
  - それ以外: `アクセス制御: protected のメソッドを届かないクラスから呼ばない`
  - 採点の実際と一致する
- 選択肢B: `visibilityEnforced: true` のステージだけ出す(`アクセス制御: private のメソッドを他クラスから呼ばない` など)。
  - 表示が短くなる
  - ただし、protected の越境が採点されることが伝わらない。継承のあるステージ(上級1・5、`template-method-stage` など)で減点の理由が分かりにくい
- 選択肢C: アクセス制御の行は出さない(数値の上限3種類だけ)。
  - ただし、01 の目的の1つ(中級3・中級7が private を採点することを構造化して見せる)が満たされない

### 未決事項3: 行数の行を、設計くらべクイズと同じ言い回しにするか

- 選択肢A(推奨): ルール名で始め、末尾に「まで」を付ける: `行数: メソッド50行・クラス200行・ファイル300行まで`。
  - 他の3行(`結合度: …`・`責務の混在: …`)と形が揃う
  - 減点表示の「行数 -10」と結び付く
- 選択肢B: クイズと同じにする: `行数の上限: メソッド50行・クラス200行・ファイル300行`。
  - 画面をまたいで同じ文になる
  - ただし、他の3行とは形がずれる

### 未決事項4: 一覧をどこに・どう出すか

- 選択肢A(推奨): `goal` の直下に、常に開いた一覧(横並びで折り返す `<ul>`)で出す。
  - 1〜2行分の高さで常に見える
  - `StagePanel.tsx` の差分が最小(`score-deduction-locations` の変更箇所から数行離れる)
- 選択肢B: 既存の「どんなコード?」の `<details>` の中、説明の `<p>` の後に置く。
  - ヘッダーの高さが増えない
  - ただし `<details>` を畳むと上限も隠れる。「題材の説明」と「採点のルール」が同じ見出しに混ざる
- 選択肢C: `goal` の直下に新しい `<details>`(「採点のルール」)を置き、最初は開いておく(`key={stage.id}` でステージ切り替え時に開き直す)。
  - 畳みたい人だけ畳める
  - ただし、差分とE2E(開閉の確認)が少し増える
