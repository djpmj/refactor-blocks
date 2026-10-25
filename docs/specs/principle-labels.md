# principle-labels: ステージに関係する設計原則(SRP・OCPなど)を付けて、一覧と「なぜ分けるのか」に出す

## 背景・目的

学習者の目線でゲームを実機で遊んで見つけた不足点。

- ステージ一覧(ヘッダーの「ステージ一覧」ボタンで開く `StageRoadmapDialog`)の各カードに出るタグ(`Stage.learns`)は、
  「Extract Method」「Move Method」「Strategy」「Factory」「Template Method」「ISP」などの**技法名・パターン名**が中心。
  単一責任・開放閉鎖・依存性逆転といった**設計原則**との対応はどこにも出ない。
- 100点になったあとに出る「なぜ分けるのか」カード(`ChangePainCard` の `change-request` 段階)の本文(`stage.why`)と
  理解度チェックは、題材(税率・帳票・決済など)に即した理由で書かれていて、原則の名前には触れていない。
- そのため学習者は「なぜその技法を使うのか」の背骨になる原則に結びつけられず、技法を暗記して終わる。
  たとえば中級4・5(税の計算・帳票の形式を分ける)と初級1(何でも屋の Controller)が、同じ「単一責任の原則」の
  練習だと気づけない。上級3(Strategy)と中級10(if分岐をクラスに分ける)が、どちらも「開放閉鎖の原則」に向かう
  組み替えだと気づけない。

各ステージに関係する設計原則を1〜2個付け、ステージ一覧と「なぜ分けるのか」カードに出す。**表示するだけで、採点には使わない。**

## 変更対象ファイル一覧

| 種別 | パス | 層 | 役割 |
| --- | --- | --- | --- |
| 変更 | `src/domain/stage/Stage.ts` | domain | 原則の識別子のUnion型 `DesignPrinciple` を足し、`Stage` に任意フィールド `principles` を足す |
| 新規 | `src/infrastructure/stages/designPrinciples.ts` | infrastructure | 原則ごとの表示名・1行説明の表 `DESIGN_PRINCIPLES` |
| 変更 | `src/infrastructure/stages/tutorialStages.ts` | infrastructure | 2ステージに `principles` を足す |
| 変更 | `src/infrastructure/stages/beginnerStages.ts` | infrastructure | 2ステージに `principles` を足す |
| 変更 | `src/infrastructure/stages/intermediateStages.ts` | infrastructure | 12ステージに `principles` を足す |
| 変更 | `src/infrastructure/stages/advancedStages.ts` | infrastructure | 8ステージに `principles` を足す |
| 変更 | `src/infrastructure/stages/stageCatalog.test.ts` | infrastructure(テスト) | 「全ステージが原則を1〜2個持つ」「表示名・説明が空でない」テストを足す |
| 変更 | `src/presentation/stage/StageRoadmapDialog.tsx` | presentation | カードのタグ欄に原則のバッジ行を足す |
| 変更 | `src/presentation/stage/ChangePainCard.tsx` | presentation | `CardBody` の `change-request` 段階で、`stage.why` の直後に「関係する原則」の行を出す |
| 変更 | `src/index.css` | presentation | 原則バッジの見た目(既存の `.stage-roadmap__tag` と見分けられる枠の色)と、カード内の原則行 |
| 変更 | `e2e/roadmap.spec.ts` | E2E | 一覧のカードに原則のバッジが出ることを確かめる |
| 変更 | `e2e/change-pain.spec.ts` | E2E | 100点後の「なぜ分けるのか」に「関係する原則: SRP(単一責任)」が出ることを確かめる |

`src/application/` は変更しない。採点(`src/domain/scoring/`)・変更依頼(`src/domain/change/`)も変更しない。新しい依存は足さない。

## データ・型の変更

### `src/domain/stage/Stage.ts`

```ts
/** ステージに関係する設計原則。表示のみに使い、採点には使わない。 */
export type DesignPrinciple = 'srp' | 'ocp' | 'dip' | 'isp' | 'dry' | 'adp' | 'encapsulation' | 'yagni';

export type Stage = {
  // ...既存のフィールド
  /** このステージで練習する組み替えの背骨になる設計原則。1〜2個。表示のみ(採点に使わない)。 */
  readonly principles?: readonly DesignPrinciple[];
};
```

- `enum` は使わない(lint で禁止)。Union type にする。
- 任意(`?`)にするのは、テスト用に `Stage` を組み立てている既存のフィクスチャ(`src/infrastructure/stages/stageReport.test.ts` など)を
  巻き込まないため。本番の全ステージに付いていることは `stageCatalog.test.ts` で守る。

