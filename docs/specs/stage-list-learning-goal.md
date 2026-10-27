# stage-list-learning-goal: ステージ一覧の各カードに「できるようになること」1行と、100点までの目安の手数を出す

## 背景・目的

実機でステージ一覧(`StageRoadmapDialog`)を開くと、各カードに出るのはタイトル・学べることのタグ(`Stage.learns`、例「Extract Method」「Move Method」)・状態(未挑戦/挑戦中/点数/クリア)だけ。
タグは概念の名前なので、新卒〜若手には「このステージを終えると何ができるようになるのか」「どのくらいの手間か」がカードから読めず、次にどれを選ぶかを決めにくい。

既にあるものをコードで確かめた結果:

- `Stage.goal` はサイドバー用の「解き方+行数などの数値条件」(例: チュートリアル1「メソッドは28行以内に。メソッドをクリックし…」)。長く、解き方まで書いてあるので一覧には向かない
- `Stage.description` は題材の説明、`Stage.why` は100点後に見せる理由。どちらも一覧には出ていない
- 手数は `docs/stages/report.md`(`stageReport.ts`、開発者向けの表。模範解答の手順の長さ)と、100点にしたときの `MoveCountNote`(`sampleMovesToPerfect`、模範解答で初めて100点に届いた手数)にある。ステージ一覧には出ていない
- `concept-mastery-map`(実装済み)は概念ごとの集計で、カードの中身は変えていない

目的: 各カードに、そのステージで**できるようになること**を1行と、**100点までの目安の手数**を出す。

## 変更対象ファイル一覧

| 種別 | パス | 層 | 役割 |
| --- | --- | --- | --- |
| 変更 | `src/domain/stage/Stage.ts` | domain | `Stage` に必須の `outcome: string` を足す |
| 変更 | `src/infrastructure/stages/tutorialStages.ts` | infrastructure | 2ステージに `outcome` を書く |
| 変更 | `src/infrastructure/stages/beginnerStages.ts` | infrastructure | 2ステージに `outcome` を書く |
| 変更 | `src/infrastructure/stages/intermediateStages.ts` | infrastructure | 12ステージに `outcome` を書く |
| 変更 | `src/infrastructure/stages/advancedStages.ts` | infrastructure | 9ステージに `outcome` を書く |
| 変更 | `src/infrastructure/blankDesigns/blankDesignProblems.ts` | infrastructure | 白紙1にも `outcome` を書く(`Stage` 型を使うので必須項目になる。一覧には出ない) |
| 変更 | `src/infrastructure/stages/stageCatalog.test.ts` | infrastructure | `outcome` の書式と、全ステージに目安の手数が出ることを確かめる |
| 変更 | `src/infrastructure/stages/stageReport.test.ts`、`src/domain/progress/roadmap.test.ts`、`src/domain/progress/drafts.test.ts`、`src/domain/blank/reviewBlankDesign.test.ts` | テスト | `Stage` の固定値に `outcome: ''` を足す(typecheck を通すためだけ) |
| 変更 | `src/presentation/stage/StageRoadmapDialog.tsx` | presentation | `StageCard` に1行と目安の手数を出す |
| 変更 | `src/index.css` | presentation | `.stage-roadmap__outcome` と `.stage-roadmap__estimate` の見た目 |
| 変更 | `e2e/roadmap.spec.ts` | E2E | カードに1行と目安の手数が出ることを確かめる |

application 層は変更しない。新しい依存は足さない。`stageReport.ts`・`docs/stages/report.md` は変更しない。

## データ・型の変更

`src/domain/stage/Stage.ts` の `Stage` に1項目を足す(`learns` のすぐ下):

```ts
/** ステージ一覧に出す「このステージでできるようになること」。1文・40文字以内・「〜できる」で終える。行数などの数値条件や解き方の手順は書かない。 */
readonly outcome: string;
```

目安の手数はデータとして足さない。既存の `sampleMovesToPerfect(stage)`(`src/domain/stage/sampleAnswer.ts`)で計算する。

全ステージの `outcome`(この文面で埋める。実装者が言い回しを整えるのはよいが、40文字以内・「〜できる」で終える・数値条件なし・プレイヤーに名前を付けさせない、は守る):

