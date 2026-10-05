# 問題のある矢印(越境・循環依存)を警告表示する

## 背景・目的

private(または届かない protected)のメソッドを別のクラスから呼んでいると、「アクセス制御」の減点になる(`findVisibilityViolations`/`countedVisibilityViolations`)。しかしキャンバスの依存の矢印(`layoutCodebase.ts` の `dependencyEdges`)は、色が付くのが循環依存(赤 `--danger`)だけで、越境している呼び出しも普通の灰色の矢印で描かれる。プレイヤーは、どの矢印が問題なのかを減点の内訳を開くまで知れず、中級3「越境する private メソッド」のようなステージで原因を見つけにくい。

また、循環依存の赤い矢印も含めて、矢印は静止した線なので、**どちらがどちらを呼んでいるか(依存の向き)** と、**それがエラー状態であること** が伝わりにくい。

そこで、問題のある矢印(採点で減点される越境・循環依存)を次のように描く。

- 越境を含む矢印は、警告色(`--warning`)の太い点線にする(循環依存は今の赤のまま)。
- 問題のある矢印だけ、点線を呼び出しの向きにゆっくり流す(アリの行列のようなアニメーション)。
- 矢印の中ほどに **⚠ バッジ** を置き、押すと「private のメソッドが外のクラスから呼ばれています」などの説明を吹き出しで出す。

### 設計判断(対話で確定済み)

- **見た目**: 越境は警告色の太い点線+バッジ。色だけに頼らず、循環依存の赤とも区別できるようにする。
- **越境の対象**: 採点で減点される越境だけ(`countedVisibilityViolations` と同じ条件)。`visibilityEnforced` のステージでは private も protected も、それ以外のステージでは protected の越境だけ。点数と見た目を揃える。
- **アニメーションとバッジの対象**: 越境の矢印と循環依存の矢印の両方。普通の依存の矢印は動かさない(画面がせわしくなり、問題の矢印が目立たなくなるため)。

## ponytailチェック

1. YAGNI: 他の減点(Feature Envy・結合度の上限超えなど)の矢印の色分けは作らない。
2. 既存の再利用: 越境の判定は `countedVisibilityViolations`、循環の判定は `classDependencies` の `cyclic` をそのまま使う。矢印の見た目は循環依存と同じ `className` + `markerEnd` の色の仕組み(`edgeAppearance`)に乗せる。流れるアニメーションは React Flow 標準の `animated`(とCSSの上書き)で作る。バッジは React Flow の `EdgeLabelRenderer` で描く。吹き出しの説明文は「減点の内訳」の「なぜ?」と同じ `RULE_WHY`(`ruleWhy.ts`)を使い、新しい文章を増やしすぎない。
3. 新しい依存は足さない。

## 変更対象ファイル一覧

| パス | 層 | 新規/変更 | 役割 |
| --- | --- | --- | --- |
| `src/domain/scoring/visibility.ts` | domain | 変更 | `visibilityViolationDependencies`(越境を含むクラス間の依存の一覧)を足す |
| `src/domain/scoring/visibility.test.ts` | domain(test) | 変更 | 上記のテストを足す |
| `src/presentation/canvas/layoutCodebase.ts` | presentation | 変更 | `dependencyEdges` が越境の一覧を受け取り、越境・循環依存の矢印に `className`・矢じりの色・`animated`・バッジ用の `data` を付ける |
| `src/presentation/canvas/layoutCodebase.test.ts` | presentation(test) | 変更 | 越境・循環依存の矢印の `className`・`animated`・`data` を確認するケースを足す |
| `src/presentation/canvas/CodebaseCanvas.tsx` | presentation | 変更 | `visibilityViolationDependencies(codebase, stage.visibilityEnforced)` を計算して `dependencyEdges` に渡す。問題のある矢印を描く辺の種類を `edgeTypes` に登録する |
| `src/presentation/canvas/WarningEdge.tsx` | presentation | 新規 | 問題のある矢印。経路は既存の辺(標準のベジェ・`TopRouteEdge`・`OffsetEdge`)と同じ計算を使い、中ほどに ⚠ バッジと吹き出しを `EdgeLabelRenderer` で描く |
| `src/presentation/canvas/TopRouteEdge.tsx` / `OffsetEdge.tsx` | presentation | 変更 | 経路の計算を関数に切り出し、`WarningEdge` から再利用できるようにする(既存の見た目は変えない) |
| `src/index.css` | presentation | 変更 | `.edge--visibility` の線(`--warning`・太さ3・点線)、流れるアニメーション、バッジ・吹き出しの見た目、`prefers-reduced-motion` のときに止める指定 |
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
  /** 越境して呼ばれているメソッドのID。見つかった順、重複なし。 */
  readonly methodIds: readonly string[];
};

