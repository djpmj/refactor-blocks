# メソッドエディタの「編集/コード」タブを、エディタ風のタブバーにする

## 背景・目的

`method-editor-tab-style.md`(実装済み)で「編集」「コード」のタブには `.mode-switch` と同じ丸いボタン風の見た目を当てた。
しかし右側サイドバーの中では、角丸ボタンが並ぶだけで「タブ」というより普通のボタンに見え、選択中かどうかも背景色の差だけで弱い。

ユーザーが示した画面イメージ(VSCodeのエディタタブ風)に合わせ、タブを**サイドバー幅いっぱいに2等分したタブバー**にして、
選択中のタブが下線と太字で一目で分かるようにする。「コード」タブにはコードを示す `</>` アイコンを付ける。
機能(タブの切り替え動作・`role`・`aria-selected`)は変更せず、見た目だけの修正。

## 変更対象ファイル一覧

| パス | 層 | 新規/変更 | 役割 |
| --- | --- | --- | --- |
| `src/index.css` | presentation | 変更 | `.method-editor__tabs` / `.method-editor__tab` / `.method-editor__tab[aria-selected="true"]` のスタイルを下記の見た目に置き換える |
| `src/presentation/editor/MethodEditor.tsx` | presentation | 変更 | 「コード」タブのボタン内、ラベルの前にアイコン用の `<span className="method-editor__tab-icon" aria-hidden="true">&lt;/&gt;</span>` を足す。`role`・`aria-selected`・`onClick`・ラベル文字列は変更しない |

## 見た目の仕様(`index.css`)

- `.method-editor__tabs`: `display: flex`。サイドバーの幅いっぱいに広げ(親の余白は変えない)、タブ同士の隙間は無し(`gap: 0`)。
  下端に1pxの区切り線(`var(--border)`)を引き、タブバーと下の内容を分ける。角丸は付けない
- `.method-editor__tab`: `flex: 1`(2つを等幅に)、中身は中央揃え。枠線なし、角丸なし、背景は非選択時に薄いグレー系
  (ライトは `var(--file-bg)`、ダークも同変数で自動的に切り替わる)、文字色は `var(--text)`。下端に2pxの透明な線(選択時に色が付いても高さが変わらないように)
- `.method-editor__tab[aria-selected="true"]`: 背景は `var(--surface)`(白)、文字は太字(`font-weight: 700`)、
  下端の線が `var(--accent)` 色になる
- `.method-editor__tab:hover`(非選択時のみ): 背景をほんの少し濃くして押せることを示す(`color-mix` か同系統の既存変数で。新しいCSS変数は足さない)
- `.method-editor__tab:focus-visible`: アウトラインを表示する(キーボード操作を維持するため、`outline: none` にしない)
- `.method-editor__tab-icon`: 色は `var(--protected)`(オレンジ系の既存変数)、ラベルとの間に4px程度の余白。フォントは等幅(`monospace`)
- ライト・ダークどちらでも既存のCSS変数経由で配色が破綻しないこと(色の直書きをしない)

## データ・型の変更

なし。CSSクラス名・アイコン用の `<span>` の追加とスタイル定義のみで、ドメインモデルやPropsの型には影響しない。

## TDD対象の純粋関数

なし。表示のみの変更であり、`domain`/`application`層のロジック変更を伴わないため
(`CLAUDE.md`「表示のみのコンポーネントはユニットテスト対象外としてよい」)。

タブの切り替え動作は既存の `e2e/class-code-preview.spec.ts` がカバーしている。アイコンを足しても、
アイコンは `aria-hidden` なのでタブのアクセシブルネームは「コード」のままで、既存E2E(`getByRole('tab', { name: 'コード' })`)は変更なしで通る。
新規E2Eは不要。

## 受け入れ基準

- `npm run check`(lint + typecheck + test)が通る
- `e2e/class-code-preview.spec.ts` が変更なしで通る
- メソッドをクリックしてメソッドエディタを開くと、「編集」「コード」がサイドバー幅いっぱいに2等分で並ぶ
- 選択中のタブは背景が白(`--surface`)・太字・下に `--accent` 色の下線、非選択のタブは薄いグレー背景で下線なし
- タブを切り替えると、下線・太字・背景が即座にもう一方へ移る
- 「コード」タブのラベルの前にオレンジ色の `</>` が表示される。「編集」タブにアイコンは付けない
- ライトモード・ダークモードどちらでも読める配色になっている
- Tabキーでフォーカスしたタブにフォーカスリングが見える

## スコープ外

- タブの個数・名前の変更、「編集」タブへのアイコン追加
- メソッドエディタの他の要素(抽出操作・可視性セレクト・タイトル行)のレイアウト変更
- `ClassCodePreview.tsx` の中身の変更(コードの色分けは `code-preview-highlight`(Issue #33)で扱う)
- タブ切り替えのアニメーション
