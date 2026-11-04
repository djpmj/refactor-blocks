# tap-target-min-size: 減点内訳のクラス名・用語の下線・サイドバー開閉ボタンのクリック領域が24px未満

## 症状

実機(PC、マウス・トラックパッド・キーボード操作)で計測すると、次の3種類の操作要素のクリック領域が
WCAG 2.2 の 2.5.8「ターゲットのサイズ(最低限)」の目安 24×24 CSS px を下回っている。小さい的は
トラックパッドで外しやすく、隣の文字を押してしまう。

| 要素 | 場所 | 計測値(幅×高さ) |
| --- | --- | --- |
| `.score-breakdown__target` | ツールバーの「減点の内訳」を開いたときの「対象: …」のクラス・メソッド名ボタン | 167×22 |
| `.glossary-term` | クリア条件・ロードマップ・減点の「ことば:」などにある用語の点線下線ボタン | 高さ22 |
| `.sidebar-toggle` | 左サイドバーの開閉ボタン(`«` / `»`) | 22×40 |

キャンバスのメソッドチップ(`method-chip-button`)は倍率によって高さ18pxなどになるが、これはズームの結果なので対象外にする。

## 原因

3つとも `src/index.css` の寸法指定によるもので、コンポーネント側の問題ではない。それぞれのクラスを使っているのは1か所だけ(grepで確認済み)。

- `.score-breakdown__items button.score-breakdown__target { padding: 1px 6px; }`(`src/index.css` 576行目付近): 12px の文字に上下 1px の padding と枠線だけなので、高さが約22pxになる。
  ボタンを描くのは `src/presentation/stage/ScoreBreakdown.tsx` の `TargetNames` だけ。
- `.glossary-term { display: inline; padding: 0; border: 0; border-bottom: 1px dotted currentColor; … }`(668行目付近): padding が 0 なので高さは文字の高さ+下線だけになる。
  ボタンを描くのは `src/presentation/glossary/GlossaryText.tsx` の `GlossaryTermButton` だけ。
  (`<button>` は `display: inline` を指定しても inline-block と同じように配置されるため、`min-height` が効く)
- `.sidebar-toggle { … width: 22px; height: 40px; … }`(211行目付近): 幅を 22px に固定している。
  ボタンを描くのは `src/presentation/stage/StagePanel.tsx` の開閉ボタンだけ。狭い画面(`max-width: 700px`)では
  `left: calc(85vw - 22px)` が2か所(231・234行目付近)あり、この 22px はボタンの幅をドロワーの右端の内側に収めるための値。

## 修正

`src/index.css`(presentation)だけを変える。TSX・ドメインは触らない。TDD対象の純粋関数は**なし**(CSSだけの変更のため)。

1. `.score-breakdown__items button.score-breakdown__target` に `min-height: 24px;` を足す(`padding: 1px 6px` はそのまま)。
2. `.glossary-term` に `min-height: 24px;` を足す。ほかの指定(`display: inline`・点線の `border-bottom`・`font: inherit` など)はそのまま。
3. `.sidebar-toggle` の `width: 22px` を `width: 24px` にする(`min-width` を足して `width` と二重に持つより、固定幅を直すほうが短い)。
   狭い画面の `left: calc(85vw - 22px)` 2か所も `calc(85vw - 24px)` にし、開いたドロワーの右端の内側にボタンが収まる関係を保つ。

### 見た目への影響(実装時に確認すること)

- 減点の内訳の「対象:」行: `.score-breakdown__targets` は `font-size: 12px; line-height: 1.8`(行の高さ約21.6px)なので、
  24px のボタンがある行は2〜3px高くなる。名前が複数行に折り返しても、ボタン同士・行同士が重ならないこと(E2Eで確かめる)。
  `line-height` や `gap` を新たに足す必要はない(足さない)。
