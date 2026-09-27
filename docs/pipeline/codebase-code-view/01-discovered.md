# 01 機能探索: 今のコードベースを「TypeScript風のコードの骨組み」として読めるダイアログ

- slug: `codebase-code-view`
- 想定の呼び名: 「コードで見る」(ボタン名・ダイアログ名は仕様設計で決める)

## 出どころ

新規探索(`docs/pipeline/USER_FIXES.md` のキュー一覧は「まだ項目はありません」で、未完了項目 `### [ ]` が無かった)。

### 既存テーマとの重複確認

- `docs/specs/` 24件・`docs/pipeline/*/01-discovered.md` 25件を `ソースコード|コード表示|コードで見|テキストで見|本物のコード|実際のコード|import 文|擬似コード|疑似コード|クリップボード`
  でgrepし、ブロックを**コードの形(テキスト)で見せる**ことを主題にしたものは無い
- 一番近いのは `method-call-references`(メソッドエディタに「呼ぶメソッド」「呼び出し元」を一覧で出す)。あちらは**選んだ1メソッドの**呼び出し関係を
  エディタの中で見せるもので、本件はコードベース**全体**をファイル単位のコードの形で読ませる。02の選択肢C(同じクラスは `this.calculateTax()` と書く)と
  呼び出しの書き方をそろえると両者がつながる(下の論点)
- 「変更前の図」「解答例の図」(`CodebasePreviewDialog`)は**図**で見せるもの。本件は同じ中身を**コード**で見せる
- 呼び出し元が列挙した25件のslugのいずれとも主題が重ならない

### 検討して見送った候補

- **フィールドの可視性を変える操作(Encapsulate Field)**: `Field.visibility` はあるのに変える操作が無い(`changeVisibility.ts` はメソッドだけ)。
  ただし public フィールドを外から**読む**ことは今の採点で減点されない(`fieldAccess.ts` の `isReadViolation`)ので、操作だけ足しても点数が動かず動機が弱い。
  減点を足すと中級6・上級7の点数と `sampleAnswer.ts` が動き、UI はフィールドのチップ(`FieldChip.tsx`)か右クリックメニュー(`move-class-via-context-menu`・
  `method-rename-keyboard` が触る)に要る。採点の追加が落ち着いてから
- **新ステージ(Facade・Middle Man を外す・Push Down Method / 継承より委譲・コマンドとクエリの分離)**: ステージ追加がすでに4件並走。
  Facade は呼び出し側の依存を Facade へ移すだけで `dependencyLimit` の減点が Facade 側に移るため、今の採点では「良くなった」が点数に出にくい。
  Push Down / 継承より委譲は新しい採点ルールが要り、`score.ts` は `duplicate-code-scoring`・`inline-method-stage` が末尾に追記予定。
  コマンドとクエリの分離は既存の Extract Method と責務の混在の減点だけで作れてしまい、チュートリアルと学びが重なる
- **フィールドを余白へ落として新しいクラスを作る**(`CodebaseCanvas.tsx` 114行目の ponytail): `CodebaseCanvas.tsx` は `drag-announcements-ja`・`class-dependency-focus` が触る予定
- **ステージ選択欄に自己ベストの点数を出す・100点のあと「次のステージへ」ボタン**: どちらも `StagePanel.tsx` の目立つ場所(`StageSelect`・操作ボタン列)で、
  学びの中身が増えない割に `stage-draft-persistence`・`blank-design-second-problem`(選択欄の前例として参照)と見た目の方針がぶつかりうる

## 背景・目的

- このゲームはコードを**ブロック**(ファイル → クラス → メソッド → 処理のまとまり)に抽象化している。遊んでいる間は分かりやすいが、
  新卒〜4年目のプレイヤーが最後に向き合うのは**テキストのコード**である。「Extract Method をすると元のメソッドに `this.calculateTax()` の1行が残る」
  「Move Method をするとファイルの先頭の `import` が増える・減る」「クラスを別ファイルへ移すと `import` の行き先が変わる」といった、
  リファクタリングが**実際のコードの見た目**に与える変化を、今は確かめる手段が無い
