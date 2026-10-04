# 途中経過の自動保存(リロード・ステージ切り替えで作業を失わない)

## 背景・目的

いまは、ステージの**編集中のコードが保存されない**。保存しているのはステージごとの自己ベスト点数だけ(`stage-progress-persistence` で意図的にスコープ外にした)。
そのため次の操作で、途中まで分けた作業がすべて消える。

- ブラウザのリロード・タブを閉じる・誤操作での戻る
- ステージ選択で別のステージへ切り替える(`selectStageState` が `stage.codebase` で上書きする)

上級ステージは数十手かかるので、作業が消えるのは致命的で、プレイヤーが別ステージを覗くこともためらわせる。
ステージごとに**編集中のコードを `localStorage` へ自動保存**し、戻ったら続きから始められるようにする。
ponytail の「手を抜かないもの(データ消失を防ぐ処理・信頼境界での入力検証)」に当たる。

## 変更対象ファイル一覧

| パス | 層 | 新規/変更 | 役割 |
| --- | --- | --- | --- |
| `src/domain/codebase/isCodebase.ts` + `.test.ts` | domain | 新規 | `isCodebase(value: unknown): value is Codebase`: 外から読んだ値が `Codebase` の形かを調べる純粋関数(TDD、下記) |
| `src/domain/progress/stageFingerprint.ts` + `.test.ts` | domain | 新規 | `stageFingerprint(stage)`: ステージ定義の初期コードから作る短い指紋(下記) |
| `src/domain/progress/drafts.ts` + `.test.ts` | domain | 新規 | `Drafts` 型と、`putDraft` / `takeDraft` の純粋関数(下記) |
| `src/infrastructure/progress/draftStorage.ts` | infrastructure | 新規 | `loadDrafts()` / `saveDrafts(drafts)`。`progressStorage.ts` と同じ作り(例外を投げない・検証する) |
| `src/presentation/store/useGameStore.ts` | presentation | 変更 | 起動時・ステージ切り替え時に下書きを復元、コードが変わるたびに保存、`restoredDraft` の表示用フラグ(下記) |
| `src/presentation/stage/StagePanel.tsx` | presentation | 変更 | 復元したときに「前回の続きから再開しました」を出す(下記) |
| `src/index.css` | presentation | 変更 | 復元のお知らせのスタイル(最小限) |
| `e2e/autosave.spec.ts` | E2E | 新規 | リロード・ステージ切り替えで作業が残る、壊れた保存データでも起動できる(下記) |

`application` 層の変更は無い。`createGameStore` が `loadProgress` / `saveProgress` を直接呼んでいるのと同じ置き方で、`loadDrafts` / `saveDrafts` を呼ぶ。

## 見た目・内容の仕様

### 保存するもの・タイミング

- ステージIDごとに、**採点の対象になっているコード**(`changeSession?.base ?? codebase`)を保存する。変更依頼の実装中の部品置き場つきのコードは保存しない
- 一緒に、そのステージの `stageFingerprint` を保存する
- 保存のタイミングは、ストアの `codebase` か `changeSession` が変わったとき(`store.subscribe` で前の値と比べる)。取り消し・やり直し・「最初に戻す」も含む
- 今のコードが**ステージの初期コードと同じ参照**(`codebase === stage.codebase`)のときは、下書きを**消す**(初期状態を下書きとして持たない)
- 保存しないもの: 取り消し・やり直しの履歴、選択中のメソッド、変更依頼の途中経過・結果、AI講評、ヒントの開いた数(すべてスコープ外)

### 復元するとき

- アプリの起動時(最初のステージ)と、`selectStage` で切り替えたとき、そのステージの下書きを `takeDraft` で取り出す
  - 下書きがあって、**指紋が今のステージ定義と一致**し、`isCodebase` を満たせば、それを `codebase` にする(履歴は空から)
  - 指紋が違う(ステージ定義が更新された)・形が壊れている → 下書きを捨てて初期コードで始める。下書きはストレージからも消す
- 復元したときは `restoredDraft: true` にする。次にコードが変わったら(操作をしたら)`false` に戻す

### 復元のお知らせ(`StagePanel`)

- `restoredDraft` が `true` の間、ツールバー(`ActionToolbar`)の近くに「前回の続きから再開しました」と、「最初に戻す」への案内を出す
  (`data-testid="draft-restored"`、`role="status"`)。ボタンは既存の「最初に戻す」をそのまま使い、新しいボタンは作らない
