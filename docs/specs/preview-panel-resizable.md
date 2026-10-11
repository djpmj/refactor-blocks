# 図のプレビュー・解答の再生で、右のメソッドパネルの幅を変えられるようにする

> **前提**: `preview-method-panel`(PR #145 の `PreviewMethodPanel`)のマージ後に実装する。

## 背景・目的

「変更前の図を見る」「解答例の図を見る」(`CodebasePreviewDialog`)と「解答を再生」(`SampleAnswerReplayDialog`)では、
メソッドをクリックすると右側に `PreviewMethodPanel`(処理の一覧・「コード」タブ)が出る。このパネルは CSS で 360px 固定
(`.codebase-preview__panel`)なので、コードタブの長い行や処理名が読みにくく、逆に図を広く見たいときも狭められない。

メイン画面の右サイドバーはすでに `useResizableSidebarWidth`(`resizable-sidebar`)で幅を変えられる。
同じ仕組みを、これらのダイアログの右パネルにも使う。表示内容は変えない。

## 変更対象ファイル一覧

| パス | 層 | 新規/変更 | 役割 |
| --- | --- | --- | --- |
| `src/presentation/preview/ResizablePreviewMethodPanel.tsx` | presentation | 新規 | 仕切り(ハンドル)+ 指定した幅の枠 + `PreviewMethodPanel` を並べる表示用コンポーネント(下記) |
| `src/presentation/preview/CodebasePreviewDialog.tsx` | presentation | 変更 | `useResizableSidebarWidth` で幅を持ち、`PreviewMethodPanel` の代わりに `ResizablePreviewMethodPanel` を出す |
| `src/presentation/stage/SampleAnswerReplayDialog.tsx` | presentation | 変更 | 同上。あわせて、仕切りにフォーカスがあるときの `←`/`→` で手順が動かないようにする(下記) |
| `src/index.css` | presentation | 変更 | 枠の中では `.codebase-preview__panel` の 360px 固定を外して枠の幅に合わせる。狭い画面(`max-width: 800px`)では仕切りを出さない |
| `e2e/preview.spec.ts`・`e2e/sample-replay.spec.ts` | E2E | 変更 | 仕切りのドラッグ・キーボードで幅が変わる(下記) |

`domain`・`application` の変更は無い。幅の計算は既存の `clampSidebarWidth` / `widthAfterDrag`(テスト済み)をそのまま使い、
`useResizableSidebarWidth` も変えない。

## 見た目・振る舞いの仕様

### 仕切りと幅

- メソッドを選んで右パネルが出ているときだけ、キャンバスとパネルの間に仕切りを出す(メイン画面と同じ `.sidebar-resizable__handle` の見た目)。
  パネルが出ていないときは仕切りも出さない
- 幅の設定はメイン画面の右サイドバーと同じ: `side: 'right'`、既定 360px、最小 280px、最大 640px
- 仕切りの `aria-label` は「メソッドパネルの幅を変更」(メイン画面の「サイドバーの幅を変更」と区別する)。`role="separator"`・
  `aria-valuenow` などは `useResizableSidebarWidth` の `handleProps` のまま
- ドラッグで変えられる。仕切りにフォーカスして `←` で広く、`→` で狭く(16px ずつ。フックの既存の振る舞い)
- キャンバスが潰れないよう、枠に `max-width: calc(100% - 240px)` を付ける(ダイアログが狭いときは CSS 側で頭打ちにする。
  メイン画面の `.sidebar-resizable` の `max-width` と同じ考え方)
- 最大化(`WindowControls`)しても、幅はそのまま

### 幅を保つ範囲

- ダイアログを開いている間は、別のメソッドを選び直しても、再生の手順を進めても戻しても、幅を保つ
  (フックはダイアログのコンポーネントで呼び、メソッドを選ぶたびに作り直される `ResizablePreviewMethodPanel` の中では呼ばない)
- 閉じて開き直したときは、今の作りのままでよい(`CodebasePreviewDialog` は閉じてもマウントされたままなので保たれ、
  再生ダイアログは開くたびに作り直すので既定に戻る)。ページを再読み込みすると既定の360pxに戻る。`localStorage` などへの保存はしない

### 再生ダイアログの矢印キー

- `SampleAnswerReplayDialog` は window の `keydown` で `←`/`→` を「1手戻る/進む」に使っている。仕切りにフォーカスがあるときの
  `←`/`→` は**幅の変更だけ**にし、手順は動かさない(window の処理で、`event.target` が仕切り(`role="separator"`)なら無視する)
- 仕切り以外にフォーカスがあるときの `←`/`→` は今どおり手順を動かす

### 狭い画面(`max-width: 800px`)

- 今どおりキャンバスの下にパネルを縦に並べ、幅いっぱいに出す。仕切りは出さない(`display: none`)

## データ・型の変更

`ResizablePreviewMethodPanel` の props:

```ts
type ResizablePreviewMethodPanelProps = Readonly<{
  codebase: Codebase;
  methodId: string;
  width: number;
  handleProps: ReturnType<typeof useResizableSidebarWidth>['handleProps'];
}>;
```

ストア・ドメインの型の変更は無い。

## TDD対象の純粋関数

なし。幅の計算(`clampSidebarWidth`・`widthAfterDrag`)は既存のテスト済みの関数を使い、今回は表示とイベントの配線だけなので、E2E で守る。

## 受け入れ基準

- `npm run check` が通る
- `npm run test:e2e` が通る(既存のメイン画面の幅変更E2E・プレビュー・再生のE2Eが壊れない)
- 「変更前の図を見る」「解答例の図を見る」「解答を再生」のそれぞれで、メソッドをクリックすると右パネルの左に仕切りが出て、
  ドラッグで右パネルの幅が変わる(280〜640px の範囲で止まる)
- 仕切りにフォーカスして `←` で広く、`→` で狭くなる。再生ダイアログでは、このとき手順の位置(「N / M 手」)が変わらない
- 仕切り以外にフォーカスがあるときの再生ダイアログの `←`/`→` は、今どおり手順を動かす
- 別のメソッドを選び直しても、再生の手順を動かしても、変えた幅が保たれる
- メソッドを選んでいないときは仕切りが出ない
- 幅800px以下の画面では仕切りが出ず、パネルは今どおりキャンバスの下に出る
- メイン画面の右サイドバー・「実際に直してみる」など、ダイアログ以外の表示は変わらない

E2E:
- `preview.spec.ts`: 「解答例の図を見る」→ メソッドをクリック → 「メソッドパネルの幅を変更」の仕切りをドラッグして `aria-valuenow` とパネルの幅が変わる → キーボード `←` で 16px 増える
- `sample-replay.spec.ts`: 「解答を再生」→ メソッドをクリック → 仕切りにフォーカスして `←` → 幅が増え、手順の位置は変わらない → 次の手へ進めても幅が保たれる

## スコープ外

- 幅の保存(`localStorage`)・メイン画面の右サイドバーと幅を共有すること
- パネルを左に出す・折りたたむ・上下に分割するなど、配置の変更
- 白紙設計の結果パネル・変更依頼パネルから開く同じダイアログ(`CodebasePreviewDialog` を共有しているので、自動的に同じ動きになる。追加の作業はしない)
- `useResizableSidebarWidth` の仕様変更(最小・最大値の変更など)
