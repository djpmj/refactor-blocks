# 仕様草案: 注目したクラスの依存の矢印だけを強調する(他の矢印を薄くする)

- slug: `class-dependency-focus`
- 元になった探索: `docs/pipeline/class-dependency-focus/01-discovered.md`
- 関連する既存仕様: `docs/specs/cyclic-dependency-class-highlight.md`(クラスノードの 🔁・赤枠。矢印の描画はスコープ外にしていた)

## 1. 背景・目的

- キャンバスには依存(`dependencyEdges`)と継承・実装(`inheritanceEdges`)の矢印がすべて同じ濃さで描かれる。中級・上級ステージでは
  矢印が交差・並走し、「このクラスはどこに依存し、どこから依存されているか」(ファンアウト・ファンイン)を1本ずつ目で追うしかない。
- 採点の「結合度」(依存元ごとの依存先の数)や変更依頼の波及(`measureChange.ts` の `rippleClasses`)を減らすには、この本数を
  プレイヤーが数えられる必要がある。上級2(決済ゲートウェイ)のようなDIPの題材では「矢印がインターフェースに集まる」ことが学びの核になる。
- そこで、キャンバスでクラスにマウスを乗せる/キーボードでフォーカスしたとき、そのクラスに出入りする矢印だけを強調し、他の矢印を薄くする。

**本当に新しい仕組みが要るか**: ほぼ要らない。

- 判定に `classDependencies` を呼び直す必要も無い。React Flow に渡している `Edge` がすでに `source`/`target`(= クラスID)を持っているので、
  「エッジ一覧と注目中のクラスIDから `className` を足す」純粋関数1つで足りる(`dependencyEdges` のシグネチャは変えない)。
- ホバーは React Flow 標準の `onNodeMouseEnter` / `onNodeMouseLeave` で拾える。見た目は CSS の `opacity` と `stroke-width` だけで作れる。
- 注目中のクラスIDは `CodebaseCanvas` のローカル state に持つ(ストアに足さない)。保存も Undo も要らない一時的な表示状態であり、
  `useGameStore.ts` を触る `stage-draft-persistence`・`critique-request-robustness` との衝突も避けられる。
- domain / application / infrastructure 層は変更しない。

## 2. 変更対象ファイル一覧

| 種別 | パス | 層 | 役割 |
| --- | --- | --- | --- |
| 変更 | `src/presentation/canvas/layoutCodebase.ts` | presentation | 純粋関数 `focusClassEdges` を追加して export する。`dependencyEdges` / `inheritanceEdges` は変更しない |
| 変更 | `src/presentation/canvas/layoutCodebase.test.ts` | presentation(test) | `focusClassEdges` のテストを追加(先に書く) |
| 変更 | `src/presentation/canvas/CodebaseCanvas.tsx` | presentation | 注目中のクラスIDをローカル state で持つフック `useClassFocus` を同じファイル内に追加し、`ReactFlow` にホバー・フォーカスのハンドラを渡す。エッジに `focusClassEdges` をかける |
| 変更 | `src/index.css` | presentation | `.edge--focused` / `.edge--dimmed` のスタイルを、既存の `.edge--cyclic` / `.edge--inheritance`(166〜167行目付近)の直後に足す |
| 変更 | `e2e/refactor.spec.ts` | (E2E) | 中級1でホバー・キーボードフォーカスによる強調と解除を守るテストを追加 |

変更しないもの: `src/domain/**`、`src/application/**`、`src/infrastructure/**`、ストア(`useGameStore.ts`)、`ClassNode.tsx`
(未決事項4で選択肢Bになった場合のみ変更)、`CodebasePreviewCanvas.tsx`(`dependencyEdges` のシグネチャを変えないので影響なし)、
`TopRouteEdge.tsx`(`BaseEdge` は `<g class="react-flow__edge ...">` の中に描かれるので、`className` によるCSSがそのまま効く)。

## 3. データ/型の変更

ドメインモデル・永続化スキーマの変更は無し。ストアの状態の追加も無し。

### 注目中のクラスIDの持ち方(`CodebaseCanvas.tsx` 内のフック `useClassFocus`)

`CodebaseCanvas` 本体はすでに約60行あり、lint の「1関数60行」に収まらなくなるので、同じファイル内に小さなフックとして切り出す
(新規ファイルは作らない)。