### `src/infrastructure/stages/designPrinciples.ts`(新規)

```ts
import type { DesignPrinciple } from '../../domain/stage/Stage';

export type DesignPrincipleInfo = {
  /** バッジと「関係する原則」に出す表示名。 */
  readonly label: string;
  /** 「なぜ分けるのか」カードに出す1行の説明。40文字以内。 */
  readonly summary: string;
};

export const DESIGN_PRINCIPLES: Readonly<Record<DesignPrinciple, DesignPrincipleInfo>> = { ... };
```

`Record<DesignPrinciple, ...>` にすることで、Union に値を足して表に書き忘れると `npm run typecheck` が落ちる。

| 値 | label | summary |
| --- | --- | --- |
| `srp` | `SRP(単一責任)` | `1つのクラス・メソッドが変わる理由は1つにする` |
| `ocp` | `OCP(開放閉鎖)` | `新しい種類は、既存のコードを書き換えずに足せるようにする` |
| `dip` | `DIP(依存性逆転)` | `具体的なクラスではなく、インターフェースに依存する` |
| `isp` | `ISP(インターフェース分離)` | `使わないメソッドの実装を、クラスに強制しない` |
| `dry` | `DRY(重複の排除)` | `同じ知識・処理は1か所にまとめる` |
| `adp` | `ADP(非循環依存)` | `クラス同士の依存は一方向にし、輪にしない` |
| `encapsulation` | `カプセル化` | `データと、それを扱う処理を同じクラスに置いて守る` |
| `yagni` | `YAGNI(不要な仕組みを作らない)` | `今要らない仕組み(中継だけの層・余分な継承)は残さない` |

### 全ステージの原則(このとおりに付ける)

本リポジトリの全24ステージ(`src/infrastructure/stages/stageCatalog.ts` が並べるもの)。順序は配列の順で、先頭が主な原則。

| ステージID | タイトル | 既存の learns | principles |
| --- | --- | --- | --- |
| `tutorial-extract-method` | チュートリアル1: 長いメソッドを分ける | Extract Method | `['srp']` |
| `tutorial-order-service` | チュートリアル2: 太った placeOrder | Extract Method, Move Method | `['srp']` |
| `beginner-user-controller` | 初級1: 何でも屋の UserController | 責務の分離, Move Method | `['srp']` |
| `beginner-invoice-service` | 初級2: クラスを自分で作る | クラスの追加, 責務の分離 | `['srp']` |
| `intermediate-cyclic-dependency` | 中級1: 循環依存を断ち切る | 循環依存, Move Method | `['adp', 'encapsulation']` |
| `intermediate-god-file` | 中級2: 何でも入った1つのファイル | ファイル分割, 責務の分離 | `['srp']` |
| `intermediate-misplaced-private` | 中級3: 越境する private メソッド | カプセル化, private | `['encapsulation']` |
| `intermediate-volatile-tax` | 中級4: 変わるのは税の計算 | 変わる部分の分離, 責務の分離 | `['srp']` |
| `intermediate-volatile-format` | 中級5: 変わるのは帳票の形式 | 変わる部分の分離, 責務の分離 | `['srp']` |
| `intermediate-feature-envy` | 中級6: 他人のデータばかり触るメソッド | Feature Envy, Move Method | `['encapsulation']` |
| `intermediate-anemic-domain-model` | 中級7: getter/setter だけの口座クラス | 貧血ドメインモデル, カプセル化 | `['encapsulation']` |
| `intermediate-extract-class` | 中級8: 給与と住所を抱えた社員クラス | Extract Class, 責務の分離 | `['srp']` |
| `intermediate-copy-paste-tax` | 中級9: コピペされた消費税計算を1か所にまとめる | 重複の排除, Merge Methods | `['dry']` |
| `intermediate-member-rank-branching` | 中級10: 会員ランクごとのif分岐をクラスに分ける | 分岐の分離, 継承 | `['ocp']` |
| `intermediate-layered-order-api` | 中級11: Controller に全部書いてある注文API | 層(Controller/Service/Repository), 依存の向き | `['srp', 'adp']` |
| `intermediate-middle-man` | 中級12: 横流しするだけの OrderManager | Middle Man, Inline Method / Inline Class | `['yagni']` |
| `advanced-notifier-hierarchy` | 上級1: 通知クラスの共通処理を基底クラスへ集める | 継承, 共通処理の集約 | `['dry']` |
| `advanced-payment-gateway-interface` | 上級2: 決済ゲートウェイをインターフェース越しに呼ぶ | インターフェース, implements | `['dip']` |
| `advanced-discount-strategy` | 上級3: 会員ランクの割引をStrategyパターンへ組み替える | Strategy, implements | `['ocp']` |
| `advanced-report-factory` | 上級4: レポート生成処理をFactoryへ集約する | Factory, 生成の集約 | `['dry', 'srp']` |
| `advanced-collapse-hierarchy` | 上級5: 子が1つしかない継承を畳む | 継承の見直し, Collapse Hierarchy | `['yagni']` |
| `advanced-interface-segregation` | 上級6: 太ったインターフェースを役割ごとに分ける | ISP, implements | `['isp']` |
| `advanced-value-object` | 上級7: 金額と通貨を Money にまとめる | Value Object, カプセル化 | `['encapsulation', 'dry']` |
| `advanced-template-method` | 上級8: 取り込みの手順を Template Method にまとめる | Template Method, 継承 | `['dry', 'ocp']` |

