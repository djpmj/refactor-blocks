# 機能探索: 採点の減点ごとに「どのクラス・メソッドが原因か」を名前で見せる

- slug: `score-deduction-locations`

## 出どころ

新規探索(`docs/pipeline/USER_FIXES.md` に未完了項目 `### [ ]` が無かったため)。

## 背景・目的

今のリファクタリング画面の採点表示は、`StagePanel.tsx` の `data-testid="score"` に出る1行だけである。

```
70点(行数 -10 / 結合度 -10 / 責務の混在 -10)
```

`describeScore.ts` は `ScoreDeduction`(`rule`・`count`・`points`)しか受け取らず、**どのクラス・メソッドが減点の原因か**は
画面のどこにも出ていない。キャンバス側の手がかりも、ファイルの箱の ⚠️/⛔(`FileNode.tsx` の `FileMark`)が
「このファイルで -20点」と合計点を出すだけで、どのルールに当たったかは分からない。
例外は行数超過(`line-badge--over` の赤い行数)と循環依存(`cyclic-mark`)だけで、残りの11ルール
(結合度・責務の混在・アクセス制御・空の入れ物・未使用private・子が1つだけの継承・空実装・約束違反・
Feature Envy・カプセル化の破れ・凝集度)は、プレイヤーがクラスを1つずつ見て推理するしかない。

対象プレイヤー(新卒〜4年目)にとって「結合度 -10」と言われても、依存の矢印が十数本ある中級・上級ステージで
どのクラスのことか見当が付かず、ヒント(模範解答の手順)を開くしかなくなる。これは「自分で気づいて直す」練習の
機会を奪っている。既存の仕様書にも、この穴が先送りとして明記されている。

- `docs/specs/fields-and-feature-envy.md` のスコープ外: 「Feature Envy のメソッドをキャンバス上で個別に目立たせる印
  (ファイルの ⚠ と点数の内訳で伝える)」 → 実際には内訳にメソッド名が出ないので伝わっていない
- `docs/specs/interface-segregation-stage.md` の未決事項: 「`contract` の3種類が1つのルール名: 内訳ではどれに当たったか
  分からない。分かりにくければ、ファイルの ⚠ の説明を出すかルールを分ける」

あわせて、コードを追うと**ルールの一覧が2か所に重複している**ことも分かった。`score.ts` の `scoreCodebase`
(ルールごとの件数)と `fileScores.ts` の `fileDeductions`(違反の対象IDを集めてファイルごとに数える)が、
同じ13個の `find*` 関数を別々に並べて呼んでいる。進行中の `duplicate-code-scoring`・`inline-method-stage` の
02-draft-spec も、新ルールを両方に1行ずつ足す手順になっている。今回の機能は「ルールごとの違反対象ID」を
求める処理を1か所にまとめる必要があるので、この重複もまとめて解消できる見込み(やり方は仕様設計者が決める)。

これまでのサイクルはステージ追加・採点ルール追加・クイズ・右クリックメニュー・永続化・AI講評の堅牢化を扱ってきた。
今回は、呼び出し元が挙げた「採点結果の見せ方」の切り口から選んだ。

### 既存テーマとの重複確認

- `docs/specs/dependency-scoring.md`: 点数と「減点のあるルールだけの内訳」の1行表示を決めた仕様。対象の名前までは扱っていない → 今回はその続き
- `docs/specs/cyclic-dependency-class-highlight.md`: 循環依存のクラスにだけ印を付ける仕様(実装済み)。他のルールには広げていない → 重複しない
- `docs/specs/stuck-player-hints.md`(`HintPanel.tsx`): 模範解答の手順を1手ずつ見せるヒント。「今のコードのどこが悪いか」は出さない → 別物
- AI講評(`critiqueRequest.ts`): ファイルごとの減点合計と Feature Envy の相手クラス名だけをAIに渡している。ルールごとの対象は渡していない。
  講評の入力を変えるのは今回のスコープ外(後述)