- `hoveredClassId: string | null` — `onNodeMouseEnter` で `node.type === 'classNode'` のとき `node.id` を入れる。
  `onNodeMouseLeave` では、離れたノードが今のホバー対象と同じときだけ `null` に戻す(`setState((current) => current === node.id ? null : current)`)。
  ファイルノードのホバーは無視する。
- `focusedClassId: string | null` — `ReactFlow` のルートに `onFocus` / `onBlur` を渡し(React の `onFocus`/`onBlur` はバブリングする)、
  フォーカスが入った要素から `closest('.react-flow__node-classNode')` の `data-id` を読む。クラスノードの外(ファイルノードや余白、
  キャンバスの外)にフォーカスが移ったら `null`。`event.target` は `instanceof Element` で確かめてから使う(`as` 禁止のため)。
  - クラスのヘッダー(dnd-kit の `tabIndex=0`)、クラス内のメソッド/フィールドのチップ、React Flow のノードのラッパー(`nodesFocusable` 既定で
    `tabIndex=0`)のどれにフォーカスしても、その持ち主クラスが注目対象になる。
  - `ReactFlow` が `onFocus`/`onBlur` をルートの `div` に渡さない場合は、`ReactFlow` を包む要素に付ける(独自のイベント配線は増やさない)。
- 実際に強調に使うID: `hoveredClassId ?? focusedClassId`(マウスを乗せたクラスが優先。マウスが離れればキーボードで注目中のクラスに戻る)。
  さらに次のときは `null` として扱う:
  - dnd-kit のドラッグ中(`activeId !== null`)。未決事項2で選択肢Aのとき
  - そのIDのクラスがもう無いとき(`findClass(codebase, id) === undefined`)。Undo でクラスが消えた直後や、ステージを切り替えた直後に
    ポインタの下の要素が消えて `mouseleave` が来ないまま古いIDが残ると、全部の矢印が薄いままになるのを防ぐ
- `edges` の `useMemo` は2段にする: 依存・継承のエッジ作成は今どおり `[codebase]` で、`focusClassEdges` をかけるのは `[baseEdges, 注目ID]` で。
  ホバーのたびに `classDependencies` を計算し直さないため。

### 新しい純粋関数(`src/presentation/canvas/layoutCodebase.ts`)

```ts
/**
 * 注目中のクラスに出入りする矢印に `edge--focused` を、それ以外の矢印に `edge--dimmed` を足す。
 * 注目しているクラスが無い(null)ときは何も足さない。
 */
export function focusClassEdges(edges: readonly Edge[], focusedClassId: string | null): Edge[];
```

- 注目中のクラスが `source` または `target` の矢印 → `className` に `edge--focused` を足し、`zIndex` を `EDGE_Z_INDEX + 1` にする
  (薄くした矢印の下に潜らないよう手前に描く)
- それ以外 → `className` に `edge--dimmed` を足す
- 既存の `className`(`edge--cyclic` / `edge--inheritance`)は残し、空白区切りで足す(例: `"edge--cyclic edge--focused"`)
- 注目中のクラスに矢印が1本も無ければ、すべて `edge--dimmed` になる(「このクラスはどこにも依存していない・されていない」ことが見て分かる。
  存在しないクラスIDは呼び出し側で `null` にするので、この関数では区別しない)
- 元の配列・`Edge` オブジェクトは変更しない(新しいオブジェクトを返す)
- 失敗しないので `Result` は使わない(既存の `dependencyEdges` と同じ)
- 未決事項3で選択肢Bになった場合: 強調する矢印にさらに `edge--outgoing`(注目クラスが `source`)/ `edge--incoming`(注目クラスが `target`)を足す
- 未決事項1(継承を含めるか)はこの関数ではなく呼び出し側で扱う: 選択肢Bなら `focusClassEdges(dependencyEdges(codebase), id)` と
  `inheritanceEdges(codebase)` をそのまま連結する

### 見た目(`src/index.css`)

- `.react-flow__edge.edge--dimmed { opacity: 0.25; }` 程度(0.2〜0.35 の範囲で実装者の裁量)。`<g>` ごと不透明度を下げるので、矢じり(marker)も一緒に薄くなる
- `.react-flow__edge.edge--focused .react-flow__edge-path { stroke-width: 3; }`。`.edge--cyclic` / `.edge--inheritance` と詳細度が同じなので、
  それらより**後ろ**に書く
- 色は変えない。循環依存の矢印は薄くしても赤のまま(不透明度が下がるだけ)、継承はアクセント色のまま。
  色だけに頼らず「太さ」と「濃さ」の差で伝える
