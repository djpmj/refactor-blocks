# 継承関係の表現と表示

## 目的

クラスに親クラス(スーパークラス)を1つ持たせられるようにし、キャンバス上に依存の矢印とは見た目を区別した
継承の矢印で表示する。CLAUDE.md のビジョン(「難しいステージでは public / private、継承、依存関係が加わり…」)と
`docs/specs/change-request.md` の「省いたもの」(開放閉鎖の原則の指標は継承を入れるときに足す)で先送りにしていた
一歩目にあたる。

**今回の範囲は「継承関係のデータモデル・操作・キャンバス表示」だけ。** 次の3つは明示的に範囲外(次のタスクで別途扱う):

- 開放閉鎖の原則の指標(`ChangeImpact` への追加): 継承先を1つ作っただけでは判定できないため
- デザインパターン(Strategy / Template Method)への組み替え支援・採点: 継承の「表現」ができてから考える
- 採点(`domain/scoring/score.ts`)・変更依頼(`domain/change/`)への組み込み、メソッドのオーバーライド概念のモデル化: 既存の
  `coupling` / `cycle` / `responsibility` は `Fragment.uses`(呼び出し)だけを見ており、継承には反応しない。今回もそのままにする

## ドメインモデルの変更(`src/domain/codebase/Codebase.ts`)

- `CodeClass` に `superclassId?: string` を追加する(省略時は継承なし。既存コード・既存ステージ定義は変更不要)。
- ヘルパー `findSuperclass(codebase: Codebase, classId: string): CodeClass | undefined` を追加する
  (`superclassId` が指すクラスを引く。存在しない ID を指していても例外にせず `undefined` を返す)。

## 継承の設定 `src/domain/codebase/setSuperclass.ts`(新規、TDD、`Result`型)

```ts
export type SetSuperclassError = 'class-not-found' | 'superclass-not-found' | 'self-inheritance' | 'inheritance-cycle';
export function setSuperclass(codebase: Codebase, classId: string, superclassName: string | null): Result<Codebase, SetSuperclassError>;
```

- `renameClass` / `addClass` に合わせ、相手は ID ではなく**クラス名**で指定する(前後の空白を除く)。`null` または
  空文字は「継承を解除する」(`superclassId` を外した新しい Codebase を返す)。
- `classId` が存在しない → `class-not-found`。
- `superclassName`(空でない)に一致するクラスが `allClasses(codebase)` に無い → `superclass-not-found`。
- 解決した親クラスの ID が `classId` 自身 → `self-inheritance`。
- 親クラスの `superclassId` を辿って `classId` に戻れる(= 継承の輪ができる)→ `inheritance-cycle`。
  親から祖先へ辿る単純なチェーン(木構造)なので、`dependencies.ts` の `canReach` のような汎用グラフ探索は不要。
  ループガード(既存データが壊れて循環していた場合の無限ループ防止)として訪問済み集合を持つ。
- 今と同じ親(名前が一致)を指定した/どちらも「継承なし」→ 何も変えず `ok(codebase)`(`renameClass` の「同じ名前」規則にならう)。
- 変更しない元の `Codebase` はそのまま(純粋関数)。他の `CodeClass` フィールドは触らない。

## アプリケーション層(`src/application/RefactorUseCases.ts`)

既存の `renameClassUseCase` / `describeRenameClassError` と同じ形で追加する。

- `setSuperclassUseCase(codebase, classId, superclassName)` → `setSuperclass` をそのまま呼ぶ薄いラッパー。
- `describeSetSuperclassError(error: SetSuperclassError): string` とエラーメッセージ定数
  (例: `class-not-found` → 'クラスが見つかりません。', `superclass-not-found` → 'その名前のクラスが見つかりません。',
  `self-inheritance` → '自分自身を継承元にはできません。', `inheritance-cycle` → '継承の輪ができてしまいます。')。

## ストア(`src/presentation/store/useGameStore.ts`)

- `renameClass` と同じパターンで `setSuperclass: (classId: string, superclassName: string | null) => boolean` を追加し、
  `apply(setSuperclassUseCase(get().codebase, classId, superclassName), describeSetSuperclassError)` を呼ぶ。

## キャンバス表示

### エッジ(`src/presentation/canvas/layoutCodebase.ts`)

- `dependencyEdges` と同じ組み立て方で `inheritanceEdges(codebase: Codebase): Edge[]` を追加する。
  - `superclassId` を持つクラスごとに、子クラス → 親クラスへ1本(id は `inherit-<classId>-<superclassId>`)。
  - `superclassId` が存在しないクラスを指している(親が削除された等)場合は、そのクラスの辺を作らない(スキップ)。
  - ファイル間をまたぐ辺の左右のハンドル選択は、`dependencyEdges` が使っている `handleSides` をそのまま再利用する
    (`fileIndexByClassId` の組み立ても共通化してよい)。
  - 依存の矢印(`edge--cyclic` の有無に関わらず既定は塗りつぶし矢印 `MarkerType.ArrowClosed`)と区別するため、
    継承の辺には `className: 'edge--inheritance'` を付け、矢印は輪郭だけの `MarkerType.Arrow` にする。
