# 仕様草案: 実装(implements)の矢印を破線にし、継承(extends)の矢印と見分けられるようにする

- slug: `implements-arrow-style`
- 元になった探索: `docs/pipeline/implements-arrow-style/01-discovered.md`
- 関連する既存仕様: `docs/specs/inheritance.md`(継承の矢印の見た目を決めた)、
  `docs/specs/advanced-payment-gateway-interface.md`(204〜205行目)・`docs/specs/interface-segregation-stage.md`(499行目)
  (どちらも「implements の矢印を別の見た目にする」をスコープ外として先送りしていた)

## 1. 背景・目的

- `inheritanceEdges`(`src/presentation/canvas/layoutCodebase.ts` 290〜317行目)は `parentIds(codeClass)`(継承元 → 実装先の順)をまとめて回し、
  継承も実装も `className: "edge--inheritance"`・`MarkerType.Arrow` の同じ辺にしている。矢印だけを見ても extends か implements か分からず、
  今はクラスのヘッダーの文字(`SuperclassLabel.tsx` の ` extends A implements B`)と矢印の行き先を1本ずつ突き合わせるしかない。
- 上級1・5(継承)と上級2・3・6(インターフェースの実装)は、まさに「実装を共有しているのか、約束だけを共有しているのか」が学びの核。
  特に上級6(ISP)は implements の付け替えが解き方の中心。
- プレイヤー(新卒〜4年目)が実務で読む UML のクラス図は、汎化(extends)を実線、実現(implements)を**破線**で描く。同じ描き分けにすれば、
  ゲームで身につけた図の読み方がそのまま実務につながる。
- 「変更前の図」「解答例の図」(`CodebasePreviewDialog.tsx`)・設計くらべクイズ(`ComparisonQuizView.tsx`)は、どちらも
  `CodebasePreviewCanvas.tsx` 22行目で同じ `inheritanceEdges` を使っている。白紙設計・変更依頼の部品置き場もキャンバス(`CodebaseCanvas.tsx` 131行目)経由で
  同じ関数を通る。**1か所直せばすべての図に効く**ので、呼び出し側の変更も特別扱いも要らない。

**本当に新しい仕組みが要るか**: 要らない(ponytail の階段4「CSS の標準機能」で止まる)。

- 辺の種類は `codeClass.superclassId === parentId` で分かる(`setSuperclass.ts` / `addInterface` が同じクラスを extends と implements の両方にすることを
  `already-related` で弾いているので、判定は1つの比較で足りる)。`parentIds` や domain の戻り値を変える必要は無い。
- 見た目は辺の `className` を1つ足し、CSS の `stroke-dasharray` で破線にするだけ。React Flow の `animated`(破線が流れるアニメーション)は
  「動いている=データの流れ」と読まれかねないので使わない。
- 矢じり(`markerEnd`)は変えない。UML どおりの白抜き三角は `MarkerType` に無く独自の SVG マーカーが要るので、スコープ外にする。
- domain / application / infrastructure 層・ストア・ステージデータ・新しい依存は不要。

## 2. 変更対象ファイル一覧

| 種別 | パス | 層 | 役割 |
| --- | --- | --- | --- |
| 変更 | `src/presentation/canvas/layoutCodebase.ts` | presentation | `inheritanceEdges` の本体(290〜317行目)の中だけを変え、実装(`interfaceIds` 由来)の辺の `className` に `edge--implements` を足す。JSDoc(286〜289行目)に「実装は破線」を1行足す |
| 変更 | `src/presentation/canvas/layoutCodebase.test.ts` | presentation(test) | `describe("inheritanceEdges")` の中に `it` を足す(実装より先に書く)。`describe("focusClassEdges")` など他の `describe` には触らない |
| 変更 | `src/index.css` | presentation | `.edge--implements` の破線のスタイルを、**166行目(`.edge--cyclic`)の直前**に足す(下記「衝突の回避」) |
| 変更 | `e2e/refactor.spec.ts` | (E2E) | 533行目・551行目の既存テストの Assert に、矢印の `className` と破線の確認を数行足す |

