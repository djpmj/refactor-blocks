# pattern-comparison-table: ステージ一覧に、似たデザインパターンを横並びで見比べる「パターン比較」表示を足す

## 背景・目的

実機で確かめたこと: 上級ステージ(上級3 Strategy・上級4 Factory・上級6 ISP・上級8 Template Method・上級9 State)は
1ステージずつ個別に遊ぶだけで、似たパターン同士(Strategy と State、Strategy と Template Method など)の
使い分けを並べて確かめられる画面が無い。上級9の理解度チェックでも「Strategy と State は形が似ていても使い分けが要る」と
問うているのに、見比べる場所が無い(`docs/specs` で「比較表」が出てくるのは change-request の変更容易性スコア比較だけで、別物)。

ステージ一覧ダイアログ(`StageRoadmapDialog`)には既に「ステージ順 / 学べることごと」の表示切替があるので、
そこに3つ目の表示「パターン比較」を足し、パターンごとに「いつ使う・何が変わる・クラス構成の特徴・向かない場面」を
横並びの表で出す。内容は静的データで、採点や進捗とは連動しない。

ponytail: 新しいダイアログやボタンは要らない(既存の `ViewSwitch` に1つ足せば足りる)。新しい依存も足さない。

## 変更対象ファイル一覧

| 種別 | パス | 層 | 役割 |
| --- | --- | --- | --- |
| 新規 | `src/presentation/stage/patternComparison.ts` | presentation | 比較表の静的データ `PATTERN_COMPARISON`(`levelLabel.ts` と同じく表示用の定数) |
| 新規 | `src/presentation/stage/patternComparison.test.ts` | presentation | 静的データとステージ定義のずれを検出するテスト |
| 新規 | `src/presentation/stage/PatternComparisonTable.tsx` | presentation | 比較表を描く表示コンポーネント |
| 変更 | `src/presentation/stage/StageRoadmapDialog.tsx` | presentation | `RoadmapView` に `'patterns'` を足し、`ViewSwitch` に「パターン比較」ボタンを足す |
| 変更 | `src/index.css` | presentation | 比較表のスタイル(`.pattern-comparison` 系)。横にはみ出す場合は横スクロール |
| 変更 | `e2e/roadmap.spec.ts` | (E2E) | パターン比較表示のE2Eを追加 |

domain / application / infrastructure は変更しない(ステージ定義 `src/infrastructure/stages/advancedStages.ts` も変更しない)。

## データ・型の変更

`src/presentation/stage/patternComparison.ts` に次を定義する。

```ts
export type PatternComparisonEntry = {
  readonly name: string;        // 列見出し(パターン名)
  readonly stageId: string;     // そのパターンを学べるステージのID
  readonly whenToUse: string;   // いつ使う
  readonly whatVaries: string;  // 何が変わる(差し替わる・増えるもの)
  readonly structure: string;   // クラス構成の特徴
  readonly notSuitedFor: string; // 向かない場面
};

export const PATTERN_COMPARISON: readonly PatternComparisonEntry[] = [ /* 下表の5件、この順 */ ];
```

内容(この順・この文言を基本とする。句読点や言い回しの微修正は実装者の裁量でよい):

| name | stageId | whenToUse | whatVaries | structure | notSuitedFor |
| --- | --- | --- | --- | --- | --- |
| Strategy | `advanced-discount-strategy` | 同じ目的の計算や処理に、やり方が何通りもあり、呼び出し側が外から選びたいとき | やり方(アルゴリズム)そのもの。新しいやり方はクラスを1つ足すだけ | 共通のインターフェースと、それを implements する方式ごとのクラス。使う側はインターフェースだけを持つ | やり方が1〜2通りで増える見込みが無いとき(if 1つで足りる) |
| State | `advanced-order-state` | オブジェクトの状態によって同じ操作の振る舞いが変わり、状態が移り変わるとき | 今の状態と、その状態での振る舞い。次の状態への遷移も状態クラスが知る | 状態ごとのクラスが共通のインターフェースを implements し、持ち主は今の状態を1つ持って処理を任せる | 状態が少なく遷移も単純なとき。外から方式を選ぶだけなら Strategy で足りる |
| Template Method | `advanced-template-method` | 処理の手順(順番)は同じで、一部のステップだけが種類ごとに違うとき | 手順の中の一部のステップだけ。手順の順番は変わらない | 基底クラスが手順を決めるメソッドを持ち、違うステップだけを子クラスが extends して上書きする | 手順そのものが種類ごとに違うとき。継承が深くなりそうなら Strategy で組み合わせる |
| Factory | `advanced-report-factory` | どのクラスを new するかの判断が、あちこちに散らばっているとき | 生成するクラスの種類。種類が増えても直すのは生成をまとめた場所だけ | 生成の分岐を1つのクラス(Factory)に集め、使う側は Factory から受け取ったものを使う | 生成するものが1種類で、分岐が無いとき |
| ISP(インターフェース分離) | `advanced-interface-segregation` | 1つのインターフェースに、使わないメソッドまで実装させられるクラスがあるとき | 役割ごとの小さなインターフェースの組み合わせ。必要な役割だけを implements する | 太いインターフェースを役割ごとに分け、各クラスは使う役割だけを implements する | どの実装もすべてのメソッドを本当に使うとき(分けると無駄に増えるだけ) |

