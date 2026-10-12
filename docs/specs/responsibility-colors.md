# responsibility-colors: 処理に責務の種類の色の印を付け、クラスに責務の種類数を出す

## 背景・目的

クリア条件と採点の「責務の混在」は、1つのクラスの中の処理(Fragment)の `responsibility` の種類数で数えている(`findResponsibilityViolations`)。
クリア条件には「責務の混在: 1クラス4種類まで(今: 最大5種類)」と出る。

ところが画面には、責務の種類がどこにも出ていない。メソッドエディタの処理の一覧には、処理の名前(`label`)と行数しかない。
そのため次のことが分からず、手探りになる(中級1で確認)。

- どの処理どうしが同じ種類として数えられているか
- どのクラスが何種類を持っているか

そこで、種類の**名前は出さず**(どう分けるかを考えるのは練習のうち)、**同じ種類なら同じ色**の印を処理に付ける。
あわせて、クラスの箱に種類数を出す。色だけに頼らないよう、印には英字(A, B, C …)も添える。

## 変更対象ファイル一覧

| 種別 | パス | 層 | 役割 |
| --- | --- | --- | --- |
| 変更 | `src/domain/scoring/responsibilities.ts` | domain | 1クラスの責務の種類を返す `classResponsibilities` を足し、`findResponsibilityViolations` はそれを使う |
| 変更 | `src/domain/scoring/responsibilities.test.ts` | domain | `classResponsibilities` のテスト |
| 新規 | `src/domain/stage/responsibilityMarks.ts` | domain | ステージの責務に印の番号(0, 1, 2 …)を振る純粋関数 |
| 新規 | `src/domain/stage/responsibilityMarks.test.ts` | domain | 上のテスト |
| 新規 | `src/presentation/editor/ResponsibilityMark.tsx` | presentation | 色と英字の小さな印 |
| 変更 | `src/presentation/editor/MethodEditor.tsx` | presentation | 処理の一覧の各行に印を付ける |
| 変更 | `src/presentation/canvas/ClassNode.tsx` | presentation | クラスの見出しの近くに「責務 N種類」を出す |
| 変更 | `src/index.css` | presentation | 印の色(8色)・種類数のバッジ |
| 新規 | `e2e/responsibility-colors.spec.ts` | E2E | 下の受け入れ基準を確かめる |

`application` / `infrastructure` は変更しない(ステージ定義に何も足さない)。

## データ・型の変更

```ts
// src/domain/scoring/responsibilities.ts
/** クラスの処理が持つ責務の種類(CALL_RESPONSIBILITY を除く)。出現順、重複なし。 */
export function classResponsibilities(codeClass: CodeClass): readonly string[];

// src/domain/stage/responsibilityMarks.ts
/**
 * 責務 → 印の番号。ステージの初期コード(stage.codebase)に出てくる順に 0, 1, 2 … を振る(CALL_RESPONSIBILITY は除く)。
 * 初期コードに無い責務(変更依頼の部品など)は、その後ろに id の辞書順で続ける。
 * プレイ中にコードが変わっても、同じ責務は同じ番号のまま。
 */
export function responsibilityMarks(initial: Codebase, current: Codebase): ReadonlyMap<string, number>;
```

## 見た目・動きの仕様

### 印(`ResponsibilityMark`)

- 直径 16px 程度の丸に、白の太字で英字(番号 0 → `A`、1 → `B` …)。背景は番号に応じた8色のパレット(`--resp-0` … `--resp-7` を `:root` とダークテーマに定義)。
  9番目以降は色をくり返し、英字で区別する(`I`, `J` …)
- 8色は、ライト・ダークの両方で白い英字が読めるコントラストにする。`--danger` / `--success` と紛らわしい赤・緑は避ける
- `aria-label` は `責務 A`(種類の名前は出さない)。`title` も同じ

### メソッドエディタの処理の一覧

- 各処理の行(チェックボックスの右、名前の左)に印を付ける
- 呼び出しの行(`responsibility === 'call'`。「○○() を呼び出す」)には印を付けない

### クラスの箱(`ClassNode`)

- クラス名の右(行数の左)に、小さく `責務 N種類` を出す(`data-testid="class-responsibilities-<クラス名>"`)
- N がステージの `responsibilityLimit` を超えるときは `var(--danger)` の文字色にし、`責務 N種類(上限 M)` とする
- N が 0(呼び出しだけ・空)のときは出さない
- ズームで詳細を隠しているとき(`useShowDetails` が `false`)は出さない
- バッジにマウスを乗せると、そのクラスの印を並べた `title`(例: `責務 A・B・C・D・E`)を出す

## TDD対象の純粋関数

### `classResponsibilities`(`domain/scoring/responsibilities.ts`)

- 2つのメソッドに `a`, `b`, `a`, `call`, `c` の処理 → `['a', 'b', 'c']`
- メソッドが無い → 空
- 既存の `findResponsibilityViolations` のテストはそのまま通る

### `responsibilityMarks`(`domain/stage/responsibilityMarks.ts`)

- 初期コードに `x`, `y`, `x`, `z` の順 → `x: 0, y: 1, z: 2`
- `call` は番号を持たない
- 今のコードにだけある `p`, `m` → 初期の責務の後ろに `m: 3, p: 4`(辞書順)
- 今のコードで処理を別のクラスへ移しても、番号は変わらない(初期コードで決まる)

## 受け入れ基準

1. 中級1で `Order.checkout()` を選ぶと、処理の一覧の各行に色と英字の印が付き、同じ責務の処理は同じ印になっている
2. 抽出してできた呼び出しの行には印が付かない
3. `Order` の箱に `責務 5種類(上限 4)` が赤で出る。処理を移して上限以内にすると、赤でなくなり `責務 4種類` になる
4. 処理を別のクラスへ移しても、その処理の印(色・英字)は変わらない
5. ライト・ダークの両方で、印の英字が読める
6. `npm run check` と `npm run test:e2e` が通る

## スコープ外

- 責務の種類の名前(日本語の名前)を出すこと
- キャンバスのメソッドの箱(`MethodChip`)への印
- 印でフィルタする・同じ種類の処理をまとめて選ぶ操作
- 責務の混在の採点の変更