- セマンティックズーム(`useShowDetails`)で詳細を隠している倍率でも同じように効く(矢印とクラスのヘッダーはどの倍率でも描かれているため、特別な処理は要らない)
- アニメーション(`transition`)は付けない

## 4. TDD対象の純粋関数

`focusClassEdges`(`layoutCodebase.test.ts` に `describe("focusClassEdges", ...)` を追加し、実装より先に書く)。
入力は既存の `codebaseOf` ヘルパー + `dependencyEdges` / `inheritanceEdges` で作ってもよいし、`Edge` のリテラルでもよい。
1ケース1つの `it`、AAAパターン。

1. 正常系: 注目クラスが `null` なら、どの矢印の `className` も変わらない(`edge--cyclic` は `edge--cyclic` のまま、`undefined` は `undefined` のまま)
2. 正常系: A→B、B→C、C→D があり B に注目すると、A→B(入ってくる)と B→C(出ていく)に `edge--focused`、C→D に `edge--dimmed` が付く
3. 正常系: 循環している矢印に注目しても `edge--cyclic` は残る(`"edge--cyclic edge--focused"` を含む)。薄くした継承の矢印も `edge--inheritance` が残る
4. 正常系: 強調した矢印の `zIndex` は、薄くした矢印の `zIndex` より大きい
5. 境界: 矢印が1本もつながっていないクラスに注目すると、すべての矢印に `edge--dimmed` が付く
6. 境界: 空の配列なら空の配列を返す
7. 元の配列・`Edge` を変更しない(呼び出し前後で元の `className` が同じ)
8. (未決事項3で選択肢Bのときのみ)出ていく矢印に `edge--outgoing`、入ってくる矢印に `edge--incoming` が付く

`useClassFocus` はイベントとDOMを扱うのでユニットテストの対象外とし、E2Eで守る。
domain / application 層は変更しないので、カバレッジ閾値への影響は無い。

## 5. 受け入れ基準

- [ ] `focusClassEdges` のテストを先に書き(Red)、実装して通る(Green)。`layoutCodebase.test.ts` の既存テストも通る
- [ ] キャンバスでクラスにマウスを乗せると、そのクラスに出入りする矢印が太く・濃くなり、それ以外の矢印が薄くなる。マウスを離すと全部元に戻る
- [ ] クラスのヘッダー(またはクラス内のチップ)に Tab でフォーカスすると、同じ強調になる。フォーカスがクラスの外へ移ると元に戻る
- [ ] マウスを乗せているクラスとキーボードでフォーカスしているクラスが違うときは、マウスの方が優先され、マウスを離すとフォーカス中のクラスの強調に戻る
- [ ] 循環依存の矢印は、薄くなっても赤のまま見分けられる
- [ ] ドラッグ中の扱いが未決事項2の決定どおりになっている(選択肢Aなら、ドラッグを始めると強調が消え、ドラッグ中に他のクラスの上を通っても強調されない)
- [ ] 「変更前の図」「解答例の図」・設計くらべクイズ(`CodebasePreviewCanvas.tsx`)は今までどおり(強調しない)
- [ ] E2E(`e2e/refactor.spec.ts`)に次を追加し通る。対象は `openCyclicStage`(中級1: 依存は Order→Inventory、Order⇄Customer(循環)の3本)
  - `class-Inventory` にホバー → `rf__edge-dep-class-order-class-inventory` に `edge--focused`、`rf__edge-dep-class-order-class-customer` と
    `rf__edge-dep-class-customer-class-order` に `edge--dimmed`(`edge--cyclic` も残っている)。既存の `FIND_EMPTY_PANE_POINT` で余白へマウスを
    移すと、3本とも `edge--focused` / `edge--dimmed` が外れる
  - `class-header-Customer` に `focus()` → Order⇄Customer の2本に `edge--focused`、Order→Inventory に `edge--dimmed`。
    ステージの `<select>`(`getByLabel('ステージ')`)へフォーカスを移すと外れる
  - (未決事項2で選択肢Aのとき)メソッドのチップを `mouse.down` して5px以上動かした状態で、どの矢印にも `edge--focused` / `edge--dimmed` が付いていない
- [ ] 既存のE2E(依存の矢印が Move Method でつなぎ変わる、継承の矢印、ドラッグ&ドロップ、右クリックメニュー)がすべて通る
- [ ] `npm run check`(lint + typecheck + test)が通る

