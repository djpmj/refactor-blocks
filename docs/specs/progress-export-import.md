# progress-export-import: 学習記録(自己ベスト・下書き・設定)をJSONファイルで書き出し・読み込みする

## 背景・目的

学習者としてゲームを実機で遊んでいて、次の不足に気づいた。

- 学習の記録はすべてブラウザの `localStorage` にだけ保存されている。`src` を grep すると、保存しているキーは次の5つだけ。
  | キー | 中身 | 読み書きする関数 |
  | --- | --- | --- |
  | `refactor-blocks:progress` | ステージごとの自己ベスト点数(`Progress`) | `src/infrastructure/progress/progressStorage.ts` の `loadProgress` / `saveProgress` |
  | `refactor-blocks:drafts` | ステージごとの途中の下書き(`Drafts`) | `src/infrastructure/progress/draftStorage.ts` の `loadDrafts` / `saveDrafts` |
  | `refactor-blocks:last-stage` | 最後に遊んだステージID | `src/infrastructure/progress/lastStageStorage.ts` の `loadLastStageId` / `saveLastStageId` |
  | `refactor-blocks:story` | ストーリーのオン/オフ | `src/infrastructure/story/storyPreference.ts` の `loadStoryEnabled` / `saveStoryEnabled` |
  | `refactor-blocks:tour-seen` | 初回ツアーを見たか | `src/infrastructure/tour/tourPreference.ts` の `loadTourSeen` / `saveTourSeen` |
- 実際に今回のセッションでブラウザのサイトデータを消したところ、積み上げた自己ベスト・挑戦中の下書きが全部消え、最初のステージ・初回ツアーからやり直しになった。別のPC・別のブラウザ・プライベートウィンドウで遊んだときも同じく白紙から始まる。
- 何十ステージも続けて学ぶゲームなのに、記録を持ち運ぶ・バックアップする手段がない。

`docs/feature-ideas/IDEAS.md` の「10. ステージのエクスポート/インポートと自作ステージ共有」のうち、まず**自分の学習記録の持ち出しだけ**を作る。
ステージの一覧ダイアログに「学習記録を書き出す」「学習記録を読み込む」を足し、上の5キーを1つのJSONファイル(バージョン番号つき)でやり取りする。
読み込むファイルは外から来る値なので、ponytail の「手を抜かないもの(信頼境界での入力検証・データ消失を防ぐ処理)」に当たる。

本当にサーバー保存やアカウントが要るか → 要らない。持ち運び・バックアップは「ファイルを1つ書き出して、別の環境で読み込む」で足りる。

## 変更対象ファイル一覧

| 種別 | パス | 層 | 役割 |
| --- | --- | --- | --- |
| 変更 | `src/domain/progress/Progress.ts` | domain | `isProgress` を `progressStorage.ts` からここへ移す(application 層から使うため。中身は変えない) |
| 新規 | `src/domain/progress/Progress.test.ts` | domain | `src/infrastructure/progress/progressStorage.test.ts` の `isProgress` のテストをそのまま移す |
| 削除 | `src/infrastructure/progress/progressStorage.test.ts` | infrastructure | 上へ移したので消す(`isProgress` 以外のテストがあれば残す) |
| 変更 | `src/domain/progress/drafts.ts` + `drafts.test.ts` | domain | `draftStorage.ts` の非公開関数 `isDraft` をここへ移して `export` する(中身は変えない)。テストを足す |
| 新規 | `src/application/LearningRecordUseCases.ts` + `.test.ts` | application | `LearningRecord` 型、ファイルの文字列化 `serializeLearningRecord`、検証つきの読み取り `parseLearningRecord`、合成 `combineLearningRecords`(すべて純粋関数・TDD) |
| 変更 | `src/infrastructure/progress/progressStorage.ts` | infrastructure | `isProgress` を domain から import する。`saveProgress` の戻り値を `boolean`(書けたら `true`)にする |
| 変更 | `src/infrastructure/progress/draftStorage.ts` | infrastructure | `isDraft` を domain から import する。`saveDrafts` の戻り値を `boolean` にする |
| 変更 | `src/infrastructure/progress/lastStageStorage.ts` | infrastructure | `saveLastStageId` の戻り値を `boolean` にする |
| 変更 | `src/infrastructure/story/storyPreference.ts` | infrastructure | `saveStoryEnabled` の戻り値を `boolean` にする |
| 変更 | `src/infrastructure/tour/tourPreference.ts` | infrastructure | `saveTourSeen` の戻り値を `boolean` にする |
| 新規 | `src/infrastructure/progress/learningRecordStorage.ts` | infrastructure | `loadLearningRecord()` / `saveLearningRecord(record)`。既存の load/save 関数を束ねるだけ(ユニットテスト対象外) |
| 新規 | `src/presentation/stage/LearningRecordSection.tsx` | presentation | ステージ一覧ダイアログの下部に置く「学習記録の持ち運び」欄(書き出し・読み込み・確認・エラー表示) |
| 変更 | `src/presentation/stage/StageRoadmapDialog.tsx` | presentation | `stage-roadmap__body` の末尾に `<LearningRecordSection />` を置く |
| 変更 | `src/index.css` | presentation | 欄のスタイル(既存の `stage-roadmap__*` に合わせた最小限) |
| 新規 | `e2e/learning-record.spec.ts` | E2E | 書き出し・読み込み(マージ/上書き)・不正ファイル・やめる(下記) |

