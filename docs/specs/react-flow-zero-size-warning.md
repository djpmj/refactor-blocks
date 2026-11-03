# react-flow-zero-size-warning: モードを切り替えると React Flow の「親要素に幅と高さが必要」警告がコンソールに出る

小さな不具合修正。新しい機能や設計判断はない。

## 症状

2026-11-03 に実機で確認した。

1. `npm run dev` で http://localhost:5173 を開く(最初のステージはチュートリアル1 `tutorial-extract-method`)
2. 上部の「設計くらべ」(`data-testid="mode-quiz"`)を押す
3. 「リファクタリング」(`data-testid="mode-refactor"`)を押す

すると、ブラウザのコンソールに次の警告が2回出る。

```
[React Flow]: The parent container needs a width and a height to render the graph. Help: https://reactflow.dev/error#004
```

画面の見た目がはっきり崩れたという報告はない。

## 原因

### 警告が出る仕組み(`@xyflow/react` 12.12.0 で確認済み)

`node_modules/@xyflow/react/dist/esm/index.mjs` の `useResizeHandler`(`ZoomPane` の中で `.react-flow__zoompane` を測っている)は、次の3つのタイミングで `updateDimensions` を呼ぶ。

- マウント時
- `ResizeObserver` で大きさの変化を検知したとき
- `window` の `resize` イベント

このとき次の2つがそろうと、`onError('004')` が呼ばれて上の警告が出る。

- `checkVisibility()` が true になる(要素が表示されている)
- 幅か高さのどちらかが0

0のときは React Flow が仮に 500×500 として扱う(`width: size.width || 500`)。
`hidden`(`display: none`)の中にあるときは `checkVisibility()` が false になるので、警告は出ない。
つまり**表示されているのに、外枠の大きさが一瞬でも0になったインスタンス**が警告を出している。

### React Flow を描いている場所(grep で全件確認済み)

| コンポーネント | 親要素の CSS | 使っている場面 |
|---|---|---|
| `src/presentation/canvas/CodebaseCanvas.tsx`(`CanvasFlow`) | `.canvas-column__flow { flex: 1; min-height: 0 }`(`.canvas-column` は高さ100%、`.app__canvas` は `flex: 1; min-width: 0`) | リファクタリング(`App.tsx` の `RefactorView`)と白紙設計(`BlankDesignView.tsx`)。モードを切り替えると `.app__view[hidden]` で隠れるだけで、アンマウントはされない |
| `src/presentation/preview/CodebasePreviewCanvas.tsx` | `.quiz-design__canvas { height: 380px }` | 設計くらべの設計A・B(2枚。`ComparisonQuizView.tsx`) |
| 同上 | `.comparison__canvas { flex: 1; min-height: 0 }` | 解答例の図(2枚。`ComparisonPanes.tsx`) |
| 同上 | `.impact-review__canvas`、`.codebase-preview__canvas` など | 答え合わせ・解答例・解答例の再生のダイアログ。どれも開いている間だけマウントされる |

### 調べて分かったことと、残っていること

- 警告が2回出ることと、設計くらべの図が2枚あることは数が合う。ただし、隠れた `.app__view` の中の図は `checkVisibility()` で除外されるはず。どのインスタンスがどの瞬間に0になったかは、コードを読むだけでは特定できなかった
- 横幅が0になりうる経路はある。1400px未満の画面でサイドバー(`--sidebar-width`)とメソッドエディタ(既定360px)を両方開くと、`.app__canvas`(`min-width: 0`)の幅が0まで縮む。開発者ツールを横に開いて画面幅が狭くなった状態が、これにあたる
- 実害は小さい。0の間、React Flow は 500×500 を仮の大きさとして使う。その後 `ResizeObserver` が本当の大きさを知らせると、次の処理で表示を合わせ直すので、ずれは一瞬で戻る
  - `CodebaseCanvas` は `FitViewOnResize` で全体を表示し直す
  - `CodebasePreviewCanvas` は `ZoomController`(`width === 0 || height === 0` を無視している)で縮尺を求め直す
  - 実害が出るとすれば、0の瞬間に初回の `fitView` が走って、その縮尺のまま残る場合だけ。これは受け入れ基準2の大きさの確認で検出する
- **実装者は最初に、下の「テスト」の E2E を書いて Red にする。** 警告が出た時点で、表示中のすべての `.react-flow` について、親要素の `getBoundingClientRect()` を `test.info().attach` に記録し、どのインスタンスが0なのかを特定する。それから修正に入る

## 修正

**方針(確定): CSS で React Flow の外枠に最小の大きさを与える。描画を遅らせたりアンマウントしたりする仕組みは作らない。**

採らなかった方針「親が0の間は `<ReactFlow>` を描画しない」が合わない理由は次の3つ。

- このリポジトリには `ReactFlowProvider` がなく、React Flow の状態は `<ReactFlow>` の中にある。外すとズーム・表示位置が消える。これは `App.tsx` が隠すだけでアンマウントしない理由(位置やズームを残すため)と矛盾する
- 報告された症状は、図が一度描かれた後のモード切替で起きている。初回だけ描画を遅らせても直らない
- ponytail の階段の4段目(CSS)で解決できるので、TS のコードを足す必要がない

### 変更内容

