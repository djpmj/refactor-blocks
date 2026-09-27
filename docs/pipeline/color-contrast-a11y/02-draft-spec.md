# 仕様草案: 文字色のコントラスト不足を直し、「行数オーバー」を色以外でも伝える

- slug: `color-contrast-a11y`
- 元になった探索: `docs/pipeline/color-contrast-a11y/01-discovered.md`
- 関連する既存仕様: `docs/specs/cyclic-dependency-class-highlight.md`(「色だけに頼らない」を必須にした前例。`CyclicMark`)

## 1. 背景・目的

- 画面の色はすべて `src/index.css` 冒頭のCSS変数(`:root` と `@media (prefers-color-scheme: dark)`)で決まる。その値の組み合わせのうち、
  WCAG 2.x AA の本文の基準(4.5:1)に届かないものがある。特に可視性の記号(`+`/`-`/`#`)・エラー文言・行数オーバーの赤字・
  ダークモードの選択中モードボタンは、ゲームの操作や採点の理解に直結する。
- 行数オーバーのメソッドは `method-chip--over` による**枠線の色だけ**で示されている。クラス・ファイルの行数バッジは赤+太字、
  循環依存は `CyclicMark`(🔁)、修正が必要なファイルは `FileMark`(⚠️/⛔)と、色以外の手段を併用しているのに、メソッドだけが例外。
  行数オーバーはチュートリアル1からの主題なので、ここが見分けられないとゲームの入り口でつまずく。

**本当に新しい仕組みが要るか**: ほぼ要らない。

- 色の修正は `index.css` の変数の値を書き換えるだけ。ダークモードで上書きが無い `--public`/`--private`/`--protected`/`--danger` は、
  **今の値をダーク側の上書きへそのまま移し**(ダーク背景では今の値で基準を満たすため)、ライト側だけ明度を下げる。色相は変えない。
- 選択中モードボタンの文字色 `#fff` 固定だけは、変数の値の調整では直せない(ダークの `--accent` #7c93ff を白文字が読めるほど暗くすると、
  今度は `--accent` を文字色に使う箇所がダーク背景で読めなくなる)。そこで「アクセント色の上に載せる文字色」`--on-accent` を1つだけ足す。
  (`var(--bg)` を流用しても比は足りるが、背景色を文字色に使う理由がコードから読めないので、名前の付いた変数にする)
- 行数オーバーの印は、`MethodChipView`(`MethodChip.tsx`)の1か所を直せば、キャンバス・`DragOverlay`・`PreviewClassNode.tsx`(変更前・解答例の図、
  設計くらべ)の3か所すべてに効く。既存の `CyclicMark`/`FileMark` と同じ書き方(`role="img"` + `aria-label` + `title` + `data-testid`)を使う。
- domain / application / infrastructure 層は変更しない。新しい依存(axe など)も足さない。

### 目標の基準

- 文字はすべて一律 **4.5:1 以上**にする。可視性の記号は 13px 太字で、WCAG の「大きな文字」(18.66px 太字 = 14pt 以上)に当たらないため、
  3:1 の緩和は使えない。基準を1本にしておく方が検査も単純になる。
- 枠線・矢印などの非テキスト(WCAG 1.4.11 の 3:1)は今回の検査対象にしない(スコープ外参照)。ただし `--danger`・`--accent` を暗く/明るくする
  変更で、赤枠・赤矢印の見え方が悪くならないこと(背景との比が下がらないこと)は目視で確かめる。

## 2. 変更対象ファイル一覧

