# 仕様草案: 描画中の例外で画面全体が真っ白にならないようにし、作業を残したまま立て直せるようにする(React のエラー境界)

- slug: `render-error-fallback`
- 元になった探索: `docs/pipeline/render-error-fallback/01-discovered.md`
- 前例: `src/presentation/quiz/ComparisonQuizView.tsx` 58〜61行目(`Verdict` の見出しへのフォーカス移動)、`src/presentation/critique/CritiquePanel.tsx` 13行目(`role="alert"`)

## 1. 背景・目的

- `src/main.tsx` は `<StrictMode><App /></StrictMode>` をそのまま描画しており、アプリのどこにも**エラー境界**が無い。
  React はエラー境界の無い描画中の例外で**ルートごとアンマウントする**ため、どこか1か所の描画で例外が起きると画面全体が消え、
  「元に戻す」「最初に戻す」ボタンにも届かない。プレイヤーはリロードするしかなく、そのステージの作業が消える。
- 描画中に例外を投げうる箇所は実際にある。
  - `src/domain/stage/sampleAnswer.ts` 80〜108・383行目の `throw` を、`StagePanel.tsx` 56〜60行目の `PreviewButtons`(`useMemo`)が描画中に呼ぶ
  - `src/presentation/preview/CodebasePreviewContext.ts` 13行目(Provider の外で使うと `throw`)
  - `law-of-demeter-stage` の02は `HintPanel.tsx` でも描画中に模範解答を当てる(例外処理は足さない方針)
  - 多数のパイプラインが描画を並行して書き換え、自動マージされる。特定のステージ・操作の後だけで起きる例外はE2Eで拾いきれない
- `stage-draft-persistence` のマージ後は、復元した途中経過の描画で例外が出ると**リロードのたびに同じ例外で真っ白になり、localStorage を手で消す以外に抜け出せない**。
  同件の02(206〜207行目)は「形だけ検証すれば画面は壊れない」を前提にしているので、その前提が外れたときの逃げ道が要る。
- ストアはReactの木の外で作られている(`useGameStore.ts` 423行目の `GameStoreContext` の既定値、`BlankDesignView.tsx` 15行目の `blankStore`。どちらもモジュール初期化時)。
  したがって**落ちた区切りだけを代わりの表示に差し替えれば、コードベースも取り消し履歴も残る**。代わりの表示から既存の `undo`・`resetStage` を呼べば、
  引き金になった操作だけを取り消して続きから遊べる。

**本当に新しい仕組みが要るか**: 要る(描画中の例外を受け止める手段は React のエラー境界しか無い)。ただし ponytail の階段4「Reactの標準機能」で止まる。
クラスコンポーネントの `static getDerivedStateFromError` を1つ書くだけで、`react-error-boundary` などの新しい依存は足さない。
立て直しの操作(`undo`・`resetStage`・`endChangeRequests`)はストアに既にあるものを呼ぶだけで、ストア・domain・application は変更しない。
例外のコンソールへの記録は、React 19 の既定の動作(エラー境界が受け止めた例外は `console.error` に出る)で足りるので、
`createRoot` の `onCaughtError`/`onUncaughtError` は使わず、`main.tsx` も変更しない(未決事項5で変わりうる)。

## 2. 変更対象ファイル一覧

未決事項1・2を推奨案(モードごとに包む/白紙設計は Provider の内側で包む)で決めた場合の一覧。