変更しないもの: `src/domain/**`(`Codebase.ts` の `parentIds`・`superclassId`・`interfaceIds` は読むだけ)、`src/application/**`、`src/infrastructure/**`、
`useGameStore.ts`、`CodebaseCanvas.tsx`・`CodebasePreviewCanvas.tsx`(呼び出し方は変わらない)、`TopRouteEdge.tsx`(`BaseEdge` は
`<g class="react-flow__edge …">` の中に描かれるので、`className` による CSS がファイルを飛び越える辺にもそのまま効く)、`SuperclassLabel.tsx`、`ClassNode.tsx`、
`dependencyEdges`。

## 3. データ/型の変更

ドメインモデル・永続化スキーマ・ストアの変更は無し。`inheritanceEdges` のシグネチャ(`(codebase: Codebase) => Edge[]`)も変えない。

### 辺の出し分け(`inheritanceEdges` の中)

| 関係 | 判定 | `className` | `markerEnd` | 辺のID |
| --- | --- | --- | --- | --- |
| 継承(extends) | `parentId === codeClass.superclassId` | `"edge--inheritance"`(**今のまま**) | `{ type: MarkerType.Arrow }`(今のまま) | `inherit-<子>-<親>`(今のまま) |
| 実装(implements) | それ以外(= `interfaceIds` 由来) | `"edge--inheritance edge--implements"`(未決事項1で選択肢Aのとき) | 今のまま | 今のまま |

- 辺のIDは E2E(`rf__edge-inherit-…`)が使っているので変えない。
- 実装の辺にも `edge--inheritance` を残す(選択肢Aのとき)ことで、色・太さ(アクセント色・`stroke-width: 2`)は継承と同じまま引き継ぎ、破線だけが違いになる。
  既存 E2E の `toHaveClass(/edge--inheritance/)` と、`class-dependency-focus` の「既存の `className` は残して空白区切りで足す」前提がどちらも崩れない。
- 実装のヒント(強制ではない): `className: parentId === codeClass.superclassId ? "edge--inheritance" : "edge--inheritance edge--implements"`。
  lint の循環的複雑度(12以下)は今の本体でおよそ9〜10なので三項演算子1つなら収まる見込み。超える場合は同じファイル内に
  `inheritanceClassName(codeClass, parentId)` のような小さな関数を切り出す(新しいファイルは作らない)。

### 見た目(`src/index.css`)

166行目(`.react-flow__edge.edge--cyclic …`)の**直前**に、次の2行(コメント1行+ルール1行)を置く。

```css
/* 実装(implements)の矢印は UML の「実現」に倣って破線(継承 extends は実線のまま)。キャンバスの破線はこの意味専用にする */
.react-flow__edge.edge--implements .react-flow__edge-path { stroke-dasharray: 6 4; }
```

- 間隔は `6 4` を目安に、ズーム 0.3(`CodebasePreviewCanvas` の `minZoom`)でも破線と分かる範囲で実装者の裁量(5〜8 / 3〜5 程度)。
- 色は変えない(継承と同じ `var(--accent)`)。色ではなく線種で区別する(色覚に頼らない)。
- `.react-flow__edge-path` だけに効かせるので、矢じり(`<marker>` 内の線)は破線にならない。
- `stroke-dasharray` は `.edge--cyclic` / `.edge--inheritance` / `class-dependency-focus` の `.edge--focused`(`stroke-width`)・`.edge--dimmed`(`opacity`)の
  どのプロパティとも重ならないので、書く順番(詳細度の勝ち負け)は結果に影響しない。

### 衝突の回避(他パイプラインとの関係)

- **`layoutCodebase.ts` / `layoutCodebase.test.ts`**: `class-dependency-focus` は `focusClassEdges` を**追加**するだけで、`inheritanceEdges` は変更しないと明記している。
  本件の差分は `inheritanceEdges` の本体とその JSDoc、テストは `describe("inheritanceEdges")` の中だけにとどめる。
- **`index.css`**: `class-dependency-focus` は `.edge--focused` / `.edge--dimmed` を166〜167行目の**直後**に足す予定。本件は**166行目の直前**に置き、
  追記位置をずらして git の競合を避ける。
- **意味上の衝突**: `class-dependency-focus` の02の未決事項3・選択肢B は「入ってくる矢印を**破線**の太線にする」案。これが採られると、
  本件の「破線 = 実装」と同じ見た目が別の意味を持ち、プレイヤーが読み違える。本件では**キャンバス上の破線は implements 専用**と定め、
  その扱いを未決事項4で確定させる(同02自身は選択肢A「区別しない」を推奨しているので、推奨どうしなら衝突しない)。
  どちらが先にマージされても破線の意味が1つに保たれるよう、最終仕様(04)にもこの約束を残すこと。
