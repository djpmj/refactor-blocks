# text-contrast-fixes: 主ボタン・クリア条件バッジ・可視性マークなどの文字が WCAG 4.5:1 に届かない

小さな不具合修正用の短い型(`_template-bugfix.md`)。基準は WCAG 2.x の通常文字 4.5:1(どの文字も 12〜13px なので大きい文字の 3:1 は使わない)。

## 症状

`prefers-color-scheme` のライト・ダーク両方で、実機の文字と背景のコントラスト比を測った結果。

| モード | 要素 | 文字 / 背景 | 実測 |
|---|---|---|---|
| ダーク | `button--primary`(「実際に直してみる」「ストーリー」など) | `#fff` / `--accent` `#7c93ff` | 2.81:1 |
| ダーク | `clear-condition__badge`(達成済みの ✓) | `#fff` / `--success` `#55d69a` | 1.83:1 |
| ライト | `class-node__relation--implements`(「implements …」12px) | `--edge-implements` `#d9730d` / `--surface` `#fff` | 3.28:1 |
| ライト | `clear-condition__badge`(達成済みの ✓) | `#fff` / `--success` `#2e9e6a` | 3.38:1 |
| ライト | `method-chip__visibility`(「+」) | `--public` `#2e9e6a` / `--bg` `#f6f7fb` | 3.16:1 |
| ライト | `clear-condition__current`(「今: 5件」12px) | `--answer-danger-text` `#a61f1f` / 未達成の行の背景 | 2.8:1 前後(下記) |
| ライト | `line-badge`(ファイルの箱の見出しの「N行」) | `--muted` `#6b7285` / `--file-bg` `#eef1fa` | 4.26:1 |
| ライト | `method-chip__lines` | `--muted` `#6b7285` / `--bg` `#f6f7fb` | 4.49:1 |

調査中に、同じ `method-chip__visibility`(と `field-chip__visibility`)の「-」「#」もライトで足りないことを見つけた(計算値)。

| モード | 要素 | 文字 / 背景 | 計算値 |
|---|---|---|---|
| ライト | private の「-」 | `--private` `#8a8fa3` / `--bg` | 3.00:1 |
| ライト | protected の「#」 | `--protected` `#c9861c` / `--bg` | 2.84:1 |

`clear-condition__current` について: 実際の背景は `.clear-condition--unmet` の `color-mix(in srgb, var(--danger) 8%, var(--surface))`(ライトで約 `#fcf0f0`)で、ここに `#a61f1f` を置くと計算上は **6.65:1** あり、基準を満たしている(ダークでも `#ff8a8a` で約 6.5:1)。2.8:1 という実測値は、測定側が `color-mix()` の背景を正しく合成できず別の色と比べた可能性が高い。そのためこの要素は色を変えず、下記のテストで実際の背景との比を固定して、退行したら気づけるようにするだけにする。

## 原因

すべて `src/index.css`(presentation層)の色の値が原因。

1. **ダークの主ボタン**: `--accent` に白い文字を載せている箇所が5つある(`.button--primary`、`.mode-switch button[aria-pressed="true"]`、`.stage-panel > button[aria-pressed="true"]`、`.stage-roadmap__views button[aria-pressed="true"]`、`.impact-highlight__label`)。どれも `color: #fff` 固定。ダークの `--accent` `#7c93ff` は明るい。
   **`--accent` の値を変えるだけでは直らない。** `--accent` はダークの暗い背景に載せる文字色としても使われている(`.stage-panel__description summary` など多数)。白い文字に 4.5:1 を取るには相対輝度 L ≤ 0.183 が要り、暗い `--surface`(L = 0.016)の上の文字として 4.5:1 を取るには L ≥ 0.248 が要るので、1つの値では両立しない。そのため、塗りの上の文字色を `#fff` 固定から `var(--surface)` に変える(ライトでは `#ffffff` なので見た目は変わらない。ダークでは `#1f222c` の暗い文字になる)。新しいトークンは足さない。
2. **達成バッジ**: `.clear-condition--met .clear-condition__badge` が `background: var(--success); color: #fff`。ダークの `--success` `#55d69a` は明るく、ライトの `#2e9e6a` は白い文字には少し明るすぎる。1と同じく文字を `var(--surface)` にし、あわせてライトの `--success` を暗くする。
3. **implements の文字**: ライトの `--edge-implements` `#d9730d` が明るすぎる。
4. **可視性マーク**: ライトの `--public` / `--private` / `--protected` が明るすぎる。ダークのブロックはこの3つを上書きしていないので、ライトの値がダークにも使われている(今のダークの値は基準を満たしている)。
5. **行数**: ライトの `--muted` `#6b7285` が、`--bg` / `--file-bg` の上ではわずかに足りない。

