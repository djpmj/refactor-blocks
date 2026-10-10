# ボタンの見た目を共通の既定スタイルにそろえる

## 背景・目的

ボタンのスタイルが `src/index.css` の10か所以上のセレクタ(`.stage-panel > button`・`.toolbar button`・
`.method-editor__extract button`・`.mode-switch button`・`.quiz__actions button`・`.merge-candidate-list button`・
`.change-panel button`・`.codebase-preview__header button`・`.operation-guide__header button`・
`.stage-roadmap__header button`・`.sample-replay__controls button` など)に、ほぼ同じ内容で重複して書かれている。

その結果、どのセレクタにも当たらないボタンがブラウザ標準の灰色ボタンのまま表示されている。
左サイドバーの「ヒントを見る」(`HintPanel.tsx`)・「少しだけヒント」(`GhostHintButton.tsx`)・
「実際に直してみる」(`ChangePainCard.tsx`)のほか、`ConceptCheckPanel`・`ManualFixPanel`・`StoryIntro`/`StoryOutro`・
`CritiquePanel`・`SpotlightTour`・`BlankDesignPanel` のボタンなどが該当する。ダークモードでは特に浮いて見える。
hover・`:focus-visible`・disabled の見た目も場所ごとに有ったり無かったりする。

`button` 要素に詳細度0の既定スタイルを1か所で定義し、全ボタンの見た目を「通常」「主要」の2種類にそろえる。
重複しているボタン定義は削除して、共通スタイルに寄せる。

## 変更対象ファイル一覧

### 変更

- `src/index.css`(presentation のスタイル)
  - **共通の既定スタイル**をファイル前半(`body` の定義の近く)に1か所で定義する。セレクタは
    `:where(button:not(.react-flow__controls-button))` のように `:where()` で包み、詳細度を0にする。
    これで、独自の見た目を持つボタン(`.method-chip-button`・`.field-chip-button`・`.warning-edge__button`・
    `.sidebar-toggle`・`.method-editor__tab`・`.error-toast__close`・`.story-card__reopen`・`.ghost-hint-button--idle` など)は、
    今あるクラスの定義がそのまま優先される。React Flow の `<Controls>` のボタンは対象から外し、見た目を変えない
  - 既定スタイルの内容(今の `.stage-panel > button` の値を基準にする):
    - 通常: `border: 1px solid var(--border)`、`background: var(--surface)`、`color: var(--text)`、`border-radius: 6px`、
      `padding: 5px 12px`、`font: inherit`、`font-size: 13px`、`line-height: 1.4`、`cursor: pointer`
    - hover(`:hover:not(:disabled)`): `border-color: var(--accent)`
    - `:focus-visible`: `outline: 2px solid var(--accent)`、`outline-offset: 2px`
    - disabled: `opacity: 0.4`、`cursor: default`(今 `0.5`/`0.55`/`not-allowed` になっている箇所もこの値にそろえる)
  - **主要ボタン** `.button--primary` は今のクラス名のまま残し、`!important` を外す。既定スタイルが詳細度0になり、
    各所の重複定義も消えるので `!important` なしで勝てるようにする。disabled の主要ボタンは通常ボタンと同じ見た目にする(今の挙動を維持)
  - 上に挙げた**重複しているボタン定義を削除**する。その場所固有の差分(`.toolbar button` の小さい文字・余白、
    `.mode-switch button[aria-pressed="true"]` の押下状態、`.score-breakdown__items button` の左寄せ・`aria-pressed` の太枠、
    `.score-breakdown__row > button:first-child` の `flex: 1`、`.story-card button` の右余白など)だけを残す
  - `border-radius: 8px` になっている箇所は、既定の `6px` にそろえる
- `src/presentation/stage/ChangePainCard.tsx`
  - 「実際に直してみる」ボタンに `className="button--primary"` を付ける(このカードで次にやることを促すボタンのため)。
    他のボタンの「主要」「通常」の割り当ては変えない(今 `.button--primary` が付いているボタンだけが主要)
- `e2e/button-style.spec.ts`(新規)
  - 下の受け入れ基準のうち、見た目の計算値を確かめるケースを書く

## データ・型の変更

なし。

## TDD対象の純粋関数

なし(CSSと className の変更のみで、`domain`/`application` のロジックは増えない)。見た目はE2Eで守る。

## 受け入れ基準

- `npm run check` と既存のE2Eがすべて通る
- 新規E2E `e2e/button-style.spec.ts` で、チュートリアル1の左サイドバーについて次を確かめる(`getComputedStyle`):
  - 「ヒントを見る」「少しだけヒント」の `border-top-style` が `solid`、`border-radius` が `6px` で、
    `background-color` が CSS変数 `--surface` と同じ値(ブラウザ標準のボタンではない)
  - 「実際に直してみる」の `background-color` が `--accent` と同じ値(主要ボタン)
  - ステージパネルのツールバーの主要ボタン(`.toolbar__primary`)は今と同じく `--accent` の背景になっている
  - キャンバス右下の React Flow のズームボタン(`.react-flow__controls-button`)の `border-radius` が既定スタイルの `6px` になっていない(既定スタイルの対象外)
- `src/index.css` の中で、`border: 1px solid var(--border); background: var(--surface); color: var(--text); ... cursor: pointer;`
  を丸ごと繰り返すボタン定義が残っていない(既定スタイルの1か所だけになる)
- `.button--primary` の定義に `!important` が残っていない
- 独自の見た目を持つボタン(メソッド・フィールドのチップ、警告の矢印のバッジ、サイドバーの開閉ボタン、メソッドエディタのタブ、
  エラートーストの閉じるボタン、ストーリーの「もう一度読む」、少しだけヒントの点滅アニメーション)の見た目が変わらない
- ライト・ダークの両方のモードで、サイドバー・メソッドエディタ・各ダイアログのボタンが同じ見た目にそろって表示される
- キーボードの Tab でボタンにフォーカスしたとき、すべてのボタンに `:focus-visible` の枠が出る(独自のフォーカス表示を持つものはそれを使う)

## スコープ外

- ボタンの文言・配置・並び順の変更
- 「主要」「通常」以外のバリエーション(小サイズ・危険操作の赤ボタンなど)の追加
- 共通のボタンコンポーネント(`<Button>`)の新設や、各コンポーネントへの共通クラスの付与
- ボタン以外の要素(`select`・`input`・`summary`・カードの枠など)のスタイル整理
- React Flow の `<Controls>` の見た目の変更