- 呼び出し元が挙げた10件の進行中・完了済みslugのいずれとも主題が重ならない。ただし採点まわりのファイルを共有する(下記「衝突可能性」)

### 検討して見送った候補

- ステージ選択画面のUX(選択欄に自己ベスト点を出す、100点で「次のステージへ」ボタン): 衝突は小さいが、学習の中身は増えない。今回の方が
  「どこが悪いかを自分で見つける」練習に直結するため優先した
- ファイルの ⚠️ にルール別の内訳をツールチップで出す: 今回の「ルールごとの対象ID」ができれば数行で足せる。今回の2段目の候補にする
- VSCode風ファイルツリー: 過去の探索と同じ理由(新しいペイン・dnd-kitのドロップ先・E2Eが要り1回のPRには大きい)で見送り
- 行き詰まりヒントを「今の進み具合」に合わせる(済んだ手順を飛ばす): 模範解答の各手が済んだかの判定の設計から要り、大きい

## 関連する既存コード

- `src/domain/scoring/score.ts` — `ScoreRule`(13ルール)・`ScoreDeduction`(`rule`/`count`/`points`)・`scoreCodebase`・`findCouplingViolations`
- `src/domain/scoring/fileScores.ts` — `fileDeductions`。各ルールの違反を「どのIDに帰属させるか」をすでに決めている
  (結合度・循環依存は依存元クラス、アクセス制御は呼んでいる側のクラス、Feature Envy はメソッド、カプセル化は触っている側のクラス…)。
  「全ファイルの合計 = `scoreCodebase` の減点の合計」という約束が `fileScores.test.ts` にある。対象IDの出し方はこれに倣える
- 各ルールの判定関数(戻り値が違反対象IDか、IDを含むオブジェクト):
  `lineLimits.ts`(`targetId`)・`responsibilities.ts`(`classId`)・`leftovers.ts`・`loneSuperclass.ts`・`interfaceContracts.ts`・
  `fieldAccess.ts`(`FeatureEnvy.methodId`/`enviedClassId`、`EncapsulationViolation.accessorClassId`、`findOpenSetters`)・
  `visibility.ts`(`callerClassId`)・`cohesion.ts`(`classId`)・`src/domain/codebase/dependencies.ts`(`classDependencies` の `from`/`to`/`cyclic`)
- `src/presentation/stage/describeScore.ts` — `RULE_LABEL` と1行表示の `describeScore`。白紙設計(`BlankDesignResultPanel.tsx`)でも使われており、
  E2Eが文言(`循環依存 -20点` など)を確認しているので、1行表示の書式は変えない方が安全
- `src/presentation/stage/StagePanel.tsx` — 採点表示(`data-testid="score"`、`aria-live="polite"`)。
  コメントに「責務の中身(responsibility の値)は見せない」という既存の方針がある(クラス名を出すのはよいが、どの責務が混ざっているかは出さない)
- `src/presentation/canvas/FileNode.tsx`(`FileMark`)・`ClassNode.tsx`(`CyclicMark`) — 色だけに頼らず文字・`aria-label` で伝える既存パターン
- `src/presentation/store/useGameStore.ts` — `selectMethod(methodId)`(内訳からメソッドを選んでメソッドエディタを開く、を入れる場合に使える。ストアの変更は不要な見込み)
- `src/domain/codebase/Codebase.ts` — `findClass`・`findMethod`・`findClassOfMethod`(IDから表示名を引く)
- `e2e/refactor.spec.ts` — `初期状態の点数は、行数の上限を超えた placeOrder・責務が混ざった OrderService・空の TaxCalculator の分だけ減点されている`
  のテストが、ちょうど「どれが原因か」を名前で確かめたい場面。ここを拡張・追加する先になる

## スコープの見立て

1回のPRに収まる規模と見る。

