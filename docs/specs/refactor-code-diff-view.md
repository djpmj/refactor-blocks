# refactor-code-diff-view: 組み替える前のコードと今のコードを並べ、移動・抽出した処理を追えるようにする

## 背景・目的

実機で確かめたこと:

- 各メソッドの「コード」タブ(`ClassCodePreview`)は、**今のコードベースの、選んだメソッドのクラス1つ分**のC#しか出さない。
  チュートリアル1で `printMonthlyReport()` から「今月の売上を集計する」を抽出すると、コードタブでは `aggregateSales();` と新しいメソッドが見えるが、
  抽出する前にどこに何が書いてあったかはもう見られない
- サイドバーの「どんなコード?」は `stage.description`(文章)で、コードではない
- 既存の比較画面はどれも「組み替える前の自分のコード」と「今のコード」をC#で比べるものではない
  - `answer-comparison-view`: 自分の設計と**解答例**を図で比べる
  - `change-impact-review`(`ChangeImpactDialog`): 変更依頼についての直す場所を、組み替える前と今の**図**で比べる。変更依頼があるときだけ出る

リファクタリングは「振る舞いを変えずにコードの置き場所を変える」ことなので、同じ処理のコードが**どこからどこへ移ったか**を
C#のまま見比べられると、ブロック操作と実際のコードの対応が身に付く。そこで、組み替える前(`stage.codebase`)と今のコードを
左右に並べ、処理(Fragment)ごとに「移動・追加・削除」を色と文字で示すビューを足す。

本当に行単位の差分(LCS)が要るか: 要らない。抽出・移動ではコードの中身は変わらず置き場所が変わるだけなので、行の差分だと
「消えた行」と「増えた行」に分かれて対応が追えない。処理は抽出・移動しても `Fragment.id` が変わらない(`extractMethod` は
選んだ処理をそのまま新しいメソッドへ移し、呼び出し行だけ新しく作る。`designDiff` も同じ前提で動いている)ので、**Fragment.id で対応づける**ほうが短く、移動も追える。

## 変更対象ファイル一覧

| 種別 | パス | 層 | 役割 |
| --- | --- | --- | --- |
| 変更 | `src/domain/codebase/generateClassSource.ts` | domain | 各行がどの処理(Fragment)のものかを付けた行の配列を返す `generateClassSourceLines` を足し、`generateClassSource` はそれを `\n` でつなぐだけにする |
| 変更 | `src/domain/codebase/generateClassSource.test.ts` | domain | `generateClassSourceLines` のテストを足す(既存のテストはそのまま通ること) |
| 新規 | `src/domain/codebase/fragmentChanges.ts` | domain | 2つのコードベースで、処理ごとに「移動・追加・削除」を求める |
| 新規 | `src/domain/codebase/fragmentChanges.test.ts` | domain | 上のテスト |
| 新規 | `src/presentation/editor/highlightCsharp.ts` | presentation | `ClassCodePreview.tsx` の `hljs` の登録と `splitHighlightedLines` をここへ移し、`highlightCsharpLines(source): string[]` として共有する(コンポーネントのファイルから関数を export すると `react-refresh` のlintに当たるため) |
| 変更 | `src/presentation/editor/ClassCodePreview.tsx` | presentation | 上の `highlightCsharpLines` を使う(見た目・動きは変えない) |
| 新規 | `src/presentation/editor/CodeChangeDialog.tsx` | presentation | 組み替える前と今のコードを左右に並べるダイアログ |
| 変更 | `src/presentation/editor/MethodEditor.tsx` | presentation | コードタブの上に「組み替える前と比べる」ボタンを置き、ダイアログを開く |
| 変更 | `src/index.css` | presentation | ダイアログの2列レイアウトと、移動・追加・削除の行の色 |
| 新規 | `e2e/refactor-code-diff-view.spec.ts` | E2E | 受け入れ基準を確かめる |

