# 解答の再生の最大化ボタンを、Chromeのウィンドウのように「✕」の横の「□」にする

## 背景・目的

「解答の再生」ダイアログ(`src/presentation/stage/SampleAnswerReplayDialog.tsx`)のヘッダーは、
`.codebase-preview__header` が `justify-content: space-between` で、子要素が「タイトル・最大化ボタン・✕ボタン」の3つある。
そのため「最大化」ボタンがヘッダーの真ん中に浮いて表示され、文字の「最大化」「縮小」ボタンとして目立ちすぎている
(`replay-maximize-method-panel.md` では「✕の左に足す」としていたが、配置がそうなっていない)。

Chromeのウィンドウのタイトルバーのように、右上に「□(最大化)」「✕(閉じる)」を隣り合わせで並べ、
最大化中は「□」を2つ重なった四角(元のサイズに戻す)に切り替える。

## 変更対象ファイル一覧

### 変更

- `src/presentation/stage/SampleAnswerReplayDialog.tsx`(presentation)
  - 最大化ボタンと✕ボタンを `<div className="window-controls">` で包み、ヘッダーの右端に「最大化 → 閉じる」の順で並べる
    (タイトルは左端のまま。ヘッダーの子要素は「タイトル」と「`.window-controls`」の2つになる)
  - 2つのボタンに `className="window-control"` を付ける。✕ボタンには `window-control--close` も付ける
  - 最大化ボタンの中身を、文字の「最大化」「縮小」からアイコンに変える
    - 通常時: 四角1つ(□)
    - 最大化中: 2つ重なった四角(Chromeの「元のサイズに戻す」と同じ形)
    - アイコンはフォントによって形が変わらないよう、インラインSVG(`viewBox="0 0 10 10"`、`stroke="currentColor"`、`fill="none"`、
      `aria-hidden="true"`)で描く。コンポーネントファイルの中に小さく書き、新しいファイルは作らない
  - アクセシビリティは今の挙動を保つ: `data-testid="sample-replay-maximize"`・`aria-pressed`・
    `aria-label`(`最大化` / `元のサイズに戻す`)はそのまま。マウスで乗せたときに分かるよう、同じ文言を `title` にも付ける。
    ✕ボタンの `aria-label="閉じる"` もそのままにして、`title="閉じる"` を足す
- `src/presentation/preview/CodebasePreviewDialog.tsx`(presentation)
  - 同じヘッダーを使う「解答例の図」の✕ボタンにも、`window-controls` / `window-control` / `window-control--close` を付けて見た目をそろえる
    (最大化ボタンは足さない)
- `src/index.css`
  - `.window-controls`: `display: flex; gap: 4px;`
  - `.window-control`: 枠なし・背景透明のアイコンボタン(`border: 0; background: transparent; color: var(--text);`、
    `width: 32px; height: 28px;`、中央寄せ、`border-radius: 6px`、`cursor: pointer`)
  - `.window-control:hover`: うすい背景色(`color-mix(in srgb, var(--text) 10%, transparent)` など、ライト・ダークの両方で見える色)
  - `.window-control--close:hover`: `background: var(--danger); color: #fff;`
  - `.window-control:focus-visible`: `outline: 2px solid var(--accent); outline-offset: 2px;`
  - 今の `.codebase-preview__header button` の定義は、`.window-control` に置き換えて削除する
    (Issue #130 `button-style-base` が先にマージされていて、その定義がすでに消えている場合は、`.window-control` を足すだけでよい)
- `e2e/sample-replay.spec.ts`: 既存ケースの最大化の確認を更新する(新しいファイルは作らない)

## データ・型の変更

なし。

## TDD対象の純粋関数

なし(表示とCSSのみの変更。`domain`/`application` のロジックは増えない)。配置と切り替えはE2Eで守る。

## 受け入れ基準

- `npm run check` と既存のE2Eがすべて通る
- `e2e/sample-replay.spec.ts` で次を確かめる:
  - 最大化ボタン(`sample-replay-maximize`)と「閉じる」ボタンが同じ `.window-controls` の中にあり、最大化ボタンが閉じるボタンのすぐ左にある
    (両方の `boundingBox` で、最大化ボタンの右端が閉じるボタンの左端より左にあり、その間が 16px 以内)
  - 閉じるボタンの右端が、ダイアログの右端から 24px 以内にある(ヘッダーの右上にある)
  - 最大化ボタンに「最大化」「縮小」の文字が表示されていない(`innerText` が空)
  - 押すと `aria-pressed` が `true`、`aria-label` が `元のサイズに戻す` になり、もう一度押すと `false`・`最大化` に戻る
  - 最大化中もボタンの並び(最大化 → 閉じる、右上)は変わらない
  - 最大化・元に戻すでダイアログの大きさが変わる、という既存の確認はそのまま残す
- 最大化中と通常時で、最大化ボタンのアイコン(SVG)の形が変わる
- マウスを乗せると、最大化ボタンはうすい背景色、閉じるボタンは赤(`--danger`)の背景になる
- Tab キーで2つのボタンにフォーカスでき、フォーカスの枠が出る。Enter / Space で押せる
- Esc・✕で閉じる動作、← → キーで前後に動く動作は変わらない
- 「解答例の図」ダイアログの✕ボタンも、同じ枠なしの見た目で右上に表示される

## スコープ外

- 「解答例の図」・設計くらべのプレビューに最大化ボタンを足すこと
- 最小化ボタン(「—」)の追加
- ダイアログをドラッグで動かす・端をつまんで大きさを変える操作
- ヘッダーをダブルクリックして最大化する操作
- 最大化した状態を次に開いたときまで覚えておくこと(今どおり、開くたびに通常サイズから始める)
