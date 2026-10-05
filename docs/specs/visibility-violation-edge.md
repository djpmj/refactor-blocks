# 越境した private / protected 呼び出しの矢印を警告色にする

## 背景・目的

private(または届かない protected)のメソッドを別のクラスから呼んでいると、「アクセス制御」の減点になる(`findVisibilityViolations`/`countedVisibilityViolations`)。しかしキャンバスの依存の矢印(`layoutCodebase.ts` の `dependencyEdges`)は、色が付くのが循環依存(赤 `--danger`)だけで、越境している呼び出しも普通の灰色の矢印で描かれる。プレイヤーは、どの矢印が問題なのかを減点の内訳を開くまで知れず、中級3「越境する private メソッド」のようなステージで原因を見つけにくい。

そこで、**採点で減点される越境呼び出しを含む依存の矢印を、警告色の太い破線と「🔒 private を呼んでいる」のラベルで描く**。

### 設計判断(対話で確定済み)

- **見た目**: 警告色(`--warning`)の太い破線にし、矢印の上に短いラベルを出す。色だけに頼らず、循環依存の赤とも区別できるようにする。
- **対象**: 採点で減点される越境だけ(`countedVisibilityViolations` と同じ条件)。`visibilityEnforced` のステージでは private も protected も、それ以外のステージでは protected の越境だけを警告色にする。点数と見た目を揃える。

## ponytailチェック

1. YAGNI: 矢印のホバーで呼んでいるメソッド名を一覧する、などの詳細表示は作らない(ラベルと減点の内訳で足りる)。
2. 既存の再利用: 越境の判定は `countedVisibilityViolations` をそのまま使い、新しい判定ロジックは作らない。メソッドの持ち主は `methodOwnerMap` で引く。矢印の見た目は循環依存と同じ `className` + `markerEnd` の色の仕組み(`edgeAppearance`)に乗せる。ラベルは React Flow の `BaseEdge` の `label` を使う。
3. 新しい依存は足さない。

## 変更対象ファイル一覧

| パス | 層 | 新規/変更 | 役割 |
| --- | --- | --- | --- |
| `src/domain/scoring/visibility.ts` | domain | 変更 | `visibilityViolationDependencies`(越境を含むクラス間の依存の一覧)を足す |
| `src/domain/scoring/visibility.test.ts` | domain(test) | 変更 | 上記のテストを足す |
| `src/presentation/canvas/layoutCodebase.ts` | presentation | 変更 | `dependencyEdges` が越境の一覧を受け取り、該当する矢印に `edge--visibility` クラス・警告色の矢じり・ラベルを付ける |
| `src/presentation/canvas/layoutCodebase.test.ts` | presentation(test) | 変更 | 越境する依存の矢印の `className`・`label` を確認するケースを足す |
| `src/presentation/canvas/CodebaseCanvas.tsx` | presentation | 変更 | `visibilityViolationDependencies(codebase, stage.visibilityEnforced)` を計算して `dependencyEdges` に渡す |
| `src/presentation/canvas/TopRouteEdge.tsx` / `OffsetEdge.tsx` | presentation | 変更 | 受け取った `label` を `BaseEdge` に渡して表示する(位置は経路の中ほど) |
| `src/index.css` | presentation | 変更 | `.react-flow__edge.edge--visibility` の線(`--warning`・太さ3・破線)とラベルの見た目 |
| `e2e/visibility-violation-edge.spec.ts` | e2e | 新規 | 下記受け入れ基準のE2E |

## データ/型の変更

```ts
// src/domain/scoring/visibility.ts
export type VisibilityViolationDependency = {
  /** 呼んでいる側のクラス。 */
  readonly from: string;
  /** 呼ばれているメソッドの持ち主のクラス。 */
  readonly to: string;
  /** その依存に private の越境が1つでもあれば 'private'、protected だけなら 'protected'。 */
  readonly kind: 'private' | 'protected';
};

/** 採点で数える越境呼び出し(countedVisibilityViolations)を、クラス間の依存(from → to)ごとにまとめる。 */
export function visibilityViolationDependencies(
  codebase: Codebase,
  visibilityEnforced: boolean | undefined,
): VisibilityViolationDependency[];
```

`dependencyEdges` の引数に `violations: readonly VisibilityViolationDependency[] = []` を足す(既存の呼び出し元・テストはそのままで動く)。

## 仕様

### `visibilityViolationDependencies`

