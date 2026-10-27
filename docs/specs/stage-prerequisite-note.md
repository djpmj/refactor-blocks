# stage-prerequisite-note: 前提のステージを飛ばして開いたとき、課題パネルで先にやるステージを案内する

## 背景・目的

実機での確認: ステージ一覧から、どれにも挑戦していないまま「中級1: 循環依存を断ち切る」を開くと、
メソッドの移動・責務・循環の知識が要る課題がそのまま始まる(クリア条件6項目のうち3/6を達成済みの状態)。
画面のどこにも「先に何をやっておくと楽か」が書かれていない。
ステージ一覧には「次のおすすめ」(`recommendNextStage`)があるが、それを飛ばして開いた学習者には何の案内も出ない。

前提のステージがクリアされていないステージを開いたとき、課題パネルの先頭に「先に○○をやると分かりやすい」を短く出し、
ワンクリックでそのステージへ移れるようにする。

## 変更対象ファイル一覧

| 種別 | パス | 層 | 役割 |
| --- | --- | --- | --- |
| 変更 | `src/domain/progress/roadmap.ts` | domain | `unclearedPrerequisites` を追加する |
| 変更 | `src/domain/progress/roadmap.test.ts` | domain | `unclearedPrerequisites` のテスト(先に書く) |
| 新規 | `src/presentation/stage/PrerequisiteNote.tsx` | presentation | 課題パネルに出す案内と「開く」ボタン |
| 変更 | `src/presentation/stage/StagePanel.tsx` | presentation | `StageSidebar` の `StoryIntro` の直後に `PrerequisiteNote` を置く |
| 新規 | `e2e/prerequisite-note.spec.ts` | E2E | 案内の表示・ワンクリックでの移動・クリア後に消えること |

application・infrastructure は変更しない(ステージ定義のデータにも手を入れない)。新しい依存は足さない。
CSS は既存のクラス(`story-card` など)で足りなければ、`src/` の既存スタイルシートに数行足すだけにする。

## データ・型の変更

`Stage` 型・保存形式は変えない。前提のステージは、すでにある `Stage.learns`(ステージ一覧の「学べること」)から導く。

```ts
// src/domain/progress/roadmap.ts
export type Prerequisite = {
  /** 先にやるとよいステージ。 */
  readonly stage: Stage;
  /** そのステージで先に学べる、今のステージの learns(今のステージの learns の並び順)。 */
  readonly concepts: readonly string[];
};

/**
 * 今のステージの learns のそれぞれについて、stages の並び順で今のステージより前にあり、
 * その概念を最初に learns に持つステージを前提とする。そのうち isCleared が false のものを返す。
 * 並びは stages の並び順、同じステージは1回だけ(concepts にまとめる)。今のステージが stages に無ければ空。
 */
export function unclearedPrerequisites(
  stages: readonly Stage[],
  stage: Pick<Stage, 'id' | 'learns'>,
  isCleared: (stageId: string) => boolean,
): readonly Prerequisite[];
```

今のステージ一覧で導いた結果の例(確認用。データとしては持たない):

- 中級1(`循環依存`・`Move Method`)→ `Move Method` を最初に学ぶ「チュートリアル2: 太った placeOrder」。`循環依存` は中級1が最初なので前提なし
- チュートリアル2(`Extract Method`・`Move Method`)→「チュートリアル1: 長いメソッドを分ける」(`Extract Method`)
- チュートリアル1 → 前提なし

## 動きの仕様

- 表示する条件(すべて満たすとき):
  - 今のステージがクリアされていない(`isStageCleared(stage.id, progress)` が false)
  - `unclearedPrerequisites(stages, stage, (id) => isStageCleared(id, progress))` が1件以上
  - 変更依頼に挑戦中でない(`changeSession === null`。ステージ一覧のボタンと同じく、挑戦中はステージを切り替えさせない)
- 表示する場所: 課題パネル(`StageSidebar`)の `StoryIntro` の直後、「困っていること」の上
- 見た目: `<section aria-label="先にやると分かりやすいステージ" data-testid="prerequisite-note">`。前提1件ごとに1行:
  - 文言: `先に「<ステージ名>」をやると分かりやすいです(<concepts を ・ で連結>)`
  - その行に `<button type="button" data-testid="prerequisite-go" aria-label="<ステージ名>を開く">開く</button>`
- 「開く」を押すと `selectStage(prerequisite.stage.id)` を呼ぶ(ステージ一覧・「次のステージへ」と同じ入口。今のステージの下書きは既存の仕組みどおり残る)
- 前提のステージを100点にすると、その行は消える(全部消えれば `section` ごと出さない)。保存も閉じるボタンも持たない
- キーボードだけで「開く」に届き、Enter/Space で移れる(普通の `button` なので追加の処理は要らない)

