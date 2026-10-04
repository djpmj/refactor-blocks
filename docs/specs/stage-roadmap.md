# 学習ロードマップ(ステージ一覧のダイアログ)

> **前提**: `stage-draft-autosave`(途中経過の自動保存)のマージ後に実装する。「挑戦中」の表示に、その仕様の下書き(`Drafts`)を使う。

## 背景・目的

いまのステージ選択は、ヘッダーのドロップダウン(`StageSelect`)1つだけ。20ステージについて次のことが一目で分からない。

- どの順に進めればよいか、次にどれをやるべきか
- そのステージで**何が身につくのか**(Extract Method・Feature Envy・Strategy など)
- どこまでクリアしたか(✅ は 100点のステージにしか付かず、途中の点数・挑戦中かは見えない)

ドロップダウンはそのまま残し、ヘッダーに「ステージ一覧」ボタンを足す。開くと、レベルごとにステージのカードを並べ、学べること・自己ベスト・状態・次のおすすめを見せる。
カードを選ぶとそのステージへ移る。プレイヤーが「今どこにいて、次に何を学ぶか」を把握できるようにする。

## 変更対象ファイル一覧

| パス | 層 | 新規/変更 | 役割 |
| --- | --- | --- | --- |
| `src/domain/stage/Stage.ts` | domain | 変更 | `learns: readonly string[]`(必須。そのステージで身につく考え方・操作の短い名前、1〜3個)を追加 |
| `src/domain/progress/roadmap.ts` + `.test.ts` | domain | 新規 | `stageStatus` と `recommendNextStage`(TDD、下記) |
| `src/infrastructure/stages/*Stages.ts` | infrastructure | 変更 | 全ステージに `learns` を足す(下記) |
| `src/infrastructure/stages/stageCatalog.test.ts` | infrastructure | 変更 | 全ステージに `learns` があること |
| `src/presentation/stage/StageRoadmapDialog.tsx` | presentation | 新規 | ステージ一覧のダイアログ(ネイティブ `<dialog>`。`CodebasePreviewDialog` と同じ作り) |
| `src/presentation/stage/StagePanel.tsx` | presentation | 変更 | ヘッダーの `StageSelect` の隣に「ステージ一覧」ボタンを足す。`LEVEL_LABEL` をダイアログと共有する |
| `src/presentation/store/useGameStore.ts` | presentation | 変更 | ダイアログが「挑戦中」を出せるよう、下書きのあるステージIDの一覧(`draftStageIds: readonly string[]`)を状態に持つ(下記) |
| `src/index.css` | presentation | 変更 | `.stage-roadmap` のスタイル |
| `e2e/roadmap.spec.ts` | E2E | 新規 | 開いて、カードを選ぶとそのステージへ移る(下記) |

`application` 層の変更は無い。

## 見た目・内容の仕様

### 開き方・閉じ方

- ヘッダーの `StageSelect`(ドロップダウン)の隣に `ステージ一覧` ボタン(`data-testid="roadmap-open"`)。ドロップダウンは**残す**(既存のE2Eが `getByLabel('ステージ')` で使っている)
- 変更依頼の調査・実装中(`changeSession !== null`)はボタンを `disabled` にする(ステージ切り替えで作業中の依頼が消えるため)
- ダイアログはネイティブ `<dialog>` の `showModal()`。`✕` ボタンと Esc で閉じる。閉じたらボタンにフォーカスが戻る
- 起動時に自動では開かない(スコープ外)

### 中身

- タイトル `ステージ一覧`。その下に「次のおすすめ: <ステージ名>」(`recommendNextStage`。全部クリアしていれば「全ステージをクリアしました」)
- レベル(チュートリアル・初級・中級・上級)ごとに見出しを付け、`stages` の順にカードを並べる
- カード(`<button>`、`data-testid="roadmap-stage-<stage.id>"`)の中身:
  - ステージ名(`stage.title`)
  - 学べること: `learns` を小さなタグで並べる
  - 状態: `stageStatus` の結果を文字で出す — `未挑戦` / `挑戦中` / `<自己ベスト>点` / `✅ クリア`
  - 今いるステージには `aria-current="true"` と、見た目の印(太い枠)
  - 次のおすすめのステージには「おすすめ」の印(文字でも出す。色だけに頼らない)
- カードを押すと `selectStage(stage.id)` して、ダイアログを閉じる。今いるステージを押したときは、閉じるだけ(作業を消さない)
- 狭い画面ではカードを1列にし、ダイアログ内でスクロールする(ページ全体は動かさない)
- カードはキーボード(Tab・Enter/Space)で選べる

### `learns` の書き方(全ステージ)