| 種別 | パス | 層 | 役割 |
| --- | --- | --- | --- |
| 変更 | `src/index.css` | presentation | 冒頭の色変数(1〜28行目)の値を調整し、`--on-accent` を追加。ダークモードに `--public`/`--private`/`--protected`/`--danger`/`--on-accent` の上書きを追加。41行目の `color: #fff` を `var(--on-accent)` に。行数オーバーのメソッドの見た目(未決事項1)を `.method-chip--over`(119行目)付近に追加 |
| 変更 | `src/presentation/canvas/MethodChip.tsx` | presentation | `MethodChipView` に行数オーバーの印を足す(未決事項1で選択肢A・Cのとき。Bのときは変更なし) |
| 新規 | `src/presentation/colorContrast.test.ts` | presentation(test) | `index.css` の色変数からコントラスト比を計算し、決めた組み合わせがすべて 4.5:1 以上であることを守る(未決事項2で選択肢Aのとき) |
| 変更 | `e2e/refactor.spec.ts` | (E2E) | 行数オーバーの印の有無を確かめるテストを追加(未決事項1で選択肢Aのとき) |

変更しないもの: `src/domain/**`、`src/application/**`、`src/infrastructure/**`、ストア(`useGameStore.ts`)、`FileNode.tsx`・`ClassNode.tsx`
(`line-badge--over` は変数の値の変更だけで直る)、`CodebaseCanvas.tsx`・`PreviewClassNode.tsx`(`MethodChipView` の props は変えない)、
`visibilityMark.ts`(記号はすでに色以外の手段になっている)、`package.json`。

## 3. データ/型の変更

ドメインモデル・永続化スキーマ・ストアの変更は無し。`MethodChipView` の props(`method`/`overLimit`/`selected`/`changeCount`)も変えない。

### 3.1 検査する色の組み合わせ(前景 / 背景)

`index.css` の各ルールで実際に重なっている組み合わせ。**ライト・ダークの両方**で 4.5:1 以上にする。

| # | 前景 / 背景 | 使われ方(主なもの) | 現状の概算(ライト / ダーク) |
| --- | --- | --- | --- |
| 1 | `--public` / `--bg` | 可視性 `+`(`.method-chip`・`.field-chip` の背景は `--bg`) | 3.2 / 5.3 |
| 2 | `--private` / `--bg` | 可視性 `-` | 3.0 / 5.6 |
| 3 | `--protected` / `--bg` | 可視性 `#` | 2.8 / 5.9 |
| 4 | `--danger` / `--surface` | `.method-editor__message`・`.critique-panel__error`・クラスの `.line-badge--over` | 4.4 / 3.6 |
| 5 | `--danger` / `--file-bg` | ファイルの `.line-badge--over`(ファイルのヘッダーは `--file-bg` の上) | **3.9** / 3.8 |
| 6 | `--on-accent` / `--accent` | 選択中のモードボタン(今は `#fff` 固定) | 4.5 / 2.8 |
| 7 | `--accent` / `--bg` | `.method-chip__badge`(変更×N) | 4.2 / 6.4 |
| 8 | `--accent` / `--surface` | `.class-node__superclass`・`.stage-panel__description summary`・右クリックメニューの選択中項目 | 4.5 / 5.6 |
| 9 | `--muted` / `--file-bg` | `.file-node__empty` | 4.3 / 6.5 |
| 10 | `--muted` / `--bg` | `.method-chip__lines`(チップの背景は `--bg`) | **4.49** / 6.9 |
| 11 | `--muted` / `--surface` | ヒント・案内文・`.class-node__empty` など多数 | 4.8 / 6.1 |
| 12 | `--text` / `--bg`・`--surface`・`--file-bg` | 本文(現状で十分。値を変えたときの退行防止) | 十分 / 十分 |

太字は `01-discovered.md` の8件に無かった、今回の手計算で新たに見つかった不足(5・10)。数値はすべて手計算の概算なので、実装時に測り直すこと。

### 3.2 色の値の候補(実装者の裁量で調整してよい)

方針: 色相(緑・灰・橙・赤・青)は保ち、ライトは明度を下げ、ダークは今の値を上書きとして残す(`--danger` だけはダークでは明るくする)。
下の値は手計算で上の表をすべて満たす見込みの**候補**。最終的な値は 3.3 のテスト(または未決事項2で決めた方法)で確かめる。