| 種別 | パス | 層 | 役割 |
| --- | --- | --- | --- |
| 新規 | `src/presentation/RenderErrorBoundary.tsx` | presentation | エラー境界(クラスコンポーネント)と代わりの表示。代わりの表示のストア操作ボタンもこのファイル内に置く(export するのは `RenderErrorBoundary` だけ) |
| 新規 | `src/presentation/RenderErrorBoundary.test.tsx` | presentation(テスト) | jsdom 上で `react-dom/client` + `act` を使い、代わりの表示と立て直しの操作を確かめる。`src/` で初めての `.test.tsx` |
| 変更 | `src/presentation/App.tsx` | presentation | 57行目の `<RefactorView>` を `storeActions` 付きで、61行目の `<ComparisonQuizView />` を `storeActions` なしで包む。import 1行 |
| 変更 | `src/presentation/blank/BlankDesignView.tsx` | presentation | 58行目の `<BlankDesignBody>` を Provider の**内側**で `storeActions` 付きで包む。import 1行(未決事項2が選択肢Bなら変更しない) |
| 変更 | `src/index.css` | presentation | **末尾に**代わりの表示のスタイルを数行追記(既存の行は変えない) |

変更しないもの(読むだけ): `src/main.tsx`・`useGameStore.ts`・`StagePanel.tsx`・`HintPanel.tsx`・`sampleAnswer.ts`・`CodebasePreviewContext.ts`・
`comparisonQuizzes.ts`・`vite.config.ts`・`eslint.config.js`・`e2e/*.spec.ts`(既存E2Eはそのまま通ることを確かめるだけ)。
触らないもの: `src/domain/`・`src/application/`・`src/infrastructure/`・`CodebaseCanvas.tsx`・`MethodEditor.tsx`・`ChangeRequestPanel.tsx`・`ComparisonQuizView.tsx` の中身・`BlankDesignBody` の中身。

### 衝突の見立て

- `App.tsx`: `operation-guide` は `nav`(38〜54行目)の末尾に1行と import 1行。本件は57・61行目と import 1行。import 行が隣り合う小さなテキスト競合のみ
  (本件の import は `./RenderErrorBoundary` で、アルファベット順なら `./quiz/...` と `./stage/...` の間。`operation-guide` の `./guide/...` とは離れる見込み)
- `BlankDesignView.tsx`: `blank-design-second-problem` の02(109〜118行目)が触るのは11〜12行目の `problem` 定数と `BlankDesignBody` の中身(17〜52行目)。
  本件が触るのは import 1行と `BlankDesignView` 関数(55〜61行目)の中の1か所で、**同じ行・隣の行は触らない**。
  import は既存の import 群の中(1〜9行目)に足し、11行目のコメントの直前には置かない。これで通常の3-wayマージで自動解決できる見込み
- `index.css`: 末尾への追記。色は `:root` の変数(`--surface`・`--border`・`--text`・`--danger`)だけを使い、`color-contrast-a11y` が変数の値を直せばそのまま乗る

## 3. データ/型の変更

ドメインモデル・永続化スキーマ・ストアの変更は無し。`RenderErrorBoundary.tsx` の中だけで使う型を置く。

```ts
type RenderErrorBoundaryProps = Readonly<{
  /**
   * true のとき、代わりの表示に「元に戻す」「最初に戻す」(変更依頼の実装中は「変更依頼をやめる」)を出す。
   * 使うストアは、境界を置いた位置の GameStoreContext のもの(App.tsx ならリファクタリング、BlankDesignView の Provider 内なら白紙設計)。
   * ストアを使わない画面(設計くらべ)では false にし、「もう一度表示する」だけを出す。
   */
  storeActions: boolean;
  children: ReactNode;
}>;

type RenderErrorBoundaryState = { failed: boolean };
```

- `error` 自体は state に持たない(未決事項5が選択肢Bなら `error: unknown` を足す)。
- `failed` を false に戻すと子が**作り直される**(代わりの表示に差し替わった時点で子はアンマウント済み)。子のローカル state(プレビューの開閉など)は初期値に戻る。
  `PreviewButtons` の `useMemo` が模範解答で落ちた場合は、これだけで元の表示に戻れる。

## 4. 画面・コンポーネントの形

### `RenderErrorBoundary`(export、クラスコンポーネント)