| id | outcome |
| --- | --- |
| `tutorial-extract-method` | 長いメソッドから、まとまった処理を別のメソッドとして取り出せる |
| `tutorial-order-service` | 取り出したメソッドを、担当のクラスへドラッグで移せる |
| `beginner-user-controller` | 何でも屋のクラスから、DBやメールの処理を担当のクラスに任せられる |
| `beginner-invoice-service` | 受け皿のクラスを自分で追加して、責務ごとに分けられる |
| `intermediate-cyclic-dependency` | メソッドを本来の持ち主へ戻して、循環依存を断ち切れる |
| `intermediate-god-file` | 1つのファイルに詰まったクラスを、ファイルごとに分けられる |
| `intermediate-misplaced-private` | 他のクラスから呼ばれる private メソッドを、正しい持ち主へ移せる |
| `intermediate-volatile-tax` | よく変わる税の計算を、変更が1か所で済む場所へ切り出せる |
| `intermediate-volatile-format` | よく変わる帳票の形式を、ほかの処理から切り離せる |
| `intermediate-feature-envy` | 他のクラスのデータばかり触る処理を、データの持ち主へ移せる |
| `intermediate-anemic-domain-model` | getter/setter だけのクラスに、データを使う振る舞いを持たせられる |
| `intermediate-extract-class` | 1つのクラスに同居した無関係なデータを、別のクラスに分けられる |
| `intermediate-copy-paste-tax` | コピペされた同じ処理を、1か所にまとめられる |
| `intermediate-member-rank-branching` | 種類ごとの if 分岐を、種類ごとのクラスに分けられる |
| `intermediate-layered-order-api` | Controller・Service・Repository の一方通行の層に分けられる |
| `intermediate-middle-man` | 横流しするだけのクラスを、呼び出し元へ戻して消せる |
| `advanced-notifier-hierarchy` | 子クラスに散らばった共通処理を、基底クラスへ集められる |
| `advanced-payment-gateway-interface` | 具体的なクラスではなく、インターフェース越しに呼ぶ形にできる |
| `advanced-discount-strategy` | ランクごとの計算を、差し替えられる Strategy に組み替えられる |
| `advanced-report-factory` | あちこちにある生成の処理を、Factory の1か所に集められる |
| `advanced-collapse-hierarchy` | 子が1つしかない不要な継承を、畳んで1つのクラスにできる |
| `advanced-interface-segregation` | 太ったインターフェースを、使う側の役割ごとに分けられる |
| `advanced-value-object` | 一緒に使う金額と通貨を、振る舞いを持つ値のクラスにまとめられる |
| `advanced-template-method` | 共通の手順は親に、違う1手順だけを子に書く形にできる |
| `advanced-order-state` | 状態ごとの分岐を、状態そのものを表すクラスに組み替えられる |
| `blank-order-shipping`(白紙1) | 白紙から、変わる理由ごとに部品をクラスへ配置できる |

## 設計判断(確定)

1. **ステージ数は25(+白紙1)。** 依頼文の「全36ステージ」は、`stageCatalog.ts` の `stages`(チュートリアル2・初級2・中級12・上級9)と `docs/stages/report.md` の行数で確かめると25だった。カタログにある全ステージを埋める
2. **「できるようになること」は新しい項目 `outcome` にする。** 「本当に新しい項目が要るか、`goal`/`description` で足りないか」→ 足りない。`goal` は数値条件と解き方の手順、`description` は題材の説明で、どちらも長く「何ができるようになるか」を言っていない。切り詰めて流用すると意味がずれる
3. **`outcome` は必須項目。** 省略可にすると書き忘れを型が教えない。白紙1(`Stage` 型を使う)にも1行書き、テストの固定値は `''` を足す
4. **目安の手数はデータに足さず、`sampleMovesToPerfect` で計算する。** 行数を `lineCount` で計算するのと同じ方針で、手数を重複して持たない。100点にしたときの `MoveCountNote` の「模範解答: M手」と同じ数になり、一覧と結果で言っていることが食い違わない
   - 手順全体の長さ(`docs/stages/report.md` の「手数」)は使わない。チュートリアル1は手順12だが、1手で100点に届く(`stageCatalog.test.ts` で確認済み)。一覧で「12手」と出し、100点後に「模範解答: 1手」と出すと矛盾する
   - 表記は `100点まで 目安N手`。「目安」なのは、UIの1操作が模範解答の複数手にあたることがあるため(`move-count-challenge` の判断5と同じ)
   - `sampleMovesToPerfect` が `undefined`(模範解答なし・100点に届かない)なら、目安の手数は出さない。今のカタログでは全ステージに出る(テストで守る)
