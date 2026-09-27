# 仕様草案: ステージの途中経過を残し、切り替え・リロード後に続きから再開できるようにする

- slug: `stage-draft-persistence`
- 元になった探索: `docs/pipeline/stage-draft-persistence/01-discovered.md`

## 1. 背景・目的

- 今のリファクタリング画面では、途中まで進めた作業が次の2つの操作で黙って消える。
  1. **ステージの切り替え**: `useGameStore.ts` の `selectStageState` が `codebase: stage.codebase`・`history: emptyHistory()` を入れるため、
     別のステージを見てから戻ると最初からやり直しになる(取り消しでも戻せない)
  2. **リロード・タブを閉じる**: 保存しているのは自己ベストスコア(`progressStorage.ts`)だけで、編集中のコードベースはメモリ上にしか無い
- 上級ステージは数十手を重ねる題材で、1回のプレイが長い。CLAUDE.md の ponytail でも「データ消失を防ぐエラー処理」は
  手を抜かないものに挙がっている。
- **既存仕様との関係**: `docs/specs/stage-progress-persistence.md` は「編集中のコードベースそのもの(Undo/Redo履歴・現在の途中経過)は
  保存しない(YAGNI)」とスコープ外にしていた。この仕様はその「現在の途中経過」の部分だけを引き取る続きで、
  自己ベストスコアの保存(`refactor-blocks:progress`)には手を入れない。Undo/Redo履歴は引き続き保存しない(未決事項2)。

**本当に新しい仕組みが要るか**: 保存の書き方は `progressStorage.ts`(try/catch で握りつぶし、読み込みは形を検証して壊れていれば空)、
計算の置き場は `domain/progress/updateProgress.ts`(同じ参照を返して無駄な保存を避ける)がそのまま前例になる。
新しく要るのは「ステージごとの途中のコードベースを覚えて・引き出す純粋関数」と「localStorage から読んだ `Codebase` の形の検証」
(`isCodebase` 相当はリポジトリにまだ無い)の2つだけ。ストアの各操作(20以上)には手を入れず、Zustand の `subscribe` 1か所で記録する。

**1回のPRに収まるか**: 収まる見込み(未決事項1)。メモリ上の保持だけなら domain の純粋関数+ストアの数十行、
localStorage まで入れても増えるのは infrastructure の検証(〜80行)と読み書き(〜25行)程度。

## 2. 変更対象ファイル一覧

| 種別 | パス | 層 | 役割 |
| --- | --- | --- | --- |
| 新規 | `src/domain/progress/stageDrafts.ts` | domain | 型 `StageDraft`/`StageDrafts`/`Resumed` と、純粋関数 `recordDraft`・`resumeStage` |
| 新規 | `src/domain/progress/stageDrafts.test.ts` | domain | 上記のテスト(先に書く) |
| 新規 | `src/infrastructure/progress/draftStorage.ts` | infrastructure | `isCodebase`・`parseStageDrafts`(信頼境界の検証)と `loadDrafts`/`saveDrafts`(localStorage の読み書き) |
| 新規 | `src/infrastructure/progress/draftStorage.test.ts` | infrastructure | `isCodebase`・`parseStageDrafts` のテスト(`progressStorage.test.ts` と同じく、検証部分だけ。先に書く) |
| 変更 | `src/presentation/store/useGameStore.ts` | presentation | `createGameStore` に `keepDrafts` オプション、状態 `drafts`、`selectStageState` での再開、`subscribe` での記録 |
| 変更 | `e2e/refactor.spec.ts` | (E2E) | 切り替え・リロード・最初に戻す・古い途中経過・壊れた保存値のテストを追加 |
| 変更 | `docs/specs/stage-progress-persistence.md` | (docs) | スコープの「現在の途中経過は保存しない」の行に「→ `stage-draft-persistence.md` で対応」と1行追記するだけ(最終仕様化の時点で) |

変更しないもの: `BlankDesignView.tsx`(`createGameStore(blankDesignProblems)` のまま。オプション省略で途中経過は無効)、
`StagePanel.tsx`(`recordProgress` の effect はそのまま)、`domain/codebase/` のリファクタリング操作・`history.ts`・採点、
ステージ定義(`src/infrastructure/stages/*.ts`)、`application` 層。

