# 継承・実装が必要なステージで、サイドバーに設定のしかたを常に表示する

## 背景・目的

上級1(通知クラスの基底クラス)・上級2(決済のインターフェース)・上級3(割引のStrategy)・上級6(複数インターフェース)・上級8(取り込みのTemplate Method)など、
クラスに親クラスを設定(`extends`)したりインターフェースを実装(`implements`)させたりする操作が必要なステージで、
プレイヤーが「継承のやり方が分からない」状態になっている。

操作方法は**クラスの名前を右クリック → 「継承元を設定」/「実装するインターフェースを設定」→ 相手を選ぶ**で、画面上にこの導線を示すボタンは無い。
課題文は「implements を設定しよう」のように操作の目的を書くだけで、方法には触れていない。
方法が書かれているのは、「ヒントを見る」を何回か押して解答の手順を開いたときの1行(`describeSolutionStep.ts`)だけで、
ヒントを使わないと分からない。

そこで、継承・実装が必要なステージでは、左サイドバー(課題とヒント)に**設定のしかたの説明を最初から表示**する。
どのステージでその操作が要るかは、ステージごとに手書きせず、模範解答の手順(`sampleAnswerSteps`)から導く。

## 変更対象ファイル一覧

| パス | 層 | 新規/変更 | 役割 |
| --- | --- | --- | --- |
| `src/domain/stage/usesInheritanceOperations.ts` + `.test.ts` | domain | 新規 | `usesInheritanceOperations(stageId): boolean`。`sampleAnswerSteps[stageId]` の手順に `setSuperclass` / `addInterface` / `removeInterface` が1つでもあれば `true`(TDD) |
| `src/presentation/canvas/menuLabels.ts` | presentation | 新規 | 右クリックメニューの項目名の定数(`継承元を設定`・`実装するインターフェースを設定`・`(解除)`)。メニュー・ヒント・説明が同じ文言を使い、食い違わないようにする |
| `src/presentation/canvas/CanvasContextMenu.tsx` | presentation | 変更 | 項目名の文字列リテラルを `menuLabels.ts` の定数に置き換える(挙動は変えない) |
| `src/presentation/stage/describeSolutionStep.ts` | presentation | 変更 | 「継承元を設定」「実装するインターフェースを設定」の文字列を同じ定数に置き換える(挙動は変えない) |
| `src/presentation/stage/InheritanceGuide.tsx` | presentation | 新規 | サイドバーに出す説明のコンポーネント(下記の文面) |
| `src/presentation/stage/StagePanel.tsx` | presentation | 変更 | サイドバーの「課題」と `HintList` の間に、`usesInheritanceOperations(stage.id)` が `true` のときだけ `<InheritanceGuide />` を出す |
| `src/index.css` | presentation | 変更 | 説明の見た目(サイドバーの文字サイズ・余白に合わせる。`.stage-panel__description` と同系統) |
| `e2e/` | E2E | 追加 | 継承・実装が要るステージで説明が出る、要らないステージで出ない、を確認する |

## 表示する内容

サイドバーの「課題」の下に、折りたためる `<details open>`(「どんなコード?」と同じ形)で表示する。見出しは「継承・実装の設定のしかた」。

1. 子にしたいクラスの名前(クラスの枠の上のほう)を**右クリック**する
2. 次のどちらかを選ぶ
   - 「継承元を設定」→ 親クラスを選ぶ(`extends`。親の実装を引き継ぐ)
   - 「実装するインターフェースを設定」→ インターフェースを選ぶ(`implements`。約束だけを共有する)
3. 設定すると、子から親へ矢印が引かれ、クラス名の横に `extends` / `implements` と表示される
4. 外すときは、同じメニューの「(解除)」を選ぶ(間違えたときは Ctrl+Z でも戻せる)

- 文面の項目名は `menuLabels.ts` の定数を埋め込む(文言を手で複写しない)
- 課題文が「implements」と言っているステージで、どちらを選ぶか迷わないよう、2の各項目には括弧書きの違い(上記)を添える。ステージごとの出し分けはしない(全ステージ同じ文面)
- 説明は1画面に収まる短さにする(5〜8行程度)。サイドバー幅(260px)で折り返して読める

## データ・型の変更

なし。`Stage` に新しいフィールドは足さない(「その操作が要るか」は `sampleAnswerSteps` から導く)。
ponytail: 模範解答に手順が無いステージ(自由に設計するステージ)では説明が出ない。そのようなステージで継承が必要になったら、模範解答を足すか `Stage` に明示的なフラグを足す。

## TDD対象の純粋関数

`usesInheritanceOperations(stageId)`。テスト(AAA):

1. `setSuperclass` の手順を持つステージID(例: `advanced-notifier-hierarchy`)→ `true`
2. `addInterface` の手順を持つステージID(例: `advanced-discount-strategy`)→ `true`
3. `removeInterface` の手順だけを持つ手順列(`sampleAnswerSteps` を差し替えた場合)→ `true`
4. 継承・実装の手順を含まないステージID(例: `tutorial-extract-method`)→ `false`
5. 模範解答が登録されていないステージID → `false`

`InheritanceGuide` は表示コンポーネントなのでユニットテスト対象外とし、E2Eで守る。

## 受け入れ基準

- `npm run check`(lint + typecheck + test)が通る
- `npm run test:e2e` が通る(右クリックメニューの項目名を使う既存E2Eが、定数化後も変更なしで通る)
- 上級1・上級2・上級3・上級6・上級8を開くと、サイドバーに「継承・実装の設定のしかた」が**ヒントを押さなくても**表示される
- チュートリアル・初級・中級など、継承・実装の手順が模範解答に無いステージには表示されない
- 説明の項目名が、実際の右クリックメニューの項目名と一字一句同じ(定数を共有しているため)
- 説明は `<details open>` で、プレイヤーが閉じられる。ステージを切り替えると、そのステージの既定(開いた状態)に戻る
- 説明を読んだとおりに操作して、上級3で `NewClass` に `DiscountStrategy` を実装させられる(E2Eで、説明に出てくる項目名のメニューを実際にたどる)
- 既存のヒント(解答の手順)の文言は、項目名が定数に変わる以外変わらない
- ライトモード・ダークモードどちらでも読める(サイドバーの既存のスタイルと同じ変数を使う)

## スコープ外

- 継承・実装を設定するボタンをクラスの枠に常時出すこと、ドラッグで設定できるようにすること(別の案。今回は説明だけ)
- 白紙設計モード(`BlankDesignPanel`)の説明の追加(別のパネル。右クリックの説明は既にある)
- 変更依頼パネル(`ChangeRequestPanel`)の説明の変更
- `extends` と `implements` の使い分けの学習解説(いつどちらを使うべきか。設計の良し悪しは採点とAI講評が担当する)
- 線の色・矢じりの見た目(`extends-implements-edge-colors` Issue #43、`inheritance-arrow-clarity` Issue #42 の担当)