| 変数 | ライト(今 → 候補) | ダーク(今 → 候補) |
| --- | --- | --- |
| `--public` | #2e9e6a → #1f7a52(対 `--bg` 約4.9) | 上書き無し → #2e9e6a(今の値。約5.3) |
| `--private` | #8a8fa3 → #666b7e(約4.9) | 上書き無し → #8a8fa3(約5.6) |
| `--protected` | #c9861c → #9a6210(約4.8) | 上書き無し → #c9861c(約5.9) |
| `--danger` | #d64545 → #c03a3a(対 `--file-bg` 約4.8、対白 約5.4) | 上書き無し → #ec6a6a(対 `--surface` 約5.2) |
| `--accent` | #4f6bed → #4a64e0(対 `--bg` 約4.7、白文字 約5.0) | #7c93ff のまま |
| `--muted` | #6b7285 → #646b7e(対 `--file-bg` 約4.7) | #9aa0b4 のまま |
| `--on-accent`(新規) | #ffffff | #15171e(対 #7c93ff 約6.4) |

`--bg`・`--surface`・`--border`・`--text`・`--file-bg` は変えない。

### 3.3 行数オーバーのメソッドの見た目(未決事項1で選択肢Aのとき)

`MethodChip.tsx` 内に、`CyclicMark`(`ClassNode.tsx`)・`FileMark`(`FileNode.tsx`)と同じ形の小さなコンポーネントを足す(別ファイルにしない)。

```tsx
/** 行数の上限を超えたメソッドの印。色だけに頼らずアイコンとラベルでも伝える。 */
function OverLimitMark() {
  const label = '行数の上限を超えています';
  return (
    <span className="method-chip__over-mark" role="img" aria-label={label} title={label} data-testid="method-over-mark">
      ⚠️
    </span>
  );
}
```

- `MethodChipView` で `overLimit` のときだけ、行数(`.method-chip__lines`)の直前に描く
- CSS: `.method-chip--over .method-chip__lines { color: var(--danger); font-weight: 700; }`(クラス・ファイルの `.line-badge--over` と揃える)。
  既存の赤枠(`.method-chip--over { border-color: var(--danger); }`)は残す
- ラベルに上限の行数は入れない(`MethodChipView` は `overLimit: boolean` しか受け取らず、props を増やすほどの必要が無い。
  上限はステージの目標文とメソッドエディタで読める)
- ⚠️ は `FileMark` の「修正が必要」と同じ意味で使う(意味がぶれないので新しい絵文字を増やさない)
- クラスの幅は `layoutCodebase.ts` の `CLASS_WIDTH = 280` 固定。印の1文字ぶん幅が増えるが、`.method-chip__name` が `flex: 1` なので
  既存ステージの一番長いメソッド名で表示が崩れないことを目視で確かめる

## 4. TDD対象の純粋関数

domain / application 層に新しいロジックは無い(カバレッジ閾値への影響も無し)。

未決事項2で選択肢Aのとき、`src/presentation/colorContrast.test.ts` を**実装(色の値の変更)より先に**書き、今の `index.css` で Red になることを確かめてから値を直す。
テストでしか使わない計算なので、ヘルパー関数はテストファイルの中に置き、`src/` に本番コードとしては足さない
(先例: `layoutCodebase.test.ts` の `codebaseOf` のようなテスト内ヘルパー)。AAAパターン、1ケース1つの `it`。

### テストファイル内のヘルパー

- `contrastRatio(foreground: string, background: string): number` — `#rrggbb` の2色から WCAG 2.x の式(sRGB の線形化 → 相対輝度 → `(L1 + 0.05) / (L2 + 0.05)`)で比を返す
- `colorVariables(css: string): { light: Record<string, string>; dark: Record<string, string> }` — 最初の `:root { ... }` の `--名前: #rrggbb;` を light に、
  `@media (prefers-color-scheme: dark)` の中の `:root { ... }` の値で light を上書きしたものを dark にする。対応するのは6桁の16進だけでよい
  (今の `index.css` の色変数はすべて6桁。3桁や `rgb()` を使い始めたら、該当する変数が見つからずテストが落ちるので気付ける)
