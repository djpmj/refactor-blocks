# コードタブの長い行をサイドバー幅で折り返す

## 背景・目的

メソッドエディタの「コード」タブ(`src/presentation/editor/ClassCodePreview.tsx`)は生成したC#疑似ソースを
`<pre><code>` で表示している。`<pre>` は折り返さないため、長い行(`var monthlySales = sales.Where(...` など)が
サイドバーの右端で見切れ、横スクロールしないと読めない。

サイドバーは幅をドラッグで変えられる(`sidebar-resizable`)ので、固定の桁数ではなく
**サイドバーの現在の幅に合わせて**長い行を折り返し、コード全体が横スクロールなしで読めるようにする。

## 変更対象ファイル一覧

### 変更

- `src/index.css`(presentation のスタイル)
  - コードタブの `pre` に `white-space: pre-wrap; overflow-wrap: anywhere;` を指定する。
    インデントの空白は保ったまま、サイドバー幅に収まらない行だけ折り返す
  - `pre` がサイドバーの幅を押し広げないよう、`max-width: 100%`(または親が `min-width: 0`)にして
    `pre` 自体の横スクロールバーが出ない状態にする。サイドバー幅を変えると折り返し位置も追従する
  - 対象は「コード」タブの `pre` だけ(他の `pre` / 要素のスタイルは変えない)。
    必要なら `ClassCodePreview.tsx` の `<pre>` に専用クラス(例: `class-code-preview__source`)を付けてよい
- `src/presentation/editor/ClassCodePreview.tsx`: クラス名を付ける場合のみ変更(構造・`role="tabpanel"`・
  `aria-label="コード"`・言語プルダウン・`pre code` は維持)
- `e2e/class-code-preview.spec.ts`: 既存ケースに追記(新規ファイルは作らない)

## データ・型の変更

なし。

## TDD対象の純粋関数

なし(CSSのみの変更で `domain`/`application` のロジックは増えない)。
折り返しの挙動はE2Eで守る。

## 受け入れ基準

- `npm run check`(lint + typecheck + test)と既存E2Eが通る
- チュートリアル1で `printMonthlyReport` を選び「コード」タブを開いたとき、`pre` が横スクロールしない
  (`pre.scrollWidth <= pre.clientWidth`)。長い行の末尾(`changeRate` の三項演算子の右端など)が見切れず読める
- サイドバー幅を広げると、折り返される行が減る(`pre` の高さが小さくなる)。狭めると折り返しが増え、それでも横スクロールしない
- インデントの空白が保たれる(`white-space: pre-wrap`)
- コードの文字列自体(`generateClassSource` の出力)は変わらない。テキストとしての内容・改行位置はそのまま
- 「コード」タブ以外の表示(キャンバス・メソッドエディタの「編集」タブ・他パネル)のレイアウトは変わらない

## スコープ外

- Issue #33(`code-preview-highlight`)の色分け・行番号。#33 の仕様は「折り返しはしない」としているが、本仕様で
  上書きする。#33 は本仕様のマージ後に rebase し、行番号を「ソースの論理行ごとの行」として折り返しと両立させる
  (折り返された行の左の番号は先頭の表示行だけに付ける、など)。この調整は #33 側で行う
- 折り返し方法の切り替えボタン・設定の保存
- コードの生成ロジック(`generateClassSource`)・他言語の対応
- コード以外のパネル(クリティーク講評など)の折り返し