ISP はデザインパターンではなく原則だが、上級ステージで implements を使って構成を組み替える点が共通なので同じ表に並べる(列見出しで「インターフェース分離」と補う)。

## 動きの仕様

- ステージ一覧ダイアログの表示切替に、「ステージ順」「学べることごと」に続けて「パターン比較」ボタン(`data-testid="roadmap-view-patterns"`、`aria-pressed`)を足す。
- 「パターン比較」を選ぶと、ステージカード・習得状況の代わりに比較表(`data-testid="pattern-comparison"`)を出す。
  - HTMLの `<table>` を使い、1行目が列見出し(パターン名、`<th scope="col">`)、2行目以降が観点(「いつ使う」「何が変わる」「クラス構成の特徴」「向かない場面」の順、行見出しは `<th scope="row">`)。
  - 表には `<caption>` で「似たパターンの使い分け」と付ける(スクリーンリーダー向けの名前)。
  - 各列見出しの下に、そのステージへ移るボタン(ステージの `title` を表示、`data-testid="pattern-stage-<stageId>"`)を置く。押すと既存の `choose(stageId)` を呼び、ステージを移ってダイアログが閉じる(今いるステージなら閉じるだけ。既存の振る舞いと同じ)。
  - ステージのタイトルは `useGameStore` の `stages` から `stageId` で引く。見つからない列はボタンを出さない(テストでずれを検出するので通常は起きない)。
  - 表がダイアログの幅を超える場合は、表を包む要素に `overflow-x: auto` を付けて横スクロールにする(セルの文字は折り返す)。
- 閉じて再度開くと「ステージ順」に戻る(既存の `handleClosed` の `setView('stages')` のまま)。
- 「学べることごと」と同様、下部の `LearningRecordSection` は表示切替に関係なく出たままでよい。
- 進捗(クリア済みか)は表に出さない。

## TDD対象

ロジックは静的データのみで domain/application の新規関数は無い。データのずれを防ぐテストだけ先に書く。

### `PATTERN_COMPARISON`(presentation)

`src/presentation/stage/patternComparison.test.ts` で `src/infrastructure/stages/stageCatalog.ts` の `stages` と突き合わせる。

- すべての `stageId` が `stages` に存在する(正常系)
- すべての `stageId` のステージの `level` が `'advanced'` である
- `name` が重複しない、`stageId` が重複しない
- 4つの観点(`whenToUse`・`whatVaries`・`structure`・`notSuitedFor`)がどれも空文字でない
- 件数が5件で、並び順が Strategy → State → Template Method → Factory → ISP(インターフェース分離)

## 受け入れ基準

1. `npm run dev` でステージ一覧を開くと「ステージ順」「学べることごと」「パターン比較」の3つの切替ボタンがあり、「パターン比較」を押すと `aria-pressed="true"` になって比較表が出る。
2. 比較表の列見出しが Strategy・State・Template Method・Factory・ISP(インターフェース分離)の順に並び、行見出しが「いつ使う」「何が変わる」「クラス構成の特徴」「向かない場面」の順に並ぶ。
3. 比較表の「上級9: 注文の状態ごとの分岐を State パターンへ組み替える」ボタンを押すと、そのステージへ移ってダイアログが閉じる。
4. キーボードだけ(Tab で「パターン比較」へ移って Enter、Tab で列のステージボタンへ移って Enter)で同じ操作ができる。
5. ウィンドウ幅を狭めても表がダイアログからはみ出さず、横スクロールで全列を見られる。
6. 「パターン比較」に切り替えて閉じ、再度開くと「ステージ順」が選ばれている。
7. `e2e/roadmap.spec.ts` に、上記 1〜3 と 6 を確かめるテストを追加している。
8. `npm run check` と `npm run test:e2e` が通る。

## スコープ外

- パターンごとのクラス図・コード例の表示(文章の表で足りるか、まず遊んでもらってから判断する)
- 比較表への進捗(クリア済み)表示や、比較表を見たことの記録・採点
- Collapse Hierarchy・Value Object・継承(上級1・5・7)など、他の上級ステージの列の追加(似たパターンの使い分けという目的から外れるため。要望が出たら行を足すだけで済む)
- ステージ画面(StagePanel・クリア画面)から比較表を開く導線
- 比較表の内容をステージ定義(`Stage` 型)へ持たせる・AI講評で使うこと
- プレイヤーにパターン名やクラス名を答えさせる・採点すること