- CSS の文字列は `import css from '../index.css?raw';` で読む(`tsconfig.app.json` の `types: ["vite/client"]` で `?raw` の型が付く)。
  Vitest で `?raw` が空文字列になる場合は、テストファイルに `/// <reference types="node" />` を書いて `node:fs` の `readFileSync` で読む
  (`@types/node` はインストール済み)。どちらの方法でも、下のケース3が「空の文字列を黙って通す」ことを防ぐ

### ケース

1. 計算の確認: `contrastRatio('#000000', '#ffffff')` が 21(小数第2位まで)、同じ色どうしは 1、`#767676` 対 `#ffffff` が約 4.54(4.5 をわずかに上回る既知の値)
2. 計算の確認: 前景と背景を入れ替えても同じ比になる
3. 読み込みの確認: `colorVariables(css)` の light・dark の両方に、3.1 の表で使う変数(`--bg`・`--surface`・`--file-bg`・`--text`・`--muted`・`--accent`・
   `--on-accent`・`--public`・`--private`・`--protected`・`--danger`)がすべてある
4. ライト: 3.1 の表の組み合わせ(#1〜#12)がすべて 4.5 以上。`it.each` で組み合わせごとに1行、失敗時に「前景/背景/実際の比」が分かる名前にする
5. ダーク: 同じ組み合わせがすべて 4.5 以上

`OverLimitMark` は表示のみのコンポーネントなのでユニットテストの対象外とし、E2Eで守る。

## 5. 受け入れ基準

- [ ] (未決事項2で選択肢Aのとき)`colorContrast.test.ts` を先に書き、今の `index.css` ではケース4・5の一部が落ちること(Red)を確かめてから、
      色の値を直して通す(Green)
- [ ] 3.1 の表の組み合わせが、ライト・ダークとも 4.5:1 以上になっている(実装者が測り直した実際の比を、PRの説明に表で載せる)
- [ ] `.mode-switch button[aria-pressed="true"]` の文字色が `var(--on-accent)` になり、`index.css` に色の直書き(`#fff` など)が
      色変数の定義以外に増えていない(`box-shadow` などの `rgb(0 0 0 / …)` の影は対象外)
- [ ] ライト・ダークの両方(ブラウザの開発者ツールで `prefers-color-scheme` を切り替え)で、可視性の記号・エラー文言・行数バッジ・変更バッジ・
      モード切り替えボタン・空のファイルの案内が読めること、赤枠・循環依存の赤い矢印・継承の青い矢印が今までどおり見分けられることを目視で確かめる
- [ ] 行数オーバーのメソッドが、枠線の色以外(未決事項1で決めた方法)でも分かる。キャンバス・ドラッグ中の `DragOverlay`・「変更前の図」「解答例の図」の
      どれでも同じ見た目になる
- [ ] (未決事項1で選択肢Aのとき)E2E(`e2e/refactor.spec.ts`)に次を追加し通る。対象は `openOrderStage`(チュートリアル2、メソッドの上限40行)
  - 初期状態で `method-placeOrder` の中に `method-over-mark` があり、`aria-label` が「行数の上限を超えています」
  - 「消費税を計算する(軽減税率あり)」(24行)を `calculateTax` として抽出すると、`method-calculateTax` の中に `method-over-mark` が無く、
    `method-placeOrder`(残り80行)には残っている
- [ ] 既存のE2E(ドラッグ&ドロップ・抽出・右クリックメニュー・ズーム・採点)がすべて通る(メソッドのチップの中身の文字が増えても
      `getByTestId` で探しているので影響しない見込み)
- [ ] `npm run check`(lint + typecheck + test)が通る

## 6. スコープ外

- 非テキストのコントラスト(WCAG 1.4.11 の 3:1)。特に `--border`(#d7dbe7)とチップ・ノードの背景の比は 1.3 前後しかないが、
  枠線は形の区切りで、情報は文字とアイコンでも伝わっているため今回は扱わない
- 右クリックメニューのホバー/フォーカス中の項目(`color-mix` で `--accent` を15%混ぜた背景)の上の、選択中項目の `--accent` 文字。
  手計算ではライトで約4.1になる見込みだが、`color-mix` の背景はテストの色変数表から計算できないので、別の仕様で扱う
  (直すなら「選択中は ✓ などの記号を付けて色は `--text` にする」方向)
- `opacity: 0.4` の無効なボタン(WCAG でも無効な部品はコントラストの対象外)
- 選択中のメソッド(`method-chip--selected`)を色以外でも示すこと(未決事項3で選択肢Bになった場合を除く)
- axe などのa11y検査ツールの導入、`index.css` 全体の自動走査(どのルールがどの背景の上に載るかはCSSだけでは決まらないため、組み合わせは3.1の表で明示する)
- 高コントラストモード(`prefers-contrast`)・`forced-colors` への対応、色覚シミュレーション
- 行数オーバーの印に上限の行数や超過行数を入れること(`MethodChipView` の props を増やす必要がある。要望が出てから)
- 配色全体の見直し(ブランドカラーの変更など)、色変数の新設(`--on-accent` 以外)

## 未決事項

### 未決事項1: 行数オーバーのメソッドを、枠線の色以外でどう示すか

- 選択肢A(推奨): 印+赤太字。行数の直前に ⚠️ の印(`role="img"`・`aria-label`・`title`、`CyclicMark`/`FileMark` と同じ書き方)を足し、
  行数の文字を `.line-badge--over` と同じ赤+太字にする。形・太さ・文字の3つで伝わり、スクリーンリーダーにも「行数の上限を超えています」と読まれる。
  E2Eで印の有無を守れる
- 選択肢B: 赤太字のみ。行数の文字を赤+太字にするだけ(CSS 1行、`MethodChip.tsx` は変更なし)。太さは色以外の手段だが差が小さく、
  スクリーンリーダーには伝わらない
- 選択肢C: 赤太字+枠線の形。行数の文字を赤+太字にし、枠線を2pxの二重線(`border-style: double` など)にする。CSSだけで済むが、
  スクリーンリーダーには伝わらず、E2Eではクラス名の有無しか確かめられない

### 未決事項2: 色のコントラストをどう守るか

- 選択肢A(推奨): Vitest のテスト。`src/presentation/colorContrast.test.ts` で `index.css` を文字列として読み、色変数からコントラスト比を計算して、
  3.1 の組み合わせをライト・ダークとも 4.5:1 以上に保つ。新しい依存は不要で、`npm run check` で毎回守られる。組み合わせの表は手で保守する
- 選択肢B: Playwright のE2E。`page.emulateMedia({ colorScheme })` でライト・ダークを切り替え、実際の要素の `getComputedStyle` の色から比を計算する。
  実際に描かれた色を測れるが、各組み合わせの要素を画面に出す手順が要り、E2Eが遅く・長くなる
- 選択肢C: 手動確認のみ。実装時に測った比をPRの説明に表で残し、テストは足さない。最も少ないが、今後の配色変更で気付かずに退行し得る

### 未決事項3: 選択中のメソッド(`method-chip--selected`、今は青い枠線だけ)も色以外で示すか

- 選択肢A(推奨): 今回は示さない。選択はサイドパネルのメソッドエディタにメソッド名が出ることで色以外でも伝わっている。スコープを広げない
- 選択肢B: 示す。選択中のチップの枠線を2pxにする(CSS 1行)。あわせて `MethodChip` のボタンに `aria-pressed={selected}` を付けて、
  スクリーンリーダーにも選択状態を伝える