grep した呼び出し元: `--public` / `--private` / `--protected` は `index.css` の可視性マーク(`field-chip` / `method-chip`)と `.method-editor__tab-icon`(`--protected`)だけ。`--edge-implements` は文字と依存の線・矢印。`--success` は枠線・背景の混色・紙吹雪・文字(`.clear-conditions__progress--complete`)。`--muted` はライトの控えめな文字全般。どれも暗くする方向の変更なので、他の使い方でコントラストが下がる箇所はない。

## 修正

変更するファイルは `src/index.css` のみ(presentation層)。

### 1. `:root`(ライト)のトークンの値

| トークン | 今 | 新しい値 |
|---|---|---|
| `--muted` | `#6b7285` | `#5c6275` |
| `--edge-implements` | `#d9730d` | `#b45309` |
| `--public` | `#2e9e6a` | `#1b7349` |
| `--private` | `#8a8fa3` | `#5c6275` |
| `--protected` | `#c9861c` | `#8a5a00` |
| `--success` | `#2e9e6a` | `#1b7349` |

### 2. `@media (prefers-color-scheme: dark)` の `:root` にトークンを追加

ライトの値を暗くするとダークに引き継がれて読めなくなるため、ダークでは今の値のまま残す。

```css
--public: #2e9e6a;
--private: #8a8fa3;
--protected: #c9861c;
```

ダークの `--accent`・`--success`・`--edge-implements`・`--muted` の値は変えない。

### 3. 塗りの上の文字色(`#fff` → `var(--surface)`)

背景が `var(--accent)` か `var(--success)` で、文字が `color: #fff` の次の6か所だけ。

- `.mode-switch button[aria-pressed="true"]`
- `.stage-panel > button[aria-pressed="true"]`
- `.clear-condition--met .clear-condition__badge`
- `.button--primary`
- `.stage-roadmap__views button[aria-pressed="true"]`
- `.impact-highlight__label`

`.responsibility-mark`(責務色の背景)、`.window-control--close:hover`(`--danger` の背景)、`.clear-screen`(グラデーションの背景)の `#fff` は変えない(スコープ外)。

### コントラスト比(計算値)

相対輝度 L は WCAG 2.x の式、比は (明るい方のL + 0.05) / (暗い方のL + 0.05)。小数第2位まで。

主な背景の相対輝度: ライト `--surface` `#fff` 1.000、`--bg` `#f6f7fb` 0.931、`--file-bg` `#eef1fa` 0.880。ダーク `--surface` `#1f222c` 0.016、`--bg` `#15171e` 0.009、`--file-bg` `#1a1d27` 0.012。

| モード | 組み合わせ(文字 / 背景) | 修正前 | 修正後 |
|---|---|---|---|
| ライト | `--surface` / `--accent` `#4f6bed`(主ボタン。L 0.183、値は変えない) | 4.51 | 4.51 |
| ライト | `--edge-implements` `#b45309`(L 0.159)/ `--surface` | 3.28 | 5.02 |
| ライト | `--surface` / `--success` `#1b7349`(L 0.130。達成バッジ) | 3.38 | 5.84 |
| ライト | `--public` `#1b7349`(L 0.130)/ `--bg` | 3.16 | 5.46 |
| ライト | `--private` `#5c6275`(L 0.123)/ `--bg` | 3.00 | 5.67 |
| ライト | `--protected` `#8a5a00`(L 0.127)/ `--bg` | 2.84 | 5.54 |
| ライト | `--muted` `#5c6275`(L 0.123)/ `--file-bg` | 4.26 | 5.38 |
| ライト | `--muted` / `--bg` | 4.49 | 5.67 |
| ライト | `--muted` / `--surface` | 4.80 | 6.07 |
| ライト | `--answer-danger-text` `#a61f1f`(L 0.092)/ `mix(--danger 8%, --surface)`(値は変えない) | 6.65 | 6.65 |
| ライト | `--success` / `mix(--success 12%, --surface)`(`.clear-conditions__progress--complete`) | 約2.9 | 約4.98 |
| ダーク | `--surface` `#1f222c` / `--accent` `#7c93ff`(L 0.324。主ボタン・押下中のボタン) | 2.81 | 5.65 |
| ダーク | `--surface` / `--success` `#55d69a`(L 0.524。達成バッジ) | 1.83 | 8.67 |
| ダーク | `--public` `#2e9e6a`(L 0.261)/ `--bg` | 5.30 | 5.30 |
| ダーク | `--private` `#8a8fa3`(L 0.277)/ `--bg` | 5.57 | 5.57 |
| ダーク | `--protected` `#c9861c`(L 0.296)/ `--bg` | 5.89 | 5.89 |
| ダーク | `--edge-implements` `#f0a050`(L 0.442)/ `--surface` | 7.44 | 7.44 |
| ダーク | `--muted` `#9aa0b4`(L 0.353)/ `--file-bg` | 6.46 | 6.46 |
| ダーク | `--answer-danger-text` `#ff8a8a`(L 0.413)/ `mix(--danger 8%, --surface)` | 約6.5 | 約6.5 |