各ステージ定義のオブジェクトで、`learns` の直後に `principles: [...]` を書く。

## 動きの仕様

### ステージ一覧(`StageRoadmapDialog` の `StageCard`)

- 既存の `learns` のタグ行(`.stage-roadmap__learns`)の**下に**、原則のバッジ行を1行足す。
  - 要素: `<span className="stage-roadmap__principles" data-testid={`roadmap-principles-${stage.id}`}>`。カードは `<button>` なので、中身は既存と同じく `span` だけにする(`div`・`ul` を入れない)。
  - 行頭に小さく `原則` と出し(`<span className="stage-roadmap__principles-heading">原則</span>`)、続けて `stage.principles` の順に
    `DESIGN_PRINCIPLES[p].label` のバッジ(`className="stage-roadmap__tag stage-roadmap__tag--principle"`)を並べる。
  - `stage.principles` が未定義・空なら行ごと出さない。
- バッジは技法タグと見分けられるよう枠線の色だけ変える(`--accent` 系の既存CSS変数を使う。新しい色変数は足さない)。
- バッジはクリックできない(カード全体のボタンのクリックでステージを選ぶ既存の動きのまま)。

### 「なぜ分けるのか」カード(`ChangePainCard` の `CardBody`、`step === 'change-request'`)

- `<p>{stage.why}</p>` の直後に、`stage.principles` の順で1原則につき1行を出す。
  - 文言: `関係する原則: <strong>{label}</strong> — {summary}`
  - 例(チュートリアル2): `関係する原則: SRP(単一責任) — 1つのクラス・メソッドが変わる理由は1つにする`
  - 要素: `<p className="change-pain__principle" data-testid="why-principle">`
- `stage.principles` が未定義・空なら何も出さない。
- それ以外の段階(`opening-fix` / `refactor` / `closing-fix`)には出さない。原則は「組み替えが済んで、理由を振り返るとき」に結びつけるのが狙いで、解く前に出すと答え(何をどこへ動かすか)のヒントになりすぎるため。

## 設計判断(確定)

1. **原則の型は domain、表示名・説明は infrastructure に置く。** `DesignPrinciple` は `Stage` のフィールドの型なので `Stage.ts` に置く。
   表示名・説明は画面に出す文言のデータで、ステージ定義(`infrastructure/stages/`)と同じ「教材データ」の側に置く。
   presentation から infrastructure のデータを読む前例は `storyChapters`・`comparisonQuizzes`・`blankDesignProblems` にあるので、それに合わせる。
2. **原則は採点に使わない。** ルールベース採点は行数・責務・結合度などの測れる量で行っていて、原則はそれらを束ねる「名前」にすぎない。
   原則ごとの採点を足すと、既存の採点と二重に減点することになる。
3. **値は小文字の識別子(`'srp'` など)、表示名は表で持つ。** 画面の文言を変えても、ステージ定義を書き換えなくて済むようにする。
4. **1ステージ1〜2個に絞る。** 3個以上付けると「全部に関係する」状態になり、どの原則の練習か伝わらない。主な原則を先頭に置く。
5. **「変更容易性」は原則として付けない。** 変更容易性はすべての原則が目指すゴールで(変更依頼・変更の痛みカードがすでにそれを見せている)、
   ステージごとの違いを生まないため。
6. **非循環依存(ADP)と YAGNI を足す。** 循環依存・層構造のステージ(中級1・11)と、横流し・継承を畳むステージ(中級12・上級5)は、
   例に挙がった6つ(SRP・OCP・DIP・ISP・DRY・カプセル化)のどれにも素直に当てはまらない。無理に SRP を付けると原則の意味がぼやけるので、
   それぞれ名前の通った原則を1つずつ足す。
