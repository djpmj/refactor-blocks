# private にした入口メソッドを、元の可視性へ戻せるようにする

## 背景・目的

メソッドエディタの「可視性」セレクト(`MethodEditor.tsx` の `VisibilitySelect`)で、どこからも呼ばれていないメソッド
(例: 上級7の `ExpenseApplicationService.submitExpense`。ステージ開始時は `public` の入口メソッド)を `private` に変えると、
**`public` / `protected` が選べなくなり、二度と戻せない**。

原因は `src/domain/codebase/changeVisibility.ts` の広げる側の前提条件(`checkWidening`)。可視性を広げる
(private → protected → public)ときは「広げた可視性でないと届かない呼び出し元(`uses` でそのメソッドを呼ぶ別クラス)が1つ以上ある」ことを
求めている(むやみに public にして逃げるのを防ぐため)。入口メソッドは設計上だれからも呼ばれないので、private にした時点で
この条件を満たす呼び出し元が存在せず、`widening-not-needed` で弾かれて、セレクトの選択肢も `disabled` になる。
(`元に戻す` / `最初に戻す` を使えば戻れるが、可視性だけ直したいプレイヤーには分かりにくい。)

そこで、**そのメソッドがステージ開始時に持っていた可視性へは、呼び出し元が無くても戻せる**ようにする
(ユーザーが方式を確定済み)。それ以外の広げ方(元の可視性より広くする・新しく作ったメソッドを広げる)は従来どおり呼び出し元を求める。

## 変更対象ファイル一覧

| パス | 層 | 新規/変更 | 役割 |
| --- | --- | --- | --- |
| `src/domain/codebase/changeVisibility.ts` | domain | 変更 | `changeVisibility(codebase, methodId, visibility, originalVisibility?)` に引数を追加。`visibility` が `originalVisibility` と等しい広げる変更は、`checkWidening` を省略して成功にする |
| `src/domain/codebase/changeVisibility.test.ts` | domain(test) | 変更 | 下記のテストを先に書く(TDD) |
| `src/application/RefactorUseCases.ts` | application | 変更 | `changeVisibilityUseCase(codebase, methodId, visibility, originalCodebase)` にして、`findMethod(originalCodebase, methodId)?.visibility` を `originalVisibility` として渡す(引数は4つで lint の上限内) |
| `src/application/RefactorUseCases.test.ts` | application(test) | 変更 | ユースケース経由で元の可視性へ戻せるテストを追加 |
| `src/presentation/store/useGameStore.ts` | presentation | 変更 | `changeVisibility` が `get().stage.codebase`(ステージ開始時のコードベース)を渡す |
| `src/presentation/editor/MethodEditor.tsx` | presentation | 変更 | `VisibilitySelect` の `disabled` 判定でも同じ `state.stage.codebase` を渡す。ヒント文(165行目付近)に「ステージ開始時の可視性にはいつでも戻せます」を足す |
| `e2e/` の可視性に関する既存spec | E2E | 追加 | 入口メソッドを private → public に戻せることを確認する |

## データ・型の変更

なし(`Codebase`・`Method`・`Visibility` は変更しない)。「元の可視性」は新しく状態として持たず、
すでにストアが持っている `stage.codebase`(ステージ開始時のコードベース。`resetStage` も同じものを使っている)から引く。

## 「元の可視性」の定義

- ステージ開始時のコードベース(`stage.codebase`)に同じ `methodId` のメソッドがあれば、その `visibility` が元の可視性
- ステージ開始後に作られたメソッド(Extract Method の新メソッド、Merge Methods で統合した新メソッドなど、IDが `stage.codebase` に無いもの)には
  元の可視性がない → 従来どおりの条件で判定する(戻せる特例は無い)
- Move Method で別クラスへ移したメソッドも、IDが変わらないので元の可視性を持つ
- 白紙設計モードなど `stage.codebase` が空で始まるものは、元の可視性が無いので従来どおり

## TDD対象の純粋関数

`changeVisibility(codebase, methodId, visibility, originalVisibility?)`。追加するテスト(AAA):

1. 呼び出し元が無い(`uses` で参照するクラスが無い)private メソッドを、`originalVisibility = 'public'` で `public` に変える → 成功
2. 同じ状況で `originalVisibility = 'protected'` なら `protected` に変えられ、`public` には変えられない(`widening-not-needed`)
3. 同じ状況で `originalVisibility` を渡さない(`undefined`)→ 従来どおり `widening-not-needed`(既存テストの期待は変わらない)
4. `originalVisibility = 'public'`、現在 `protected` のメソッドを `public` にする → 呼び出し元が無くても成功
5. 元の可視性に戻す変更でも、`fragments: []`(契約メソッド)は `contract-method` のまま、現在と同じ可視性は `same-visibility` のまま
6. 狭める変更(public → private など)は `originalVisibility` の有無に関係なく従来のチェック(`narrowing-breaks-callers`)を受ける
7. 元の可視性に戻す変更は、元のコードベースを変更せず新しい Codebase を返す(不変性)

`changeVisibilityUseCase` のテスト: ステージ開始時のコードベースで `public`、現在 `private` のメソッドを、`originalCodebase` を渡して `public` へ戻せる。
`originalCodebase` にそのメソッドが無ければ従来どおり弾かれる。

## 受け入れ基準

- `npm run check`(lint + typecheck + test)が通る
- `npm run test:e2e` が通る
- 上級7で `ExpenseApplicationService.submitExpense`(開始時 `public`)を選び、可視性を `private` にしたあと、同じセレクトで `public` を選べる
  (選択肢が `disabled` にならず、選ぶと可視性が `public` に戻る)
- 同じメソッドを `protected` にしたり、元より広くするなど「元の可視性以外への広げる変更」は、従来どおり呼び出し元が無いと選べない
- Extract Method で作った新メソッド(開始時には存在しない)は、private にした後に呼び出し元が無ければ従来どおり広げられない
- `最初に戻す`・`元に戻す`・`やり直し` の動作は変わらない
- 既存の可視性まわりのテスト(`changeVisibility.test.ts`・`RefactorUseCases.test.ts`・E2E)が、期待値の変更なしで通る

## スコープ外

- 「呼び出し元が無いメソッドは自由に広げてよい」という方式(広げる制限そのものの緩和)。今回は元の可視性への復帰だけ
- 元の可視性より広い・中間の可視性(private → protected など)への特例
- 新しく作ったメソッドの「作った時点の可視性」への復帰(元の可視性を持たないため)
- `describeChangeVisibilityError` の文言変更・disabled の選択肢へホバーで理由を出す表示
- スコア(未使用 private の減点など)の計算変更