- `useGameStore.ts` は変更しない(読み込み後はページを読み込み直して、既存の起動処理に復元を任せる。理由は「設計判断」)。
- 既存の save 関数の呼び出し元(`useGameStore.ts`)は戻り値を使わないので、変更は不要。
- 新しい依存は足さない。ファイルの受け渡しは `Blob` + `URL.createObjectURL` + `<a download>` と `<input type="file">` + `File.text()` だけで行う。

## データ・型の変更

### application 層(`src/application/LearningRecordUseCases.ts`)

```ts
import type { Progress } from '../domain/progress/Progress';
import type { Drafts } from '../domain/progress/drafts';
import type { Result } from '../domain/shared/Result';

/** ブラウザに保存している学習記録のすべて。ファイルに書き出す単位。 */
export type LearningRecord = {
  readonly progress: Progress;
  readonly drafts: Drafts;
  /** 最後に遊んだステージID。無ければ null。 */
  readonly lastStageId: string | null;
  readonly storyEnabled: boolean;
  readonly tourSeen: boolean;
};

export type ImportMode = 'merge' | 'overwrite';

export const LEARNING_RECORD_VERSION = 1;
/** 読み込むファイルの文字数の上限(localStorage の容量の目安 約5MB に合わせる)。 */
export const MAX_LEARNING_RECORD_LENGTH = 5_000_000;

export function serializeLearningRecord(record: LearningRecord): string;
export function parseLearningRecord(text: string): Result<LearningRecord, string>;
export function combineLearningRecords(current: LearningRecord, imported: LearningRecord, mode: ImportMode): LearningRecord;
```

### ファイルの形式(バージョン1)

```json
{
  "app": "refactor-blocks",
  "version": 1,
  "progress": { "tutorial-extract-method": 100 },
  "drafts": { "<ステージID>": { "fingerprint": "...", "codebase": { ... } } },
  "lastStageId": "tutorial-extract-method",
  "storyEnabled": true,
  "tourSeen": true
}
```

- `serializeLearningRecord` は上の形を `JSON.stringify(value, null, 2)` で出す(人が開いても読めるように字下げする)。
- 上のキー以外のフィールドがあっても無視する(エラーにしない)。書き出し日時などのメタ情報は持たない(ファイル名に日付が入るので足りる)。

### domain 層

- `src/domain/progress/Progress.ts` に `export function isProgress(value: unknown): value is Progress` を移す(中身は今の `progressStorage.ts` のまま)。
- `src/domain/progress/drafts.ts` に `export function isDraft(value: unknown): value is Draft` を移す(中身は今の `draftStorage.ts` のまま)。

### infrastructure 層(`src/infrastructure/progress/learningRecordStorage.ts`)