7. **既存の `learns` は変えない。** 中級3・中級7・上級7の learns にある「カプセル化」、上級6の「ISP」は原則バッジと文字が重なるが、
   原則の行には `原則` の見出しを付けて別の行に出すので、「技法・題材」と「原則」の2段として読める。learns を書き換えると
   learns 側のテスト(1〜3個)や他の仕様との整合を見直す必要が出て、このIssueの範囲を超える。
8. **本当に新しい画面・ダイアログが要るか**: 要らない。既存の一覧カードと「なぜ分けるのか」カードに1行ずつ足すだけで、
   「技法 → 原則」の結びつきは伝わる。原則ごとの解説ページや原則で絞り込む機能は推測の要求なのでスコープ外にする。

## TDD対象

domain / application に新しいロジックは足さない(型とデータだけ)。データの整合を `src/infrastructure/stages/stageCatalog.test.ts` で先に書いて Red にしてから、各ステージに `principles` を足して Green にする。

### `stageCatalog.test.ts` に足すテスト(infrastructure・データ検査)

- `it.each(stages)` 「%s: 関係する原則(principles)が1〜2個あり、重複しない」
  - `principles` が未定義 → 失敗(全ステージに付ける)
  - 個数が 0 / 3 以上 → 失敗
  - 同じ値が2回 → 失敗
- 「原則の表は全原則に空でない表示名と40文字以内の説明を持つ」
  - `Object.entries(DESIGN_PRINCIPLES)` の各 `label`・`summary` が `trim()` 後に空でない
  - `summary.length <= 40`(1行に収める)

`Record<DesignPrinciple, ...>` の網羅は型チェックで守るので、テストでは重ねない。マッピング表そのもの(どのステージに何を付けるか)を
テストで二重に書くことはしない(表の写しになるだけで、変えるたびに2か所を直すことになる)。評価者は本仕様の表と実装を突き合わせる。

### E2E(Playwright)

- `e2e/roadmap.spec.ts` の「ステージ一覧を開き…」のテストに、`roadmap-principles-tutorial-extract-method` が `SRP(単一責任)` を含む、
  `roadmap-principles-advanced-discount-strategy` が `OCP(開放閉鎖)` を含む、の確認を足す。
- `e2e/change-pain.spec.ts` の「100点で理由を見せて…」のテスト(チュートリアル2)で、`reason`(「なぜ分けるのか」領域)が
  `関係する原則: SRP(単一責任)` を含むことを足す。

## 受け入れ基準

1. `npm run dev` で開き、ヘッダーの「ステージ一覧」を開くと、全24ステージのカードに、既存のタグの下に `原則` の見出しと
   上の表どおりのバッジ(例: チュートリアル1は `SRP(単一責任)`、上級3は `OCP(開放閉鎖)`、上級8は `DRY(重複の排除)` と `OCP(開放閉鎖)` の2つ)が出る。
2. 原則のバッジは既存の技法タグと枠線の色で見分けられ、カードをクリック・Enter で選ぶ既存の動き(ステージ移動・ダイアログが閉じる)は変わらない。
3. チュートリアル2を100点にして「なぜ分けるのか」カードを開くと、`stage.why` の本文の直後に
   `関係する原則: SRP(単一責任) — 1つのクラス・メソッドが変わる理由は1つにする` が1行出る。
   原則が2つのステージ(例: 上級7)では2行出る。
4. 100点になる前(変更の痛みカードの「もし、この変更が来たら?」や手直しの段階)には原則の行が出ない。
5. 原則を付けても、全ステージの初期点・模範解答の点(`stageCatalog.test.ts` の既存テスト)は変わらない。
6. `stageCatalog.test.ts` に足した2つのテストが通り、どれか1ステージの `principles` を消すとそのテストが落ちる。
7. `npm run check` と `npm run test:e2e` が通る。

## スコープ外

- 原則を採点・減点・AI講評に使うこと(表示のみ)。
- 白紙設計モード(`src/infrastructure/blankDesigns/blankDesignProblems.ts`、型は `BlankDesignProblem`)・比較クイズへの原則の付与。
- ステージ一覧の表(`npm run stage-report` が出す `docs/stages/report.md`、`src/infrastructure/stages/stageReport.ts`)への原則の列の追加。
- 理解度チェック(`Stage.checks`)の問題文・解説に原則の名前を織り込むこと(`concept-check` の範囲)。
- `stage.why` の本文の書き換え(`why-split-change-pain` の範囲)。原則の行は `why` の外に足すだけにする。
- 既存の `learns` の書き換え(設計判断7)。
- 原則ごとの詳しい解説ページ・用語集、原則でステージを絞り込む・並べ替える機能、原則バッジのツールチップ。
- LSP(リスコフの置換原則)など、今のステージに対応する題材がない原則の追加。題材のステージを作るときに Union と表に足す。
