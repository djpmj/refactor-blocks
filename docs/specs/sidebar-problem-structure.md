# サイドバーの問題構成の整理(困っていること・クリア条件・ヒント)

## 背景・目的

左のサイドバー(`StagePanel.tsx` の `aside.sidebar`「課題とヒント」)は文字が多く、プレイヤーが「いま何をすればいいか」を見失う。上から次の要素がすべて開いたまま並んでいる。

1. ストーリーカード(`StoryIntro`)。閉じると完全に消える
2. 課題文(`stage.goal`)。**問題の症状・解き方(「Move Method で移動し…」)・数値条件(「50行以内」「依存先は0クラス」)が1つの段落に混ざっている**。ストーリーと同じ問題を2回説明していることも多い
3. 「もし、この変更が来たら?」カード(`ChangePainCard`)。操作を始める前から詳細まで開いている
4. ヒント(`HintList`)。開くボタンはヘッダー、中身はサイドバーと分かれている
5. 「どんなコード?」(`stage.description`)。最初から開いている

対象プレイヤー(新卒〜4年目)がサイドバーで知りたいのは「何が困っているか」「何ができたらクリアか」「いまどこまでできているか」の3つ。そこで、**常に見せるのは「困っていること」と「クリア条件」だけにし、それ以外は必要なときに開く**構成に組み替える。

### 設計判断(対話で確定済み)

- **困っていること**: `Stage` に `problem`(症状だけを書いた1〜2行)を新設し、全ステージ分を書く。`goal` はAI講評(`critiqueRequest.ts`)とステージ一覧表(`stageReport`)のために残すが、サイドバーには出さない。
- **クリア条件**: ステージごとの手書きはせず、**採点結果から自動で作る**。行数・結合度・責務の混在はステージの上限値付きで常に表示する。それ以外のルールは、初期状態か現在のどちらかで減点されているものだけを ✓/✗ 付きで並べる。
- **ヒント**: 模範解答を1手ずつ明かす今の仕組みはそのままにする。ボタンをヘッダーからサイドバーのヒント欄へ移し、表示と同じ場所にまとめる。段階分け(方向性 → 操作名 → 対象)は今回やらない。
- **変更の痛み**: プレイ中は要約1行に畳み、クリックで詳細を開く。100点時の「なぜ分けるのか」は開いた状態で出す。

## 新しいサイドバーの並び

```
課題とヒント
┌ 第7章 通知の裏口 ▸            ← ストーリー: 閉じたあとも1行で残り、押すと開き直せる
├ 困っていること                ← stage.problem(常時)
│  privateのメソッドが、別のクラスから呼ばれている
├ クリア条件                    ← 採点から自動(常時・操作のたびに更新)
│  ✗ 行数: メソッド50行・クラス120行・ファイル300行以内(今: メソッド最大84行)
│  ✗ 結合度: 依存先は0クラスまで(今: 最大1クラス)
│  ✓ 責務の混在: 1クラス2種類まで
│  ✗ アクセス制御: 0件にする(今2件)
├ ヒント [ヒントを見る (1/3)]    ← ボタンをヘッダーから移動。開いたヒントはこの下
├ ▸ もし、この変更が来たら? 1か所・84行を読む   ← 畳む。100点時は「なぜ分けるのか」を開いて出す
├ ▸ どんなコード?               ← 最初は閉じる
└ (100点時)理解度チェック・章の結び
```

## ponytailチェック

1. YAGNI: 3段ヒントは作らない(今の「模範解答を1手ずつ」で足りるか、使われ方を見てから)。条件をステージごとに書く欄も作らない(採点から出せる)。
2. 既存の再利用: `scoreCodebase`・`Score.deductions`・`RULE_LABEL`・`useHints`/`HintButton`/`HintList`・`ChangePainCard` の計測結果・`<details>`。
3. 標準機能: 折りたたみは `<details>`/`<summary>` を使い、新しい開閉状態の管理は作らない(ストーリーの1行表示だけは既存の `useState` を流用)。新しい依存は足さない。

## 変更対象ファイル一覧