/** 採点で数える越境呼び出し(countedVisibilityViolations)を、クラス間の依存(from → to)ごとにまとめる。 */
export function visibilityViolationDependencies(
  codebase: Codebase,
  visibilityEnforced: boolean | undefined,
): VisibilityViolationDependency[];
```

`dependencyEdges` の引数に `violations: readonly VisibilityViolationDependency[] = []` を足す(既存の呼び出し元・テストはそのままで動く)。

問題のある矢印の `data` に持たせるもの(`WarningEdge` が読む):

```ts
type WarningEdgeData = {
  /** 元の辺の経路の種類(標準・topRoute・offset)と、その計算に要る lane/targetOffset。 */
  readonly route: 'default' | 'topRoute' | 'offset';
  readonly lane?: number;
  readonly targetOffset?: number;
  readonly cyclic: boolean;
  /** 越境があるときだけ。 */
  readonly visibility?: { readonly kind: 'private' | 'protected'; readonly methodNames: readonly string[] };
};
```

## 仕様

### `visibilityViolationDependencies`

- `countedVisibilityViolations(codebase, visibilityEnforced)` の各違反について、`from = callerClassId`、`to = 呼ばれたメソッドの持ち主のクラス`(`methodOwnerMap`)とする。
- 同じ `from → to` は1件にまとめ、`methodIds` に越境して呼ばれているメソッドを集める。1つでも `private` があれば `kind: 'private'`、なければ `'protected'`。
- 並び順は違反が見つかった順。
- 元のCodebaseを変更しない。

### 矢印の見た目

- 越境を含む矢印(`from → to` が `violations` にある):
  - `className` に `edge--visibility`、矢じり(`markerEnd`)の色を `var(--warning)`。
  - 線: `--warning` の色・太さ3・点線。継承の `implements` の破線(`6 4`)と見分けられるよう、点に近い間隔(例: `2 5`)にする。
- 循環依存の矢印: 今までどおり赤(`edge--cyclic`)。越境でもある場合は、線と矢じりは赤を優先する(`className` は両方付けてよい。CSSで赤が勝つようにする)。
- 越境・循環依存の矢印だけ、`animated: true` にして点線を呼び出しの向き(`source` → `target`)に流す。速さはゆっくり(1周期1.5秒前後)。普通の依存・継承の矢印は動かさない。
- `prefers-reduced-motion: reduce` のときは流さない(静止した点線のまま)。
- 越境がなくなる(Move Method で同じクラスへ移す・public にするなど)・循環がなくなると、その矢印は普通の見た目に戻る(`codebase` から毎回計算するので自然にそうなる)。
- 変更依頼の実装中など、キャンバスが別のコードベースを表示しているときも、表示中のコードベースとステージの設定で計算する。

### ⚠ バッジと吹き出し(`WarningEdge`)

- 越境・循環依存の矢印の経路の中ほど(`TopRouteEdge` の経路なら水平に渡る区間の中央)に、⚠ バッジを置く。バッジの中の短い文字は、越境なら `private`/`protected`、循環なら `循環`、両方なら `循環・private` のようにする。
- バッジは `<button>`(`nodrag nopan` を付け、キャンバスのドラッグ・パンに奪われないようにする)。`aria-label` は `この矢印の問題を見る`。`aria-expanded` で開閉状態を示す。
- 押すと吹き出しを開き、次を出す。
  - 越境: 見出し `private のメソッドが外のクラスから呼ばれています`(protected なら `protected のメソッドが届かないクラスから呼ばれています`)、呼ばれているメソッド名の一覧(`methodNames`)、`RULE_WHY.visibility` の「こう困ります」「だから」。
  - 循環: 見出し `2つのクラスが互いに呼び合っています`、`RULE_WHY.cycle` の「こう困ります」「だから」。
  - 両方なら両方を順に出す。
- 吹き出しはもう一度押す・`Esc`・吹き出しの外をクリックで閉じる。同時に開くのは1つだけ。
- 吹き出しには直し方の答え(「〇〇へ移そう」)は書かない(答えはヒントの役目)。
- バッジ・吹き出しは背景付きで、ライト・ダークの両テーマで読めるようにする。セマンティックズームで細部を隠す倍率(`semanticZoom.ts`)では、バッジは小さな ⚠ だけにしてよい。

## TDD対象の純粋関数

### `visibilityViolationDependencies`(`src/domain/scoring/visibility.ts`)

- 正常系: `visibilityEnforced: true` で、クラスAがクラスBの private メソッドを呼ぶ → `{ from: A, to: B, kind: 'private', methodIds: [m] }`
- 正常系: 同じA → Bで private を2つ呼ぶ → 1件にまとまり、`methodIds` に2つ入る
- 正常系: A → B に private と protected の越境が両方ある → `kind: 'private'`
- 正常系: protected の越境だけ → `kind: 'protected'`
- 対象外: `visibilityEnforced` が `false`/`undefined` のとき、private の越境は含めない(protected の越境は含める)
- 対象外: 子クラスから親の protected を呼ぶ(届く呼び出し)は含めない
- 越境がなければ空配列

### `dependencyEdges`(`layoutCodebase.test.ts`)

- `violations` に含まれる依存の矢印に `edge--visibility`・`animated: true`・越境の `data` が付き、含まれない普通の矢印には付かない(`animated` も付かない)
- 循環依存の矢印に `edge--cyclic`・`animated: true`・`cyclic: true` が付く
- 越境かつ循環の矢印は、両方の情報を持つ
- 元の経路の種類(`topRoute`/`offset`)と `lane`/`targetOffset` が `data` に引き継がれる
- `violations` を渡さなければ、循環依存以外は今までどおり(既存テストは、循環依存の矢印の `type`/`animated` の期待値を新仕様に合わせる以外は無変更で通る)

## 受け入れ基準

1. `npm run check` が通る。上記の純粋関数にAAAパターンのテストがある。
2. 中級3「越境する private メソッド」を開くと、private メソッドを越境して呼んでいる依存の矢印が、警告色の太い点線で描かれ、呼び出しの向きに流れ、中ほどに ⚠ バッジが出る。
3. バッジを押すと、越境の説明・呼ばれているメソッド名・「こう困ります」「だから」の吹き出しが開き、もう一度押す・`Esc` で閉じる。
4. Move Method でそのメソッドを呼び出し元と同じクラスへ移す(または public にする)と、矢印が普通の見た目に戻り、バッジも消える。
5. 中級1「循環依存を断ち切る」では、赤い循環依存の矢印が流れ、バッジから循環の説明が開く。
6. `visibilityEnforced` でないステージでは、private を越境して呼んでいても警告表示にならない(点数も減らない)。protected の越境は全ステージで警告表示になる。
7. 普通の依存・継承の矢印は動かない。`prefers-reduced-motion: reduce` のときは、問題のある矢印も動かない。
8. バッジはキーボードで押せ、バッジを押してもキャンバスのパン・ノードのドラッグが始まらない。
9. ライト・ダークの両テーマでバッジ・吹き出しが読める。
10. E2E(`e2e/visibility-violation-edge.spec.ts`): 2〜5、7(reduced motion は `page.emulateMedia`)を確認する。既存のE2Eが通る。
11. `npm run test:e2e` が通る。

## スコープ外

- 他の減点(Feature Envy・結合度の上限超えなど)の矢印の色分け・バッジ。
- 普通の依存の矢印のアニメーション。
- 吹き出しに直し方(答え)を書くこと。
- 減点の内訳で「アクセス制御」「循環依存」を押したときに矢印を光らせる連動(今はメソッド・クラスが光る。必要なら別仕様)。
- 採点に数えない越境(`visibilityEnforced` でないステージの private 越境)を薄く表示するなどの段階表示。

## 未決事項

なし。見た目・対象・アニメーションとバッジの範囲は対話で確定済み。バッジの文言・点線の間隔・速さは、受け入れ基準を満たす範囲で実装者の裁量。