- `class RenderErrorBoundary extends Component<RenderErrorBoundaryProps, RenderErrorBoundaryState>`
- `state = { failed: false }`、`static getDerivedStateFromError(): RenderErrorBoundaryState { return { failed: true }; }`
- `componentDidCatch` は書かない(React 19 が既定で `console.error` に出す)
- `render()`: `failed` でなければ `children` を**包み要素なしで**そのまま返す(`.app__view` の flex レイアウト・既存E2Eのセレクタを変えないため)。
  `failed` なら `<RenderErrorFallback storeActions={...} onRetry={this.retry} />`
- `retry` はアロー関数のクラスフィールドで `this.setState({ failed: false })`
- `eslint.config.js` の制約: `as`・`!` を使わない。`erasableSyntaxOnly` のためコンストラクタ引数プロパティ(`constructor(private x)`)は使わない

### `RenderErrorFallback`(ファイル内、非export)

```
<section className="render-error" data-testid="render-error" aria-labelledby=...>
  <h2 tabIndex={-1} ref={見出し}>この部分を表示できませんでした</h2>
  <p>表示の途中でエラーが起きました。コードと取り消しの履歴は残っています。下のボタンで立て直してください。</p>
  <div className="render-error__actions">
    {storeActions ? <StoreRecoveryButtons onDone={onRetry} /> : null}
    <button type="button" data-testid="render-error-retry" onClick={onRetry}>もう一度表示する</button>
  </div>
</section>
```

- マウント時に見出しへフォーカスを移す(`useEffect` + `ref`。未決事項6の推奨案。`ComparisonQuizView.tsx` の `Verdict` と同じ形)
- 文言は上記を既定とし、実装時に多少変えてよい。ボタンのラベルは既存の `StagePanel` の「元に戻す」「最初に戻す」にそろえる

### `StoreRecoveryButtons`(ファイル内、非export。`storeActions` のときだけ描画)

hook の条件付き呼び出しを避けるため、ストアを読むのはこのコンポーネントだけにする。

| ボタン | data-testid | 押したとき | 無効になる条件 |
| --- | --- | --- | --- |
| 元に戻す | `render-error-undo` | `undo()` → `onDone()` | `history.past.length === 0` |
| 最初に戻す(`changeSession === null` のとき) | `render-error-reset` | `resetStage()` → `onDone()` | なし |
| 変更依頼をやめる(`changeSession !== null` のとき) | `render-error-end-change` | `endChangeRequests()` → `onDone()` | なし |

- 「最初に戻す」は `resetStage` が `commit` するので1手として記録され、あとで「やり直し」ではなく「元に戻す」で戻せる(既存の動き)。
- `stage-draft-persistence` のマージ後、復元した途中経過で落ちた場合(取り消し履歴が空)の抜け道は「最初に戻す」。
  同件の02(121行目)のとおり `resetStage` は `stage.codebase` と同じ参照を積むので保存値も消え、リロード後も抜け出せる。
- 変更依頼の実装中は `resetStage` が何もしない(`useGameStore.ts` 404行目)ので、代わりに `endChangeRequests` を出す。

### 包む位置

- `App.tsx` 57行目: `<RenderErrorBoundary storeActions><RefactorView active={...} /></RenderErrorBoundary>`
  (Provider の無い位置なので、既定のリファクタリング用ストアを使う)
- `App.tsx` 61行目: `<RenderErrorBoundary storeActions={false}><ComparisonQuizView /></RenderErrorBoundary>`
- `BlankDesignView.tsx` 58行目: `<GameStoreContext.Provider value={blankStore}><RenderErrorBoundary storeActions><BlankDesignBody .../></RenderErrorBoundary></GameStoreContext.Provider>`
- `nav.mode-switch`(と `operation-guide` のガイド)は境界の外に残るので、どのモードが落ちても他のモードへ切り替えられる。
- 注意: `useUndoRedoShortcut` は `RefactorView`/`BlankDesignBody` の中にあるので、代わりの表示の間は Ctrl+Z が効かない。代わりの表示のボタンで足りる(足さない)。