## 3. データ/型の変更

ドメインモデル(`Codebase` 以下)・`Stage` 型の変更は無し。永続化に新しいキーを1つ足す。

```ts
// src/domain/progress/stageDrafts.ts
import type { Codebase } from '../codebase/Codebase';
import type { Stage } from '../stage/Stage';

/** 1ステージの途中経過。origin は記録した時点のステージ定義の初期コード(stage.codebase を JSON.stringify したもの)。 */
export type StageDraft = {
  readonly origin: string;
  readonly codebase: Codebase;
};

/** ステージID → 途中経過。初期状態のままのステージはキーを持たない。 */
export type StageDrafts = Readonly<Partial<Record<string, StageDraft>>>;

/** ステージを開くときに使うコードと、その出どころ。 */
export type Resumed = {
  readonly codebase: Codebase;
  /** initial: 途中経過なし / resumed: 途中経過から再開 / outdated: 途中経過はあったがステージ定義が変わったので捨てた */
  readonly status: 'initial' | 'resumed' | 'outdated';
};

export function recordDraft(drafts: StageDrafts, stage: Stage, codebase: Codebase): StageDrafts;
export function resumeStage(drafts: StageDrafts, stage: Stage): Resumed;
```

### 保存形式(localStorage)

- キー: `refactor-blocks:drafts`(`refactor-blocks:progress` と別キー。自己ベストの読み書きに影響させない)
- 値: `StageDrafts` をそのまま `JSON.stringify` したもの。例:
  `{"tutorial-2":{"origin":"{\"files\":[...]}","codebase":{"files":[...]}}}`
- 保存するのは**挑戦前のコード**(`changeSession?.base ?? codebase`)。変更依頼の実装中の部品置き場入りのコード・
  `changeSession`・`lastChangeReport`・講評・選択中のメソッド・Undo/Redo履歴は保存しない。

### ステージ定義が変わったときの判定(未決事項3の推奨案)

記録時に `origin = JSON.stringify(stage.codebase)` を一緒に持ち、再開時に今の `JSON.stringify(stage.codebase)` と文字列比較する。
一致しなければ「古い途中経過」として捨て、初期状態から始める。
他パイプライン(`template-method-stage`・`inline-method-stage`・`utils-class-split-stage` など)がステージの初期コードを
変えると、そのステージの途中経過だけが捨てられる。`limits`・`goal`・`changeRequests` だけの変更では捨てない(途中のコードはそのまま使えるため)。

- 本当にハッシュが要るか: 要らない。ステージの初期コードは数KBで、文字列比較で足りる。同期で使える標準のハッシュ関数も無い
  (`crypto.subtle.digest` は非同期)。localStorage の上限(5MB前後)に対し、全ステージ分を2倍で持っても数百KBに収まる
- キーの並び順だけが変わっても「変わった」と判定される(安全側に倒れる)。ステージ定義はリテラルなので実害は無い

## 4. ストアの変更(`src/presentation/store/useGameStore.ts`)

```ts
type GameState = {
  // ...既存
  drafts: StageDrafts;
};

type GameStoreOptions = {
  /** ステージごとの途中経過を覚えて、切り替え・リロード後に続きから始めるか。リファクタリング画面のストアだけ true。 */
  readonly keepDrafts: boolean;
};

export function createGameStore(allStages: readonly Stage[], options: GameStoreOptions = { keepDrafts: false }): GameStore;

// 既定のストア(リファクタリング画面)
export const GameStoreContext: Context<GameStore> = createContext(createGameStore(stages, { keepDrafts: true }));
```

- **初期状態**: `drafts` は `keepDrafts ? loadDrafts() : {}`。最初のステージのコードは `resumeStage(drafts, firstStage)` の結果を使い、
  `status === 'outdated'` なら `message` に下記の文言を入れる(未決事項4)。