- `CodebaseCanvas.tsx` で `dependencyEdges(codebase)` の結果と `inheritanceEdges(codebase)` の結果を連結して
  `edges` に渡す(`useMemo` の中で `[...dependencyEdges(codebase), ...inheritanceEdges(codebase)]`)。

### スタイル(`src/index.css`)

- `.react-flow__edge.edge--cyclic` の隣に追記する:
  `.react-flow__edge.edge--inheritance .react-flow__edge-path { stroke: var(--accent); stroke-width: 2; }`
  (依存の既定の辺は無色指定=黒系、循環は赤、継承はアクセント色+輪郭矢印で3種類とも一目で区別できる)。

### クラスノード(`src/presentation/canvas/ClassNode.tsx`)

- 親クラスがある場合、クラス名の下に小さく `extends <親クラス名>` を表示する(`data-testid` 不要、テキストで判定できるようにする)。
  親クラスが見つからない(削除された)場合は何も表示しない(`findSuperclass` が `undefined` を返すとき)。
  ズームで隠れる行数バッジやメソッド一覧と違い、クラス名と同格の構造情報なので `showDetails` の外側(常時表示)に置く。

### 右クリックメニュー(`src/presentation/canvas/CanvasContextMenu.tsx`)

- クラスを右クリックしたときのメニューに「継承元を設定」を1項目追加する(`renameClass` と同じ `NameForm` を使う)。
  - ラベル: 「親クラス名(空で解除)」、`initialValue` は今の親クラス名(`findSuperclass` があれば `.name`、無ければ空文字)。
  - 送信: `setSuperclass(codeClass.id, name)`(前後の空白の除去・空文字判定は `setSuperclass` 側で行うので、フォームは入力をそのまま渡す)。
  - 失敗時(存在しない名前・自己継承・循環)は他のフォームと同じく `NameForm` がメニューを開いたまま理由を表示する
    (`onSubmit` が `false` を返す = 既存の失敗表示の仕組みをそのまま使う。追加のエラー表示UIは作らない)。
  - 新しい `Mode` 値 `'setSuperclass'` を `menuItemsFor` / `useFormConfig` に足す(`renameClass` と同じ並びの追加)。

## 受け入れ基準

1. `setSuperclass` の AAAパターンのユニットテストがある。正常に設定・解除(null と空文字の両方)・今と同じ親を指定
   (変化なしで成功)・`class-not-found` / `superclass-not-found` / `self-inheritance` / 直接の循環(A→B→A)/
   間接の循環(A→B→C→A)を含む。元の `Codebase` を変更しないことも確認する。
2. `findSuperclass` のユニットテスト(見つかる/見つからない/`superclassId` 未設定)。
3. `inheritanceEdges` のユニットテスト(継承なし・1本・親が削除されて存在しない ID を指すケースでその辺だけ出ない、を含む)。
4. E2E(`e2e/refactor.spec.ts` に追加): あるクラスを右クリック→「継承元を設定」→既存の別クラス名を入力して確定すると、
   継承の辺(`edge--inheritance` クラス)が表示され、子クラスのノードに `extends <親クラス名>` が出る。
5. E2E: 循環になる親クラス名を入力すると、エラーメッセージが表示されメニューが閉じない(継承は設定されない)。
6. `npm run check` と `npm run test:e2e` が通る。

## 省いたもの(いつ足すか)

- **開放閉鎖の原則の指標・変更依頼への組み込み**: `docs/specs/change-request.md` が明示的に先送りにしていたもの。
  継承の「表現」ができた今回の次で、`ChangeImpact` に「修正 vs 追加」の指標を足すときに扱う。
- **採点(結合度・循環依存・責務の混在)への継承の組み込み**: 継承も一種の依存だが、既存の `coupling`/`cycle` は
  呼び出し(`uses`)だけを見ている。継承をどう数えるか(呼び出しの依存と同じ扱いにするか、別ルールにするか)は
  採点をいじる回で改めて決める。
- **メソッドのオーバーライド**: 親と同名のメソッドを子に置いたときの意味付け(上書き)はモデル化しない。
  今は「同じクラス内のメソッド名の重複チェック」もしていないので、既存の制約と足並みを揃える。
- **親クラスを削除したときに子の `superclassId` を消す処理**: 今は残るが、`findSuperclass`/`inheritanceEdges` が
  存在しない ID を無視するので、見た目には何も出ない(壊れたリンクの掃除は他のダングリング参照
  <small>(例: `Fragment.uses` が指す削除済みメソッド)</small> と同じ扱いにする)。
- **ステージ定義(infrastructure)への継承データの追加**: 既存ステージは変更しない(既存テスト・E2Eへの影響を避ける)。
  継承を使うと解ける新ステージは、この機能が入ったあとの別タスクで設計する。
- **多重継承・interface**: `superclassId` は1つだけ。TypeScript/Java的な単一継承のモデルで十分なため。