### `index.css`(末尾に追記)

- `.render-error`: `margin`/`padding` を少し、`background: var(--surface)`、`border: 1px solid var(--border)`(左だけ `var(--danger)` にする程度の強調は任意)、`color: var(--text)`
- `.render-error__actions`: ボタンを横に並べる(`display: flex; gap`)
- 新しい色の値は足さない

## 5. TDD対象

domain / application 層に新しいロジックは無い(ストア・ユースケースは変更しない)。代わりに presentation 層のコンポーネントテストを**先に書いて**から実装する
(CLAUDE.md のTDDは domain/application が必須対象だが、本件の中身は境界とボタンだけなので、ここで振る舞いを固定する)。

`src/presentation/RenderErrorBoundary.test.tsx`(AAAパターン、Vitest、`environment: 'jsdom'` は `vite.config.ts` で設定済み)

準備:
- `react-dom/client` の `createRoot` と `react` の `act` だけを使う(新しい依存は足さない。`@testing-library/react` は入れない)
- `IS_REACT_ACT_ENVIRONMENT` は `Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)` で立てる(`as` を使わずに型エラーを避ける)
- React が受け止めた例外を `console.error` に出すので、`vi.spyOn(console, 'error').mockImplementation(() => {})` で黙らせ、`afterEach` で戻す。`root.unmount()` とコンテナの除去も `afterEach` で行う
- 例外を投げる子は、テストファイル内に置く小さなコンポーネント(例: ストアの `history.past.length > 0` なら `throw`、またはテスト内の `let` 変数で制御)
- ストアは `createGameStore([...])` で作り、`GameStoreContext.Provider` で渡す(既定のストアを共有しないため)。1手の操作には `addFile` などの既存操作を使う

ケース:

| # | 種別 | ケース | 期待 |
| --- | --- | --- | --- |
| 1 | 正常系 | 子が例外を投げない | 子がそのまま描画され、`render-error` は無い。境界が包み要素を足していない(コンテナの直下が子の要素) |
| 2 | 異常系 | 子が描画中に例外を投げる | `render-error` が出る。境界の**外**に並べた兄弟要素は残っている |
| 3 | 異常系→復帰 | 例外の条件を解いてから「もう一度表示する」 | 子が再び描画され、`render-error` が消える |
| 4 | 異常系→復帰 | `storeActions` あり。1手操作した後に子が落ちる → 「元に戻す」 | 子が再び描画される。ストアの `codebase` が操作前に戻り、`history.future` に1手残る(履歴が消えていない) |
| 5 | 異常系→復帰 | `storeActions` あり。子が「コードベースが `stage.codebase` と違えば throw」 → 「最初に戻す」 | 子が再び描画され、`codebase === stage.codebase` |
| 6 | 異常系→復帰 | `storeActions` あり。`startChangeRequests()` 後に子が落ちる | 「最初に戻す」が無く「変更依頼をやめる」がある。押すと `changeSession === null` になり子が再び描画される(`changeRequests` を持つステージで作ったストアを使う) |
| 7 | 異常系 | `storeActions` あり、取り消し履歴が空のまま子が落ちる | 「元に戻す」が `disabled` |
| 8 | 異常系 | `storeActions={false}` | 「もう一度表示する」だけで、`render-error-undo`・`render-error-reset`・`render-error-end-change` は無い |
| 9 | 異常系 | 子が落ちる | 代わりの表示の見出しに `document.activeElement` がある(未決事項6が選択肢Aの場合) |

## 6. 受け入れ基準