- **`e2e/refactor.spec.ts`**: 533〜549行目・551〜569行目の2本の Assert に数行足すだけにし、他のパイプラインの追記位置(ファイル末尾付近など)とは離す。

## 4. TDD対象の純粋関数

`inheritanceEdges`(presentation 層の純粋関数。既存テストに倣い Vitest で**実装より先に**書く)。`layoutCodebase.test.ts` の `describe("inheritanceEdges")` に追加。
1ケース1つの `it`、AAA パターン。

1. 正常系: `interfaceIds: ["class-A"]` のクラスから `class-A` への辺の `className` が `"edge--inheritance edge--implements"`
   (未決事項1で選択肢Bなら `"edge--implements"`)。`markerEnd` は `{ type: MarkerType.Arrow }`、ID は `inherit-<子>-<親>` のまま
2. 正常系: `superclassId: "class-A"` と `interfaceIds: ["class-X"]` を両方持つクラスから2本の辺ができ、`class-A` への辺の `className` は `"edge--inheritance"`
   (`edge--implements` を含まない)、`class-X` への辺は実装の `className`
3. 正常系: 2つのインターフェースを実装したクラス(既存の343行目と同じ形)の辺は、2本とも実装の `className`
   (既存の `it` に Assert を足すのではなく、新しい `it` にする)
4. 境界: 実装先が削除されて存在しないIDを指しているとき(`interfaceIds: ["class-deleted"]`)は辺を作らない(既存の「親が削除済み」は extends のケースしか無いため)
5. 既存: 245行目の「継承の辺の `className` が `"edge--inheritance"` と完全一致」はそのまま通る(= 継承の見た目は変わらない)

domain / application 層は変更しないので、カバレッジ閾値への影響は無い。CSS の見た目はユニットテストの対象外とし、E2E で守る。

## 5. 受け入れ基準

- [ ] 上記4のテストを先に書き(Red)、実装して通る(Green)。`layoutCodebase.test.ts` の既存テストもすべて通る
- [ ] リファクタリング画面のキャンバスで、implements の矢印は破線、extends の矢印は今までどおりの実線で描かれる(色・太さ・矢じりは両方とも今までと同じ)。
      依存・循環依存の矢印の見た目は変わらない
- [ ] ファイルを飛び越える実装の辺(`type: "topRoute"`)も破線になる
- [ ] 「変更前の図」「解答例の図」(例: 上級6の解答例で Chatwork の `implements ChatClient, TaskTracker` の2本)・設計くらべクイズでも、実装の矢印が破線になる
      (呼び出し側を変えずに効いていること)
- [ ] E2E(`e2e/refactor.spec.ts`)で次が通る
  - 533行目のテスト(継承元を設定): `rf__edge-inherit-class-tax-calculator-class-order-service` が `edge--inheritance` を持ち、
    `edge--implements` を**持たない**(`not.toHaveClass(/edge--implements/)`)。辺の中の `.react-flow__edge-path` の `stroke-dasharray` が `none` のまま
  - 551行目のテスト(実装するインターフェースを設定): 同じIDの辺が1本出て、`edge--implements` を持つ(選択肢Aなら `edge--inheritance` も持つ)。
    辺の中の `.react-flow__edge-path` の `stroke-dasharray` が `none` でない(`not.toHaveCSS('stroke-dasharray', 'none')`。CSS が実際に効いていることを確かめる)
  - 題材はチュートリアル2(`openOrderStage`)のまま。並走するステージ追加の影響を受けない
- [ ] 既存の E2E(継承の矢印・2つ実装すると矢印2本・上級ステージの継承の矢印 1230行目付近・ドラッグ&ドロップ・右クリックメニュー)がすべて通る
- [ ] `src/index.css` の追記が166行目(`.edge--cyclic`)の直前にあり、`.edge--cyclic` / `.edge--inheritance` の2行は変更していない
- [ ] `npm run check`(lint + typecheck + test)が通る

## 6. スコープ外

