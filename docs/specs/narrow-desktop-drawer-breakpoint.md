# narrow-desktop-drawer-breakpoint: 幅701〜1023pxのウィンドウで、左右パネルに挟まれたキャンバスが潰れないようにする

小さな不具合修正。ファイル名は依頼時のものだが、ドロワーの境界(700px)は**動かさない**(理由は「修正」の「採らなかった案」)。
直すのは、701〜1023pxで左右パネルの幅に上限をかけてキャンバスの幅を残すことだけ。

## 症状

デスクトップのブラウザを幅800x600にして、チュートリアル1で「実際に直してみる」を押す(または抽出エディタを開く)と、次のことが起きる。

- 左の課題パネル(約280px)と右のエディタ(360px)が両方出て、キャンバスの幅が約160pxしか残らない
- `ReportService` のファイル枠が途中で切れ、「整列」ボタンがファイル枠に重なる
- メソッドの「直した」チェックボックスがキャンバスの外(x=461)に出て、クリックすると別の要素に当たる
- 「全体を表示」を押すと縮小されすぎて、チェックボックスが消える

1024x700では起きない。スマホ幅(700px以下)はドロワーになるので対象外。

関連する既存の仕様:

- `narrow-screen-layout.md`: 700px以下で左右パネルをドロワーにする。「701px以上は今のまま」と決めていて、今回の幅はその外にある
- `left-sidebar-default-max-width.md`: 左パネルの初期幅を上限(480px)にする。1400px未満では `stageSidebarMaxWidth()` が画面幅の35%(200〜480px)に下げる
- `canvas-refit-on-resize.md`: キャンバスの大きさが変わったら図を合わせ直す。今回キャンバスの幅が変わったときもこの仕組みで合わせ直されるので、追加の対応は要らない
- #404(`StagePanel.tsx` の `ChangeRequestSidebarCloser`): 変更依頼のときは701〜1399pxで左パネルを閉じる。手で直すシミュレーションのときは逆に `useOpenSidebarForManualFix` が1400px未満で左パネルを開く(「リリースする」ボタンが左パネルにあるため)ので、左右が両方出る

## 原因

`src/presentation/useResizableSidebarWidth.ts` の `effectiveBounds` は、700px以下の左パネル以外では、呼び出し元が渡した `minWidth`/`maxWidth` をそのまま使う。

- 右のエディタ(`App.tsx` の `RefactorView`): `defaultWidth: 360, minWidth: 280, maxWidth: 640`。画面幅が狭くても360pxのまま
- 左パネル(`StagePanel.tsx` の `useStageSidebarWidth`): 画面幅の35%(800pxで280px)

800pxでは 800 − 280 − 360 = 160px になる。`.app__canvas` は `flex: 1; min-width: 0` なので、残った幅まで縮む。
左右の幅の上限を決めているのは `effectiveBounds` だけなので、直すのはここ1か所で済む(右のエディタの呼び出し元 `App.tsx`・`BlankDesignView.tsx`・`CodebasePreviewDialog.tsx`・`SampleAnswerReplayDialog.tsx` と、左の `StagePanel.tsx` は全部この関数を通る)。

## 修正

**701〜1023pxでは、左右どちらのパネルも「画面幅の30%」を上限にする。** 800pxなら左240px・右240pxになり、キャンバスに320pxが残る(今の2倍)。1024px以上と700px以下は今のまま。

1. `src/presentation/clampSidebarWidth.ts`(presentation)に純粋関数を足し、`effectiveBounds` の中身をここへ移す

   ```ts
   export type WidthBounds = Readonly<{ min: number; max: number }>;
   /** 画面幅に応じたサイドバーの幅の範囲。701〜1023pxでは左右とも画面幅の30%まで(キャンバスの幅を残すため)。 */
   export function sidebarWidthBounds(side: 'left' | 'right', viewportWidth: number, minWidth: number, maxWidth: number): WidthBounds
   ```

   - `viewportWidth >= 1024`: `{ min: minWidth, max: maxWidth }`(今のまま)
   - `701 <= viewportWidth <= 1023`(左右とも): `max = Math.min(maxWidth, Math.floor(viewportWidth * 0.3))`、`min = Math.min(minWidth, max)`
   - `viewportWidth <= 700` かつ `side === 'left'`: 今の式のまま(`max = Math.min(maxWidth, viewportWidth * 0.4)`、`min = Math.min(120, max)`)
   - `viewportWidth <= 700` かつ `side === 'right'`: `{ min: minWidth, max: maxWidth }`(今のまま。700px以下では右はドロワーで、幅はCSSの85vwが決める)
   - 境界の 700 / 1024 と 0.3 は関数の中のローカル定数にする(他で使わないので export しない)
2. `src/presentation/useResizableSidebarWidth.ts`: `effectiveBounds` を消し、`sidebarWidthBounds(side, window.innerWidth, minWidth, maxWidth)` を呼ぶ。今あるリサイズ時の幅の切り詰め(`resize` で `clampSidebarWidth`)はそのまま使えるので、ウィンドウを狭めたときも追従する