- 1〜3個。名詞の短い言葉(10文字程度まで)で、そのステージで**初めて**、または**主に**練習するもの
- 操作名(`Extract Method`・`Move Method`・`Merge Methods`・`継承`・`implements`)と、考え方・設計の名前(`責務の分離`・`循環依存`・`Feature Envy`・
  `Strategy`・`Factory`・`Template Method`・`ISP`・`Value Object`・`カプセル化` など)を使う
- ステージの課題文・`description` と矛盾させない。解き方の手順(ヒントの領分)は書かない

## データ・型の変更

```ts
// src/domain/stage/Stage.ts
export type Stage = {
  // …既存
  /** ステージ一覧に出す「学べること」。1〜3個の短い名前。 */
  readonly learns: readonly string[];
};
```

```ts
// src/domain/progress/roadmap.ts
export type StageStatus =
  | { readonly kind: 'not-started' }
  | { readonly kind: 'in-progress' }                 // 下書きがあり、自己ベストの記録が無い
  | { readonly kind: 'scored'; readonly best: number } // 自己ベストが 100 未満(下書きの有無は問わない)
  | { readonly kind: 'cleared' };                    // 自己ベストが 100

export function stageStatus(stageId: string, progress: Progress, hasDraft: boolean): StageStatus;

/** 並び順で最初の、クリアしていない(自己ベストが100でない)ステージ。全部クリアしていれば undefined。 */
export function recommendNextStage(stages: readonly Stage[], progress: Progress): Stage | undefined;
```

`useGameStore` に `draftStageIds: readonly string[]` を足す(`stage-draft-autosave` で下書きを保存・削除するときに、同じ処理で更新する)。
`Drafts` そのものは持たない(コードを丸ごと状態に持つ必要は無い)。

自己ベストの記録は、ステージを開いた時点で初期コードの点数(0点より上のことが多い)が `recordProgress` で入る。
そのため「開いただけ」でも `scored` になる。開いただけのものを `未挑戦` に見せたい場合は、`stageStatus` の分岐の順で `hasDraft === false` かつ
自己ベスト = 初期コードの点数 なら `not-started` とする — **これは採らない**(初期点の計算を一覧のために全ステージぶん回したくない。開いたら記録が付くのは今の仕様どおり)。
`// ponytail: 開いただけのステージも点数が付いて見える。気になるとプレイで分かったら、初期点と同じなら「未挑戦」にする`

## TDD対象の純粋関数

### `stageStatus`

1. 自己ベストが無く、下書きも無い → `not-started`
2. 自己ベストが無く、下書きがある → `in-progress`
3. 自己ベストが 100 未満 → `scored`(`best` にその点。下書きの有無は問わない)
4. 自己ベストが 100 → `cleared`(下書きがあっても `cleared`)

### `recommendNextStage`

1. 記録が空 → 先頭のステージ
2. 先頭から2つが100点、3つ目が60点 → 3つ目
3. 先頭が未記録、2つ目が100点 → 先頭(並び順で最初のクリアしていないもの)
4. 全ステージが100点 → `undefined`
5. `stages` が空 → `undefined`

### ステージカタログ(`stageCatalog.test.ts`)

全ステージについて、`learns` が1〜3個で、どれも前後の空白を除いて空でない。

## 受け入れ基準

- `npm run check` が通る
- `npm run test:e2e` が通る(ヘッダーのドロップダウンを使う既存のE2Eが変わらず通る)
- ヘッダーの「ステージ一覧」を押すと、レベルごとに全ステージのカードが並び、各カードに学べることと状態が出る
- 100点のステージは `✅ クリア`、途中のステージは `<自己ベスト>点`、下書きだけあって記録の無いステージは `挑戦中`、未記録は `未挑戦` と出る
- 「次のおすすめ」が、並び順で最初のクリアしていないステージを指す。全部クリアすると「全ステージをクリアしました」
- カードを押すと、そのステージへ移ってダイアログが閉じる。下書きがあれば続きから始まる(`stage-draft-autosave`)
- 今いるステージのカードを押しても、作業は消えずダイアログが閉じるだけ
- 変更依頼の調査・実装中は「ステージ一覧」ボタンが押せない
- Esc・`✕` で閉じられ、キーボードだけでカードを選べる
- 全20ステージ(以降に追加されたものも)に `learns` がある

## スコープ外

- 初回起動時に自動で開くこと・オンボーディング
- ステージの解放条件(前のステージをクリアしないと選べない、など)。今までどおり全ステージを選べる
- 学べることのタグからの絞り込み・検索・用語集へのリンク
- ステージごとの所要時間・難易度の星
- 弱点(よく減点されるルール)に基づくおすすめ
- 白紙設計モード・設計くらべクイズの一覧
- ヘッダーのドロップダウンの削除・置き換え