- `countedVisibilityViolations(codebase, visibilityEnforced)` の各違反について、`from = callerClassId`、`to = 呼ばれたメソッドの持ち主のクラス`(`methodOwnerMap`)とする。
- 同じ `from → to` は1件にまとめる。1つでも `private` があれば `kind: 'private'`、なければ `'protected'`。
- 並び順は違反が見つかった順。
- 元のCodebaseを変更しない。

### 矢印の見た目

- `dependencyEdges` は、`from → to` が `violations` にある依存の矢印に次を付ける。
  - `className` に `edge--visibility`
  - 矢じり(`markerEnd`)の色を `var(--warning)`
  - `label`: `kind` が `private` なら `🔒 private を呼んでいる`、`protected` なら `🔒 protected を呼んでいる`
- 線: `--warning` の色・太さ3・破線。継承の `implements` の破線(`6 4`)と見分けられるよう、点に近い破線(例: `2 5`)にする。
- 同じ矢印が循環依存でもあるときは、線と矢じりは循環依存の赤(`edge--cyclic`)を優先し、ラベルは出す(`className` は両方付けてよい。CSSで赤が勝つようにする)。
- ラベルは背景付きで読みやすくする(ライト・ダークの両方)。セマンティックズームで細部を隠す倍率(`semanticZoom.ts`)ではラベルも隠してよい。
- 越境がなくなる(Move Method で同じクラスへ移す・public にするなど)と、その矢印は普通の見た目に戻る(`codebase` から毎回計算するので自然にそうなる)。
- 変更依頼の実装中など、キャンバスが別のコードベースを表示しているときも、表示中のコードベースとステージの設定で計算する。

### カスタムの辺(`TopRouteEdge`/`OffsetEdge`)

- 今は `label` を描いていないので、`EdgeProps` の `label` を `BaseEdge` に渡す。位置は、`TopRouteEdge` は水平に渡る区間の中央、`OffsetEdge` は `getBezierPath` が返すラベル位置を使う。

## TDD対象の純粋関数

### `visibilityViolationDependencies`(`src/domain/scoring/visibility.ts`)

- 正常系: `visibilityEnforced: true` で、クラスAがクラスBの private メソッドを呼ぶ → `{ from: A, to: B, kind: 'private' }`
- 正常系: 同じA → Bで private を2つ呼ぶ → 1件にまとまる
- 正常系: A → B に private と protected の越境が両方ある → `kind: 'private'`
- 正常系: protected の越境だけ → `kind: 'protected'`
- 対象外: `visibilityEnforced` が `false`/`undefined` のとき、private の越境は含めない(protected の越境は含める)
- 対象外: 子クラスから親の protected を呼ぶ(届く呼び出し)は含めない
- 越境がなければ空配列

### `dependencyEdges`(`layoutCodebase.test.ts`)

- `violations` に含まれる依存の矢印に `edge--visibility` とラベルが付き、含まれない矢印には付かない
- `violations` を渡さなければ今までどおり(既存テストが無変更で通る)
- 循環依存でもある矢印は `edge--cyclic` を持ち、ラベルも付く

## 受け入れ基準

1. `npm run check` が通る。上記の純粋関数にAAAパターンのテストがある。
2. 中級3「越境する private メソッド」を開くと、private メソッドを越境して呼んでいる依存の矢印が、警告色の太い破線で描かれ、「🔒 private を呼んでいる」のラベルが出る。
3. Move Method でそのメソッドを呼び出し元と同じクラスへ移す(または public にする)と、矢印が普通の見た目に戻る。
4. `visibilityEnforced` でないステージでは、private を越境して呼んでいても警告色にならない(点数も減らない)。protected の越境は全ステージで警告色になる。
5. 循環依存でもある矢印は赤のまま、ラベルが付く。
6. ライト・ダークの両テーマでラベルが読める。
7. E2E(`e2e/visibility-violation-edge.spec.ts`): 2〜3を確認する。既存のE2Eが無変更で通る。
8. `npm run test:e2e` が通る。

## スコープ外

- 矢印をホバー・クリックしたときに、越境しているメソッド名を一覧する表示。
- 他の減点(Feature Envy・結合度の上限超えなど)の矢印の色分け。
- 減点の内訳で「アクセス制御」を押したときに矢印を光らせる連動(今はメソッド・クラスが光る。必要なら別仕様)。
- 採点に数えない越境(`visibilityEnforced` でないステージの private 越境)を薄く表示するなどの段階表示。

## 未決事項

なし。見た目と対象は対話で確定済み。ラベルの文言・破線の間隔は、受け入れ基準を満たす範囲で実装者の裁量。