- 特に `import` は、ゲームの「結合度」「循環依存」「ファイル分け」の採点が実務で何に当たるかを一番よく表す。
  ファイルの間の依存(`classDependencies`)をファイル単位の `import` 行として見せれば、キャンバスの矢印と、実務で毎日見ている `import` の並びが結び付く
- ブロックが持つ情報は、コードの骨組みを組み立てるのに足りている(コードを読んで確かめた範囲):
  - ファイルのパス(`CodeFile.path`)、クラス名・`extends`/`implements`(`superclassId`/`interfaceIds`)、フィールド名と可視性、メソッド名と可視性
  - 処理のまとまりの説明(`Fragment.label`)と行数(`lines`)。抽出で残った呼び出し行は `callFragmentId`(`<id>:call`)で、`uses` に呼び先のメソッドIDを持つ
  - インターフェース役(`isInterfaceLike`)・中身の無い契約メソッド(`fragments: []`)・getter/setter(`isAccessorMethod`)の判定関数
  - 採点用の隠しタグ(`responsibility`・`duplicateGroup`・`stub`・`accessor`)は**出さない**(`StagePanel` の「責務の中身は見せない」方針を守る)
- ponytail の階段では「このリポジトリにもうあるか?」「JavaScript/TypeScript の標準機能でできるか?」で止まる見込み:
  コードベースから文字列を組み立てる純粋関数1つと、ネイティブ `<dialog>` + `<pre>` の表示だけ。新しい依存(シンタックスハイライトのライブラリなど)・
  domain/application の変更・ストアの変更は要らない(今のコードベースはストアから読むだけ)

## 関連する既存コード

- `src/presentation/stage/StagePanel.tsx` 53〜72行目の `PreviewButtons` — 「変更前の図を見る」「解答例の図を見る」ボタンとダイアログの開閉。
  **本件のボタンを1つ足す先の候補**(変更依頼の実装中は `disabled` にする流儀もここに倣える)
- `src/presentation/preview/CodebasePreviewDialog.tsx` — ネイティブ `<dialog>` の `showModal()`・`onClose`・`aria-labelledby`・閉じるボタンの前例(**読むだけ**)。
  `operation-guide` の02も同じ流儀で新しいダイアログを作る予定
- `src/domain/codebase/Codebase.ts` — `CodeFile`・`CodeClass`・`Field`・`Method`・`Fragment`、`isInterfaceLike`・`isAccessorMethod`・`fieldsOf`・`findMethod`・`findClassOfMethod`・`findFileOfClass`(**読むだけ**)
- `src/domain/codebase/dependencies.ts` — `classDependencies`(`uses`・`reads`/`writes` からクラス間の依存を出す)。ファイルごとの `import` を出す元(**読むだけ**)
- `src/domain/codebase/extractMethod.ts` — `callFragmentId`・呼び出し行の `label`(`<name>() を呼び出す`)。呼び出し行をコードの1文にする元(**読むだけ**)
- `src/presentation/canvas/visibilityMark.ts` — 可視性の記号(`+`/`-`/`#`)。コードでは `public`/`private`/`protected` のキーワードにする想定なので使わない見込み
- `src/presentation/stage/describeScore.ts`・`src/presentation/change/describeChange.ts`・`src/presentation/canvas/layoutCodebase.test.ts` —
  presentation 層に表示用の純粋関数を置き、Vitest で守っている前例。本件の組み立て関数も同じ形で**テストを先に書ける**
- `e2e/preview.spec.ts` — 「変更前の図」「解答例の図」のダイアログのE2Eの前例。本件のE2Eは新しい spec ファイルに置く想定
- `docs/pipeline/method-call-references/02-draft-spec.md` 192行目付近 — 呼び出しの書き方(`this.calculateTax()` など)の選択肢。そろえると画面の間で表記がぶれない

## スコープの見立て