1. **今回やる**:
   - domain: ルールごとの違反対象(IDの並び)を返す処理を用意し、`scoreCodebase` の件数と `fileDeductions` の帰属先がそこから出るようにする
     (13ルールの一覧を1か所にまとめる。既存の `find*` 関数は変えない)。TDD
   - presentation: リファクタリング画面の採点表示の下に、減点のあるルールごとに原因のクラス・メソッド名を並べる
     (例: `結合度: OrderService` / `Feature Envy: Invoice.calculateTotal()`)。1行表示(`describeScore`)はそのまま残す
   - E2E: 初期状態のチュートリアル/初級で、原因の名前が出ることと、直すと消えることを確認する
2. **後回し**:
   - 内訳の名前をクリックしてキャンバス上のそのクラスへビューポートを寄せる・メソッドエディタを開く
   - ファイルの ⚠️ のツールチップにルール別の内訳を出す
   - 白紙設計の結果画面・設計くらべクイズへの同じ内訳の表示
   - AI講評の入力(`critiqueRequest.ts`)にルールごとの対象を渡すこと(`workers/` 側のプロンプト変更を伴う)

仕様設計者に決めてほしい論点(ここでは決めない):

- 対象の出し方をどこまで細かくするか(循環依存は `Order → Customer` のように依存の組で出すか、依存元クラス名だけか。
  約束違反・カプセル化の破れで「どのメソッド/フィールドか」まで出すか)
- 答えが見えすぎないか: Feature Envy の相手クラス名(移し先の答えそのもの)や、責務の混在で「どの責務か」は出さない方針でよいか
- 表示の形(常に展開した一覧か、`<details>` で畳むか)と、`aria-live` で読み上げる範囲(一覧まで読み上げると長い)
- 変更依頼の実装中(`changeSession` あり)の扱い。今の採点は `changeSession.base` で数えているので、内訳も同じコードで出すか、隠すか
- `ScoreDeduction` 型に対象IDを持たせるか、別の関数・型にするか(AI講評の入力 `CritiqueRequest.score` にそのまま流れる点に注意)

### 既存パイプラインとの衝突可能性

- **`src/domain/scoring/score.ts`・`fileScores.ts`(と各テスト)・`describeScore.ts` の `RULE_LABEL`**:
  `duplicate-code-scoring` と `inline-method-stage`(どちらも 02-draft-spec.md まで完了)が、同じ2ファイルのルール一覧に1行ずつ足す予定。
  本件はその一覧そのものを1か所にまとめ直すので、**同時に走るとテキスト上の競合が確実に起きる**。
  次のどちらかを仕様設計で決めてほしい:
  - (推奨)この2件がマージされてから実装に入る。まとめ直す対象が15ルールになるだけで、設計は変わらない
  - 先にこちらを入れ、2件の 02-draft-spec の「`score.ts` と `fileScores.ts` の両方に足す」手順を「まとめた1か所に足す」に読み替えてもらう
  どちらの場合も、`ScoreRule` にルールが増えても型エラーで追加漏れに気づける形(`Record<ScoreRule, …>` など)にしておけば、順序の影響は小さい
- **`src/presentation/stage/StagePanel.tsx`**: `stage-draft-persistence`(続きから再開の表示を出すなら)・`critique-request-robustness`
  (`CritiquePanel` の呼び出し付近)が触る可能性がある。本件は採点表示の直下に要素を足すだけなので、競合しても小さい
- **`src/domain/critique/critiqueRequest.ts`**: `ScoreDeduction` 型を変える場合、`CritiqueRequest.score` 経由でAI講評の入力の形が変わる。
  `critique-request-robustness` はクライアントの通信を触る予定で入力の形は変えない見込みなので、直接の衝突はない。
  `workers/critique/` の入力検証が未知のキーをどう扱うかは仕様設計で確認してほしい
- **ステージ定義(`src/infrastructure/stages/*.ts`)・`sampleAnswer.ts`**: 触らない。点数の値も変わらない(表示を足すだけで採点ロジックの結果は同じ)
- **`e2e/refactor.spec.ts`**: 他の多くのパイプラインも追記する。追記位置の競合はあり得る(小さい)
