# 循環依存の可視化と警告(クラスノードの強調表示)

## 背景・目的

`src/domain/codebase/dependencies.ts` の `classDependencies` は、クラス間の依存が循環に含まれるかどうか(`cyclic: boolean`)をすでに算出しており、
以下はすべて**既存実装済み**であることを調査で確認した。

- 採点: `src/domain/scoring/score.ts` の `scoreCodebase` に `cycle` ルールがあり、循環している依存1本につき10点減点している(テスト: `score.test.ts`)。
  `src/domain/scoring/fileScores.ts` もファイル単位の減点に循環依存を含めている。
- 画面: `src/presentation/canvas/layoutCodebase.ts` の `dependencyEdges` が、循環している依存の矢印を赤(`edge--cyclic` クラス、`var(--danger)`)で描いている。
- ステージ: `中級1: 循環依存を断ち切る`(`src/infrastructure/stages/intermediateStages.ts`)がすでに循環依存を題材にしており、
  E2Eテスト(`e2e/refactor.spec.ts`)で「循環依存 -20点」の表示も確認済み。

つまり要求にある「採点への反映」は追加作業が不要(すでに完成している)。唯一足りていないのは要求文にある
**「クラスノードの強調表示(赤色など)」**だけで、現状の `ClassNode`(`src/presentation/canvas/ClassNode.tsx`)は
循環依存に関与しているかどうかを一切見ていない(行数超過の `line-badge--over` はあるが、循環依存の印はない)。

本仕様は、この**クラスノード側の強調表示**だけをスコープにする。矢印の赤色描画・採点ロジックは変更しない(すでにあるため作らない = YAGNI)。

参考にする既存パターン: `src/presentation/canvas/FileNode.tsx` の `FileMark` コンポーネント。
ファイルの減点があるとき、色だけに頼らずアイコン(⚠️/⛔)+ `aria-label` + `title` で伝えている
(コメント: 「修正が必要なファイルの印。色だけに頼らずアイコンとラベルでも伝える。ズームで詳細を隠していても出す。」)。
クラスノードの循環依存の印もこのパターンを踏襲する。

## 変更対象ファイル一覧

### 新規

なし(既存ファイルへの追記のみで足りる)。

### 変更

| パス | 役割 | 層 |
| --- | --- | --- |
| `src/domain/codebase/dependencies.ts` | 循環依存に関与しているクラスIDの集合を返す関数 `cyclicClassIds` を追加する | domain |
| `src/domain/codebase/dependencies.test.ts` | `cyclicClassIds` のユニットテストを追加する(TDDでこちらを先に書く) | domain(test) |
| `src/presentation/canvas/ClassNode.tsx` | `cyclicClassIds(classDependencies(codebase))` を使い、循環依存に関与するクラスに印(アイコン+強調枠)を付ける | presentation |
| `src/index.css` | 循環依存に関与するクラスノードの強調スタイル(`.class-node--cyclic`)を追加する | presentation |
| `e2e/refactor.spec.ts` | 中級1(循環依存を断ち切る)ステージで、印の表示/消滅を確認するテストを追加・拡張する | E2E |

## データ/型の変更

ドメインモデル・永続化スキーマの変更はなし。`ClassDependency` 型(`{ from, to, cyclic }`)は既存のまま使う。

## ドメイン層: 追加する純粋関数

`src/domain/codebase/dependencies.ts` に、既存の `ClassDependency[]` を受け取って印を付けるべきクラスIDの集合を返す関数を追加する。
`classDependencies` 自体は変更しない(再利用するだけ)。

```ts
/** 循環している依存の from/to に含まれるクラスIDの集合を返す。ノードの強調表示に使う。 */
export function cyclicClassIds(dependencies: readonly ClassDependency[]): ReadonlySet<string>;
```

- `classDependencies` と同様、失敗しない(常に集合を返す)ので `Result` 型は使わない。既存の `methodOwnerMap` と同じ方針。
- 実装イメージ(仕様であって強制ではない): `cyclic: true` の依存だけを残し、`from`・`to` を集めて `Set` にする。

### TDD対象のテストケース(`dependencies.test.ts` に追加、先に書く)

AAAパターン・Vitest。既存の `describe('classDependencies', ...)` の下に `describe('cyclicClassIds', ...)` を追加する。

1. 正常系: 循環している依存が1つもなければ、空の集合を返す。
2. 正常系: A→B→A の循環では、A・Bの両方のクラスIDが集合に含まれる。
3. 正常系: 3クラスの循環(A→B→C→A)+循環の外への依存(C→D)があるとき、集合には A・B・C だけが含まれ、D は含まれない
   (`classDependencies` のテストにある `3クラスの循環に含まれる依存だけに印が付き〜` のケースを流用できる)。
4. 異常系/境界: 依存が空配列なら、空の集合を返す。

## 採点への反映

**追加の変更は不要。** 理由をここに明記する(推測で新しいルールを足さない)。