## 設計判断(確定)

1. **前提は手書きの表ではなく `learns` から導く。** 本当に各ステージに前提IDの表が要るか → `learns` はすでに全ステージにあり、
   学べることごとの表示(`conceptMastery`)とも同じ文字列なので足りる。ステージを足しても前提の保守が要らない。
   手書き表(`Stage.prerequisites`)は、導いた結果が不自然なステージが実際に見つかったら足す。
2. **前提は「その概念を最初に学ぶステージ」1つだけ。** 同じ概念を持つ前のステージを全部出すと行が増えすぎる。
   最初のステージをクリア済みなら、途中を飛ばしていても案内しない(短く出すことを優先)。
3. **「習得」の判定は `isStageCleared`(自己ベスト100点)。** 理解度チェック・変更依頼まで終えたか(`stageStatus` の `cleared`)は求めない。
   前提を知っているかの目安としては100点で足り、クリアの定義を変えるときは `isStageCleared` 1か所で済む。
4. **今のステージをクリア済みなら出さない。** 解けたステージで前を勧める意味がない。
5. **閉じるボタン・「今後表示しない」は付けない。** 1〜2行で、前提を100点にすれば消える。邪魔だという声が出たら足す。
6. `unclearedPrerequisites` は `conceptMastery` と同じく `isCleared` を引数で受け取り、`Progress` に直接依存しない。

## TDD対象

### `unclearedPrerequisites`(domain)

`roadmap.test.ts` の既存ヘルパー `stageOf(id, learns)` を使い、AAAで書く。

- 正常系: `[a(['X']), b(['Y']), c(['X','Z'])]` で c を渡し、何もクリアしていない → `[{ stage: a, concepts: ['X'] }]`
- 正常系: 前提のステージがクリア済み(`isCleared('a') === true`)→ `[]`
- 正常系: 2つの概念が同じステージで最初に出る(`a(['X','Y'])`, `c(['Y','X'])`)→ 1件にまとまり、`concepts` は今のステージの順 `['Y','X']`
- 正常系: 2つの概念が別々のステージで最初に出る(`a(['X'])`, `b(['Y'])`, `c(['Y','X'])`)→ `stages` の並び順 `[a, b]`
- 正常系: 概念が今のステージより後にしか出ない・今のステージが最初(`a(['X'])` で a を渡す、`a(['X']), b(['X'])` で a を渡す)→ `[]`
- 正常系: 同じ概念が前に2回出る(`a(['X'])`, `b(['X'])`, `c(['X'])`)→ 最初の a だけ(a 未クリア・b 未クリアでも a のみ。a クリア済みなら `[]`)
- 境界: `learns` が空 → `[]`
- 異常系: 今のステージが `stages` に無い(白紙設計の問題などのID)→ `[]`

## 受け入れ基準

1. 新しい状態(localStorage を空)で「中級1: 循環依存を断ち切る」を開くと、課題パネルの「困っていること」の上に
   `先に「チュートリアル2: 太った placeOrder」をやると分かりやすいです(Move Method)` と「開く」ボタンが出る
2. その「開く」を押すと、ヘッダーのタイトルが「チュートリアル2: 太った placeOrder」に変わり、今度は
   `先に「チュートリアル1: 長いメソッドを分ける」をやると分かりやすいです(Extract Method)` が出る
3. 「チュートリアル1: 長いメソッドを分ける」を開いたときは `prerequisite-note` が出ない
4. `refactor-blocks:progress` に `{ "tutorial-order-service": 100 }` を入れてから中級1を開くと、`prerequisite-note` が出ない。
   `{ "intermediate-cyclic-dependency": 100 }` だけを入れて中級1を開いたときも出ない
5. Tab で「開く」にフォーカスでき、Enter で前提のステージに移れる
6. 1〜5 を `e2e/prerequisite-note.spec.ts` で確かめる(ステージの切り替えは `e2e/selectStage.ts` の `selectStage` を使う)
7. `npm run check` と `npm run test:e2e` が通る

## スコープ外

- `Stage` に前提ステージの手書きの表を足すこと(設計判断1)
- ステージ一覧(`StageRoadmapDialog`)のカードに前提や「飛ばしています」の印を出すこと
- 前提が未クリアのステージを開けなくする(ロックする)こと
- 案内の閉じるボタン・「今後表示しない」の保存(設計判断5)
- 理解度チェック・変更依頼まで終えたかで前提の習得を判定すること(設計判断3)
- 白紙設計モードへの表示
- `learns` の文言の見直し(中級1に `責務の分離` を足すなど)