application層・infrastructure層・ストア(`useGameStore.ts`)は変更しない(組み替える前は `state.stage.codebase`、今は `state.codebase` をそのまま読む)。新しい依存は足さない(色付けは導入済みの `highlight.js` を使う)。

## データ・型の変更

保存形式の変更はなし。

```ts
// src/domain/codebase/generateClassSource.ts
export type SourceLine = {
  readonly text: string;
  /** この行が属する処理の id。クラス宣言・フィールド・メソッド宣言・波括弧・空行は undefined。 */
  readonly fragmentId?: string;
};
export function generateClassSourceLines(codebase: Codebase, classId: string, language: CodeLanguage): SourceLine[];
// 既存。中身は generateClassSourceLines(...).map((line) => line.text).join('\n') にする
export function generateClassSource(codebase: Codebase, classId: string, language: CodeLanguage): string;
```

- 処理の行は、処理名のコメント行(`// 今月の売上を集計する` / `// 未入力: ...`)とコードの各行に、その処理の `fragmentId` を付ける。処理と処理の間の空行には付けない

```ts
// src/domain/codebase/fragmentChanges.ts
export type MethodLocation = { readonly className: string; readonly methodName: string };
export type FragmentChange =
  | { readonly kind: 'moved'; readonly from: MethodLocation; readonly to: MethodLocation }
  | { readonly kind: 'added'; readonly to: MethodLocation }
  | { readonly kind: 'removed'; readonly from: MethodLocation };
/** キーは Fragment.id。置き場所が変わらない処理は入れない。 */
export function fragmentChanges(before: Codebase, after: Codebase): ReadonlyMap<string, FragmentChange>;
```

- 「置き場所が変わった」は、処理を持つ**メソッドの id またはクラスの id** が違うこと(名前では比べない。メソッド名の変更だけでは `moved` にしない)
- `added`: `after` にだけある処理(抽出でできた呼び出し行、変更依頼で足した処理など)
- `removed`: `before` にだけある処理(統合・削除で消えたもの)
- 呼び出し行(`call`)も他の処理と同じに扱う(抽出で増えた呼び出し行を「追加」として見せたいため。`designDiff` とはここが違う)

## 動きの仕様

- メソッドエディタの「コード」タブを開くと、コードの上に「組み替える前と比べる」ボタンが出る。押すと `CodeChangeDialog` が開く
  - `PreviewMethodPanel`(解答例などのプレビュー)のコードタブには出さない(比べる「組み替える前」がプレイヤーの操作ではないため)
- ダイアログ(`<dialog>`、`data-testid="code-change-dialog"`、見出し「組み替える前と今のコード」)
  - 既存の `ChangeImpactDialog` と同じ作り: `showModal()` で開き、`WindowControls` で最大化・閉じる、Escape で閉じる。閉じたらフォーカスはボタンに戻る(`<dialog>` の標準の動き)
  - 左の列「組み替える前」(`data-testid="code-before"`)に `stage.codebase`、右の列「今」(`data-testid="code-after"`)に今のコードベースを出す
  - 各列は `allClasses(codebase)` の順に、クラスごとの `generateClassSourceLines` を空行1行をはさんでつなげ、`highlightCsharpLines` で色付けし、コードタブと同じ `code-preview__line` の行番号付きで出す
  - 処理の行には `data-fragment-id` と、変化があれば `data-change="moved" | "added" | "removed"` を付けて背景色を変える
    - 左の列: `moved` と `removed` の行に色を付ける。右の列: `moved` と `added` の行に色を付ける
  - 色だけに頼らず、変化のあった処理の**最初の行(処理名のコメント行)**の右端に文字のラベルを付ける
    - 左の列の `moved`: `→ <to.className>.<to.methodName>() へ`、`removed`: `削除`
    - 右の列の `moved`: `← <from.className>.<from.methodName>() から`、`added`: `追加`
  - 列の上に要約(`data-testid="code-change-summary"`)を出す: `移動 N 件・追加 N 件・削除 N 件`(0件の種類は省く)。変化が1件もなければ `まだ組み替えていません`
  - 2列は幅が足りないとき(既存の `impact-review` と同じブレークポイント)上下に積む。各列は縦にスクロールでき、コードは折り返す(コードタブと同じ `pre-wrap`)
