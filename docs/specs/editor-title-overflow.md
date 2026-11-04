# editor-title-overflow: メソッドエディタの見出し「クラス名.メソッド名()」が長いと右に切れる

## 症状

- 上級7(`上級7: 金額と通貨を Money にまとめる`)で `ExpenseApplicationService` のメソッド
  (`validateMoney()`・`format()`、抽出前の `submitExpense()` も同じ)を開くと、右のメソッドエディタの見出しが
  右端で切れる。実測で見出しの `scrollWidth` 369px に対し `clientWidth` 321px。`text-overflow` は既定の `clip` なので
  省略記号も出ず、「…validateMone」のように途中で消える。行数表示「7行」は2行目に落ちる。
- 中級4(`SalesReportService.generateQuarterlyRe…`)でも、1440px幅・左サイドバーを開いた状態で右端が切れる。

## 原因

`src/index.css` の `.method-editor__title` は `font-size` と `font-family` しか指定していない。
見出しの文字列 `ExpenseApplicationService.validateMoney()` は空白を含まないため、ブラウザは途中で折り返せず、
パネル幅(`.method-editor` は `min-width: 0` で縮む)より長いとはみ出して切れる。
行数バッジ(`.line-badge`)の前には空白があるので、そこだけで改行されて2行目に落ちている。

見出しは `src/presentation/editor/MethodEditor.tsx`(380行目)の `<h2 className="method-editor__title">` で、
同じクラスを `FieldInfo.tsx`・`PreviewMethodPanel.tsx`・`ChangeRequestPanel.tsx`・`BlankDesignResultPanel.tsx` も使う。
スタイルは `.method-editor__title` の1か所(と `.codebase-preview__panel .method-editor__title` の上書き。こちらは
`margin`/`font-size` のみ)なので、直す場所は1か所で済む。

## 修正

- `src/index.css`(presentation)の `.method-editor__title` に `overflow-wrap: anywhere;` を足す。
  - 変更後: `.method-editor__title { font-size: 15px; font-family: ui-monospace, monospace; overflow-wrap: anywhere; }`
  - 空白のない長い識別子もパネル幅で折り返し、全文が見える。行数バッジは入る位置に続けて出る(入らなければ次の行)
- 既存の同種の修正(`change-pain-wrap.md` の `.change-pain li`、`code-preview-wrap.md`、`resizable-left-sidebar.md` の
  `.sidebar`)と同じ `overflow-wrap: anywhere` に揃える。
- 省略記号(`text-overflow: ellipsis` + `title` 属性)にはしない。このゲームはメソッド名を読んで判断させるので、
  全文が常に見える折り返しのほうが目的に合い、TSX の変更も要らない(CSS 1行で済む)。
  クラス名とメソッド名を別行に分ける DOM 変更も、折り返しで足りるので行わない。
- 同じクラスを使う他のパネル(フィールド情報・プレビュー・変更依頼・答え合わせ)の見出しにも同じ折り返しが効く。
  短い見出しは見た目が変わらない。

## テスト

CSS のみの変更で `domain`/`application` のロジックは増えないため、Vitest のテストは追加しない。E2E で守る。

- `e2e/editor-title-overflow.spec.ts` を新規作成(既存の見出しの E2E は `class-code-preview.spec.ts` の行数確認だけで
  目的が異なるため、別ファイルにする)。先に書いて、修正前に失敗することを確かめる。
  - `selectStage(page, '上級7: 金額と通貨を Money にまとめる')` で開き、`page.getByTestId('method-submitExpense').click()` で
    メソッドエディタを開く(開幕の修正バナー等が出る場合は既存の E2E と同じ手順で閉じる)
  - 見出し `page.locator('.method-editor__title')` が `ExpenseApplicationService.submitExpense()` を含む
  - 見出しの `scrollWidth <= clientWidth` が `true`(`expect.poll` で待つ)
  - `page.setViewportSize({ width: 1024, height: 900 })` に狭めても `scrollWidth <= clientWidth` が `true`
  - 行数バッジ `.method-editor__title .line-badge` が見えている(`toBeVisible()`)

## 受け入れ基準

1. 上級7で `ExpenseApplicationService` のメソッドを開いたとき、見出しが右に切れず全文が読める
   (`.method-editor__title` の `scrollWidth <= clientWidth`)。中級4の `SalesReportService.generateQuarterlyReport()` も
   1440px幅・サイドバーを開いた状態で切れない
2. 見出しのテキストと DOM 構造は変わらない(`MethodEditor.tsx` などの TSX は変更しない)
3. 短い見出し(チュートリアル1の `ReportService.printMonthlyReport()` など)の見た目は変わらず、
   `class-code-preview.spec.ts` の行数バッジ確認がそのまま通る
4. `npm run check` と `npm run test:e2e` が通る

## スコープ外

- 省略記号表示・`title` 属性・クラス名とメソッド名の別行表示
- キャンバスのクラスノード・メソッドブロック内の名前の見切れ対応
- 見出しのフォントサイズ・余白の調整、メソッド名を短くするステージ定義の変更(`short-method-names.md` の範囲)
