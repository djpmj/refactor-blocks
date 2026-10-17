# dark-mode-canvas-controls: ダークモードでキャンバスのズームボタンが見えるようにする

## 背景・目的

2026-10-17 に OS をダークモードにして中級1を開くと、ゲーム全体は暗い配色になる(`src/index.css` の `prefers-color-scheme: dark`)のに、
キャンバス左下のズームボタン(`+` / `-` / 全体表示)が**白い四角**に見え、アイコンがほとんど見えなかった。右下の `React Flow` の表記も白く浮いている。

調べると、React Flow のルート要素のクラスが `react-flow light` のままだった。`<ReactFlow>` に `colorMode` を渡していないので既定の `light` になり、
ボタンの背景は `rgb(254, 254, 254)`、アイコンの色はゲーム側の暗い配色用の変数で `rgb(230, 232, 239)` になり、白地に白に近い色で描かれている。

## 変更対象ファイル一覧

| 種別 | パス | 層 | 役割 |
| --- | --- | --- | --- |
| 変更 | `src/presentation/canvas/CodebaseCanvas.tsx` | presentation | `<ReactFlow colorMode="system">` にする |
| 変更 | `src/presentation/preview/CodebasePreviewCanvas.tsx` | presentation | 同上(解答例の図・設計くらべ・答え合わせのプレビュー) |
| 変更 | `src/index.css` | presentation | 必要なら React Flow の変数(`--xy-controls-button-background-color` など)をゲームの配色の変数へつなぐ |
| 新規 | `e2e/dark-mode-canvas-controls.spec.ts` | E2E | `colorScheme: 'dark'` で下の受け入れ基準を確かめる |

`domain` / `application` / `infrastructure` は変更しない。

## データ・型の変更

なし。

## 見た目の仕様

- ダークモードでは、ズームボタンの背景はゲームの面の色(パネルと同じ暗い色)、アイコンは本文の文字色にする。ライトモードは今のまま
- 背景のドット・ミニマップ(使っていれば)も同じく暗い配色にする
- `React Flow` の表記(attribution)は、背景を半透明の暗い色にする(消さない。ライセンスの表記のため)
- ボタンのアイコンと背景のコントラスト比は 3:1 以上

## TDD対象の純粋関数

なし(見た目の変更)。E2E で確かめる。

## 受け入れ基準

1. `colorScheme: 'dark'` で中級1を開くと、`.react-flow` のクラスに `dark` が付いている
2. ズームボタンの背景色とアイコンの色のコントラスト比が 3:1 以上(E2E で `getComputedStyle` から計算する)
3. ライトモードでは今と同じ見た目
4. 解答例の図(プレビュー)でも1・2が成り立つ
5. `npm run check` と `npm run test:e2e` が通る

## スコープ外

- ゲーム全体の配色の見直し
- 手動でライト/ダークを切り替えるボタンの追加