- **`selectStageState(allStages, stageId, drafts)`**: 引数に `drafts` を足し、`codebase: stage.codebase` を `resumeStage(drafts, stage).codebase` に置き換える。
  `history: emptyHistory()`・`changeSession: null`・`lastChangeReport: null`・`critique: EMPTY_CRITIQUE`・`selectedMethodId: null` は今までどおり空にする(未決事項2の推奨案)。
  `message` は `outdated` のとき下記の文言、それ以外は `null`。
- **記録(`subscribe`)**: `keepDrafts` のときだけ、`createStore` の直後に `store.subscribe` で状態の変化を拾い、
  `recordDraft(state.drafts, state.stage, state.changeSession?.base ?? state.codebase)` の参照が変わったときだけ
  `saveDrafts(next)` して `store.setState({ drafts: next })` する。
  - 各操作(`apply`・`travelTo`・`finishImplementation`・`endChangeRequests`・`resetStage`・`selectStage`)に手を入れずに済む
  - `setState` で `subscribe` がもう1回呼ばれるが、`recordDraft` が同じ参照を返すので止まる
  - `StagePanel` の effect に置く案(`recordProgress` と同じ形)より、切り替え直前の記録が effect の実行タイミングに左右されない
  - `createGameStore` は1関数60行の上限に近いので、購読は `keepDraftsIn(store)` のような小さい関数に分ける
- **「最初に戻す」との関係**: `resetStage` は `stage.codebase` と**同じ参照**を `commit` するので、`recordDraft` がそのステージのキーを消し、
  そのまま保存される(=リロードしても初期状態)。取り消しで戻せば再び記録される。専用の処理は足さない。
- **変更依頼の実装中**: `changeSession.base` は挑戦中は変わらないので記録も起きない。実装中に切り替え・リロードすると、
  挑戦前のコードから(変更依頼に挑戦していない状態で)再開する。
- **白紙設計のストア**: `createGameStore(blankDesignProblems)` のまま(`keepDrafts: false`)。`drafts` は `{}` で購読もしないので、
  問題の切り替えは今までどおり初期状態へ戻る(`blank-design-second-problem` の前提を崩さない)。localStorage にも書かない。

古い途中経過を捨てたときの文言(未決事項4で「知らせる」を選んだ場合):
`ステージの内容が更新されたため、保存していた途中経過を破棄して最初から始めます`
(既存の `message` 表示 = `MethodEditor` の `role="alert"` にそのまま出る。次の操作で消える)

## 5. TDD対象の純粋関数

### `recordDraft(drafts, stage, codebase)`(`src/domain/progress/stageDrafts.test.ts`)

| ケース | 期待 |
| --- | --- |
| 記録が無いステージで、`codebase` が `stage.codebase` と別の参照 | そのステージIDに `{ origin: JSON.stringify(stage.codebase), codebase }` を足した新しい `StageDrafts`。他のステージのキーは残る |
| 記録があり、違うコードを渡す | 上書きした新しい `StageDrafts` |
| 記録されているコードと同じ参照を渡す | **同じオブジェクト参照**を返す(無駄な保存を避ける) |
| `codebase === stage.codebase`(最初に戻した・取り消しで初期状態に戻った)で記録がある | そのキーを消した新しい `StageDrafts`。他のキーは残る |
| `codebase === stage.codebase` で記録も無い | **同じオブジェクト参照** |
| 元の `drafts` を変更しない | 呼び出し後も引数の `drafts` は元のまま |

### `resumeStage(drafts, stage)`

| ケース | 期待 |
| --- | --- |
| 記録が無い | `{ codebase: stage.codebase(同じ参照), status: 'initial' }` |
| 記録があり、`origin` が今の `JSON.stringify(stage.codebase)` と一致 | `{ codebase: 記録のコード, status: 'resumed' }` |
| 記録があり、`origin` が一致しない(ステージ定義が変わった) | `{ codebase: stage.codebase, status: 'outdated' }` |
| 別のステージIDの記録しか無い | `status: 'initial'` |

### `isCodebase(value)` / `parseStageDrafts(value)`(`src/infrastructure/progress/draftStorage.test.ts`)