| パス | 層 | 新規/変更 | 役割 |
| --- | --- | --- | --- |
| `src/domain/stage/Stage.ts` | domain | 変更 | `Stage` に `problem: string` を追加 |
| `src/domain/stage/clearConditions.ts` | domain | 新規 | `clearConditions`(初期と現在の `Score` からクリア条件の一覧を出す)・`worstMeasures`(上限を超えている実際の値) |
| `src/domain/stage/clearConditions.test.ts` | domain(test) | 新規 | 上記のテスト |
| `src/infrastructure/stages/tutorialStages.ts` / `beginnerStages.ts` / `intermediateStages.ts` / `advancedStages.ts` | infrastructure | 変更 | 全ステージに `problem` を書く(下記の書き方ルール) |
| `src/infrastructure/stages/stageCatalog.test.ts` | infrastructure(test) | 変更 | 全ステージの `problem` が空でなく60文字以内であることを確認するケースを足す |
| テスト用のステージ定義(`Stage` 型を直接組み立てているテスト・フィクスチャ) | 各層(test) | 変更 | `problem` を足して型を通す(`grep -rn "goal:" src` で洗い出す) |
| `src/presentation/stage/describeCondition.ts` | presentation | 新規 | クリア条件1件を画面の文言にする(上限値の埋め込み) |
| `src/presentation/stage/describeCondition.test.ts` | presentation(test) | 新規 | 文言のテスト(既存の `ruleWhy.test.ts` と同じ扱い) |
| `src/presentation/stage/ClearConditionList.tsx` | presentation | 新規 | 「クリア条件」欄(✓/✗ の一覧) |
| `src/presentation/stage/StagePanel.tsx` | presentation | 変更 | サイドバーの並びを上図のとおりにする。`stage.goal` の表示をやめ `stage.problem` を出す。`HintButton` をヘッダーからサイドバーのヒント欄へ移す。「どんなコード?」の `open` を外す |
| `src/presentation/stage/StoryIntro.tsx` | presentation | 変更 | 閉じたあとは章タイトル1行のボタンにし、押すと開き直す |
| `src/presentation/stage/ChangePainCard.tsx` | presentation | 変更 | `<details>` で畳み、`<summary>` に見出しと要約1行を出す。100点時は開いた状態 |
| `src/presentation/stage/describePain.ts`(または `ChangePainCard.tsx` 内) | presentation | 変更 | 要約1行の文言を作る関数 `summarizePain` を足す |
| `src/index.css` | presentation | 変更 | 新しい欄の見た目(既存の `stage-panel__goal` などに倣う) |
| `e2e/sidebar-structure.spec.ts` | e2e | 新規 | 下記受け入れ基準のE2E |
| `e2e/change-pain.spec.ts` / `e2e/manual-fix.spec.ts` / `e2e/story-mode.spec.ts` ほか | e2e | 変更 | 畳まれた要素を開いてから中身を確認するなど、構成変更に合わせて最小限直す(確認したい観点は変えない) |

`BlankDesignPanel.tsx`(白紙設計モード)は対象外(別の画面で、`Stage` を使っていない)。

## データ/型の変更

```ts
// src/domain/stage/Stage.ts
export type Stage = {
  // ...既存
  readonly goal: string; // AI講評・ステージ一覧表で使う。サイドバーには出さない
  /** サイドバーの「困っていること」。コードの症状だけを1〜2行(60文字以内)で書く。解き方(操作名)や数値条件は書かない。 */
  readonly problem: string;
  // ...
};
```

```ts
// src/domain/stage/clearConditions.ts
import type { Score, ScoreRule } from '../scoring/score';

export type ClearCondition = {
  readonly rule: ScoreRule;
  /** 今の違反件数。0なら満たしている。 */
  readonly count: number;
};

/** ステージの上限値があり、常に表示するルール。 */
export const ALWAYS_SHOWN_RULES: readonly ScoreRule[] = ['line-limit', 'coupling', 'responsibility'];

export function clearConditions(initial: Score, current: Score): ClearCondition[];

/** 上限値のある3ルールについて、上限を超えているものの最大値。上限内の項目は undefined。 */
export type WorstMeasures = {
  readonly method?: number;
  readonly class?: number;
  readonly file?: number;
  readonly dependencies?: number;
  readonly responsibilities?: number;
};

export function worstMeasures(
  codebase: Codebase,
  stage: Pick<Stage, 'limits' | 'dependencyLimit' | 'responsibilityLimit'>,
): WorstMeasures;
```

### `problem` の書き方ルール(実装者向け)

- コードで**何が起きているか(症状)**だけを書く。例: 「private のメソッドが、別のクラスから呼ばれている」「1つのメソッドに、検証・計算・保存が全部書いてある」
- Extract Method / Move Method などの**操作名や解き方は書かない**(ヒントの役目)。
- 「50行以内」「依存先0クラス」などの**数値条件は書かない**(クリア条件欄の役目)。
- 60文字以内。`description`(どんなコード?)やストーリーと同じ文をそのまま写さない。
- 既存の `goal` 前半の問題説明を短く言い換えるのが出発点になる。

