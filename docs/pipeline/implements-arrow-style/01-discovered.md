# 01 機能探索: 実装(implements)の矢印を、継承(extends)の矢印と見た目で見分けられるようにする

- slug: `implements-arrow-style`

## 出どころ

新規探索(`docs/pipeline/USER_FIXES.md` のキュー一覧は「まだ項目はありません」で、未完了項目 `### [ ]` が無かった)。

既存仕様書の「スコープ外」で、**2回続けて先送りされていたもの**:

> - 「実装(implements)」を表す新しい矢印スタイル(破線など)。表示テキストの出し分け(`superclassKind`)のみ行い、
>   矢印の色・線種は継承と共通のままにする。
>   (`docs/specs/advanced-payment-gateway-interface.md` 204〜205行目)

> - **implements の矢印を破線など別の見た目にすること**: 継承と同じ見た目のまま(ラベルで区別できる)
>   (`docs/specs/interface-segregation-stage.md` 499行目)

## 背景・目的

キャンバスの矢印は今、次の3種類の見た目しかない(`src/presentation/canvas/layoutCodebase.ts`・`src/index.css` 166〜167行目)。

| 関係 | 今の見た目 | className |
| --- | --- | --- |
| 依存(メソッド呼び出し・フィールド参照) | 既定色・塗りつぶしの矢じり | なし |
| 循環している依存 | 赤・塗りつぶしの矢じり | `edge--cyclic` |
| 継承(`superclassId`)**と**実装(`interfaceIds`) | アクセント色・輪郭だけの矢じり | どちらも `edge--inheritance` |

`inheritanceEdges` は `parentIds(codeClass)`(継承元 → 実装先の順)をまとめて回しており、**extends と implements が同じ線・同じ矢じり・同じクラス名**になる。
見分ける手段はクラスのヘッダーの文字(`SuperclassLabel.tsx` の ` extends A implements B`)だけで、矢印をたどってもどちらの関係かは分からない。

- 上級ステージの半分がこの2つの関係を題材にしている: 継承は上級1(共通処理を基底クラスへ)・上級5(子が1つの継承を畳む)・進行中の `template-method-stage`、
  実装は上級2(DIP)・上級3(Strategy)・上級6(ISP。1クラスが複数のインターフェースを実装する)。
  「継承で実装を共有しているのか、インターフェースで約束だけ共有しているのか」は、これらのステージの学びの核そのものである。
- 対象プレイヤー(新卒〜4年目)がこれから現場で読むクラス図(UML)では、汎化(extends)は実線、実現(implements)は**破線**で描き分けるのが定石。
  ゲームの図が同じ描き分けをしていれば、ゲームで身につけた見方がそのまま実務の図の読み方につながる。
- 上級6の模範解答は `BacklogClient` の `implements ChatClient` を外して `TaskTracker` を付けるなど、実装先の付け替えが解き方の中心で、
  矢印だけ見て「どれが implements か」を追えないと、ヘッダーの文字と矢印の行き先を1本ずつ突き合わせることになる。
- 設計くらべクイズ・「変更前の図」・「解答例の図」(`CodebasePreviewCanvas.tsx`)も同じ `inheritanceEdges` を使うので、1か所直せばすべての図に効く。

ponytail の階段では「ブラウザ・CSS・React Flow の標準機能でできるか?」で止まる見込み: 辺の `className` を関係の種類で分け、
CSS の `stroke-dasharray` で破線にするだけ。domain・application・ストア・新しい依存は要らない。

### 既存テーマとの重複確認

- `class-dependency-focus`(02作成済み): 注目したクラスに出入りする矢印を**太く・濃く**し、他を薄くする。矢印の**種類**の描き分けはしない。
  02で `dependencyEdges` / `inheritanceEdges` は「変更しない」、既存の `className`(`edge--cyclic` / `edge--inheritance`)は「残して空白区切りで足す」と明記しており、
  本件で実装の辺に別のクラス名を足しても、その前提は崩れない(補い合う関係)
- `docs/specs/inheritance.md`・`advanced-payment-gateway-interface.md`・`interface-segregation-stage.md`: 継承・実装の矢印を足した仕様。見た目の描き分けは上のとおりスコープ外 → 今回はその続き
- `color-contrast-a11y`(02作成済み): 文字色のコントラスト。矢印などの非テキストは「スコープ外」と明記。`--accent` の値を変えるが、本件は色を変えない
- `operation-guide`(02作成済み): **操作**のやり方の一覧。矢印の読み方(凡例)は扱わない
- `docs/specs/` 24件・`docs/pipeline/*/01-discovered.md` 23件を `破線|implements の矢印|inheritanceEdges|edge--inheritance|凡例` でgrepし、
  主題にしたものは無い(上の2つの仕様のスコープ外と、`class-dependency-focus` の参照・未決事項だけ)
- 呼び出し元が列挙した23件のslugのいずれとも主題が重ならない

### 検討して見送った候補

