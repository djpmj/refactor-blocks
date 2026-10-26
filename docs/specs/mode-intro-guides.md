# mode-intro-guides: 設計くらべ・白紙設計を初めて開いたとき3ステップのミニガイドを出し、白紙設計の右パネルの文言をモードに合わせる

## 背景・目的

実機で確認したこと:

- 初回ツアー(`TOUR_STEPS` の6ステップ)が案内するのは「リファクタリング」モードのチュートリアル1だけ(`startTour` は `TOUR_STAGE_ID` 以外では始まらない)。
- 「設計くらべ」を開くと、問題文と「Aのほうが楽」「Bのほうが楽」ボタンが並ぶだけ。何を見比べてどう答えればよいかの説明が無い。
- 「白紙設計」を開くと、右パネル(`MethodEditor` の空表示)に「中央の図から、直したいメソッドをクリックしてみよう」/「まとまりを選んで『メソッドとして抽出』できます」と出る。部品はまだ部品置き場にあって直すメソッドも無いので、リファクタリング向けの文言がずれている。モードの目的と操作の流れの説明も無い。

初めてのプレイヤーが、モードごとに「何をするか・どこを見るか・どう終えるか」を2〜3手で分かるようにする。

## 変更対象ファイル一覧

| 種別 | パス | 層 | 役割 |
| --- | --- | --- | --- |
| 変更 | `src/presentation/tour/tourSteps.ts` | presentation | `ModeIntroKind` 型と `MODE_INTRO_STEPS`(設計くらべ・白紙設計それぞれ3ステップ)を足す |
| 変更 | `src/presentation/tour/tourSteps.test.ts` | presentation | `MODE_INTRO_STEPS` のテストを足す |
| 変更 | `src/presentation/tour/SpotlightTour.tsx` | presentation | `SpotlightOverlay` の「n/6」の固定をやめて総ステップ数と `data-testid` を受け取るようにする。同じファイルに `ModeIntroGuide` コンポーネントを足す(既存の `useSpotlightPosition`・`useEscapeEnd`・`SpotlightOverlay` を同じファイルの中で使い回す) |
| 変更 | `src/infrastructure/tour/tourPreference.ts` | infrastructure | `loadModeIntroSeen(kind)` / `saveModeIntroSeen(kind)` を足す |
| 変更 | `src/presentation/App.tsx` | presentation | 設計くらべ・白紙設計の画面に `ModeIntroGuide` を置く |
| 変更 | `src/presentation/editor/MethodEditor.tsx` | presentation | 空表示の文言をモードで切り替える `emptyMessage` prop を足す |
| 変更 | `src/presentation/blank/BlankDesignView.tsx` | presentation | `<MethodEditor alwaysShowVisibility emptyMessage="blank" />` にする |
| 変更 | `playwright.config.ts` | (E2E設定) | 既定の `storageState` に、新しい2つのキーを `'true'` で足す(既存のE2Eにガイドが被らないように) |
| 新規 | `e2e/mode-intro-guides.spec.ts` | (E2E) | ミニガイドと白紙設計の文言のE2E |

domain・application は変更しない。CSSは既存の `.spotlight-tour__*` をそのまま使い、足さない。新しい依存は足さない。

## データ・型の変更

`src/presentation/tour/tourSteps.ts`:

```ts
export type ModeIntroKind = 'quiz' | 'blank';
export const MODE_INTRO_STEPS: Readonly<Record<ModeIntroKind, readonly TourStep[]>>;
```

ステップは既存の `TourStep` 型を使い、`advance` はすべて `{ kind: 'next' }`(操作待ちのステップは作らない)。

`src/infrastructure/tour/tourPreference.ts`(infrastructure から presentation の型は参照しないので、引数は `'quiz' | 'blank'` をその場で書く):

```ts
export function loadModeIntroSeen(kind: 'quiz' | 'blank'): boolean;  // localStorage 'refactor-blocks:mode-intro-seen:<kind>' === 'true'。例外時は false
export function saveModeIntroSeen(kind: 'quiz' | 'blank'): boolean;  // 'true' を書く。例外時は false を返し、ガイドはそのまま使える
```

既存の `loadTourSeen` / `saveTourSeen` と同じ try/catch の形にする。学習記録の書き出し・読み込み(`tourSeen`)には含めない。