小さい〜中くらい。1回のPRに収まる。presentation 層の新しい純粋関数1ファイル(+Vitest)、新しいダイアログのコンポーネント1ファイル、
`StagePanel.tsx` の `PreviewButtons` に数行、CSS 数行、E2E 1〜2本(新しい spec ファイル)。domain / application / infrastructure・ストア・ステージデータ・採点は変更しない見込み。

1. **今回やる**:
   - 今のコードベース(リファクタリング画面の `codebase`)を、ファイルごとに「`import` の行 → クラス宣言(`extends`/`implements`)→ フィールド → メソッド(可視性・名前)→
     処理のまとまりをコメント + 行数、呼び出し行は呼び出しの文」の形の文字列にする純粋関数(TDD)
   - それを読み取り専用で見せるダイアログ(ネイティブ `<dialog>`、`<pre>`/`<code>`)と、開くボタン1つ
   - E2E: ボタンで開く → 今のコードのクラス名が出る → Extract Method したあとで開き直すと、元のメソッドに新しいメソッドの呼び出しが出る → Esc で閉じる
2. **後回し**(大きくなりそうなら切る):
   - 「変更前の図」「解答例の図」のダイアログに「図 / コード」の切り替えを足す(`CodebasePreviewDialog.tsx` は `quiz-change-site-marks` が props を足す可能性がある)
   - 白紙設計・変更依頼の実装中の画面から開くこと
   - コピーのボタン、シンタックスハイライト(新しい依存になるので足さない方向)
   - 設計くらべクイズの設計A・Bをコードで見せること(`ComparisonQuizView.tsx` は `quiz-change-site-marks`・`data-placement-quizzes` が触る)

仕様設計者に決めてほしい論点(ここでは決めない):

- **書式**: TypeScript に寄せるか(`export class OrderService extends Base implements Port {` / `private calculateTax(): void {`)、言語をぼかした擬似コードにするか。
  型・引数・戻り値の情報は持っていないので、書けない部分(`(): void` など)をどう扱うか
- **処理のまとまりの見せ方**: `// 税を計算する(5行)` のようなコメント1行にするか、行数ぶんの空行・`…` で本当の長さを見せるか(長いメソッドの「長さ」の実感と、読みやすさの兼ね合い)
- **呼び出しの見せ方**: 同じクラスなら `this.calculateTax();`、他クラスなら何と書くか(受け手の名前を持っていない。`taxCalculator.calculate();` とクラス名から作るか、
  `// → TaxCalculator.calculate()` とコメントにするか)。呼び出し行(`<id>:call`)以外で `uses` を持つ処理(元から他メソッドを呼ぶ処理)の扱い。
  `method-call-references` の表記とそろえるか
- **`import` の出し方**: `classDependencies` のうち、別ファイルのクラスへの依存だけをファイル単位でまとめる想定でよいか。継承・実装(`extends`/`implements`)の相手も `import` に入れるか。
  パスを相対パス(`./tax/TaxCalculator`)で書くか、クラス名だけにするか
- **インターフェース・契約メソッド・空実装・getter/setter の見せ方**: `isInterfaceLike` のクラスを `interface` と書くか、契約メソッド(`fragments: []`)をどう書くか。
  `stub`・`accessor` は隠しタグなので**キーワードや印では出さない**(ラベルにすでに「未対応: …」と書いてある)でよいか
- **ボタンの置き場所と、変更依頼の実装中の扱い**: `PreviewButtons` の3つ目のボタンにするか。実装中(部品置き場入りのコード)は他の2つと同じく `disabled` でよいか
- **大きさ**: 上級ステージは10ファイル前後になる。1つの `<pre>` に全ファイルを縦に並べるか、ファイルごとの見出し(`<h3>` など)で区切るか。
  ダイアログ内のスクロール・キーボードでのスクロール(`<pre>` に `tabIndex={0}` を付けるか)・スクリーンリーダーでの読み方
- **置き場所**: 組み立て関数を `src/presentation/` のどこに置くか(例: 新しいフォルダ `src/presentation/code/`)。ドメインの知識(可視性・継承)を文字にするだけなので
  presentation 層でよい見立て。`domain` に置くならカバレッジの閾値の対象になる