- 用語ボタン: ボタンの中身は上下中央に置かれるので、点線の下線は文字の下に約1px離れて付くだけ。用語を含む行だけ行の高さが少し増える。
  文章の途中での見た目(行間が極端に開かない・下線が文字から離れすぎない)をクリア条件(中級3)とロードマップのカードで目視確認する。
  崩れが目立つ場合でも、この仕様の範囲では `vertical-align` 等の追加調整はしない(崩れたら報告して別Issueにする)。
- 開閉ボタン: 2px 太くなるだけ。広い画面ではサイドバーの右端の外側に接する位置(`left: var(--sidebar-width, 480px)`)は変わらない。

### 本当に要るか

WCAG 2.5.8 には「文中のインラインの的」の例外があり、用語の下線ボタンは厳密には例外に当たりうる。ただし用語ボタンはこのゲームで
用語を引く主要な導線で、1行足すだけで直るため揃える。全ボタン共通の `button { min-height: 24px }` のような一括指定は、
ツールバーやメソッドエディタのレイアウト全体に波及するので作らない(実測で24px未満だった3種類だけ直す)。

## テスト

E2E(新規 `e2e/tap-target-size.spec.ts`)。CSSを変える前に書いて、3件とも失敗することを確かめてから直す。
各テストは AAA コメント(`// Arrange` `// Act` `// Assert`)を付け、ビューポートは PC 幅(`1280×900`)にする。

- 減点内訳のクラス名ボタン: `selectStage(page, 'チュートリアル1: 長いメソッドを分ける')` → `.score-breakdown summary` をクリック →
  `.score-breakdown__target` の全要素の `boundingBox()` の `height` が 24 以上。さらに、同じ `.score-breakdown__targets` 内のボタン同士の
  boundingBox が重ならない(`score-breakdown-overlap.spec.ts` の `apart` と同じ判定)。
  チュートリアル1で対象ボタンが出ない場合は、`e2e/layered-stage.spec.ts` が `score-targets-layer` を確かめているステージに差し替える。
- 用語の下線ボタン: `glossary.spec.ts` と同じく `selectStage(page, '中級3: 越境する private メソッド')` → 「サイドバーを開く」 →
  `.clear-conditions` の `glossary-term-coupling` の `boundingBox().height` が 24 以上。
- サイドバー開閉ボタン: `page.goto('/')` → `.sidebar-toggle`(閉じた状態の「サイドバーを開く」と、開いた状態の「サイドバーを閉じる」の両方)の
  `boundingBox()` の `width` と `height` が 24 以上。

既存のE2E(`sidebar-toggle.spec.ts` の「境界との隙間 0〜2px」、`narrow-screen-layout.spec.ts`、`score-breakdown-overlap.spec.ts`、`glossary.spec.ts`)は
変更しないで通ること。

## 受け入れ基準

1. PC幅(1280×900)で、`.score-breakdown__target`・`.glossary-term`・`.sidebar-toggle` の boundingBox の高さが 24px 以上、`.sidebar-toggle` の幅も 24px 以上になる(`e2e/tap-target-size.spec.ts` が通る)
2. 減点内訳の「対象:」が複数行に折り返しても、ボタン同士が重ならない
3. 狭い画面(幅375)でドロワーを開いたとき、開閉ボタンがドロワーの右端の内側に収まり、既存の `sidebar-toggle.spec.ts`・`narrow-screen-layout.spec.ts` が通る
4. 変更は `src/index.css` の上記4か所(3クラス+狭い画面の `left` 2か所)と新規E2Eだけ
5. `npm run check` と `npm run test:e2e` が通る

## スコープ外

- キャンバスのメソッドチップ(`method-chip-button`)など、React Flow のズーム倍率で大きさが変わる要素(ズームの結果のため)
- スマホ・タッチ向けの 44px などより大きいタップ領域
- 全ボタン・全リンクの一括監査と一括の `min-height` 指定(今回実測で見つかった3種類だけ直す。ほかに見つかれば別Issue)
- 用語ボタン・対象ボタンのデザイン変更(色・下線の種類・padding の見直し)や、行間(`line-height`)の調整
- TSX・ドメイン・`application` 層の変更