信頼境界の検証。`progressStorage.test.ts` の `isProgress` と同じく、純粋な部分だけテストを先に書く。
`isRecord` は `critiqueClient.ts` の非公開関数なので、同じ3行をこのファイルに置く(infrastructure 同士の不要な依存を作らない)。
複雑度12以下に収めるため、`isFragment`・`isMethod`・`isField`・`isCodeClass`・`isCodeFile` と、省略可能項目用の
`isOptionalString`・`isOptionalStringArray`・`isOptionalBoolean` に分ける。

`isCodebase`:

| ケース | 期待 |
| --- | --- |
| ステージ定義の `codebase`(実物を1つ使う。省略可能項目を多く含む上級ステージが望ましい)を `JSON.parse(JSON.stringify(...))` したもの | true |
| `{ files: [] }` | true |
| `files` が配列でない・無い | false |
| Fragment の `lines` が数値でない、`id`/`label`/`responsibility` が文字列でない | false |
| Method の `visibility` が `'public' \| 'private' \| 'protected'` 以外 | false |
| 省略可能項目の型が違う(`uses` が文字列、`stub` が文字列、`interfaceIds` に数値、`fields` の要素の `visibility` 不正 など、各1例) | false |
| null・配列・プリミティブ | false |

`parseStageDrafts(value: unknown): StageDrafts`:

| ケース | 期待 |
| --- | --- |
| 全エントリが `{ origin: string, codebase: Codebase }` | 同じ内容を返す |
| 一部のエントリだけ壊れている | **壊れたエントリだけ捨て**、他のステージの途中経過は残す(1件の破損で全ステージ分を失わない) |
| null・配列・プリミティブ | `{}` |

`loadDrafts()`/`saveDrafts()` は `loadProgress`/`saveProgress` と同じ形(キーが無い・JSONパース失敗・`localStorage` が使えないときは `{}`、
保存は `try/catch` で握りつぶす)。I/Oなのでユニットテスト対象外。

## 6. 受け入れ基準

- `npm run check`(lint + typecheck + test)が通る。`domain` のカバレッジ閾値を下回らない
- `stageDrafts.test.ts`・`draftStorage.test.ts` が AAA パターンで書かれ、上記ケースを満たす(実装より先にコミット、または同じコミットでテストが先に書かれている)
- `npm run test:e2e` が通り、`e2e/refactor.spec.ts` に次のテストが追加されている
  1. チュートリアル2でメソッドを抽出 → 中級1へ切り替え → チュートリアル2へ戻すと、抽出したメソッドが残っている(「元に戻す」は無効)
  2. チュートリアル2でメソッドを抽出 → `page.reload()` → チュートリアル2を選ぶ(未決事項6で「最後のステージを開く」を選んだ場合は選ばずに)と、抽出したメソッドが残っている
  3. 抽出 → 「最初に戻す」 → リロード → チュートリアル2は初期状態(抽出したメソッドが無い)
  4. `page.addInitScript` で `refactor-blocks:drafts` に `origin` が今の定義と合わない途中経過を入れておくと、そのステージは初期状態で開き、(未決事項4で知らせる場合)上記の文言が `role="alert"` に出る
  5. `page.addInitScript` で `refactor-blocks:drafts` に壊れたJSON(例: `'{'`)を入れておいても、画面が表示され最初のステージが初期状態で遊べる
- 変更依頼の実装中に別ステージへ切り替えて戻ると、変更依頼に挑戦していない状態で、挑戦前のコードから再開する(コードレビューまたは手動確認)
- 白紙設計のストアは `keepDrafts` を渡しておらず、localStorage の `refactor-blocks:drafts` に白紙設計の問題IDが書かれない(コードレビューで確認)
- 既存の自己ベスト(`refactor-blocks:progress`)・✅ 表示の挙動が変わらない
- 新しい依存を足していない

## 7. スコープ外

- **Undo/Redo履歴の保存・保持**(リロード後もステージ切り替え後も、再開した時点から取り消し履歴は空。`history.ts` の
  「ステージを切り替えれば空になる」という ponytail コメントの前提もそのまま)。要るのは「続きから」であって「取り消しの続き」ではない