```ts
/** 5つのキーをまとめて読む。既存の load 関数を呼ぶだけ(壊れた値は各 load が空・既定値にする)。 */
export function loadLearningRecord(): LearningRecord;
/** 5つのキーをまとめて書く。1つでも書けなかったら false。 */
export function saveLearningRecord(record: LearningRecord): boolean;
```

`saveLearningRecord` の書き込み順と止め方:

1. `saveDrafts(record.drafts)` を**最初に**呼ぶ。いちばん大きく、容量超過で失敗しやすいため。失敗したら残りを書かずに `false` を返す(`localStorage.setItem` は失敗すると元の値を残すので、この時点では何も変わっていない)。
2. `saveProgress` → `saveLastStageId(record.lastStageId ?? '')` → `saveStoryEnabled` → `record.tourSeen` が `true` のときだけ `saveTourSeen()`。どれかが `false` を返したら `false`。
   - `lastStageId` が `null` のときに空文字を書くのは、`loadLastStageId` が空文字を「保存なし」として扱う既存の仕様を使うため(削除用の関数を新設しない)。コードにその旨のコメントを残す。

## 動きの仕様

### 置き場所

ステージ一覧のダイアログ(`StageRoadmapDialog`)の本文の末尾に、セクション「学習記録の持ち運び」を置く(`data-testid="learning-record"`、見出しは `h3`、`aria-labelledby` で見出しと結ぶ)。

- 説明文: 「記録(自己ベスト・挑戦中の下書き・最後に遊んだステージ・設定)は、このブラウザにだけ保存されています。別のPCやブラウザで続けるとき、サイトデータを消す前に書き出しておいてください。」
- ボタン2つ: 「学習記録を書き出す」(`data-testid="learning-record-export"`)、「学習記録を読み込む」(`data-testid="learning-record-import"`)
- ファイル選択用の `<input type="file" accept="application/json,.json" hidden>`(`data-testid="learning-record-file"`)。「学習記録を読み込む」ボタンがこれを `click()` で開く。選んだら `value` を空に戻す(同じファイルを選び直せるように)
- ステージ一覧ボタンは変更依頼の挑戦中は押せない(既存)ので、この欄も挑戦中には出てこない

### 書き出し

1. 「学習記録を書き出す」を押すと、`loadLearningRecord()` で今の記録を読み、`serializeLearningRecord` で文字列にする。
2. `new Blob([text], { type: 'application/json' })` を `URL.createObjectURL` で URL にし、一時的な `<a download="refactor-blocks-learning-record-YYYY-MM-DD.json">` をクリックしてダウンロードさせ、すぐ `URL.revokeObjectURL` する。日付はローカル時刻の年月日。
3. 下書きは編集のたびに、自己ベストは点数が上がるたびに `localStorage` へ書かれているので、`localStorage` から読めば最新になる(ストアから読む必要はない)。

### 読み込み

1. 「学習記録を読み込む」→ ファイルを選ぶ → `file.text()` で読み、`parseLearningRecord` で検証する。
2. **不正なとき**: 何も保存せず、欄の中に理由を `role="alert"` で出す(`data-testid="learning-record-error"`)。メッセージは下の「TDD対象」の表のとおり。`file.text()` 自体が失敗したときは「ファイルを読み込めませんでした」。
3. **正しいとき**: 欄の中に確認パネルを出す(`data-testid="learning-record-confirm"`)。別のモーダルは重ねない。
   - 内容の要約: 「選んだファイル: 点数の記録 N ステージ(うちクリア M)、下書き K 件」(N は `progress` のキー数、M は 100 点の数、K は `drafts` のキー数。表示用の数え上げなので presentation に直接書く)
   - `fieldset`(`legend`「読み込み方」)にラジオボタン2つ:
     - 「マージ: ステージごとに点数が高いほうを残す(おすすめ)」 — **既定で選択**(`data-testid="learning-record-mode-merge"`)
     - 「上書き: このブラウザの記録をファイルの内容に置き換える」(`data-testid="learning-record-mode-overwrite"`)。選んでいるときだけ注意書き「このブラウザの今の記録は消えます。心配なら先に書き出してください。」を出す
   - 「読み込む」(`data-testid="learning-record-apply"`)と「やめる」(`data-testid="learning-record-cancel"`)。補足に「読み込むと画面を読み込み直します。」
   - パネルが出たらフォーカスを既定で選ばれているラジオボタン(マージ)へ移す。「やめる」で閉じたらフォーカスを「学習記録を読み込む」ボタンへ戻す
