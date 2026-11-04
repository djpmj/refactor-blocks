# blank-design-short-viewport: 高さの低いウィンドウでも、白紙設計の部品置き場が全部見えてドラッグできる

小さな不具合修正(CSS と className 1つの変更)。`_template-bugfix.md` の型で書く。

## 背景

- `narrow-screen-layout.md` は**幅** 700px 以下(スマホ相当)の3列レイアウトを扱い、スコープ外に「設計くらべ・白紙設計の狭い画面対応」を残している。
  この仕様は**幅は足りているが高さが低い**デスクトップの小さいウィンドウ(800x600・1024x700)の白紙設計だけを扱い、重ならない。
- `blank-design-tray-display.md` は部品置き場の見た目と、開いた直後に箱の枠がキャンバスの端で切れないこと(左端・上端)を扱った。
  高さが足りず部品置き場の**下半分**が見切れる問題は扱っていない。
- `blank-check-unplaced-feedback.md` で、答え合わせが押せない理由(未配置の部品名の一覧)を上部パネルに常時出すようにした。これも上部パネルが高くなる一因。
- スマホ幅(700px 以下)は対象外。

## 症状

白紙設計モード(白紙1: 注文と発送)を開くと、

- 800x600 では、上部パネル(要求文2段落・目標・補足・ツールバー・答え合わせが押せない理由)が画面の約7割を占め、キャンバスは約180px しかない。
  ページはスクロールしない(`scrollHeight == innerHeight`)ので、それ以上キャンバスを広げる手段がない
- 部品置き場(7部品)の下半分が見切れる。自動の合わせ(`useAutoViewportFit`)はメソッドが隠れる倍率 `DETAIL_ZOOM`(0.6)より小さくしないため、
  収まらない分は左上から見せる仕様で、下の部品はキャンバスの外に出る
- 部品が見えないのに、右パネルには「部品置き場の部品を、置きたいクラスへドラッグしよう」の案内だけが出る
- 1024x700 でもキャンバスは約330px

設計くらべ(クイズ)画面も確認した。`.quiz` は `overflow-y: auto` でスクロールでき、設計A・Bのキャンバスは固定の高さ 380px(`.quiz-design__canvas`)なので、
800x600 でも各キャンバスは丸ごと画面に入る。**設計くらべは高さの問題がなく、対象外**。

## 原因

- `src/index.css` の `.app { height: 100vh }` → `.app__view { flex: 1; min-height: 0 }` → `.app__body { flex: 1; min-height: 0 }` の連鎖で、
  白紙設計の画面(`App.tsx` の `data-testid="blank-view"` の `.app__view`)は画面の高さに固定され、`overflow` も指定がないのでスクロールしない。
  上部パネル(`BlankDesignPanel.tsx` の `header.stage-panel`)が高いと、その分だけ `.app__body`(キャンバス)が `min-height: 0` まで縮む
- キャンバスの最小の高さを守る指定がどこにもない

リファクタリングモード(`RefactorView`)は左パネルが横にあり、この縦の連鎖の問題は起きない。直す場所は白紙設計の画面1か所でよい。

## 修正

方針: **白紙設計の画面だけ、縦にスクロールできるようにし、キャンバスの領域(`.app__body`)に最小の高さ 420px を確保する。**
要求文の折りたたみはしない。

- 折りたたみ(初期は開く)にしても、開いた直後の画面は今と同じ高さで、症状(開いた直後に部品が見切れる)が直らない
- 初期を閉じる・操作を始めたら畳むにすると、設計中に読み返したい要求文が隠れ、ツアーの「まず要求文と目標を読もう」の段とも合わない
- スクロールは CSS だけで済み、背の高い画面(高さが足りる場合)では今と見た目が変わらない

変更するファイル(すべて presentation 層。`domain` / `application` / `infrastructure` は変更しない):

| 種別 | パス | 変更 |
| --- | --- | --- |
| 変更 | `src/presentation/App.tsx` | 白紙設計の `<div className="app__view" ... data-testid="blank-view">` に `app__view--blank` を足す(`className="app__view app__view--blank"`) |
| 変更 | `src/index.css` | 下の3行を `.app__view[hidden]` の近くに足す |
| 新規 | `e2e/blank-design-short-viewport.spec.ts` | 下の「テスト」 |

```css
.app__view--blank { overflow-y: auto; }
.app__view--blank > .stage-panel { flex: none; }
.app__view--blank > .app__body { min-height: 420px; }
```