- 変更依頼の実装中の状態(`changeSession`)・直前の変更依頼の結果(`lastChangeReport`)・AI講評・選択中のメソッド・キャンバスの位置/ズームの保存
- 白紙設計・設計くらべクイズの途中経過
- ステージ定義が変わったときに古い途中経過を新しい定義へ移し替える(マイグレーション)。捨てて初期状態から始めるだけ
- 途中経過の中身の整合性の検証(`uses` が存在するメソッドを指すか、IDの重複が無いか)。形だけ検証する。
  存在しないIDは既存のドメイン関数が `find` で飛ばすので画面は壊れない
- 使われなくなったステージID(カタログから消えたステージ)の途中経過の掃除
  → `// ponytail: 消えたステージの途中経過は残り続ける。ステージを大きく入れ替えるときに loadDrafts で allStages にないキーを捨てる` を残す
- 保存容量超過(`QuotaExceededError`)をプレイヤーに知らせる → 握りつぶすだけ。`saveDrafts` に ponytail コメントを残す
- 複数タブ間の同期(`storage` イベント)。最後に書いたタブが勝つ
- 「続きから / 最初から」を選ばせるダイアログ(「最初に戻す」ボタンで足りる)

## 8. 未決事項

### 未決事項1: このPRでどこまでやるか

- 選択肢A(推奨): メモリ上の保持と localStorage への保存を1回でやる。増えるのは形の検証と読み書きで、1PRに収まる見込み
- 選択肢B: まずメモリ上の保持(ステージ切り替えで消えない)だけにし、localStorage への保存は別パイプラインに回す。
  このPRでは `draftStorage.ts` を作らず、受け入れ基準のE2Eは1だけにする

### 未決事項2: ステージを切り替えて戻ったとき、取り消し(Undo/Redo)履歴も残すか

- 選択肢A(推奨): コードベースだけ残し、履歴は空から始める。リロード後と挙動がそろい、保存するものも増えない
- 選択肢B: メモリ上ではステージごとに履歴も残す(リロードでは消える)。切り替えただけなら取り消しで戻れるが、
  切り替えとリロードで挙動が違い、`drafts` に履歴も持たせる分だけ型と処理が増える

### 未決事項3: ステージ定義が更新されて保存済みの途中経過が古くなったことを、どう判定するか

- 選択肢A(推奨): 記録時のステージの初期コード(`JSON.stringify(stage.codebase)`)を一緒に保存し、再開時に今の定義と文字列比較する。
  ステージ作者は何もしなくてよい。ラベルの誤字修正でもそのステージの途中経過は捨てられる
- 選択肢B: `Stage` に手書きの版番号(例: `draftVersion`)を足し、初期コードを変えたときだけ作者が上げる。
  誤字修正では捨てずに済むが、上げ忘れると古い途中経過がそのまま復元される(Fragment のIDずれなど)。`Stage` 型と全ステージ定義を触る
- 選択肢C: 判定しない。古い途中経過もそのまま復元する(形の検証だけ)。一番短いが、ステージを直しても遊ぶ人の画面に反映されない

### 未決事項4: 古い途中経過を捨てたとき、プレイヤーに知らせるか

- 選択肢A(推奨): 既存の `message`(メソッドエディタの `role="alert"`)に「ステージの内容が更新されたため、保存していた途中経過を破棄して最初から始めます」と出す。
  黙って消えると「消えた」と感じて離脱しやすい。追加は文言1つ
- 選択肢B: 知らせず、黙って初期状態から始める

### 未決事項5: 途中経過から再開したことを画面で知らせるか

- 選択肢A(推奨): 知らせない。キャンバスを見れば続きだと分かり、やり直したければ「最初に戻す」がある。`message` は操作エラーの表示に使っているので混ぜない
- 選択肢B: `message` に「前回の途中経過から再開しました(「最初に戻す」でやり直せます)」と出す

### 未決事項6: リロードしたとき、最後に開いていたステージを開くか

- 選択肢A(推奨): 開かない。今までどおり最初のステージで開き、ステージ選択で選び直すと続きから始まる。保存するものが増えない
- 選択肢B: 最後に開いていたステージIDも保存(例: キー `refactor-blocks:last-stage`)し、リロード後はそのステージを続きから開く。
  「続きから再開」の体験としては自然だが、保存キーと検証(カタログにないIDなら最初のステージ)が1つ増える