4. 「読み込む」: `combineLearningRecords(loadLearningRecord(), imported, mode)` を `saveLearningRecord` で保存する。
   - `true` なら `window.location.reload()` で読み込み直す。起動時の既存処理(`initialStage` → `loadLastStageId`、`restoreFirstDraft`、`loadProgress`、`loadStoryEnabled`)がそのまま新しい記録で画面を作る
   - `false` なら読み込み直さず、`role="alert"` で「ブラウザに保存できませんでした。容量が足りないか、保存が許可されていない可能性があります。」を出す
5. 「やめる」: パネルを閉じ、何も保存しない。
6. ダイアログを閉じたときは、確認パネル・エラーの状態を捨てる(`StageRoadmapDialog` は閉じると `null` を返すので、子のステートも消える)。

## TDD対象

すべて `src/application/LearningRecordUseCases.test.ts`(AAAパターン)。domain の移動分は既存テストを移し、`isDraft` のテストを `drafts.test.ts` に足す。

### `parseLearningRecord(text)`(application)

| 入力 | 期待 |
| --- | --- |
| `serializeLearningRecord(r)` の出力(往復) | `ok`、値が `r` と等しい(`toEqual`) |
| progress・drafts が空 `{}`、`lastStageId: null` | `ok` |
| 上のキーに加えて未知のフィールド `"extra": 1` がある | `ok`(無視する) |
| 長さが `MAX_LEARNING_RECORD_LENGTH` を超える文字列 | `err('ファイルが大きすぎます(5MBまで)')`(`JSON.parse` より先に判定) |
| `'{'`(JSONとして壊れている) | `err('JSONとして読めないファイルです')` |
| `'[]'` / `'null'` / `'1'` / `app` が無い / `app` が `"other"` | `err('Refactor Blocks の学習記録ファイルではありません')` |
| `version: 2` | `err('新しいバージョンのゲームで書き出されたファイルです(読み込めるのはバージョン1まで)')` |
| `version` が無い / `"1"`(文字列) / `0` / `1.5` | `err('学習記録ファイルのバージョンが読み取れません')` |
| `progress` が無い / 配列 / 値に `101` / `-1` / `"100"` | `err('自己ベスト点数(progress)の形式が正しくありません')` |
| `drafts` が無い / 配列 / エントリの1つが `{ fingerprint: 1, codebase: ... }` / `codebase` が `isCodebase` を満たさない | `err('途中の下書き(drafts)の形式が正しくありません')`(1件でも不正ならファイル全体を拒否する。`loadDrafts` のように不正エントリだけ捨てることはしない) |
| `lastStageId` が無い / `123` | `err('最後に遊んだステージ(lastStageId)の形式が正しくありません')`(`null` と文字列は可) |
| `storyEnabled` か `tourSeen` が無い / `"true"`(文字列) | `err('設定(storyEnabled・tourSeen)の形式が正しくありません')` |
| `progress` に `"__proto__": 50` のキーがある(`JSON.parse` は自前のプロパティとして作る) | `ok`。返した値の `Object.getPrototypeOf(progress)` が `Object.prototype` のまま(プロトタイプ汚染しない) |

- 検証は既存の `isProgress`・`isDraft`(`isCodebase` を使う)を再利用する。ステージIDが今のステージ一覧に存在するかは**検証しない**(理由は「設計判断」)。
- 1関数60行・複雑度12以下に収まるよう、項目ごとの小さな検査関数に分けてよい。

### `serializeLearningRecord(record)`(application)

- 出力を `JSON.parse` すると `app: 'refactor-blocks'`、`version: 1` と5項目を持つ
- `lastStageId: null` は `null` のまま出る

### `combineLearningRecords(current, imported, mode)`(application)