- **継承より委譲(Replace Inheritance with Delegation)・Push Down Method のステージ**: 題材としては足りていないが、どちらも「使わない親のメソッドを抱えた子」
  を減点する新しい採点ルールが要る。`score.ts` は `duplicate-code-scoring`・`inline-method-stage` が末尾に追記する予定で、ステージ追加もすでに4件並走している
- **フィールド参照による依存の矢印を、メソッド呼び出しの矢印と描き分ける**(`docs/specs/fields-and-feature-envy.md` のスコープ外): 辺の種類を知るために
  `classDependencies`(`src/domain/codebase/dependencies.ts`。`method-call-references` が関数を足す可能性あり)の戻り値を変える必要があり、domain まで波及する。
  1本の矢印が両方の理由を持つ場合の見た目も決める必要があり、本件より大きい
- **クラスノードにファンイン・ファンアウトの数を出す**: `class-dependency-focus` の02がスコープ外として残したもの。`ClassNode.tsx`(`template-method-stage` が触る可能性)に差分が出る
- **Feature Envy のメソッドにキャンバス上で個別の印を付ける**: `score-deduction-locations` が減点原因のメソッド名を出すので、困りごとが半分以上重なる
- **フィールド宣言の行数を数える**(`Codebase.ts` の ponytail コメント): 全ステージの点数が動き、進行中のステージ追加4件の数値の試算をやり直させてしまう
- **部品置き場の ⚠️ を消す・白紙設計の結果の保存**: 前者は過去の探索と同じく YAGNI(邪魔だという声がまだ無い)、後者は `blank-design-second-problem` が同じ画面を触る

## 関連する既存コード

- `src/presentation/canvas/layoutCodebase.ts` — **主な変更先**。`inheritanceEdges`(290〜317行目)が `parentIds` を回して `className: "edge--inheritance"`・
  `MarkerType.Arrow` の辺を作る。`superclassId` 由来か `interfaceIds` 由来かを分けて `className` を変える形になる見込み。
  辺のID `inherit-<子>-<親>` は E2E が使っているので変えない(`setSuperclass.ts` が同じクラスを継承元と実装先の両方にすることを `already-related` で弾くので、IDは重ならない)
- `src/presentation/canvas/layoutCodebase.test.ts` — `describe("inheritanceEdges")`(214行目〜)。継承の辺の `className` を `"edge--inheritance"` と**完全一致**で見ているテスト(245行目)と、
  2つのインターフェースを実装したクラスの辺のID(343〜362行目)がある。実装の辺の `className` のテストを先に足す先
- `src/domain/codebase/Codebase.ts` — `superclassId`・`interfaceIds`・`parentIds`。**読むだけ**
- `src/index.css` 166〜167行目 — `.edge--cyclic`・`.edge--inheritance` のスタイル。実装の辺の破線を足す先
- `src/presentation/canvas/TopRouteEdge.tsx` — ファイルを飛び越える辺のカスタムエッジ。`BaseEdge` は `<g class="react-flow__edge …">` の中に描かれるので、
  `className` によるCSSはそのまま効く見込み(`class-dependency-focus` の02と同じ見立て)。**変更不要の見込み**
- `src/presentation/canvas/CodebaseCanvas.tsx`(131行目)・`src/presentation/preview/CodebasePreviewCanvas.tsx`(22行目) — `inheritanceEdges` の呼び出し元。**変更不要の見込み**
- `src/presentation/canvas/SuperclassLabel.tsx` — ヘッダーの ` extends A implements B`。文字での区別の今の手段(**読むだけ**)
- `src/infrastructure/stages/advancedStages.ts`(上級6の `interfaceIds`)・`src/domain/stage/sampleAnswer.ts`(上級2・3・6の `addInterface`) — E2E で実装の矢印を確かめる題材の候補(**読むだけ**)
- `e2e/refactor.spec.ts` 533〜549行目(継承元を設定すると `edge--inheritance` の辺が出る)・551〜569行目(実装するインターフェースを設定すると `implements` の表示が出る。
  **矢印の見た目は確かめていない**)・571行目〜(2つ実装すると矢印2本) — E2E を足す・広げる先
- `docs/specs/inheritance.md` 59〜72行目 — 継承の矢印の見た目を決めた経緯

## スコープの見立て

小さい。1回のPRに十分収まる。presentation 層の1ファイル(`layoutCodebase.ts`)とそのテスト、CSS 1〜2行、E2E 1本が中心。
domain / application / infrastructure・ストア・ステージデータは変更しない見込み。`inheritanceEdges` は純粋関数なので、既存テストに倣い Vitest でテストを先に書ける。

1. **今回やる**: 実装(`interfaceIds`)の矢印を、継承(`superclassId`)の矢印と線種で見分けられるようにする(UML に倣って実装を破線にする想定)。
   リファクタリング画面のキャンバスと、読み取り専用の図(`CodebasePreviewCanvas`)の両方に効く。継承の矢印の見た目・依存の矢印・辺のIDは変えない