5. **計算はダイアログで1回だけ。** `StageRoadmapDialog` の `if (!open) return null` より前で、`useMemo` を使い `stages` から `Map<stageId, number | undefined>` を作る(`stages` は変わらないので実質1回)。`StageCard` には数を props で渡す
6. **所要時間(分)は出さない。** 時間のデータがどこにもなく、決め打ちの数字は根拠のない推測になる。手数を目安にする

## 動きの仕様

ステージ一覧の「ステージ順」の各カード(`data-testid="roadmap-stage-<id>"`)を、上から次の順にする:

1. タイトル(今どおり)
2. **できるようになること**: `<span className="stage-roadmap__outcome" data-testid="roadmap-outcome">{stage.outcome}</span>`。タイトルより小さめの通常の太さ(12〜13px)で、折り返してよい
3. 学べることのタグ(今どおり)
4. 状態の行(今どおり)。その行の右か下に **目安の手数**: `<span className="stage-roadmap__estimate" data-testid="roadmap-estimate">100点まで 目安N手</span>`。控えめな色(`var(--text-muted)` など既存の変数があればそれ。無ければ `opacity` で薄く)。N が無いステージでは span ごと出さない

- カードは `<button>` のままなので、読み上げ名に1行と手数も入る。キーボード操作は今と変わらない
- 「学べることごと」の表示(`ConceptMasteryList`)・「次のおすすめ」・サイドバー・`MoveCountNote` は変えない
- 狭い画面(600px以下、1列)でも1行目が切れず折り返す

## TDD対象

新しい domain/application のロジックは無い(計算は既存の `sampleMovesToPerfect` を使う)。代わりにステージ定義のテストを先に書く。

### ステージ定義の `outcome`(`src/infrastructure/stages/stageCatalog.test.ts`)

- 全ステージで `outcome.trim()` が空でない
- 全ステージで `outcome` が40文字以内で、改行を含まない
- 全ステージで `outcome` が「る」で終わる(「〜できる」「〜移せる」など。文末のぶれを防ぐ)
- `outcome` に半角数字+「行」(`/\d+行/`)が含まれない(数値条件を書かない)
- `outcome` がステージ間で重複しない
- `outcome` が `goal` と同じ文字列ではない(流用しない)

### 目安の手数(`src/infrastructure/stages/stageCatalog.test.ts`)

- カタログの全ステージで `sampleMovesToPerfect(stage)` が1以上の数を返す(今の「模範解答を持つ全ステージで」を、全ステージに広げる。模範解答の無いステージを足したら、ここで気づける)

## 受け入れ基準

1. `npm run dev` で開き、「ステージ一覧」を押すと、全25枚のカードにタイトルの下の1行(`roadmap-outcome`)と「100点まで 目安N手」(`roadmap-estimate`)が出る
2. チュートリアル1のカードに「長いメソッドから、まとまった処理を別のメソッドとして取り出せる」と「100点まで 目安1手」が出る
3. チュートリアル1を1手抽出して100点にすると、サイドバーの手数の行が「模範解答: 1手」となり、一覧の目安と同じ数になる
4. 600px以下の幅でもカードの1行目が折り返して読め、カードを Tab で選んで Enter で移れる(今どおり)
5. 「学べることごと」に切り替えた表示は今と変わらない
6. `e2e/roadmap.spec.ts` に、チュートリアル1のカードの `roadmap-outcome` と `roadmap-estimate`(`100点まで 目安1手`)を確かめ、全カード数と `roadmap-outcome` の数が等しいことを確かめるテストがある
7. `npm run check` と `npm run test:e2e` が通る

## スコープ外

- 所要時間(分)の表示(設計判断6)
- `docs/stages/report.md`・`stageReport.ts` への `outcome` 列の追加(開発者向けの表で、今回の困りごとではない)
- `outcome` をサイドバー・クリア画面・「次のおすすめ」・「学べることごと」に出すこと
- 手数の目安を難易度やプレイヤーの記録で補正すること、自己ベスト(`moveBests`)を一覧に出すこと
- `goal`・`description`・`learns` の文面の見直し
- 白紙設計モードの画面に `outcome` を出すこと