| ケース | 期待 |
| --- | --- |
| merge: progress が `{a: 40, b: 100}` と `{a: 100, b: 60, c: 20}` | `{a: 100, b: 100, c: 20}`(ステージごとに高いほう。既存の `updateProgress` を畳み込んで使う) |
| merge: 同じステージの下書きが両方にある | `current` の下書きを残す |
| merge: `imported` にだけ下書きがある | 追加される |
| merge: `current.lastStageId` が `'x'`、`imported` が `'y'` | `'x'` |
| merge: `current.lastStageId` が `null`、`imported` が `'y'` | `'y'` |
| merge: `storyEnabled` が `current: false`・`imported: true` | `false`(このブラウザの設定を保つ) |
| overwrite: progress・drafts・lastStageId・storyEnabled | すべて `imported` の値(`current` にだけあるステージの点数・下書きは消える) |
| overwrite / merge 共通: `tourSeen` | `current.tourSeen \|\| imported.tourSeen` |
| 引数を変更しない | `current`・`imported` を `Object.freeze` しても例外にならず、元の値が変わらない |

### `isDraft(value)`(domain、`drafts.test.ts` に追加)

- `{ fingerprint: 'abc', codebase: <正しい Codebase> }` → `true`
- `null` / `{ fingerprint: 'abc' }` / `{ fingerprint: 1, codebase: <正しい Codebase> }` / `{ fingerprint: 'abc', codebase: {} }` → `false`

## 設計判断(確定)

1. **層の分け方**: 検証・合成は application 層の純粋関数にする。application は infrastructure を import できない(依存の向き)ので、型ガード `isProgress`・`isDraft` を domain へ移して共有する。ファイル形式の検証は「1つの操作(記録の取り込み)を組み立てる」ユースケースの入口であり、カバレッジ閾値(`vite.config.ts` は domain/application のみ)の下でTDDしたいため、infrastructure には置かない。`localStorage` に触るのは infrastructure の `learningRecordStorage.ts` だけ。
2. **書き出す範囲は5キー全部(ツアーの完了を含む)**: 不足点の一つが「ツアーも初回から」だったため。`LearningRecord` は保存しているキーの総和なので、将来キーを足したら `version` を上げる。
3. **マージの規則**: 点数は「高いほう」(要求どおり。自己ベストの意味を保つ)。下書きは同じステージに両方あれば**このブラウザの下書きを残す**(いま開いている作業を黙って置き換えて失うのを防ぐ。無いステージだけファイルから足す)。最後のステージ・ストーリー設定もこのブラウザ側を優先する(マージは「足す」操作で、今の環境の好みを変えない)。
4. **ツアー済みは常に OR**: 上書きでも「見た」を「見ていない」には戻さない。一度見た人にツアーを再表示する学習上の利点はなく(操作ガイドからいつでも再生できる)、`saveTourSeen` に消去の口を足さずに済む。
5. **ステージIDの存在は検証しない**: ステージが増減したバージョン間でも記録を移せるようにするため。未知のIDは既存の処理が無害に扱う(`initialStage` は先頭へフォールバック、ロードマップは今あるステージだけを表示、下書きは `takeDraft` の指紋照合で捨てられる)。
6. **不正なファイルは全体を拒否する**: 一部だけ取り込むと、何が入って何が落ちたか学習者に分からないため。理由は日本語で1つ出す。
7. **読み込み後はページを読み込み直す**: ストアは下書きを `createGameStore` のクロージャ(`holder`)に持ち、`autosaveDrafts` が次の編集で今のステージの下書きを上書きするので、ストアを差し替える方式だと取り込んだ下書きを失う恐れがある。`location.reload()` なら既存の起動処理だけで正しく復元でき、ストアの変更が要らない。
8. **書き込み失敗の扱い**: 既存の save 関数は例外を握りつぶすため、戻り値を `boolean` にして失敗を知らせる(呼び出し元の既存コードは戻り値を無視するだけで影響なし)。下書きを最初に書き、失敗したら止めることで「半分だけ書き換わった」状態を作りにくくする。
9. **置き場所はステージ一覧のダイアログ**: 進捗(点数・挑戦中)を一覧で見せている場所で、取り込んだ結果もそこで確かめられるため。ヘッダーにボタンを増やさない。
10. **ファイルの大きさの上限は 5,000,000 文字**: `localStorage` の容量(多くのブラウザで約5MB)を超えるファイルはどのみち保存できないため、`JSON.parse` の前に断る。

