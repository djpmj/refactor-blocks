# 機能探索: 分けすぎたメソッドを Inline Method で戻すステージと、「分けすぎ」の採点

- slug: `inline-method-stage`

## 出どころ

新規探索(`docs/pipeline/USER_FIXES.md` に未完了項目 `### [ ]` が無かったため)。

過去の探索で、候補に挙がったが見送られていたもの(`docs/pipeline/blank-design-second-problem/01-discovered.md`):

> Inline Method を題材にするステージ(「分けすぎたメソッドを戻す」): 操作(`inlineMethod`)はあるのに、それを解き方に使うステージも模範解答
> (`sampleAnswer.ts`)も無い。ただ「分けすぎ」を減点する採点ルール(Lazy Class など)を新しく設計する必要があり、`duplicate-code-scoring` と
> 同じ `score.ts` を同じ時期に触ることになる。採点ルールが落ち着いてから改めて検討したい。

操作そのものは auto-dev の完了タスク「メソッドの統合(Inline Method)を追加する」(`docs/auto-dev/TASKS.md`)で入っている。
そのタスクの背景は「分解だけでなく『分けすぎたものを戻す』操作も学ばせたい」だったが、今はその目的を果たすステージが無い。

### 他の候補と見送った理由(参考)

- `template-method-stage`・`move-via-context-menu`・`move-class-via-context-menu`・`duplicate-code-scoring`・`blank-design-second-problem` は
  進行中または完了済みなので対象外。
- Middle Man・データクラスの減点、VSCode風ファイルツリー: 過去の探索と同じ理由で見送る
  (ゲーム内で直す操作が無い/新しい判定の設計から要る/新しいペインとドロップ先が要り1回のPRには大きい)。
- 上級ステージの追加: `template-method-stage` が `advancedStages.ts` の末尾を触る予定。今回の題材は中級向け(下記)なので、
  `intermediateStages.ts` 側に置けば衝突を避けられる見込み。

## 背景・目的

- 今の採点は、`lone-superclass`(子が1つだけの継承)を除き、**分ける・抽出する方向にしか点が動かない**。行数の上限と責務の混在が主な減点なので、
  「とにかく細かく抽出すれば点が上がる」という癖がつきやすい。`lone-superclass-scoring.md` がクラスの継承について同じ問題を指摘し
  Collapse Hierarchy(上級5)で扱ったが、**メソッドの粒度**の「分けすぎ」は手付かずのまま。
- 新卒〜4年目は、「メソッドは短いほど良い」を覚えた直後に、1〜3行の private メソッドを量産しがちである。たとえば
  `isEmpty()` が `list.length === 0` を返すだけで、呼び出し元も1か所しかないもの。読む人は定義へジャンプし続けることになり、
  かえって流れが追いにくい(Fowler の Inline Method の動機)。
  ゲームの中心の学習サイクル「分けたら点が上がる」に、**「分けすぎたら戻す」の判断**を加えるステージが1件あると、
  メソッド抽出の学習(チュートリアル1・2)と釣り合いが取れる。
- 仕組みはほぼ揃っている:
  - `inlineMethod`(`src/domain/codebase/inlineMethod.ts`)は、呼び出し行 `<methodId>:call`(`callFragmentId`)を持つ呼び出し元を探して、
    private メソッドの処理をその位置へ戻す。ステージデータの初期コードに `<id>:call` の処理を置いておけば、
    Extract Method をしなくても最初から Inline できる見込み(`responsibility: 'call'`・`uses: [<id>]` の形は `extractMethod.ts` の `callFragment` と同じ)
  - メソッドエディタの「呼び出し元へ戻す」ボタンと、そのE2E(`e2e/refactor.spec.ts`)は既にある
- 足りないもの:
  1. 「分けすぎ」を数える採点ルール(`score.ts` の `ScoreRule` に無い)。これが無いと、初期状態(分けすぎ)が既に100点近くになり、
     `stageCatalog.test.ts` の「初期状態では減点がある」「模範解答どおりに操作すると100点になる」を意味のある形で満たせない
  2. 模範解答のステップ `inline`(`sampleAnswer.ts` の `SolutionStep` に無い)と、そのヒント文(`describeSolutionStep.ts`)
  3. ステージデータ1件

## 関連する既存コード

