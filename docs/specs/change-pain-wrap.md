# 「もし、この変更が来たら?」カードの長い場所名を折り返す

## 背景・目的

左のサイドバーの課題カード(`src/presentation/stage/ChangePainCard.tsx`)は、直す場所を
`ReportService.printMonthlyReport(86行)` のような「クラス名.メソッド名(行数)」の箇条書きで出す。
この文字列は空白を含まないため、サイドバー幅(260px既定・ドラッグで変更可)より長いと折り返されず、
右端の `(86行)` が見切れて読めない。

サイドバーの現在の幅に合わせて、長い場所名を途中で折り返し、全文が読めるようにする。

## 変更対象ファイル一覧

### 変更

- `src/index.css`(presentation のスタイル)
  - `.change-pain li` に `overflow-wrap: anywhere;` を指定する。空白のない長い識別子もカード幅で折り返す
  - 同じ見切れが起きうる `.change-memo__list li`(`ChangeMemo.tsx` の前回の変更依頼の減点理由)にも同じ指定をする
  - 対象はこの2つのリストだけ。サイドバー全体(`.sidebar`)や他のパネルのスタイルは変えない
- `e2e/change-pain.spec.ts`: 既存ケースに追記(新規ファイルは作らない)

## データ・型の変更

なし。

## TDD対象の純粋関数

なし(CSSのみの変更。`domain`/`application` のロジックは増えない)。折り返しはE2Eで守る。

## 受け入れ基準

- `npm run check` と既存E2Eが通る
- チュートリアル1で課題カードを表示したとき、場所のリスト(`.change-pain li`)の `scrollWidth <= clientWidth` で、
  `ReportService.printMonthlyReport(86行)` の末尾が見切れない(カードの右端を越えない)
- サイドバーを狭めても `.change-pain li` が横にはみ出さない
- 表示テキスト(`describePain` の出力)は変わらない。折り返すだけで、文字列の中身・DOM構造は同じ
- 課題カード以外のレイアウトは変わらない

## スコープ外

- 場所名の表示形式の変更(省略記号で切る、行数を別行にする、など)
- コードタブの折り返し(Issue #92 `code-preview-wrap`)
- 課題カード・前回の変更依頼以外のパネルの見切れ対応