- `scoreCodebase`(`src/domain/scoring/score.ts`)はすでに `classDependencies` の `cyclic` を見て `cycle` ルールで10点/本減点している。
- `scoreChange.ts`(`src/domain/change/scoreChange.ts`)は変更依頼の採点で、循環依存を直接見るルールを持たない。
  ただし `measureChange.ts` の `rippleClasses` はすでに `classDependencies` から計算しており、循環に巻き込まれたクラスほど
  依存元(呼び出し元)が多くなるため、実質的に `ripple` 減点に反映される。循環かどうかで二重に罰する意味はないため、
  「本当に `scoreChange.ts` に循環専用のルールが要るか」を検討した結果、**不要**と判断した(YAGNI)。

## プレゼンテーション層: 強調表示の仕様

`ClassNode.tsx` に `FileNode.tsx` の `FileMark` と同じ考え方で、循環依存に関与しているときだけ表示するマーク用コンポーネントを追加する。

- データ取得: `useGameStore((state) => cyclicClassIds(classDependencies(state.codebase)).has(data.classId))` のように、
  `FileNode` が `fileDeductions` を毎レンダー呼んでいるのと同じ方針で、ノードごとに `classDependencies` を呼んでよい
  (`layoutCodebase.ts` の `dependencyEdges` 側で既に同じ計算をしているが、キャッシュや `data` への詰め込みは新しい仕組みなので今回は作らない。YAGNI)。
- アイコン+ラベル: 例 `🔁` + `aria-label="循環依存にあります"` + `title` 同文。`role="img"`、`data-testid="cyclic-mark"` を付け、
  `showDetails`(セマンティックズーム)の状態に関わらず常に表示する(`FileMark` と同じく、ズームで詳細を隠していても出す)。
  絵文字・具体的な文言は実装者の裁量でよいが、**色だけに頼らない**(アイコン・テキストで伝える)ことは必須。
- 枠の強調: クラスノードのルート要素に `class-node--cyclic` クラスを追加できるようにし、`.class-node--drop-target` と同様
  `border-color` と `box-shadow` を `var(--danger)` 系にする(`.class-node--drop-target` の実装をそのまま踏襲、色だけ `--accent` → `--danger`)。
  ドラッグのドロップ先強調(`isOver`)と同時に成立しうるので、両方のクラス名を同時に付けられる書き方にする(単純な三項演算子の連結ではなく、配列 + `filter(Boolean).join(' ')` などで両立させる)。

## 受け入れ基準

1. `src/domain/codebase/dependencies.test.ts` に追加した `cyclicClassIds` のテスト(上記4ケース)がすべて通る。
2. `npm run check`(lint + typecheck + test)が通る。`domain`/`application` 層のカバレッジ閾値を満たす。
3. E2Eテスト(`e2e/refactor.spec.ts`):
   - 既存の「ステージを選ぶと、そのステージのコードベースと目標に切り替わり〜」テストを拡張し、
     `中級1: 循環依存を断ち切る` に切り替えた直後、`class-Order` と `class-Customer` の中に `cyclic-mark`(または実装したtestid)が表示されることを確認する。
   - 新規テスト: 中級1ステージで、循環を断ち切る操作(ステージのコメントにある通り、`countOrdersOf` を Customer へ、
     `calculateOrderTotal` を Order へ Move Method する)を行うと、`循環依存` の減点が消え、`class-Order` / `class-Customer` の
     `cyclic-mark` も消えることを確認する。既存の「税の計算を抽出して〜」テストの Move Method 操作(`page.mouse.move`/`down`/`up`)と
     同じ手順を使う。
4. 循環依存に関与しないクラス(例: `中級1` の `Inventory`)には `cyclic-mark` が付かないことを確認する(誤検出がないことの確認)。
5. 目視/手動確認: 強調表示が色(赤枠)だけに頼っていない(アイコン・`aria-label` がある)こと。

## スコープ外

- 矢印(エッジ)の描画・色: すでに実装済みのため変更しない。
- 採点ロジック(`scoreCodebase`・`fileDeductions`・`scoreChange`)の変更: すでに循環依存を反映しているため変更しない。
- 循環依存の「重さ」(関与する依存の本数やクラス数)に応じた段階的な強調(`FileSeverity` のような `ok`/`error`/`danger` 分け): 今回は
  「循環に含まれるか否か」の二値で十分。段階分けが必要になったら別途仕様化する。
- パフォーマンス最適化(`classDependencies` の計算結果をメモ化・`layoutCodebase` の `data` に詰め替えて使い回す等): `FileNode` が
  同種の計算を毎レンダー行っている既存パターンに合わせるだけにとどめ、新しいキャッシュ機構は作らない。ステージ規模で問題が出たら
  `dependencies.ts` の既存の ponytail コメント(`O(E·(V+E))`)と合わせて見直す。
- AI講評(`src/infrastructure` のAI講評クライアント)へ循環依存の情報を渡すこと: 要求に含まれていないため対象外。

## 未決事項

- アイコン(絵文字)の具体的な種類・`aria-label` の文言は実装者の裁量とする(既存の `FileMark` が `⚠️`/`⛔` を使っているため、
  循環依存には別の絵文字(例: `🔁`)を使い、ファイルの減点マークと混同しないようにすることだけを条件とする)。
- `cyclic-mark` という `data-testid` 名は仮称。実装時に既存の命名(`file-mark` など)と一貫性が取れる名前であれば変更してよい
  (ただしE2Eテストとの整合を取ること)。