- `src/domain/codebase/inlineMethod.ts` / `inlineMethod.test.ts` — Inline Method 本体(private のみ・呼び出し行が必要)
- `src/domain/codebase/extractMethod.ts` — `callFragmentId`・呼び出し行の処理(`CALL_LINES = 1`、`responsibility: 'call'`、`uses`)の形
- `src/domain/scoring/score.ts` — `ScoreRule` / `scoreCodebase`。ルールを1つ足す場所
- `src/domain/scoring/leftovers.ts` — `findUnusedPrivateMethods`(private メソッドの呼び出し元を `uses` から数える前例。判定の書き方が近い)
- `src/domain/scoring/loneSuperclass.ts` — 「分けすぎ」系の減点を1つ足した前例
- `src/domain/scoring/fileScores.ts` — ファイルのエラーマーク(`fileDeductions`)。新ルールも足すかの確認先
- `src/domain/stage/sampleAnswer.ts` / `sampleAnswer.test.ts` — `SolutionStep` に `inline` が無い。足す場所
- `src/presentation/stage/describeSolutionStep.ts` — 行き詰まりヒントの文(`docs/specs/stuck-player-hints.md`)
- `src/presentation/stage/describeScore.ts` — `RULE_LABEL`(減点の表示名)
- `src/presentation/change/describeChange.ts` — `ScoreRule` を参照している箇所
- `src/domain/critique/critiqueRequest.ts` — AI講評がルール名を扱っていれば合わせる箇所
- `src/infrastructure/stages/intermediateStages.ts` — 中級1〜8。新ステージ(中級9の想定)を足す場所
- `src/infrastructure/stages/stageCatalog.test.ts` — 全ステージ共通の制約(80行以上のメソッドが1つ以上ある、初期は減点あり、模範解答で100点、
  変更依頼2件以上で、模範解答で変更コストが下がる など)
- `docs/specs/lone-superclass-scoring.md` — 「分けすぎ」を減点するルールとステージを1回で足した仕様の前例(構成をそのまま真似できる)
- `docs/specs/cohesion-value-object-anemic.md` の前提10 — Inline Method は `<id>:call` が無いと使えない、という制約の記述
- `e2e/refactor.spec.ts` — 「呼び出し元へ戻す」の既存E2E

## スコープの見立て

- 採点ルール1つ + `SolutionStep` への `inline` の追加 + 中級ステージ1件 + ヒント文・表示名の追加。
  `lone-superclass-scoring.md`(ルール1つ + 上級5の追加)と同じくらいの規模で、1回のPRで完結すると見ている。
  新しい操作・ドラッグ操作は要らない(Inline Method のUIとE2Eは既存)。
- 仕様設計者に決めてほしい論点(ここでは決めない):
  - **「分けすぎ」の定義**。例: 「呼び出し元が1か所だけで、処理の行数が小さい private メソッド」など。
    ただし、**既存の全ステージの模範解答が100点のまま**であることを必ず確かめる。チュートリアル・初級・中級の模範解答は小さめのメソッドを
    抽出しているものがあり、上級5の `quoteChar`(4行のフック、protected)のように、小さくても正当なメソッドもある。
    閾値やpublic / protected の扱いによっては、既存の模範解答が減点されてしまう
  - Extract Method した直後のメソッドも対象になるか(プレイヤーが抽出した途端に減点が出ると、チュートリアルの体験が変わる)
  - **`duplicate-code-scoring` との競合**: 同じ `score.ts` の `ScoreRule`・`scoreCodebase` の並び・`RULE_LABEL` に1件ずつ足すことになる。
    どちらが先にマージされても素直に rebase できるよう、追加位置(並びの末尾など)を仕様に書いておく。点数の試算は、相手のルールがある場合と無い場合の両方で
    模範解答が100点になることを確かめる
  - ステージの難しさ(中級を想定。`advancedStages.ts` は `template-method-stage` が触るので避けたい)と題材。
    `stageCatalog.test.ts` の「80行以上のメソッドが1つ以上ある」を、分けすぎの題材とどう両立させるか
    (例: 長いメソッドを抽出で分けつつ、細かすぎるメソッドは戻す、の両方をさせる)
  - 変更依頼(2件以上)の中身。Inline すると「触るブロック数が減る」をプレイヤーが実感できる依頼にできるか
  - 設計くらべクイズ(`comparisonQuizzes.ts`)に問題を足すか(今回はスコープ外にしてもよい)
- 大きくなりそうなら次のように割る:
  1. 今回: 採点ルールの追加と、既存ステージの模範解答が100点のままであることの確認 + `SolutionStep` の `inline` + 中級ステージ1件
  2. 後回し: 設計くらべクイズの追加、AI講評・行き詰まりヒントでの「分けすぎ」の言い回しの調整