ライトの主ボタン(4.51)は余裕が小さいが基準を満たしており、今回は変えない。テストで 4.5 を下回らないことを固定する。

## テスト

先に書くテスト(Vitest、変更前は失敗する):

- 新規 `src/presentation/colorContrast.test.ts`(presentation層のテスト。対象の `src/index.css` が presentation の持ち物のため)
  - CSS は `import css from '../index.css?raw'` で文字列として読む(`tsconfig.app.json` の `types: ["vite/client"]` で型が付く。Vitest でもそのまま使える)。新しい依存は足さない。
  - **テスト専用のヘルパーはこのテストファイルの中に書き、`src/` の他の場所から export しない**(ゲームのドメインではないため):
    - `parseTokens(block: string): Map<string, string>` — `--名前: #rrggbb;` を拾う
    - `themeTokens(css: string, mode: 'light' | 'dark'): Map<string, string>` — ライトは `@media (prefers-color-scheme: dark)` より前の `:root`、ダークはライトの値にダークのブロックの値を上書きしたもの
    - `mix(a: string, b: string, ratioOfA: number): Rgb` — `color-mix(in srgb, a p%, b)` と同じ、sRGB の各チャンネルの線形補間
    - `relativeLuminance(rgb: Rgb): number` — WCAG 2.x の式(チャンネルを 0〜1 にし、0.04045 以下は `/12.92`、それ以外は `((c + 0.055) / 1.055) ** 2.4`、`0.2126R + 0.7152G + 0.0722B`)
    - `contrastRatio(a: Rgb, b: Rgb): number`
  - ヘルパー自体のテスト(AAA): `#ffffff` と `#000000` の比が 21、同じ色どうしが 1、`#767676` と `#ffffff` が 4.54(小数第2位で一致)
  - 本体のテスト: 上の「コントラスト比」の表の組み合わせを `it.each` で並べ、モードごとに実際の CSS から取った値で比が **4.5 以上**であること。`color-mix` の背景は `mix()` で作る。塗りの上の文字の行は、`.button--primary` と `.clear-condition--met .clear-condition__badge` の規則に `color: var(--surface)` が書かれていることも文字列で確かめる(`#fff` に戻ったら落ちる)
  - 変更前は、ダークの主ボタン・両モードの達成バッジ・ライトの implements / 可視性マーク / `--muted` の行が失敗する

E2E は追加しない(色の値の変更だけで、操作は変わらないため)。

## 受け入れ基準

1. `npm test` で `src/presentation/colorContrast.test.ts` が通り、表のすべての組み合わせが両モードで 4.5:1 以上になる
2. ライト・ダークそれぞれで、主ボタン「実際に直してみる」、クリア条件の ✓、「implements …」、メソッドの「+ / - / #」、「N行」の色を開発者ツールで測り直し、4.5:1 以上になっている
3. ライトモードの見た目で、主ボタンの文字が白のまま(`--surface` が `#ffffff` のため)
4. ダークモードで、可視性マーク・implements・行数の色が変更前と同じ
5. `src/index.css` 以外の `src/` のファイル(テストを除く)を変更していない。新しい依存・新しい色トークンを足していない
6. `npm run check` と `npm run test:e2e` が通る

## スコープ外

- `.responsibility-mark`(責務色の上の白い英字)、`--danger` の文字(`line-badge--over` など)、`.window-control--close:hover`、`.clear-screen` のコントラスト
- コードプレビューの色(`--code-*`)と、`--success` の混色を背景にした追加行の上のシンタックスハイライト(`--code-comment` など。今回の `--success` の変更で背景は少し暗くなるが、元から基準に届いていない組み合わせがあり、別件で扱う)
- `opacity` で薄くしている文字(`:disabled` のボタン、`.score-badge__start`、無効なメニュー項目)。WCAG では無効な部品はコントラストの対象外
- ダークの `--accent` / `--success` の値そのものの調整、ライトの `--accent`(4.51 で基準を満たすため)
- 色トークンを TS に移す、テーマ切り替えの仕組みを作るなどの構造の変更。本当に要るか: 今回は CSS の値と6つの `color` を直すだけで足りる
- 4.5:1 より厳しい基準(AAA の 7:1)への対応
