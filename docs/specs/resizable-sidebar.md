# 右サイドバーの幅をドラッグで変える

## 背景・目的

右側に出るパネル(メソッドエディタ・変更依頼パネル・白紙設計の答え合わせパネル。
いずれも共通の `.method-editor` クラスで幅360px固定)は、処理の一覧やAI講評の文章が長いと
中でスクロールが必要になる。プレイヤーが読みやすい幅に自分で調整できるようにする。

対象は、右サイドバーが同じ構造(`<main className="app__body"><section className="app__canvas">…
</section>{右パネル}</main>`)で出ている2画面: リファクタリング画面(`RefactorView`)と
白紙設計モード(`BlankDesignView`)。設計くらべ画面にはこの右パネルが無いため対象外。

## 変更対象ファイル一覧

| パス | 層 | 新規/変更 | 役割 |
| --- | --- | --- | --- |
| `src/presentation/clampSidebarWidth.ts` | presentation | 新規 | `clampSidebarWidth(width, min, max)` |
| `src/presentation/clampSidebarWidth.test.ts` | presentation | 新規 | 上記のテスト |
| `src/presentation/useResizableSidebarWidth.ts` | presentation | 新規 | 幅の状態・ポインタ操作・キーボード操作をまとめたフック(副作用を持つためユニットテスト対象外) |
| `src/presentation/App.tsx` | presentation | 変更 | `RefactorView` で右パネルをハンドル付きの幅可変な `<div>` で包む |
| `src/presentation/blank/BlankDesignView.tsx` | presentation | 変更 | `BlankDesignBody` で同様にラップする |
| `src/index.css` | presentation | 変更 | `.method-editor` の固定幅(`width: 360px`)を外し、新しいラッパー・ハンドルのスタイルを追加 |
| `e2e/refactor.spec.ts` | E2E | 変更 | ドラッグとキーボードでの幅変更を確認するケースを追加 |

`src/presentation/editor/MethodEditor.tsx`・`src/presentation/change/ChangeRequestPanel.tsx`・
`src/presentation/blank/BlankDesignResultPanel.tsx` はいずれも `.method-editor` クラスを使うだけで、
幅はラッパー側が決めるため**変更しない**。

## データ・型の変更

なし。`Codebase`・`Stage` などのドメインモデルには影響しない。幅はReactのコンポーネント内
`useState`(`useResizableSidebarWidth` 内)が持つだけの、画面表示専用の一時的な状態。

## 実装方針

### 定数(`useResizableSidebarWidth.ts` 内)

- `SIDEBAR_DEFAULT_WIDTH = 360`(今までの固定幅と同じ値。読み込み直後の見た目を変えない)
- `SIDEBAR_MIN_WIDTH = 280`
- `SIDEBAR_MAX_WIDTH = 640`
- `KEYBOARD_STEP = 16`(矢印キー1回あたりの変化量、px)

### `useResizableSidebarWidth(): { width: number; handleProps: {...} }`

- `width` を `useState(SIDEBAR_DEFAULT_WIDTH)` で持つ(**永続化しない**。リロードすると360pxに戻る)。
- ハンドルの `onPointerDown`: `event.currentTarget.setPointerCapture(event.pointerId)` し、
  開始時のポインタX座標と現在の `width` を `useRef` に控える。
- `onPointerMove`: ドラッグ中でなければ何もしない。ハンドルは右パネルの**左端**にあるため、
  ポインタを左へ動かす(X座標が減る)ほど右パネルは広がる。
  `delta = 開始X - 現在X`、`setWidth(clampSidebarWidth(開始時width + delta, MIN, MAX))`。
- `onPointerUp`: ドラッグ状態を解除し、`releasePointerCapture` する。
- `onKeyDown`: フォーカスがハンドルにある状態で `ArrowLeft` は `width + KEYBOARD_STEP`、
  `ArrowRight` は `width - KEYBOARD_STEP`(ドラッグの向きと一致させる)。どちらも
  `clampSidebarWidth` で収めてから `setWidth` し、`event.preventDefault()` する。
  それ以外のキーは無視する。