`SpotlightOverlay` の props に `total: number`(「n/total」の表示用)と `testId: string` を足す。既存の初回ツアーは `total={TOUR_STEPS.length}`・`testId="first-visit-tour"` を渡し、見た目と `data-testid` は変えない。ミニガイドの `aria-label` は「モードの案内」、`data-testid` は `mode-intro-guide` にする(`e2e/selectStage.ts` が `first-visit-tour` を見て分岐しているので、同じtestidを使わない)。

`MethodEditor` の props に `emptyMessage?: 'refactor' | 'blank'`(既定 `'refactor'`)を足す。

## 動きの仕様

### ミニガイドの出しかた

- `App` で、設計くらべの画面(`quizOpened` の `app__view` の中)に `<ModeIntroGuide kind="quiz" active={mode === 'quiz'} />`、白紙設計の画面に `<ModeIntroGuide kind="blank" active={mode === 'blank'} />` を置く。
- `ModeIntroGuide` は表示中のステップ番号を `useState<number | null>` で持つ(ストアには入れない)。`active` が true になったとき、`loadModeIntroSeen(kind)` が false なら手順1から始める。
- 「次へ」で進み、最後のステップの「次へ」、「ガイドを終了」、Esc キー、表示中に別のモードへ切り替えた(`active` が false になった)とき、のどれでも閉じて `saveModeIntroSeen(kind)` を呼ぶ。閉じたあとは、同じモードを開き直しても再び出ない。
- 次のステップ番号は既存の `nextTourStep(MODE_INTRO_STEPS[kind], current, { kind: 'next' })` で出す(null なら閉じる)。
- スポットライトの位置計算・画面内へのスクロール・Esc は既存の `useSpotlightPosition`・`useEscapeEnd` をそのまま使う。対象が見つからないときは既存どおり全体を暗くして中央に吹き出しを出し、「次へ」を出す。
- 設計くらべ・白紙設計はリファクタリング画面を隠したまま残すので、セレクタは白紙設計の画面の中だけを指すよう `[data-testid="blank-view"]` で絞る(隠れた画面の同じtestidを拾わないため)。

### ステップ(文言は確定)

設計くらべ(`quiz`):

| # | target | text |
| --- | --- | --- |
| 1 | `.quiz__question` | 設計くらべでは、同じ機能を持つ2つの設計A・Bを見比べます。まず「依頼」(これから入れる変更)と行数の上限を読もう。 |
| 2 | `.quiz__designs` | 左右の図が設計Aと設計Bです。依頼を入れるとき、触るクラスが少なく、行数の上限も超えにくいのはどちらかを比べよう。 |
| 3 | `.quiz__actions` | 楽だと思う方のボタンを押すと、正解と、それぞれの設計に依頼を入れた結果(点数・触るクラス数)が出ます。 |

白紙設計(`blank`):

| # | target | text |
| --- | --- | --- |
| 1 | `[data-testid="blank-view"] .stage-panel__heading` | 白紙設計では、要求文を読んで、クラスの分け方を一から組みます。まず要求文と目標を読もう。 |
| 2 | `[data-testid="blank-view"] .app__canvas` | 部品置き場にメソッドの部品が並んでいます。部品をキャンバスの空いている所へドラッグすると新しいクラスができ、クラスへ落とすとそのクラスに入ります。クラス名は自動で付きます。 |
| 3 | `[data-testid="blank-view"] [data-testid="blank-review"]` | 部品を全部置き終えると「答え合わせ」が押せます。自分の設計と模範解答の点数、変更依頼を入れたときの違いが出ます。 |

### 白紙設計の右パネルの文言

`emptyMessage="blank"` のとき、`method-editor-empty` の中身を次にする(👈 のアイコンと `data-testid="method-editor-empty"` はそのまま):

- 見出し: `部品置き場の部品を、置きたいクラスへドラッグしよう`
- 本文1: `キャンバスの空いている所へ落とすと新しいクラスができ、クラスへ落とすとそのクラスに入ります`
- 本文2: `置いたメソッドをクリックすると、中身と public / private がここに出ます`
- 本文3: `全部品を置いたら、上の「答え合わせ」を押そう`