2. **後回し**:
   - キャンバス上の凡例(依存・循環・継承・実装の4種類の矢印の読み方)。置くなら `CodebaseCanvas.tsx` に React Flow 標準の `<Panel>` を足すことになり、
     `class-dependency-focus` と同じファイルに差分が出るため、そのマージ後に
   - 矢じりを UML どおりの白抜き三角にする(React Flow の `MarkerType` には無く、独自の SVG マーカーが要る)
   - 依存の矢印を「呼び出し」と「フィールド参照」で描き分ける(上の見送り候補)

仕様設計者に決めてほしい論点(ここでは決めない):

- **`className` の付け方**: 実装の辺を `"edge--inheritance edge--implements"`(継承の色・太さを引き継ぎ、破線だけ足す)にするか、
  `"edge--implements"` 単独(継承と別の見た目を一から決める)にするか。前者なら既存 E2E(`toHaveClass(/edge--inheritance/)`)と
  `class-dependency-focus` の「`edge--inheritance` が残る」前提がどちらも崩れない
- **見た目**: 破線だけで足りるか(色は継承と同じアクセント色のまま)。破線の間隔、矢じりを変えるか。色だけに頼らず線種で区別すること(アクセシビリティ)
- **スクリーンリーダー向けの文字**: React Flow の `Edge` の `ariaLabel` に「A は B を継承」「A は B を実装」を付けるか。
  今の矢印には文字の説明が無く(`class-dependency-focus` の未決事項4も「今回は伝えない」を推奨)、付けるなら依存の矢印との揃え方も決める必要がある
- **凡例を今回に含めるか**(上の後回しを推奨する理由は `CodebaseCanvas.tsx` の競合)
- **E2E の題材**: 既存の 551行目のテスト(チュートリアル2で実装先を設定する)に矢印の見た目の確認を足すか、新しいテストにするか。
  「継承の辺には `edge--implements` が付かない」ことも一緒に確かめるか
- **白紙設計・変更依頼の部品置き場**: 同じ `inheritanceEdges` を使うので自動で効く。特別扱いは要らない、でよいか

### 既存パイプラインとの衝突可能性

- **`src/presentation/canvas/layoutCodebase.ts`**: `class-dependency-focus` の02が純粋関数 `focusClassEdges` を**追加**する予定(`dependencyEdges` / `inheritanceEdges` は「変更しない」と明記)。
  本件の差分は `inheritanceEdges` の本体(290〜317行目)の中だけにすれば、相手の追加位置(ファイルの末尾付近の見込み)とは離れ、テキスト上の競合は小さい。
  他の23件で `layoutCodebase.ts` を変更すると書いているものは無い(`quiz-change-site-marks` の02は「変更しない」と明記)
- **`src/presentation/canvas/layoutCodebase.test.ts`**: `class-dependency-focus` が `describe("focusClassEdges")` を足す予定。本件は `describe("inheritanceEdges")` の中に
  `it` を足すだけにすれば、追記位置は離れる
- **`src/index.css`**: `class-dependency-focus` の02が `.edge--focused` / `.edge--dimmed` を「166〜167行目の**直後**」に足す予定で、同じ位置に追記すると
  git の競合になる。本件の破線(`stroke-dasharray`)は相手の `opacity` / `stroke-width` と打ち消し合わないので、詳細度の順番は問わない。
  **167行目の直後ではなく、166行目の直前(`.edge--cyclic` の前)に1行置く**ことで、追記位置をずらせる。
  `color-contrast-a11y` は `--accent` の値を変えるが、本件は色を変えないので影響しない
- **意味上の衝突**: `class-dependency-focus` の02の未決事項3の選択肢B(「入ってくる矢印を**破線**の太線にする」)が採られると、「破線 = 実装」と意味がぶつかる。
  同02は選択肢A(区別しない)を推奨しているが、本件の仕様設計ではこの点を明記し、どちらが先にマージされても破線の意味が1つに保たれるようにしてほしい
- **`e2e/refactor.spec.ts`**: 多くのパイプラインが追記する。本件は 551〜569行目の既存テストの Assert に1〜2行足すか、その直後に1本足す程度で、
  他の件の追記位置(変更依頼の結果・名前の変更・右クリックメニューの移動など)とは離れる見込み。新しい spec ファイルに置けば競合は無い
- **意味上の依存(ステージの追加)**: `template-method-stage`(継承)・`law-of-demeter-stage` などが追加するステージにも、`inheritanceEdges` を通るので自動で効く。
  E2E はそれらが題材を変えないチュートリアル2で確かめれば、マージ順に左右されない
- `src/domain/`・`src/application/`・`src/infrastructure/`(ステージ定義・`sampleAnswer.ts`・`stageCatalog.test.ts` を含む)・`useGameStore.ts`・`score.ts`・`describeScore.ts`・
  `StagePanel.tsx`・`CodebaseCanvas.tsx`・`CodebasePreviewCanvas.tsx`・`ClassNode.tsx`・`FileNode.tsx`・`MethodChip.tsx`・`CanvasContextMenu.tsx`・`MethodEditor.tsx`・
  `SuperclassLabel.tsx`・`TopRouteEdge.tsx`・`workers/critique/` には触らない想定