- `handleProps` に `role="separator"`・`aria-orientation="vertical"`・`aria-valuenow={width}`・
  `aria-valuemin={SIDEBAR_MIN_WIDTH}`・`aria-valuemax={SIDEBAR_MAX_WIDTH}`・
  `aria-label="サイドバーの幅を変更"`・`tabIndex={0}` を含める(キーボード操作・スクリーンリーダー対応)。

### 呼び出し側(`App.tsx` の `RefactorView`、`BlankDesignView.tsx` の `BlankDesignBody`)

```tsx
const { width, handleProps } = useResizableSidebarWidth();
// ...
<main className="app__body">
  <section className="app__canvas" aria-label="コードベース">...</section>
  <div className="sidebar-resizable" style={{ width }}>
    <div className="sidebar-resizable__handle" {...handleProps} />
    {investigating ? <ChangeRequestPanel /> : <MethodEditor />}
  </div>
</main>
```

`style={{ width }}` は数値を渡せば React が自動で `px` を付ける(既存コードに前例は無いが、
Reactの標準動作)。`BlankDesignBody` 側も同じ形で `BlankDesignResultPanel`/`MethodEditor` を包む。

### CSS(`src/index.css`)

- `.method-editor` から `width: 360px;` を削除し、`flex: 1; min-width: 0;` を追加する
  (ラッパーの残り幅いっぱいに広がる。padding・background・border-left・overflow-yは変更しない)。
- `.sidebar-resizable { display: flex; flex: none; min-width: 0; }` を追加。
- `.sidebar-resizable__handle { width: 6px; flex: none; cursor: col-resize; touch-action: none; background: transparent; }`
  と、`:hover`・`:focus-visible` で `background: var(--accent); outline: none;` を追加
  (つかめる場所が目で分かるようにする)。

## TDD対象の純粋関数

### `clampSidebarWidth(width: number, min: number, max: number): number`(`src/presentation/clampSidebarWidth.ts`)

`src/presentation/canvas/clampMenuPosition.ts` と同じ考え方(`Math.max`/`Math.min` で範囲に収める)。

- 正常系: `min` 以上 `max` 以下の `width` → そのまま返す
- 境界: `min` より小さい `width` → `min` に収める
- 境界: `max` より大きい `width` → `max` に収める

## 受け入れ基準

- `npm run check`(lint + typecheck + test)が通る
- リファクタリング画面・白紙設計モードどちらでも、右パネルの左端のハンドルをドラッグすると
  パネルの幅が変わり、`280px`〜`640px`の範囲に収まる(それ以上広げよう・狭めようとしても止まる)
- ハンドルに `Tab` でフォーカスでき、`←`/`→` キーでも同じ範囲で幅を変更できる
- ページを再読み込みすると、幅は初期値(360px)に戻る(永続化しない)
- 設計くらべ画面(`ComparisonQuizView`)には影響がない(右パネルが無いため対象外)
- `e2e/refactor.spec.ts` に、ドラッグでの幅変更とキーボードでの幅変更を確認するケースが追加され、通る

## スコープ外

- 幅のlocalStorageへの永続化(対話で「記憶しない」を確定。将来欲しくなったら別仕様で追加する)
- 左サイドバー(`.sidebar`、課題とヒント)の幅ドラッグ(今回は「右サイドバー」という要求のみに絞る。
  開閉トグルは`ui-redesign`で実装済みのものをそのまま使う)
- パネルの最小幅を画面幅に応じて動的に変える(ビューポート幅の考慮)。固定の`280px`〜`640px`で十分と判断
- 設計くらべ画面への同機能の追加(右パネルが存在しないため、仕様自体が成立しない)

## 未決事項

なし。対話(`AskUserQuestion`)で、適用範囲(リファクタリング画面・白紙設計モードの両方)と
永続化しないことを確定済み。