CSS・`App.tsx`・`StagePanel.tsx`・`useNarrowScreen.ts` は変えない。

本当に要るか: 上限1つで症状(キャンバス160px・チェックボックスがキャンバスの外に出る)は解消する。キャンバスの最小幅をCSSで保証したり、左右の幅を足し算して配分したりする仕組みは要らない。

### 採らなかった案

- **ドロワーの境界を700pxから約1000pxへ上げる**: 700pxは `index.css` の3か所、`useNarrowScreen.ts`、`App.tsx`、`StagePanel.tsx` の3か所、`useStageSidebar.ts`、`useResizableSidebarWidth.ts` にあり、変更が広い。さらにドロワーの右パネルは**メソッドを選んだときだけ**開く(`mobileDrawerActive`)ので、701〜1000pxのデスクトップで、変更依頼のパネル(`ChangeRequestPanel`)や手で直すときのメソッドの中身(`ManualFixMethodViewer`)が、選ぶまで出なくなる。これは退行になる
- **右パネルにだけ `max-width: calc(100% - Npx)` を付ける**: 800pxでは右に残る幅が約160pxになり、エディタのほうが使えなくなる

## テスト

先に書いて失敗させる。

- Vitest `src/presentation/clampSidebarWidth.test.ts` に `sidebarWidthBounds` のケースを足す(AAA)
  - 正常系: `('right', 800, 280, 640)` → `{ min: 240, max: 240 }`
  - 正常系: `('left', 800, 200, 280)` → `{ min: 200, max: 240 }`
  - 境界: `('right', 1023, 280, 640)` → `{ min: 280, max: 306 }`、`('right', 1024, 280, 640)` → `{ min: 280, max: 640 }`(今のまま)
  - 境界: `('right', 701, 280, 640)` → `{ min: 210, max: 210 }`
  - 今の挙動を保つ: `('left', 375, 200, 480)` → `{ min: 120, max: 150 }`、`('right', 375, 280, 640)` → `{ min: 280, max: 640 }`
  - 上限が小さいとき: `('left', 1000, 200, 250)` → `{ min: 200, max: 250 }`(30% = 300 より `maxWidth` が小さければ `maxWidth`)
- E2E 新規 `e2e/narrow-desktop-layout.spec.ts`(ビューポート 800x600)
  1. チュートリアル1を冒頭の手直しの前で開き(`selectStage(..., { completeOpeningFix: false })`)、バナーの「実際に直してみる」を押す
  2. 「手で直すシミュレーション」の region が見えること、左パネル(`complementary` 「課題」)とキャンバス(`region` 「コードベース」)が並んでいて、キャンバスの幅が 300px 以上あること
  3. 最初の「直した」チェックボックス(`getByRole('checkbox', { name: /を直した$/ }).first()`)の中心がキャンバスの範囲内にあることを `boundingBox` で確かめてから、`check()` してチェックが付くこと(別の要素に当たると Playwright のクリックが失敗するので、それも確かめられる)
  4. 同じ800x600で、別の未着手の状態(手直しを終えた状態)から `printMonthlyReport()` を選んでエディタを開いたときも、キャンバスの幅が 300px 以上あること

## 受け入れ基準

1. 800x600でチュートリアル1の「実際に直してみる」を押すと、キャンバスの幅が300px以上あり、「直した」チェックボックスがキャンバスの中でクリックできる
2. 800x600で抽出エディタを開いても、キャンバスの幅が300px以上ある
3. 1024px以上では、左右パネルの初期幅・ドラッグの範囲が今と同じ(既存の `refactor.spec.ts`・`preview.spec.ts`・`sample-replay.spec.ts`・`sidebar-toggle.spec.ts` の `aria-valuenow`/`aria-valuemax` の期待値を**変えずに**通る)
4. 700px以下のドロワーの挙動が今と同じ(`narrow-screen-layout.spec.ts` が変更なしで通る)
5. `canvas-refit-on-resize.spec.ts`(900px幅のケースを含む)が変更なしで通る
6. `npm run check` と `npm run test:e2e` が通る

## スコープ外

- ドロワーの境界(700px)の変更と、700px以下のスマホ幅の見た目
- 「整列」ボタンとファイル枠の重なりの個別対応(キャンバスの幅が戻れば重ならない想定。残るなら別の仕様)
- 「全体を表示」で縮小したときにチェックボックスが消える(セマンティックズーム)閾値の見直し
- 手で直すシミュレーションのときに左パネルを自動で開く条件(`useOpenSidebarForManualFix`)と、#404 の変更依頼のときに閉じる条件の変更
- 設計くらべ・白紙設計・プレビューのダイアログ独自のレイアウト調整(右パネルの上限は同じ関数を通るので、701〜1023pxでは同じく30%になる。それ以上は合わせない)