### 既存パイプラインとの衝突可能性

| ファイル | 本件の変更 | 同じファイルを触る進行中の件 | 衝突の見立て |
|---|---|---|---|
| 新規 `src/presentation/code/<名前>.ts` と `.test.ts` | コードの文字列を組み立てる純粋関数 | なし | なし |
| 新規 `src/presentation/code/<名前>Dialog.tsx` | ダイアログ | なし | なし |
| `src/presentation/stage/StagePanel.tsx` | `PreviewButtons`(53〜72行目)に、ボタン1つとダイアログの開閉を数行。import 1〜2行 | `score-deduction-locations`(`score` の要素の直後)・`stage-rules-summary`(`goal` の `<p>` の直後と import 1行)。`stage-draft-persistence`・`critique-request-robustness` は「変更しない」/周辺のみ | **差分の位置は `PreviewButtons` の中だけにすれば、相手の変更箇所(`StagePanel` 本体の見出し・点数)と数十行離れる**。import 行が隣り合うテキスト上の競合はありうる(小さい。手で直せる) |
| `src/index.css` | ダイアログ・`<pre>` のスタイル数行 | 多数(`class-dependency-focus`・`implements-arrow-style`・`color-contrast-a11y`・`stage-rules-summary`・`operation-guide` など) | 追記位置の競合はありうる(小さい)。既存の `.codebase-preview` のスタイルを使い回せれば、足す行を最小にできる。末尾ではなく `.codebase-preview` の定義の近くに置けば他件の追記位置とずれる見込み |
| 新規 `e2e/code-view.spec.ts` | E2E | なし | なし(`refactor.spec.ts`・`preview.spec.ts` には追記しない) |

- **読むだけで変更しないファイル**: `Codebase.ts`・`dependencies.ts`(`method-call-references` が関数を**足す**予定だが、本件は既存の `classDependencies` を使うだけ)・
  `extractMethod.ts`・`CodebasePreviewDialog.tsx`・`visibilityMark.ts`・`useGameStore.ts`(`codebase`・`changeSession` をセレクタで読むだけ)
- **触らないファイル**: `src/domain/`・`src/application/`・`src/infrastructure/`(ステージ定義・`sampleAnswer.ts`・`stageCatalog.test.ts` を含む)・`score.ts`・`describeScore.ts`・
  `CodebaseCanvas.tsx`・`ClassNode.tsx`・`MethodChip.tsx`・`FieldChip.tsx`・`FileNode.tsx`・`MethodEditor.tsx`・`CanvasContextMenu.tsx`・`layoutCodebase.ts`・
  `CodebasePreviewCanvas.tsx`・`ComparisonQuizView.tsx`・`App.tsx`・`workers/critique/`
- **意味上の依存**(テキストの競合ではなく、中身が影響し合うもの):
  - `identifier-name-validation`: 今はクラス名・メソッド名・パスに空白や記号が入りうるので、コードとして見せると壊れた見た目になる。
    本件の組み立て関数は**名前をそのまま出す**(直したり弾いたりしない)想定にすれば、あちらのマージ前後どちらでも動く
  - `template-method-stage`: 抽象クラス・抽象メソッド(`protected` のフック)を題材にするので、「中身の無いメソッド」の書き方(`abstract` と書くか)が
    あちらの題材の見え方に影響する。どちらが先でも、本件の書き方は `fragments: []` を一律に扱う形にしておけば壊れない
  - `method-call-references`: 呼び出しの表記(`this.x()` など)をそろえるとよい(どちらが先でも、後の件で合わせる)
  - 新ステージ(`inline-method-stage`・`utils-class-split-stage`・`law-of-demeter-stage`・`template-method-stage`): 同じ `Codebase` の型なので自動で効く。
    E2E は題材を変えないチュートリアル1・2で確かめれば、マージ順に左右されない
  - `stage-draft-persistence`: 途中経過を復元したあとも、ストアの `codebase` を読むだけなのでそのまま効く