- **キャンバス上の凡例**(依存・循環・継承・実装の4種類の矢印の読み方)。置くなら `CodebaseCanvas.tsx` に React Flow 標準の `<Panel>` を足すことになり、
  `class-dependency-focus` と同じファイルを触る。未決事項3で「含める」にならない限り、そのマージ後に別の仕様で
- **矢じりを UML どおりの白抜き三角にする**。`MarkerType` に無く、独自の SVG `<marker>` 定義が要る。破線だけで区別できているうちは作らない
- **依存の矢印を「メソッド呼び出し」と「フィールド参照」で描き分ける**(`docs/specs/fields-and-feature-envy.md` のスコープ外)。`classDependencies` の戻り値を変える必要があり domain まで波及する
- 矢印の色の変更(`--accent` は `color-contrast-a11y` が値を変える予定。本件は色に触らない)
- 依存の矢印の `ariaLabel`(未決事項2で選択肢Cにならない限り)
- `CodebasePreviewCanvas` 専用の E2E(同じ純粋関数を通るのでユニットテストと画面の目視で足りる。壊れたという報告が出たら足す)
- React Flow の `animated`(流れる破線)の利用
- 白紙設計・変更依頼の部品置き場の特別扱い(同じ `inheritanceEdges` を通るので自動で効く)

## 未決事項

### 未決事項1: 実装の辺の `className` をどう付けるか

- 選択肢A(推奨): `"edge--inheritance edge--implements"`。継承の色・太さを引き継ぎ、破線だけを足す。CSS は1行で済み、既存 E2E の `toHaveClass(/edge--inheritance/)` と
  `class-dependency-focus` の前提(`edge--inheritance` が残る)がどちらも崩れない
- 選択肢B: `"edge--implements"` 単独。実装の見た目を継承と独立に決められる(将来色を変えるなど)が、色・太さのルールを1行重複して書くことになり、
  `edge--inheritance` を「継承・実装の両方」の意味で見ている箇所(`class-dependency-focus` のテストケース3など)の読み替えが要る

### 未決事項2: スクリーンリーダー向けに、矢印が継承か実装かを文字でも伝えるか

- 選択肢A(推奨): 今回は伝えない(見た目の線種だけ)。今の矢印にも文字の説明は無く、今回の変更でアクセシビリティが下がるわけではない。
  継承・実装の区別はクラスのヘッダーの文字(` extends A implements B`)で読める。`class-dependency-focus` の未決事項4(推奨: 今回は伝えない)とも揃う
- 選択肢B: 継承・実装の辺にだけ、React Flow の `Edge` の `ariaLabel` で「B は A を継承」「B は A を実装」を付ける(クラス名は `findClass` で引く)。
  依存の矢印は React Flow 既定の読み上げのままで、辺の種類によって読み上げの言語・形式が揃わない
- 選択肢C: 選択肢Bに加え、依存の矢印にも「A は B に依存」「A と B は循環依存」を付ける(`dependencyEdges` も変更する)。一貫するが差分が広がり、
  `class-dependency-focus` と同じファイルの近い位置を触る

### 未決事項3: キャンバス上の凡例を今回に含めるか

- 選択肢A(推奨): 含めない(スコープ外)。破線は UML の定石で、ヘッダーの ` implements B` の文字とも対応が取れる。凡例は `CodebaseCanvas.tsx` を触るので、
  `class-dependency-focus` のマージ後に、4種類の矢印をまとめて説明する別の仕様にする
- 選択肢B: 含める。`CodebaseCanvas.tsx` に React Flow 標準の `<Panel>` で「実線=継承 / 破線=実装」などの凡例を出す。`class-dependency-focus` と同じファイルに差分が出て、
  E2E・受け入れ基準も増える

### 未決事項4: `class-dependency-focus` の未決事項3で「入ってくる矢印を破線にする」(選択肢B)が採られた場合の扱い

- 選択肢A(推奨): 「キャンバス上の破線は implements 専用」を本件で確定させる。`class-dependency-focus` の未決事項3は選択肢A(区別しない)を選ぶか、
  選択肢Bを選ぶなら破線以外の表現(矢じりの大きさ・線の太さの差など)に変えるよう、その最終仕様に申し送る
- 選択肢B: `class-dependency-focus` の破線(入ってくる矢印)を優先し、本件は破線以外の方法(線の太さを変える、など)で実装を描き分ける。
  UML の定石から外れるので、背景・目的の「実務の図の読み方につながる」が弱まる
