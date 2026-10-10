# ストーリーを初回からオンにし、「ストーリー」ボタンを押下中の色にする

## 背景・目的

ストーリー(章の導入・結び、`story-mode.md`)は、オン/オフを `localStorage` の `refactor-blocks:story` に保存し、
保存値が無いときは**オフ**で始まる(`src/infrastructure/story/storyPreference.ts`)。
そのため初めて遊ぶプレイヤーには、チュートリアル1の左サイドバーに「第1章 入社1日目、最初のコード」の導入が出ない。
ヘッダーの「ストーリー」ボタンを押せば出るが、ボタンは `aria-pressed` を持つだけで見た目が変わらず、
オン/オフのどちらなのかも分かりにくい。

初回からストーリーをオンにして導入を見せ、「ストーリー」ボタンはオンの間、押下中の色(アクセント色)で表示する。

## 変更対象ファイル一覧

### 変更

- `src/infrastructure/story/storyPreference.ts`(infrastructure)
  - `loadStoryEnabled()`: **オフ(`'false'`)を保存しているときだけ `false`**。保存値が無い・`localStorage` が読めないときは `true` を返す(例外は投げない)
  - `saveStoryEnabled()` は変えない
- `src/index.css`(presentation のスタイル)
  - ヘッダーのボタンで `aria-pressed="true"` のもの(`.stage-panel > button[aria-pressed="true"]`)に、
    上部のモード切り替え(`.mode-switch button[aria-pressed="true"]`)と同じ `background: var(--accent); border-color: var(--accent); color: #fff;` を当てる
- `e2e/storage-state.json`
  - 既存のE2Eはストーリーが出ない画面を前提にしているので、`refactor-blocks:story` に `"false"` を入れて今の前提を保つ
- `e2e/story-mode.spec.ts`
  - 最初のケースを「初回(保存値なし)はオンで始まり、導入が出て、ボタンが押下中の色になる。オフにすると消え、リロード後もオフのまま」に書き換える
    (テストの中で `refactor-blocks:story` を消してから読み込み直し、初回の状態を作る)
  - ほかのケースは、オフの状態からボタンを押してオンにする今の流れのままでよい

### 新規

- `src/infrastructure/story/storyPreference.test.ts`: `loadStoryEnabled` の単体テスト

## データ・型の変更

なし(`localStorage` のキー・値の形式は変えない。保存値が無いときの解釈だけを変える)。

## TDD対象の純粋関数

`domain`/`application` のロジックは増えない。infrastructure の `loadStoryEnabled` は、先にテストを書いてから変える。

- 保存値が無い → `true`
- `false` を保存している → `false`
- `true` を保存している → `true`

## 受け入れ基準

- `npm run check` と、すべてのE2Eが通る
- `localStorage` に何も無い状態で開くと、ストーリーがオンで、チュートリアル1の左サイドバーに章の導入(`story-intro`)が出る
- ストーリーがオンの間、「ストーリー」ボタンは `aria-pressed="true"` で、背景が `--accent` の色になる。オフにすると通常のボタンの見た目に戻る
- 一度オフにすると、リロード後もオフのまま(保存した好みが優先される)
- 初回ガイドのツアー(`first-visit-tour`)は今どおり出る。ストーリーの導入と同時に出てもよい

## スコープ外

- 初回ガイドとストーリーの導入の順番の制御(片方を閉じてからもう片方を出す、など)
- 章の導入・結びの文言や表示位置の変更
- ヘッダーの他のボタン(「ステージ一覧」など)の見た目の変更
- ボタンのスタイルの共通化(Issue #130 `button-style-base`)
