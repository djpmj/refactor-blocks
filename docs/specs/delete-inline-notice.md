# クラス・ファイルを削除したとき、呼び出し元へ戻した処理を案内する

## 背景・目的

クラス・ファイルを削除すると、中の切り出し済みメソッドは消える前に呼び出し元へ戻される
(`src/domain/codebase/deleteClass.ts` の `inlineBeforeDelete`。`deleteFile` も同じ)。
中級12「横流しするだけの OrderManager」では、`OrderManager.ts` を削除するだけで、`OrderController` が `OrderService` を直接呼ぶ形になり、
模範解答(Inline 2回 → 削除)と**まったく同じ結果**の100点になる(調査で確認済み。処理は1行も消えない正しい動き)。

ところが画面には何の案内も出ないので、プレイヤーは「消したら100点になった」としか分からず、
「横流しの中継ぎをなくし、呼び出し元から直接呼ぶ形にした」(Inline Class)ことを学べない(報告あり)。

そこで、削除の前に呼び出し元へ戻した処理があったときは、**何をどこへ戻したか**をキャンバスに案内する。
削除の可否・結果のコードベース・採点は変えない。

## 振る舞い

- 「クラスを削除」「ファイルを削除」が成功し、削除の前に呼び出し元へ戻したメソッドが1つ以上あったとき、キャンバスに案内を出す
  - 文面: 「削除する前に、処理を呼び出し元へ戻しました: `OrderManager.placeOrder()` → `OrderController.placeOrder()`、`OrderManager.cancelOrder()` → `OrderController.cancelOrder()`」
  - 戻した順に `クラス名.メソッド名()` → `呼び出し元クラス名.呼び出し元メソッド名()` を「、」でつなぐ。4件以上なら3件まで出して「ほか N 件」
  - 名前は戻した時点の名前(削除後はクラスが無いため、ドメインが名前で返す)
- 戻したメソッドが無い削除(空のクラス・空実装だけのクラスなど)では、今どおり何も出さない
- 削除が失敗したとき(`has-code`・`has-fields` など)は、今どおりエラーのトースト(`message`)を出し、案内は出さない
- 案内は、失敗のトーストと同じ場所に**情報の見た目**で出す: アイコン「ℹ」、`role="status"`、警告色ではない配色。閉じるボタン(「メッセージを閉じる」)で消える
- 次の操作(コードベースが変わる操作・元に戻す/やり直し・最初に戻す・ステージ切り替え)や、メソッド・フィールドの選択で消える(`message` が消える場面と同じ)
- エラーの `message` と案内が同時に出ることはない(新しい方だけを出す。失敗したら案内を消してエラーを出す)
- 模範解答の再生・解答例の図(`sampleAnswer.ts` の `deleteFile` 手順)では案内を出さない(ストアを通らないため)

## 変更対象ファイル一覧

| パス | 層 | 新規/変更 | 役割 |
| --- | --- | --- | --- |
| `src/domain/codebase/deleteClass.ts` + `.test.ts` | domain | 変更 | `inlineBeforeDelete` が、戻したメソッドの一覧(`InlinedBeforeDelete[]`)も返す。`deleteClass` は `{ codebase, inlined }` を返す(TDD) |
| `src/domain/codebase/deleteFile.ts` + `.test.ts` | domain | 変更 | `deleteFile` も `{ codebase, inlined }` を返す(TDD) |
| `src/domain/stage/sampleAnswer.ts` | domain | 変更 | `deleteFile` の結果から `.codebase` を取り出す(挙動は変えない) |
| `src/application/RefactorUseCases.ts` + `.test.ts` | application | 変更 | `deleteClassUseCase`・`deleteFileUseCase` の戻り値の型を合わせる |
| `src/presentation/store/useGameStore.ts` | presentation | 変更 | `notice: string \| null` を足す。削除の成功時に、戻したメソッドがあれば `notice` を設定する。`message: null` にしている箇所で `notice` も `null` にする。`dismissMessage` は両方を消す |
| `src/presentation/canvas/describeInlinedBeforeDelete.ts` + `.test.ts` | presentation | 新規 | 戻したメソッドの一覧から案内の文面を作る純粋関数(上の文面の規則) |
| `src/presentation/canvas/ErrorToast.tsx` | presentation | 変更 | `message` が無く `notice` があるとき、情報の見た目で出す |
| `src/index.css` | presentation | 変更 | `.error-toast--info`(情報の配色) |
| `e2e/`(中級12を扱う既存のspec、無ければ `e2e/delete-inline-notice.spec.ts` を新規) | E2E | 変更 | 下記 |