## 仕様

### `clearConditions(initial, current)`

- `ALWAYS_SHOWN_RULES` の3ルールは、件数に関係なく常に含める。
- それ以外のルールは、`initial` か `current` のどちらかで `count > 0` のものだけを含める(初期から違反していて直したものは ✓ として残り、操作の途中で新たに違反したものは ✗ として現れる)。
- 並び順は `current.deductions` の並び(=`scoreCodebase` のルール順)。
- `count` は `current` の件数。

### `worstMeasures(codebase, stage)`

上限を超えているものの中で一番大きい値を返す。上限内なら、その項目は `undefined`。

- `method`/`class`/`file`: `findLineLimitViolations` の結果を種類ごとに見て、超えているものの最大行数
- `dependencies`: 依存先の数が `dependencyLimit` を超えているクラスの中で最大の依存先数(`classDependencies` を `from` ごとに数える。`findCouplingViolations` と同じ数え方)
- `responsibilities`: `findResponsibilityViolations` の結果の中で最大の責務の種類数

### 画面

- `initial` は `scoreCodebase(stage.codebase, stage)` を `useMemo` で1回だけ計算する(ステージが変わったら計算し直す)。`current` は `StagePanelContent` がすでに計算している `score` を使う。
- 文言(`describeCondition(condition, stage)`):
  - `line-limit`: `行数: メソッド{method}行・クラス{class}行・ファイル{file}行以内`
  - `coupling`: `結合度: 依存先は{dependencyLimit}クラスまで`
  - `responsibility`: `責務の混在: 1クラス{responsibilityLimit}種類まで`
  - その他: `{RULE_LABEL[rule]}: 0件にする`
  - 違反中は末尾に今の状態を付ける。上限値のある3ルールは**実際の値**(`worstMeasures` の結果)を、それ以外は件数を出す:
    - `line-limit`: 超えている種類だけを並べる。例: `(今: メソッド最大84行・クラス最大200行)`
    - `coupling`: `(今: 最大{maxDependencies}クラス)`
    - `responsibility`: `(今: 最大{maxResponsibilities}種類)`
    - その他: `(今{count}件)`
  - 満たしているときは何も付けない。
- 各行の先頭に ✓/✗ を出す。記号だけに頼らず、`aria-label` などで「達成」「未達成」が読み上げでも分かるようにする(アクセシビリティ)。
- 一覧は `aria-live="polite"` にし、操作で状態が変わったら読み上げられるようにする。
- 変更依頼の実装中(`investigating`)は、今と同じく挑戦前のコードの点数で表示する。

### ストーリー(`StoryIntro`)

- ストーリーが有効で章があるとき、最初はこれまでどおりカードで表示する。
- 「閉じる」を押すと、`第{n}章 {title} ▸` の1行ボタン(`aria-expanded="false"`)だけが残る。押すとカードを開き直す。
- 別のステージへ切り替えたら、またカードで表示する(既存の挙動)。`data-testid="story-intro"` はカードに付けたままにする。

### 変更の痛み(`ChangePainCard`)

- `<section>` の中を `<details>` にし、`<summary>` に見出し(`もし、この変更が来たら?` など既存の `cardHeading`)と要約1行を入れる。region 名(`aria-labelledby`)は今の見出しのまま変えない。
- 要約(`summarizePain`):
  - 修正の痛みがあるとき: `{n}か所・{readLines}行を読む`
  - 追加の痛みだけのとき: 既存クラスを書き換えるなら `既存の{n}クラスを書き換える`、書き換え不要なら `新しいクラスを足すだけ`
- 100点(`perfect`)のときは `open` で表示する(「なぜ分けるのか」をすぐ読めるように)。それ以外は閉じた状態で表示する。
- 「実際に直してみる」ボタンは `<details>` の中に入れる(押す前に詳細を読んでもらうため)。

### ヒント

- ヘッダーの `HintButton` を外し、サイドバーの「ヒント」欄(見出し+ボタン+`HintList`)に移す。開いた数の持ち方(`revealed` の state)とステージ切り替え時のリセットは今のまま。
- 変更依頼の実装中は今と同じく押せない。

## TDD対象の純粋関数

### `clearConditions`(`src/domain/stage/clearConditions.ts`)