- `npm run check`(lint + typecheck + test)が通る。`RenderErrorBoundary.test.tsx` の上記ケースがすべて通る
- `npm run test:e2e` の既存のテストがすべて変更なしで通る(例外が無いときはDOMが変わらないため)
- `package.json` に依存が増えていない
- `src/main.tsx`・`src/domain/`・`src/application/`・`src/infrastructure/`・`useGameStore.ts` に差分が無い
- コードレビューで確認:
  - `App.tsx` の `nav.mode-switch` は境界の外にある
  - 白紙設計の境界は `GameStoreContext.Provider value={blankStore}` の**内側**にあり、代わりの表示の操作が白紙設計のストアに効く(未決事項2が選択肢Aの場合)
  - 設計くらべの境界は `storeActions={false}`(リファクタリングのストアを誤って操作しない)
  - `as`・`!`・`enum` を使っていない
- 手動確認(任意): 開発サーバーで一時的に `StagePanel` などへ `throw` を足すと、リファクタリングの区切りだけが代わりの表示になり、モード切り替えは使える(確認後に戻す。コミットしない)

## 7. スコープ外

- **イベントハンドラ・非同期処理・モジュール読み込み時の例外**。エラー境界は**描画中(描画・`useMemo`・ライフサイクル/effect)の例外しか受け止めない**。
  - イベントハンドラ(ドラッグの終了・ボタン押下など)やストアの操作が投げた例外を画面に出す仕組みは、実害が出てから
  - 非同期処理(AI講評の取得など)は `critique-request-robustness` などの担当
  - モジュール読み込み時の例外(`comparisonQuizzes.ts` 10・16行目、`main.tsx` 8行目)はエラー境界の外側。題材データのテストで守る今の形のまま
- 例外の内容を外部へ送る(ログ収集)。外部サービスを持たない(YAGNI)
- `createRoot` の `onCaughtError`/`onUncaughtError` によるコンソール記録のカスタマイズ(React 19 の既定の `console.error` で足りる)
- 途中経過(`stage-draft-persistence`)の保存値を代わりの表示から消す専用のボタン(「最初に戻す」で足りるかを、あちらのマージ後に見て決める)
- キャンバス・メソッドエディタ・ステージ欄などを個別に包む細かい境界(未決事項1で選ばれた場合のみ対象)
- テスト専用の「わざと落とす」入口を本番コードに作ること
- 代わりの表示での Ctrl+Z / Ctrl+Y のショートカット

## 8. 未決事項

### 未決事項1: エラー境界で包む単位をどうするか

- 選択肢A(推奨): モードごと。リファクタリング・設計くらべ・白紙設計の中身をそれぞれ1つの境界で包む。`App.tsx` の2か所(+白紙設計は未決事項2のとおり)で済み、進行中の件が触る `StagePanel.tsx`・`CodebaseCanvas.tsx` などに差分が広がらない。落ちるとステージ欄ごと代わりの表示になるが、立て直しのボタンは代わりの表示にある
- 選択肢B: リファクタリング画面だけ、`App.tsx` の `RefactorView` の中で `StagePanel`・キャンバスの `section`・エディタ(`MethodEditor`/`ChangeRequestPanel`)を別々に包む(設計くらべ・白紙設計はモードごと)。`App.tsx` だけで済み、キャンバスが落ちてもステージ欄の「元に戻す」やステージ選択が使える。境界が3つに増え、モードによって粒度がそろわない
- 選択肢C: 各コンポーネントのファイルの中で細かく包む(ヒント欄・プレビューなど)。落ちる範囲は最も狭いが、進行中の多数の件と衝突する

### 未決事項2: 白紙設計の代わりの表示から、白紙設計のストアを操作できるようにするか