## データ・型の変更

`src/domain/codebase/deleteClass.ts`:

```ts
/** 削除の前に呼び出し元へ戻したメソッド。削除後はクラスが無くなるので、戻した時点の名前で持つ。 */
export type InlinedBeforeDelete = {
  readonly className: string;
  readonly methodName: string;
  readonly callerClassName: string;
  readonly callerMethodName: string;
};

export type DeleteResult = { readonly codebase: Codebase; readonly inlined: readonly InlinedBeforeDelete[] };

export function inlineBeforeDelete(codebase: Codebase, classIds: readonly string[]): Result<DeleteResult, 'has-code'>;
export function deleteClass(codebase: Codebase, classId: string): Result<DeleteResult, DeleteClassError>;
```

`deleteFile(codebase, fileId): Result<DeleteResult, DeleteFileError>`。エラーの種類は変えない。
`useGameStore` に `notice: string | null`(初期値 `null`)。

## TDD対象の純粋関数

### `inlineBeforeDelete` / `deleteClass` / `deleteFile`

1. 横流しのメソッド2つを持つクラスを削除すると、`inlined` に2件が戻した順で入り、各件のクラス名・メソッド名・呼び出し元のクラス名・メソッド名が正しい
2. 戻したメソッドが無い削除(空のクラス・空実装だけ)では `inlined` が空
3. 削除するクラスの中で、メソッドAがBを呼び、Aが外の呼び出し元Cへ戻される場合、Bの呼び出し元はその時点のC(戻した後の呼び出し元)として記録される
4. 失敗するとき(`has-code`・`has-fields`・`class-not-found`・`file-not-found`・`last-file`)のエラーは今どおり
5. `codebase` は今の実装の結果と同じ(既存のテストの期待値を `.codebase` に読み替えて通る)
6. 中級12で `OrderManager.ts` を `deleteFile` すると、`inlined` が `OrderManager.placeOrder → OrderController.placeOrder`、`OrderManager.cancelOrder → OrderController.cancelOrder` の2件

### `describeInlinedBeforeDelete`

1. 空なら `null`
2. 1件・3件は全件を「、」でつなぐ
3. 4件以上は3件まで出して「ほか N 件」

## 受け入れ基準

- `npm run check` が通る
- `npm run test:e2e` が通る(既存の削除・トーストのE2Eが壊れない)
- 中級12で `OrderManager.ts` を右クリック →「ファイルを削除」すると、キャンバスに「削除する前に、処理を呼び出し元へ戻しました: OrderManager.placeOrder() → OrderController.placeOrder()、OrderManager.cancelOrder() → OrderController.cancelOrder()」が `role="status"` で出る。点数・結果のコードベースは今どおり(100点)
- 案内は閉じるボタンで消え、次の操作(元に戻すなど)でも消える
- 空のクラスを削除したときは案内が出ない
- 削除が拒まれたとき(本物の処理を持つクラスなど)は、今どおりエラーのトーストが出て、案内は出ない
- 案内はエラーと見分けられる(アイコン「ℹ」・配色。色だけに頼らない)
- 模範解答の再生・採点・ステージ一覧表は変わらない

E2E: 中級12で `OrderManager` のファイルを右クリック →「ファイルを削除」→ `getByRole('status')` に `OrderManager.placeOrder() → OrderController.placeOrder()` が含まれる →「メッセージを閉じる」で消える。

## スコープ外

- 削除する前の確認ダイアログ・戻す内容の事前プレビュー
- 「メソッドを呼び出し元へ戻す」(Inline Method)単体の操作の案内
- 戻した箇所のキャンバス上での強調・アニメーション
- 案内の自動で消えるタイマー
- 削除の可否・採点の変更