`'refactor'`(既定)のときは今の文言のまま変えない(`e2e/action-affordance.spec.ts`・`e2e/sample-replay.spec.ts` が見ている)。

## 設計判断(確定)

- **ストアに入れず、コンポーネント内の state で持つ。** 設計くらべはゲームストアを使っていない(`ComparisonQuizView` は自前の state)、ステップも「次へ」だけで操作待ちが無いので、`tourActions` のような仕組みは要らない。
- **新しいファイルを作らず `SpotlightTour.tsx` に足す。** `useSpotlightPosition` 等を別ファイルから使うために export すると `react-refresh/only-export-components` に触れるので、同じファイル内で使い回す。
- **「?」の操作ガイドからミニガイドをもう一度見る導線は作らない。** `operation-guide.md` の仕様で設計くらべ・白紙設計では「?」が開かないため。要望が出たら足す。
- **見た印は学習記録の書き出しに含めない。** 本当に要るか: 別のブラウザで設計くらべのミニガイドがもう一度出ても3ステップで閉じられるので、`tourSeen` と同じ扱いにするほどの損は無い。
- **操作(A/Bを押す・部品を置く)でステップを進めない。** 2〜3ステップの説明なら「次へ」で足りる。スポットライトの穴は既存どおりクリックが通るので、案内中に操作してもよい。

## TDD対象

### `MODE_INTRO_STEPS`(presentation、`tourSteps.test.ts`)

- `quiz`・`blank` それぞれ、ステップ数が2以上3以下
- すべてのステップの `advance.kind` が `'next'`
- `blank` のすべての `target` が `[data-testid="blank-view"]` で始まる(隠れたリファクタリング画面を拾わない)
- `nextTourStep(MODE_INTRO_STEPS.quiz, 0, { kind: 'next' })` → 1、最後のステップから → null

`loadModeIntroSeen` / `saveModeIntroSeen`(infrastructure)と `ModeIntroGuide`(表示)はユニットテスト対象外とし、E2Eで守る。

## 受け入れ基準

1. localStorage の `refactor-blocks:mode-intro-seen:quiz` を消して「設計くらべ」を押すと、`mode-intro-guide` の吹き出しに「1/3」と手順1の文言が出て、問題文の枠が明るく囲まれる。「次へ」を2回押すと「3/3」で A/B のボタンが囲まれ、もう一度「次へ」で閉じる。
2. 1のあと「リファクタリング」→「設計くらべ」と開き直しても、ミニガイドは出ない。localStorage の `refactor-blocks:mode-intro-seen:quiz` が `'true'` になっている。
3. localStorage の `refactor-blocks:mode-intro-seen:blank` を消して「白紙設計」を押すと、白紙設計のミニガイドが「1/3」で出る。手順2では部品置き場のあるキャンバスが、手順3では「答え合わせ」ボタンが囲まれる。
4. ミニガイドの表示中に「ガイドを終了」を押す・Esc を押す・別のモードへ切り替える、のどれでも閉じ、同じモードを開き直しても再び出ない。
5. 白紙設計の右パネルに、何も選んでいないとき「部品置き場の部品を、置きたいクラスへドラッグしよう」が出て、「直したいメソッドをクリック」の文言は出ない。リファクタリングの右パネルの空表示は今の文言のまま。
6. チュートリアル1の初回ツアーは今までどおり「1/6」〜「6/6」で表示され、`e2e/first-visit-tour.spec.ts` が変更なしで通る。
7. 1・3・4・5 を `e2e/mode-intro-guides.spec.ts` で確かめる(このspecでは `addInitScript` で該当キーを消す)。
8. `npm run check` と `npm run test:e2e` が通る。

## スコープ外

- 「?」の操作ガイドやボタンからミニガイドをもう一度見る導線
- ミニガイドの見た印を学習記録の書き出し・読み込みに含めること
- A/Bの回答・部品の配置などの操作に合わせてステップを進めること
- 設計くらべの結果まとめ画面・白紙設計の答え合わせ結果パネルへの案内
- リファクタリングモードの初回ツアー(`TOUR_STEPS`)の手順・文言の変更
- 白紙設計の上部パネルのヒント文(`BlankDesignPanel` の「部品をキャンバスの空いている所へドラッグすると…」)の変更