- 選択肢A(推奨): `BlankDesignView.tsx` の `GameStoreContext.Provider` の**内側**で `BlankDesignBody` を包む(import 1行と58行目のみ)。代わりの表示の「元に戻す」「最初に戻す」が白紙設計のストアに効く。01の「今回やる」(白紙設計は自分のストアの操作を呼べるようにする)を満たす。`blank-design-second-problem` の02が触る行(11〜12行目・`BlankDesignBody` の中身)とは離れているので、テキストの競合は小さい見込み
- 選択肢B: `App.tsx` 側だけで白紙設計の `app__view` の中を `storeActions={false}` で包み、代わりの表示は「もう一度表示する」だけにする。`BlankDesignView.tsx` は一切触らない。ただし例外の原因がコードベースの状態にある場合は立て直せず、リロード(白紙設計の作業は消える。白紙設計は保存されない)しかない
- 選択肢C: `blankStore` を export し、`App.tsx` から境界にストアを渡す。`BlankDesignView.tsx` の14〜15行目を触り、「exportしない」という既存の方針も変わるので推奨しない

### 未決事項3: 代わりの表示にどの操作を出すか(ストアを持つ画面)

- 選択肢A(推奨): 「元に戻す」「最初に戻す」「もう一度表示する」。変更依頼の実装中は「最初に戻す」の代わりに「変更依頼をやめる」(`endChangeRequests`)を出す。実装中に何もしないボタンを見せずに済む
- 選択肢B: 「元に戻す」「最初に戻す」「もう一度表示する」の3つ固定。実装中は「最初に戻す」を無効にする(実装中に落ちた場合、抜け出す手段は「元に戻す」と、モードの行き来だけ)
- 選択肢C: 「もう一度表示する」だけ。ストアを使わずに済むが、例外の原因がコードベースにある場合は立て直せない(推奨しない)

(設計くらべはストアを使わないので、どの選択肢でも「もう一度表示する」だけにする)

### 未決事項4: 立て直しの操作のあと、元の表示にいつ戻すか

- 選択肢A(推奨): ボタン方式。「元に戻す」などのボタンの処理の中で、ストアの操作に続けて境界の `failed` を戻す。「もう一度表示する」は操作なしで戻す。仕組みが最も単純
- 選択肢B: 自動方式。ストアの `codebase` が変わったら境界を自動で戻す(`resetKey` のような仕組みを `componentDidUpdate` で足す)。ステージ欄など境界の外の「元に戻す」でも戻るが、境界がストアを読む必要があり、置き場所(Provider の内外)で読むストアが変わる点に注意が要る

### 未決事項5: 例外の内容をプレイヤーに見せるか

- 選択肢A(推奨): 見せない。日本語の説明だけを出し、例外そのものは React 19 の既定の `console.error` に任せる。`main.tsx` も変更しない
- 選択肢B: 代わりの表示に `<details><summary>詳しい内容(不具合の報告用)</summary>` を置き、`error.message` を小さく出す。state に `error` を持つ。英語の内部メッセージが出る場合がある
- 選択肢C: 選択肢Aに加え、`main.tsx` の `createRoot` に `onCaughtError` を渡して記録の形をそろえる(外部送信はしない)

### 未決事項6: 代わりの表示のアクセシビリティ

- 選択肢A(推奨): 表示したときに見出し(`tabIndex={-1}`)へフォーカスを移す。例外の引き金になった要素ごと消えてフォーカスが `body` に落ちるので、キーボード利用者がすぐ立て直しのボタンへ進める。前例は `ComparisonQuizView.tsx` の `Verdict`
- 選択肢B: `role="alert"` で読み上げるだけにし、フォーカスは動かさない(前例は `CritiquePanel.tsx`)
- 選択肢C: 両方(読み上げが二重になりうる)

### 未決事項7: テストの形

- 選択肢A(推奨): ユニットテストだけ。`src/presentation/RenderErrorBoundary.test.tsx` を `react-dom/client` + `act`(jsdom)で書く。E2Eは足さない。本番のコードに「わざと落とす」入口を作らずに例外を起こす手段がE2Eには無いため。既存E2Eが変更なしで通ることで、例外が無いときに画面が変わらないことを守る
- 選択肢B: 選択肢Aに加えてE2Eも足す。そのために本番コードにテスト専用の入口(例: URLのクエリで例外を投げる)を作る。本番に残るので推奨しない