## 受け入れ基準

1. ステージ一覧を開くと、末尾に「学習記録の持ち運び」欄と「学習記録を書き出す」「学習記録を読み込む」ボタンがある。
2. いくつかのステージで点数を取り、1つのステージを途中まで操作した状態で「学習記録を書き出す」を押すと、`refactor-blocks-learning-record-YYYY-MM-DD.json` がダウンロードされる。開くと `app: "refactor-blocks"`、`version: 1`、取った点数、途中のステージの下書き、`lastStageId`、`storyEnabled`、`tourSeen` が入っている。
3. サイトデータを消したブラウザ(またはプライベートウィンドウ)で 2. のファイルを読み込み、マージを選んで「読み込む」を押すと、画面が読み込み直され、最後に遊んだステージが開き、途中の下書きから「前回の続きから再開しました」が出る。ステージ一覧には書き出したときの点数・クリア・挑戦中が出ており、初回ツアーは出ない。
4. このブラウザで `チュートリアル1` が40点、ファイルでは100点のとき、マージで読み込むと100点(✅ クリア)になる。逆にこのブラウザが100点・ファイルが40点のときマージでは100点のまま、上書きでは40点になる。
5. 確認パネルではマージが最初から選ばれており、上書きを選んだときだけ「このブラウザの今の記録は消えます」の注意が出る。キーボード(Tab・矢印・Enter/Space)だけで読み方を選んで「読み込む」「やめる」を押せる。
6. 壊れたJSON・別のアプリのJSON・`version: 2`・点数に `101` を含むファイルを選ぶと、それぞれ「TDD対象」の表の日本語の理由が出て、画面は読み込み直されず、`localStorage` の5キーは選ぶ前と同じまま。
7. 確認パネルで「やめる」を押すと、何も変わらず、フォーカスが「学習記録を読み込む」ボタンに戻る。
8. `e2e/learning-record.spec.ts` が、次を Playwright で確かめる。
   - 書き出し: `addInitScript` で `refactor-blocks:progress` に `{"tutorial-extract-method": 100}` を入れ、ダウンロードしたファイルの名前と中身(`app`・`version`・progress)を検証する(`page.waitForEvent('download')`)
   - マージで読み込み: 今40点・ファイル100点 → 読み込み後のステージ一覧の `roadmap-stage-tutorial-extract-method` に「クリア」が出る
   - 上書きで読み込み: 今100点・ファイル40点 → 「40点」が出る
   - 不正なファイル(`version: 2`): `learning-record-error` に理由が出て、`localStorage` の `refactor-blocks:progress` が変わらない
   - 「やめる」: `localStorage` が変わらない
   - ファイルは `setInputFiles` に `{ name, mimeType: 'application/json', buffer }` で渡す(一時ファイルを作らない)
9. `src/application/LearningRecordUseCases.test.ts` と `src/domain/progress/` のテストが「TDD対象」のケースをすべて含み、通る。
10. `npm run check` と `npm run test:e2e` が通る。

## スコープ外

- サーバーへの保存・アカウント・端末間の自動同期
- 自作ステージ・白紙設計モードの構成の書き出し/共有(`IDEAS.md` 10. の残り。`blank-design-mode` 側の機能として別仕様にする)
- 取り消し・やり直しの履歴、ヒントを開いた数、AI講評の結果、変更依頼の途中経過の書き出し(そもそも保存していない。`stage-draft-autosave` でスコープ外にしたものと同じ)
- 下書きの一覧表示・ステージ単位での選択的な取り込み・読み込みの取り消し(Undo)
- 古いバージョンのファイルの変換(バージョン1しか存在しないため。2を作るときに足す)
- 読み込み直したあとの「読み込みました」のお知らせ(確認パネルで「読み込み直します」と伝え、結果はステージ一覧で見える。要望が出たら足す)
- 既存の `loadDrafts` などの「壊れた値は黙って空にする」挙動の変更(`stage-progress-persistence`・`stage-draft-autosave` の範囲)