- ダイアログは開いた時点のコードを出す(開いたまま操作はできないモーダルなので、開いている間の更新は考えない)

## TDD対象

### `generateClassSourceLines`(domain)

- チュートリアル1相当のクラス → `text` をつなぐと既存の `generateClassSource` の出力と完全に一致する
- 処理を2つ持つメソッド → 1つ目の処理のコメント行とコード行には1つ目の id、間の空行は `fragmentId` なし、2つ目の処理の行には2つ目の id
- コードが未入力の処理 → `// 未入力: <label>` の1行にその処理の id
- クラス宣言・フィールド・メソッド宣言・`{` `}` の行 → `fragmentId` なし
- 存在しないクラス id → 空配列(`generateClassSource` は今どおり `''`)

### `fragmentChanges`(domain)

- 同じコードベース同士 → 空の Map
- 処理を同じクラスの新しいメソッドへ抽出 → 抽出した処理が `moved`(from は元のメソッド、to は新しいメソッド)、新しい呼び出し行が `added`、抽出しなかった処理は入らない
- メソッドを別クラスへ移動 → そのメソッドの全処理が `moved`(クラス名が変わる)
- メソッド名だけ変えた(id は同じ) → 入らない
- `before` にだけある処理 → `removed`
- 引数の `before` / `after` を変更しない

## 受け入れ基準

1. チュートリアル1で `printMonthlyReport()` を選び、「コード」タブの「組み替える前と比べる」を押すと、2列のダイアログが開き、要約が `まだ組み替えていません` になる
2. チュートリアル1で「今月の売上を集計する」を抽出してから開くと、
   - 要約が `移動 1 件・追加 1 件` になる
   - 左の列の `// 今月の売上を集計する` の行に `→ ReportService.aggregateSales() へ` が付き、右の列の同じ行に `← ReportService.printMonthlyReport() から` が付く
   - 右の列の `aggregateSales();` の呼び出し行が「追加」の色になり、処理名のコメント行に `追加` が付く
   - 抽出しなかった処理(「前月比を計算する」など)の行には色もラベルも付かない
3. メソッドを別クラスへドラッグで移したあとに開くと、移したメソッドの処理に `← <元のクラス名>.<メソッド名>() から` が付く
4. Escape キーと「閉じる」ボタンのどちらでも閉じられ、閉じたあと「組み替える前と比べる」ボタンにフォーカスが戻る
5. 既存の `e2e/class-code-preview.spec.ts` が変更なしで通る(コードタブの見た目・行番号は変わらない)
6. `npm run check` と `npm run test:e2e` が通る

## 設計判断(確定)

- **入口はメソッドエディタのコードタブだけ**。「どんなコード?」は文章の説明で、コードを読む場所はコードタブなので、そこに置く。入口を2つにしない
- **比べる「組み替える前」は `stage.codebase`(ステージの初期状態)**。直前の1手との比較ではない(1手ごとの変化は `operation-result-feedback` が扱っている)
- **全クラスを出す**。抽出・移動では新しいクラスができたり消えたりするので、選んだクラス1つだけでは「どこへ行ったか」が見えない
- **行の差分ではなく処理(Fragment.id)単位で対応づける**(背景・目的の理由)。処理の中身(コード文字列)の変化は比べない
- 変更依頼の調査・実装中も同じように開ける(変更依頼で足した処理は「追加」に出る)。特別扱いはしない

## スコープ外

- 行単位の差分(LCS)、処理の中のコードの書き換えの検出
- ラベルを押して反対側の列の同じ処理へスクロール・強調する機能、左右のスクロール同期
- 直前の1手や任意の時点との比較(履歴の選択)
- C#以外の言語
- 解答例との比較(`answer-comparison-view` が扱う)
- 差分の採点・点数への反映
