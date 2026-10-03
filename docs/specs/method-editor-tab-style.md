# メソッドエディタの「編集/コード」タブに見た目のスタイルを当てる

## 背景・目的

`class-code-preview-tab.md`(実装済み、`docs/specs/implemented.md`)で、メソッドエディタ
(`src/presentation/editor/MethodEditor.tsx`)に「編集」「コード」のタブ切り替え
(`role="tablist"` / `role="tab"` / `aria-selected`)を追加した。機能は動くが、タブの `<button>` に
専用のCSSが当たっておらず、選択中かどうかが見た目で分からない素のボタンのまま残っている。

画面左上のモード切り替え(「リファクタリング」「設計くらべ」「自由設計」、`.mode-switch`、
`aria-pressed="true"` で青背景にする既存のスタイル)と同じ見た目のパターンをメソッドエディタの
タブにも適用し、選択中のタブが一目で分かるようにする。機能(タブの切り替え動作)は変更しない、
見た目だけのCSS修正。

## 変更対象ファイル一覧

| パス | 層 | 新規/変更 | 役割 |
| --- | --- | --- | --- |
| `src/presentation/editor/MethodEditor.tsx` | presentation | 変更 | `role="tablist"` の `<div>` に `method-editor__tabs` クラスを、各 `role="tab"` の `<button>` に `method-editor__tab` クラスを足す(`aria-selected`・`onClick`などの既存ロジックは変更しない) |
| `src/index.css` | presentation | 変更 | `.method-editor__tabs`・`.method-editor__tab`・`.method-editor__tab[aria-selected="true"]` のスタイルを、`.mode-switch` / `.mode-switch button[aria-pressed="true"]`(39〜41行目)と同じ見た目になるよう追加する |

## データ・型の変更

なし。CSSクラス名の追加とスタイル定義のみで、`Codebase`・`Stage` などのドメインモデルやPropsの型には影響しない。

## TDD対象の純粋関数

なし。表示のみのCSS・クラス名変更であり、`domain`/`application`層のロジック変更を伴わないため
(`CLAUDE.md`「表示のみのコンポーネントやI/Oを含む副作用コードはユニットテスト対象外としてよい」)。

タブの切り替え動作(`activeTab` の `useState` 遷移、クリックで `ClassCodePreview` と編集UIが
入れ替わる)は `class-code-preview-tab.md` で実装済みの `e2e/class-code-preview.spec.ts` が既に
カバーしており、今回CSSクラスを足すだけなので新規E2Eテストは不要(既存テストが引き続き通ることを
確認すれば十分)。

## 受け入れ基準

- `npm run check`(lint + typecheck + test)が通る
- `e2e/class-code-preview.spec.ts` が、クラス名変更後も引き続き通る(タブの機能面に影響がないこと)
- 画面でメソッドをクリックしてメソッドエディタを開いたとき、「編集」「コード」のタブが
  `.mode-switch` と同じ見た目(非選択時は枠線だけ、選択中は `--accent` 色の背景・白文字)で表示される
- タブを切り替えると、選択中の表示(背景色)が即座に切り替わる(`aria-selected` の値に連動)
- ライトモード・ダークモードどちらでも(`--accent` などのCSS変数経由のため)配色が破綻しない

## スコープ外

- タブの構成・個数の変更(「編集」「コード」の2つのまま。新しいタブの追加はしない)
- メソッドエディタ内の他の要素(抽出操作・可視性セレクトなど)のレイアウト変更。今回は
  タブの見た目のみを対象にする(ユーザーが「編集/コードタブに分けてほしいだけ」と確定させた範囲)
- `ClassCodePreview.tsx` の中身(コードプレビューの表示形式)の変更

## 未決事項

なし。対話(`AskUserQuestion`)で、`.mode-switch` と同じ見た目に揃えるCSSのみの修正であることを確定済み。