- エラーではないので、`message`(失敗理由・#57 のトースト)は使わない

### 失敗に強くする

- `localStorage` が使えない(プライベートブラウジング・容量超過)ときは、保存できないだけで遊べる(`saveProgress` と同じく例外を握りつぶす)
- 保存データが壊れていても(JSONでない・形が違う)、例外を投げずに空として扱い、画面を壊さない
- `// ponytail: 全ステージの下書きを1つのキーにJSONで丸ごと書く。1回の書き込みで数十KB程度。ステージが数百になって重くなったら、ステージごとのキーに分ける`

## データ・型の変更

```ts
// src/domain/progress/drafts.ts
export type Draft = { readonly fingerprint: string; readonly codebase: Codebase };
/** ステージID → 下書き。 */
export type Drafts = Readonly<Partial<Record<string, Draft>>>;

/** 下書きを入れた新しい Drafts を返す。codebase が初期コードそのもの(参照が同じ)なら、そのステージの下書きを消す。 */
export function putDraft(drafts: Drafts, stage: Stage, codebase: Codebase): Drafts;

/** そのステージで使える下書きのコードを返す。無い・指紋が違う・形が壊れている(isCodebase でない)なら undefined。 */
export function takeDraft(drafts: Drafts, stage: Stage): Codebase | undefined;
```

```ts
// src/domain/progress/stageFingerprint.ts
/** ステージの初期コードの JSON から作る短い文字列(例: 32bit の FNV-1a を16進で)。同じ定義なら同じ値、1文字でも違えば(ほぼ確実に)違う値。 */
export function stageFingerprint(stage: Pick<Stage, 'codebase'>): string;
```

`// ponytail: 指紋は簡単な32bitハッシュ。暗号的な強さは要らない(偶然の一致で古い下書きが復元されても、形の検証は通っている)。問題が出たら長いハッシュにする`

```ts
// src/infrastructure/progress/draftStorage.ts
const STORAGE_KEY = 'refactor-blocks:drafts';
export function loadDrafts(): Drafts;   // 壊れていれば {}。各エントリの形(fingerprint が文字列、codebase が isCodebase)も検証し、不正なエントリだけ捨てる
export function saveDrafts(drafts: Drafts): void; // 失敗しても例外を投げない
```

`GameState` に `restoredDraft: boolean` を足す。`drafts` 自体はストアの状態に持たない(保存の都度 `putDraft` してストレージへ書くだけ。表示に使わないため)。
起動時に読んだ `Drafts` はストアを作るときの局所変数に持ち、`selectStage` の復元に使う。

## TDD対象の純粋関数

### `isCodebase`

信頼境界の検証。`Codebase.ts` の型の**必須項目**と、任意項目の型を調べる。

1. 正しい `Codebase`(既存の全ステージの `stage.codebase`)は `true`
2. `null`・配列・文字列・`{}`(`files` が無い)は `false`
3. `files` の要素に `id`/`path`/`classes` が無い・型が違う → `false`
4. クラスの `id`/`name`/`methods` が無い・型が違う、`superclassId` が文字列でない、`interfaceIds` が文字列の配列でない、`fields` の要素の形が違う → `false`
5. メソッドの `visibility` が `'public' | 'private' | 'protected'` 以外 → `false`
6. Fragment の `lines` が0以上の整数でない、`responsibility` が文字列でない、`uses`/`reads`/`writes` が文字列の配列でない、`stub`/`accessor` が真偽値でない → `false`
7. 任意項目(`code`・`suggestedName`・`duplicateGroup` など)は、無くても `true`

### `stageFingerprint`

1. 同じステージ定義からは同じ値
2. 初期コードの Fragment の `lines` を1つ変えると違う値
3. 戻り値は空でない文字列

### `putDraft` / `takeDraft`

1. `putDraft` したコードを、同じステージで `takeDraft` すると同じ内容が返る
2. `putDraft` に `stage.codebase` そのものを渡すと、そのステージの下書きが消える(`takeDraft` が `undefined`)
3. 指紋が違う下書き(ステージ定義が変わった)は、`takeDraft` が `undefined`
4. 形が壊れた下書き(`isCodebase` でない)は、`takeDraft` が `undefined`
5. 別のステージの下書きには影響しない
6. 元の `Drafts` を変更しない(新しいオブジェクトを返す)

## 受け入れ基準

- `npm run check` が通る
- `npm run test:e2e` が通る(Playwright はテストごとに新しいブラウザコンテキスト=空の `localStorage` で始まるので、既存のE2Eは影響を受けない)
- ステージでメソッドを移したあとリロードすると、移したあとの状態から再開し、「前回の続きから再開しました」が出る
- ステージAで作業 → ステージBへ切り替え → ステージAへ戻ると、Aの作業が残っている。Bは初期状態(またはBの下書き)で始まる
- 「最初に戻す」を押してからリロードすると、初期状態で始まり、お知らせは出ない
- 復元したあとに操作をすると、お知らせが消える
- 変更依頼の実装中にリロードすると、挑戦前のコード(部品置き場なし)で再開する
- `localStorage` の `refactor-blocks:drafts` に壊れた値(JSONでない文字列・形の違うオブジェクト)を入れて起動しても、エラーにならず初期状態で始まる
- ステージ定義が変わった(指紋が違う)下書きは使われず、初期状態で始まる
- 自己ベスト点数の保存(`refactor-blocks:progress`)の挙動は変わらない
- `localStorage` に書き込めない環境でも遊べる

## スコープ外

- 取り消し・やり直しの履歴の保存(リロード後は履歴が空から始まる)
- 変更依頼の途中経過・結果、AI講評、ヒントの開いた数、キャンバスのズーム・ファイルの位置の保存
- 白紙設計モード・設計くらべクイズの保存
- 複数の端末間での同期・サーバー保存
- 下書きの一覧・手動での保存/読み込み・エクスポート(`isCodebase` はエクスポート/インポートを作るときに再利用できる)
- 下書きの容量上限の管理
