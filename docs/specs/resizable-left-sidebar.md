# 左サイドバー(課題とヒント)の幅をドラッグ・キーボードで変える

## 背景・目的

右サイドバー(メソッドエディタなど)は `resizable-sidebar` で幅を変えられるが、左の「課題とヒント」サイドバー
(`StagePanel.tsx` の `<aside className="sidebar">`、`index.css` の `.sidebar { width: 260px }`)は幅が固定のままである。
課題文・「もし、この変更が来たら?」カード・ヒント・ストーリーが長いため、狭いと縦に長くなり、
`RegularDiscount/PremiumDiscount/…` のような長い名前が右端で見切れる。逆に、キャンバスを広く使いたいときは狭めたい。
プレイヤーが読みやすい幅に、右サイドバーと同じ操作で調整できるようにする。

## 変更対象ファイル一覧

### 変更

- `src/presentation/useResizableSidebarWidth.ts`(presentation): 右専用のフックを、サイドバーがどちら側にあるかを
  受け取る形に一般化する。
  `useResizableSidebarWidth({ side: 'left' | 'right', defaultWidth, minWidth, maxWidth })`
  - 右サイドバー(既存の呼び出し `App.tsx` / `BlankDesignView.tsx`)は `side: 'right'`、`360 / 280 / 640` で従来と同じ動き
  - 左サイドバーは `side: 'left'`、`defaultWidth: 260`、`minWidth: 200`、`maxWidth: 480`
  - ハンドルが「サイドバーの内側の端」にあるので、ドラッグの向きが反対になる:
    右サイドバーはポインタを左へ動かすと広がり、**左サイドバーはポインタを右へ動かすと広がる**。
    キーボードも、右サイドバーは ← で広がるのに対し、左サイドバーは → で広がる(ドラッグの向きと一致させる)
  - 幅は永続化しない(右サイドバーと同じ。リロードで既定値に戻る)
  - `handleProps` の `aria-label` は呼び出し側から渡せる(`サイドバーの幅を変更` を既定とし、左は `課題とヒントの幅を変更`)。
    その他の `role="separator"`・`aria-valuenow/min/max`・`tabIndex` は既存と同じ
- `src/presentation/stage/StagePanel.tsx`(presentation)
  - `StagePanelContent` でフックを呼び、`sidebarOpen` のときだけ、`aside.sidebar` のすぐ右にハンドル
    (`sidebar-resizable__handle` と同じ見た目・同じ `handleProps`)を出す。閉じているとき(`hidden`)はハンドルも出さない
  - 幅は `.app__body` のインラインスタイルでCSSカスタムプロパティ `--sidebar-width` として渡す
    (開閉ボタンとの位置をそろえるため。`aside` の `style={{ width }}` を直接使ってもよいが、ボタンも追従すること)
- `src/index.css`(presentation)
  - `.sidebar { width: 260px }` を `width: var(--sidebar-width, 260px)` にする
  - `.app__body--sidebar-open > .sidebar-toggle` の `left` を `var(--sidebar-width, 260px)` にする。
    ボタンの左端をサイドバーの右端に一致させ、サイドバーの内側(スクロールバー)に食い込ませない(`sidebar-toggle-overlap`、Issue #99 の方針。
    `- 10px` のような食い込みは入れない。#99 が先にマージ済みなら `left: 260px` をこの形に置き換え、未マージなら #99 側が rebase で合わせる)
  - 狭い画面用の既存の上書き(`.app__body--sidebar-open > .sidebar { width: min(260px, 40vw) }` と
    `.sidebar-toggle { left: ... }`)は、サイドバー幅を `min(var(--sidebar-width, 260px), 40vw)` にし、ボタンの `left` も
    同じ値(`min(var(--sidebar-width, 260px), 40vw)`)にして、サイドバーの右端に接する位置を保つ。狭い画面でキャンバスが消えないこと
  - `.sidebar` に `overflow-wrap: anywhere` を足し、幅を狭めても長い識別子(クラス名・メソッド名)が見切れず折り返す
    (`change-pain-wrap`・`code-preview-wrap` の方針と同じ。同じ指定が既にあれば足さない)
- `src/presentation/clampSidebarWidth.ts` / `clampSidebarWidth.test.ts`(presentation): 追加の純粋関数 `widthAfterDrag` を置く(下記)
- `e2e/sidebar-toggle.spec.ts` と `e2e/refactor.spec.ts`: 左サイドバーのドラッグ・キーボードでの幅変更、
  幅を変えたあとの開閉ボタンの位置を確認するケースを追記する(新規ファイルは作らない)

## データ・型の変更

なし。幅は `useState` が持つ、画面表示専用の一時的な状態。

## TDD対象の純粋関数

ドラッグの向きの違いを、フックの外の純粋関数に切り出してテストする(`src/presentation/clampSidebarWidth.ts` に追加):

`widthAfterDrag(side: 'left' | 'right', startWidth: number, startX: number, currentX: number, min: number, max: number): number`

1. `side: 'left'` で、ポインタが右へ `+40` 動くと幅は `startWidth + 40`
2. `side: 'right'` で、ポインタが左へ `-40` 動くと幅は `startWidth + 40`(既存の動きと同じ)
3. `side: 'left'` でポインタが左へ動くと幅は狭まる。`min` を下回らない
4. `side: 'left'` で大きく右へ動いても `max` を超えない
5. ポインタが動かない(`currentX === startX`)と幅は `startWidth` のまま(範囲内のとき)

フック本体(ポインタ捕捉・キーボード)は副作用を持つためユニットテスト対象外とし、E2Eで守る。

## 受け入れ基準

- `npm run check` と `npm run test:e2e` が通る。既存の右サイドバー・開閉ボタンのE2E(`sidebar-toggle.spec.ts` など)が壊れない
- 左サイドバーが開いているとき、その右端にドラッグできるハンドル(`role="separator"`、`aria-label="課題とヒントの幅を変更"`)が出る
- ハンドルを右へドラッグすると左サイドバーが広がり、左へドラッグすると狭まる。幅は 200〜480px の範囲に収まる
- ハンドルにフォーカスして → で広がり、← で狭まる(1回16px)。範囲を超えない。`aria-valuenow` が現在の幅を表す
- 幅を変えても、開閉ボタン(`«`/`»`)は常にサイドバーの右端の境界に接していて、サイドバー(スクロールバー)に重ならない(ボタンの左端 ≥ サイドバーの右端、差は 2px 以内)
- サイドバーを閉じるとハンドルも消え、開き直すと直前に調整した幅で開く(同じセッション内。リロードでは既定の260pxに戻る)
- 幅を最小にしても、長い識別子(`DiscountService.calculateDiscount(110行)` など)が見切れず折り返す
- 狭い画面でも、キャンバスが消えず、サイドバーの幅は画面の40%以内に収まる
- 左サイドバーを操作しても、右サイドバーの幅・表示は変わらない(逆も同じ)
- 設計くらべ・白紙設計など、`StagePanel` を使わない画面は変わらない

## スコープ外

- 幅の永続化(`localStorage` など)。右サイドバーと同じく、リロードで既定値に戻る
- ダブルクリックで既定幅に戻す、ドラッグ中の幅の数値表示
- サイドバー内の各カード(「もし、この変更が来たら?」など)の表示内容の変更
- 右サイドバーの上限・下限・既定幅の変更
- タッチ以外のジェスチャー(ピンチなど)