- 正常系: どちらでも減点がないとき、`line-limit`・`coupling`・`responsibility` の3件だけを返し、どれも `count: 0`
- 正常系: 初期に `visibility` が2件・今も2件 → `visibility` を `count: 2` で含む
- 正常系: 初期に `visibility` が2件・今は0件 → `visibility` を `count: 0` で含む(直した条件が ✓ として残る)
- 正常系: 初期は0件・今 `unused` が1件 → `unused` を `count: 1` で含む(途中で増えた違反が現れる)
- 境界: 初期も今も0件の `cycle` などは含まない
- 並び順: `scoreCodebase` のルール順になる(例: `line-limit` → `coupling` → `responsibility` → `visibility`)
- 常時表示の3ルールが違反中なら、その件数が `count` に入る

### `worstMeasures`(`src/domain/stage/clearConditions.ts`)

- 正常系: 上限50行で84行と60行のメソッドがある → `method: 84`
- 正常系: クラス・ファイルの行数超えも、それぞれの最大値が入る
- 正常系: 依存先上限1で、依存先3クラスと2クラスのクラスがある → `dependencies: 3`
- 正常系: 責務上限2で、4種類と3種類のクラスがある → `responsibilities: 4`
- 境界: すべて上限内 → すべて `undefined`
- 境界: ちょうど上限(50行・依存先1・責務2)は超えていないので `undefined`

### `describeCondition`(`src/presentation/stage/describeCondition.ts`)

- `line-limit` にステージの3つの上限値が入る
- `coupling`/`responsibility` にステージの上限値が入る
- その他のルールは `RULE_LABEL` を使った `…: 0件にする` になる
- 違反中の `line-limit` は、超えている種類だけ `(今: メソッド最大84行・…)` が付く
- 違反中の `coupling`/`responsibility` は `(今: 最大Nクラス)`/`(今: 最大N種類)` が付く
- 違反中のその他のルールは `(今{count}件)` が付く
- 満たしている条件には何も付かない

### `summarizePain`

- 修正の痛みがあるとき `{n}か所・{readLines}行を読む`
- 追加の痛みだけで書き換えがあるとき/ないときの2通り

### ステージ定義(`stageCatalog.test.ts`)

- 全ステージの `problem` が空白だけでなく、60文字以内

## 受け入れ基準

1. `npm run check`(lint + typecheck + test)が通る。上記の純粋関数にAAAパターンのテストがある。
2. 全ステージに `problem` があり、書き方ルール(症状だけ・操作名なし・数値条件なし・60文字以内)を満たす。評価者は全ステージの文言に目を通して確認する。
3. 画面: サイドバーに課題文(`stage.goal`)が表示されず、上から「ストーリー(1行またはカード)→ 困っていること → クリア条件 → ヒント → 変更の痛み(畳んだ状態)→ どんなコード?(閉じた状態)」の順に並ぶ。
4. 画面: クリア条件の ✓/✗ と今の状態(行数・依存先数・責務数は実際の最大値、それ以外は件数)が、操作(Move Method など)のたびに更新される。100点になると全条件が ✓ になる。
5. 画面: 「ヒントを見る」ボタンがヘッダーではなくサイドバーのヒント欄にあり、押すたびにその下へヒントが1つずつ増える。
6. 画面: ストーリーを閉じると章タイトルの1行ボタンが残り、押すとカードが開き直る。
7. 画面: 変更の痛みは、プレイ中は要約1行の閉じた状態で、開くと今までどおり詳細・「実際に直してみる」が出る。100点時は「なぜ分けるのか」が開いた状態で出る。
8. E2E(`e2e/sidebar-structure.spec.ts`): 3〜7の操作を確認する。既存のE2E(`change-pain`・`manual-fix`・`story-mode` など)は、畳まれた要素を開く手順を足すなどの最小限の修正で通る。
9. `npm run test:e2e` が通る。
10. AI講評のリクエスト(`critiqueRequest`)は今までどおり `goal` を渡している(変更しない)。

## スコープ外

- 3段ヒント(方向性 → 操作名 → 対象)。今回は「模範解答を1手ずつ」のまま。
- ステージごとに手書きするクリア条件。
- `goal` の文言の書き換え・削除(AI講評・ステージ一覧表で使い続ける)。
- サイドバーのタブ化。
- 白紙設計モード(`BlankDesignPanel`)の画面。
- ヘッダーの点数・「減点の内訳」(`ScoreBreakdown`)の変更。クリア条件と内容が重なるが、違反箇所へのジャンプ・「なぜ?」の説明はヘッダー側に残す。重複が気になったら別仕様で整理する。
- 畳んだ・開いた状態をステージをまたいで覚える仕組み(`localStorage` など)。

## 未決事項

なし。「困っていること」の持たせ方・クリア条件の作り方・ヒントの扱い・変更の痛みの見せ方は対話で確定済み。各ステージの `problem` の文言は、書き方ルールの範囲で実装者の裁量。