- `.app__body` の `flex: 1`(= `1 1 0%`)はそのまま。余りの高さが 420px 以上ならこれまで通り全部使い、足りなければ 420px で止まって画面がスクロールする。
  `flex-basis` を `auto` にしない(右パネルのメソッドエディタの中身の高さでキャンバスが伸びてしまうため)
- 上部パネルは `flex: none` で縮ませない
- 420px は「800x600 で、白紙1〜3 の部品置き場(7部品)が倍率 0.6・余白 10% で丸ごと入る高さ」の目安。E2E で部品置き場が収まらなければ、
  実測して 20px 単位で上げる(上限 480px。それでも収まらなければ実装を止めて報告する)
- キャンバスの大きさが変わると `FitViewOnResize` が合わせ直すので、fit まわりのコードは変更しない
- 初回ツアーの白紙設計の段(`tourSteps.ts` の `[data-testid="blank-view"] .app__canvas` など)は、`SpotlightTour.tsx` の `scrollIntoViewOnce` が
  スクロールできる祖先(この変更で `.app__view--blank` になる)をたどって見える位置へ動かすので、変更しない
- 幅 700px 以下のメディアクエリに例外は足さない(スマホ幅は対象外。この3行がそのまま効いてもよい)

純粋関数に切り出すロジックはない(CSS の変更のみ)。

## テスト

先に `e2e/blank-design-short-viewport.spec.ts` を書き、今のコードで失敗する(1件目が部品の位置の検証で落ちる)ことを確かめてから CSS を直す。
`openBlank` は `e2e/blank-design-tray-display.spec.ts` と同じ手順(`page.goto('/')` → `mode-blank` をクリック)。

1. **800x600 で、部品置き場の7部品がすべてキャンバスの内側に見え、最後の部品をドラッグして置ける**
   - Arrange: `page.setViewportSize({ width: 800, height: 600 })` → `openBlank`。`blank-view` の `.app__canvas` を `scrollIntoViewIfNeeded()`
   - Assert(位置): 部品置き場のクラス `getByTestId('class-部品置き場')` の中の `[data-testid^="method-"]` が7個。それぞれの `boundingBox()` が
     `.react-flow__pane` の `boundingBox()` の内側にあり、かつ下端が 600 以下(画面内)。合わせ直しが落ち着くまで `expect.poll` で待つ
   - Act: 7個目(`.last()`)の部品を、`blank-design-tray-display.spec.ts` の3件目と同じマウス操作(少し動かしてから)でペインの右下の余白へドラッグ
   - Assert: `blank-unplaced` が `部品置き場に残っている部品: あと6個` になる
2. **800x600 で、白紙設計の画面がスクロールでき、キャンバスの高さが 420px 以上ある**
   - Assert: `blank-view` の `scrollHeight > clientHeight`、`.app__canvas` の `boundingBox().height >= 420`
3. **背の高い画面では今まで通りスクロールしない**
   - Arrange: `page.setViewportSize({ width: 1440, height: 900 })` → `openBlank`
   - Assert: `blank-view` の `scrollHeight === clientHeight`(1px の誤差は許す)

既存の `e2e/blank.spec.ts`・`e2e/blank-design-tray-display.spec.ts`・初回ツアー/モード案内の E2E が既定のビューポートでそのまま通ること。

## 受け入れ基準

1. 800x600 で白紙設計を開き、画面をスクロールすると、部品置き場の7部品がすべて見え、どれでもドラッグしてクラスへ置ける
2. 1024x700 でも、部品置き場の7部品がすべてキャンバスの内側に入る(スクロールしてよい)
3. 1440x900 では、今と見た目が変わらない(画面はスクロールしない)
4. 設計くらべ・リファクタリングモードの見た目は変わらない(`.app__view--blank` 以外に効かない)
5. `npm run check` と `npm run test:e2e` が通る

## スコープ外

- 要求文の折りたたみ・上部パネルの文言の短縮(答え合わせが押せない理由の一覧を畳むなど)。スクロールで足りるため作らない。実機で「上部パネルを毎回スクロールで飛ばすのが面倒」と分かったら別Issue
- キャンバスの上でのホイールを画面のスクロールに回すこと(今まで通りキャンバスのズームのまま。画面のスクロールは上部パネル・右パネルの上のホイールかスクロールバーで行う)
- スマホ幅(700px 以下)の白紙設計(`narrow-screen-layout.md` のスコープ外のまま)
- 設計くらべ画面(上の確認のとおり高さの問題なし)
- リファクタリングモードの低い画面への対応
- `DETAIL_ZOOM` の床や自動の合わせ(`useAutoViewportFit`)の変更