## 6. スコープ外

- `CodebasePreviewCanvas.tsx`(変更前の図・解答例の図・設計くらべクイズ)への同じ強調。操作しない読み取り専用の図なので、要望が出てから
- クラスノードにファンイン・ファンアウトの数(「依存先 3 / 依存元 2」)を出す表示
- 矢印の先のクラスノード自体を光らせる(ノードの強調)。`ClassNode.tsx` を触ることになり `template-method-stage` と競合し得る
- クリックで注目を固定する(ピン留め)。クラスのヘッダーはドラッグ元でもありクリックの意味が増えるうえ、固定の解除操作も要る
- メソッドを選んだとき(`selectedMethodId`)の持ち主クラスとの連動(未決事項5で選択肢Bになった場合を除く)
- ストア(`useGameStore.ts`)への状態追加、注目状態の保存
- 強調・薄くする切り替えのアニメーション、不透明度の設定UI
- ミニマップ・クラス名検索(`01-discovered.md` で YAGNI として見送り済み)

## 未決事項

### 未決事項1: 継承・実装の矢印(`edge--inheritance`)も強調・薄くするの対象に含めるか

- 選択肢A(推奨): 含める。依存と同じく、注目クラスが子・親のどちらかなら強調、それ以外は薄くする。`focusClassEdges` に全エッジを渡すだけで済み(追加コード無し)、
  上級2のDIP題材で「実装クラス→インターフェース」の矢印も一緒に追える
- 選択肢B: 含めない。継承の矢印は注目中も今の濃さのまま(強調も薄くもしない)。依存の矢印だけに絞って見せたいとき。呼び出し側で依存のエッジにだけ `focusClassEdges` をかける

### 未決事項2: クラス・メソッドをドラッグしている間の強調をどうするか

- 選択肢A(推奨): ドラッグ中は強調を止める(全部の矢印を通常表示に戻す)。ドラッグ中はポインタが他のクラスの上を通るたびに `onNodeMouseEnter` が来て、
  強調がちらつくため。ドロップ後、ポインタの下のクラスに再びマウスを乗せれば強調される
- 選択肢B: ドラッグ中もホバーしているクラスを強調する。ドロップ先のクラスの依存を見ながら落とせるが、ちらつきは受け入れる

### 未決事項3: 注目クラスから「出ていく」矢印と「入ってくる」矢印を見た目で区別するか

- 選択肢A(推奨): 区別しない(どちらも同じ太さ・濃さ)。向きは既存の矢じりで分かる。まず最小限で出して、足りなければ足す
- 選択肢B: 区別する。例えば出ていく矢印は実線の太線、入ってくる矢印は破線の太線(`edge--outgoing` / `edge--incoming`)。色に頼らずファンアウト・ファンインを数えやすくなるが、
  破線は「継承」などの別の意味に読まれるおそれがあり、凡例の説明が要るかもしれない

### 未決事項4: スクリーンリーダー向けに、注目したクラスの依存先・依存元を文字でも伝えるか

- 選択肢A(推奨): 今回は伝えない(視覚の強調だけ)。今の矢印自体にも文字での説明は無く、今回の変更でアクセシビリティが下がるわけではない。
  キーボードで注目できるので、晴眼のキーボード利用者は同じ情報を得られる。文字での説明は、スコープ外の「ファンイン・ファンアウトの数の表示」と一緒に別の仕様で扱う
- 選択肢B: 伝える。クラスのヘッダーに `aria-describedby` で「依存先: X, Y / 依存元: Z」の非表示テキストを結び付ける。`ClassNode.tsx` を変更することになり、
  `template-method-stage` が抽象クラスの表示を足す場合に `classNodeClassName` 付近で小さな競合があり得る

### 未決事項5: 注目のきっかけに「メソッドを選んだとき(`selectedMethodId`)」を含めるか

- 選択肢A(推奨): 含めない。ホバーとキーボードフォーカスだけにする。メソッドを選ぶとメソッドエディタが開いている間ずっと矢印が薄くなり、
  抽出などの作業中に全体の矢印が見えにくくなるため
- 選択肢B: 含める。ホバーもフォーカスも無いとき、選んでいるメソッドの持ち主クラスを注目対象にする(ストアの `selectedMethodId` を読むだけで、ストアは変更しない)。
  優先順位は ホバー > キーボードフォーカス > メソッド選択