1. `src/index.css`(presentation 層。既存の `.react-flow.dark {` の直前)に、次の1ルールを足す。

   ```css
   /* React Flow は外枠の幅・高さが0だと警告(error#004)を出し、500×500 とみなして表示を合わせてしまうので、0にならないようにする */
   .react-flow { min-width: 1px; min-height: 1px; }
   ```

   - React Flow が測っている `.react-flow__zoompane` は `.react-flow` に対して `position: absolute`・100% なので、外枠が1pxあれば0にならない
   - 1px にしたのは、レイアウトを変えないため。大きな値にすると、縮んだ `.app__canvas` からはみ出して、メソッドエディタの上に重なる
2. E2E を書いてみて、**ある親要素が表示中にずっと0のまま**だと分かった場合は、1px のルールで隠さない。その親要素のクラス(上の表のどれか)に `min-height` などを与えて、レイアウトそのものを直す(受け入れ基準2で検出する)。手段は同じ「CSS で大きさを保証する」なので、方針は変わらない
3. TS/TSX は変更しない見込み。E2E で特定した原因が CSS では直せない場合(例: マウントの順序)は、実装を止め、特定した内容を報告して仕様を見直す

- 本当に `<ReactFlow>` のラッパーコンポーネントが要るか? 要らない。CSS 1行で足りる
- 本当に `onError` で 004 だけ握りつぶす必要があるか? 要らない。それは症状を隠すだけになる
- 本当に hidden の切替を `visibility` に変える必要があるか? 要らない。`display: none` の間は React Flow 自身が除外している

### TDD対象の純粋関数

なし(CSS だけの変更で、domain/application 層のロジックを足さない)。

## テスト

新規: `e2e/react-flow-size-warning.spec.ts`(先に書いて Red を確かめる)

- 共通の準備
  - `page.addInitScript` で `refactor-blocks:mode-intro-seen:quiz` と `refactor-blocks:mode-intro-seen:blank` を `'true'` にして、ミニガイドの暗幕がクリックを邪魔しないようにする(`e2e/mode-intro-guides.spec.ts` のキー名に合わせる)
  - `page.on('console', ...)` で `type()` が `warning` または `error` のメッセージを集める。そのうち本文に `error#004` か `parent container needs a width and a height` を含むものを `zeroSizeWarnings` に入れる
  - 表示中の図が描き終わるのを待つ関数を用意する。表示中の `.app__view:not([hidden])` の中で `.react-flow__node` が見えるまで待ち、`.react-flow` がそれぞれ幅・高さとも100px以上あることを `boundingBox()` で確かめる
- テスト1「モードを行き来しても React Flow の大きさの警告が出ない」
  - Arrange: `page.goto('/')`。リファクタリングの図が描き終わるのを待つ
  - Act: `mode-quiz` → `mode-refactor` → `mode-blank` → `mode-refactor` → `mode-quiz` → `mode-blank` → `mode-refactor` の順に押す。押すたびに、表示中の図が描き終わるのを待つ(設計くらべでは `quiz-design-a` と `quiz-design-b` の両方を待つ)
  - Assert: `zeroSizeWarnings` が空(`toEqual([])`)
- テスト2「課題サイドバーとメソッドエディタを開閉しても警告が出ない」
  - Arrange: `page.setViewportSize({ width: 900, height: 700 })` にする。サイドバーとエディタの両方が場所を取り、1400px未満・701px以上の範囲に入る幅
  - Act: 次の順に操作する
    1. 「サイドバーを開く」を押す
    2. チュートリアル1のメソッドを1つ押してメソッドエディタを開く(`[data-method-id]` の先頭)
    3. 「サイドバーを閉じる」を押す
    4. `mode-quiz` → `mode-refactor` を押す
  - Assert: `zeroSizeWarnings` が空。最後に表示中の `.react-flow` の幅・高さが0より大きい
- E2E は PC が重くならないよう1件ずつ実行する(`npx playwright test e2e/react-flow-size-warning.spec.ts`。既定の workers=1 のまま)

## 受け入れ基準

1. 症状の再現手順(チュートリアル1 → 設計くらべ → リファクタリング)を開発サーバーでもう一度やって、コンソールに `error#004` の警告が1回も出ない。白紙設計を挟んでも出ない
2. 新しい E2E の2件が通る。テストの中で、切り替えのたびに表示中の各 `.react-flow` が幅・高さとも100px以上ある(1px のルールでレイアウトの不具合を隠していないことの確認)
3. 既存の E2E(特に `e2e/mode-intro-guides.spec.ts`、`e2e/dark-mode-canvas-controls.spec.ts`、設計くらべ・白紙設計・解答例の図に関するもの)の結果が変わらない
4. `npm run check` と `npm run test:e2e` が通る
5. 原因として特定したインスタンスと瞬間(どのモード・どの操作で、どの親要素が0だったか)を PR の本文に1〜2行で書く

## スコープ外

- 開発者ツールを開いて画面幅を極端に狭くしたときに、キャンバスが細くなりすぎるレイアウトの改善(`.app__canvas` の最小幅、サイドバーの自動で閉じる条件の見直しなど)。警告を止めることだけを扱う
- `onError` を渡して React Flow の警告を握りつぶすこと
- `<ReactFlow>` を親の大きさで出し入れするラッパーやフック、`ReactFlowProvider` の導入
- モード切替の隠し方(`hidden` / `display: none`)の変更
- `checkVisibility` を持たない古いブラウザで、隠れるときに出る警告への対応(Playwright の Chromium と、現行の Chrome/Edge/Firefox/Safari は対応済み)
- ダイアログ(答え合わせ・解答例・解答例の再生)の図。開いている間しかマウントされず、今回の再現手順には入らない。E2E で原因と分かった場合だけ、同じ CSS の方針で直す
