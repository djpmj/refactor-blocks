# notice-uses-final-class-name: 自動 public 化の通知が、自動命名前の仮名 `NewClass` を出す

`auto-class-naming.md` は「図・見出し・コードタブ・AI講評に自動で付いた名前を一貫して出す」と決めたが、
移動時の通知(`notice`)が対象に入っていなかった。その抜けを埋める不具合修正。

## 症状

初級2「クラスを自分で作る」で、`sendInvoice` から「送信履歴を記録する」を `recordHistory` として抽出し、
`recordHistory` をキャンバスの余白へドロップして新しいクラスを作る。

- キャンバスのクラスは自動命名で `InvoiceStorage`(同名がすでにあれば `InvoiceStorage2`)になる
- 同時に出る通知は「recordHistory() は **NewClass** の外(InvoiceService)から呼ばれるようになったので、public にしました」で、
  画面のどこにもない仮名 `NewClass` が出る

## 原因

`src/presentation/store/useGameStore.ts` で、通知を作る順番と自動命名の順番が逆になっている。

- 自動命名(`autoNameClasses`)は `commit()` の中で行われる
- 移動の通知 `publicizedMoveNotice(after, changes)` は、`commit()` を呼ぶ**前**に、ユースケースが返した
  命名前の Codebase(新しいクラスの `name` はまだ `NewClass`)からクラス名を読んでいる

`publicizedMoveNotice` の呼び出し元は次の3つで、すべて同じ順番になっている(grep 済み)。

| 呼び出し元 | 操作 |
| --- | --- |
| `moveMethodAction`(`moveMethod`) | 既存クラスへの移動。移動先・呼び出し元が自動命名のクラスなら、中身が変わって名前が変わりうる |
| `moveMethodToNewClassInFileAction`(`moveMethodToNewClassInFile`) | ファイルの中へドロップして新しいクラスを作る |
| `moveActions` の `moveMethodToNewClass` | 余白へドロップして新しいファイル・クラスを作る(今回の再現) |

`moveMethodToNewClass` は `autoNameClasses` を先に呼んでいるが、通知はその1行前に、命名前の Codebase から作っている。

ほかに `notice` を作る箇所は2つあり、どちらも今回の原因とは関係ない。

- 抽出の初回の説明文(`extractOverheadExplained`)— クラス名を含まない
- 削除前のインライン化(`describeInlinedBeforeDelete`)— 下の「スコープ外」を参照

## 修正

`publicizedMoveNotice` の中で、名前を読む前に `autoNameClasses` をかけて、`commit()` が保存するのと同じ命名後の
Codebase からクラス名を読む。直すのはこの関数1か所(presentation 層)。

```ts
function publicizedMoveNotice(
  after: Codebase,
  changes: readonly { readonly methodId: string; readonly visibility: 'public' | 'protected' }[],
  classNames: Readonly<Record<string, string>>,
): string | null
// 先頭で const named = autoNameClasses(after, classNames); とし、以降の findMethod / findClassOfMethod / allClasses は named を見る
```

- 呼び出し元3つは、第3引数に `state.stage.classNames` を渡すだけにする
- `autoNameClasses` は純粋で、同じ入力から同じ名前を返す。`commit()` の中でもう一度呼ばれても名前は変わらない
  (命名済みの Codebase を渡すと同じ Codebase がそのまま返る)ので、通知とキャンバスの名前は必ず一致する
- `moveMethodToNewClass` の `const codebase = autoNameClasses(...)` は `commit()` と重複しているので削除し、
  `applyResult` には `result.value.codebase` を渡す(挙動は変わらない)
- ponytail: 1回の移動で `autoNameClasses` を2回走らせる(通知用と `commit()` 用)。クラス数は1ステージ十数個までで問題にならない。
  遅くなったら `commit()` に命名済みの Codebase を渡す形にまとめる、とコメントを残す
- 本当に新しい関数や型が要るか: 要らない。既存の `autoNameClasses` を呼ぶ順番を変えるだけで足りる

## テスト

先に書いて失敗(Red)を確認する。

- Vitest(`src/presentation/store/useGameStore.test.ts` の `describe('move visibility notice')` に追加)
  - 「余白へ移して作ったクラスの通知は、自動命名後の名前を使う」: 初級2(`title === '初級2: クラスを自分で作る'`)で
    `extractMethod({ sourceMethodId: <sendInvoice の id>, fragmentIds: [<送信履歴を記録する の id>], newMethodName: 'recordHistory' })` → 
    `moveMethodToNewClass(<recordHistory の id>)`
    - `recordHistory` を持つクラスの名前を `findClassOfMethod(store.getState().codebase, id)` で取り、`NewClass` ではないこと(`InvoiceStorage` のはず)
    - `notice` が `` `recordHistory() は ${そのクラス名} の外(InvoiceService)から呼ばれるようになったので、public にしました` `` と一致すること
    - `notice` に `NewClass` が含まれないこと
  - id はステージ定義(`src/infrastructure/stages/beginnerStages.ts`)から探す。直書きせずメソッド名・ラベルで引いてもよい
- E2E(`e2e/auto-class-naming.spec.ts` にテストを1件追加。既存の `dragToEmptyCanvas` を使う)
  - 初級2を選び、`method-sendInvoice` から「送信履歴を記録する」を `recordHistory` として抽出し、`method-recordHistory` を余白へドロップする
  - `class-InvoiceStorage` の中に `method-recordHistory` が見える
  - `.error-toast[role="status"]` が「recordHistory() は InvoiceStorage の外(InvoiceService)から呼ばれるようになったので、public にしました」を含み、`NewClass` を含まない

## 受け入れ基準

1. 初級2で上の再現手順をやると、通知のクラス名がキャンバスのクラス名(`InvoiceStorage` / 同名があれば `InvoiceStorage2`)と一致し、`NewClass` は出ない
2. ファイルの中へドロップして新しいクラスを作った場合・既存の自動命名クラスへ移した場合も、通知は命名後の名前を使う(同じ関数を通るので、追加のテストは不要)
3. 既存の通知テスト(`move visibility notice` の各ケース、`e2e/operation-result-feedback.spec.ts`)が変更なしで通る
4. `npm run check` と `npm run test:e2e` が通る

## スコープ外

- 削除前のインライン化の通知(`describeInlinedBeforeDelete`)。`callerClassName` は domain の `deleteClass` が削除前の名前で文字列として返すため、
  呼び出し元のクラスが自動命名で、インライン化で中身が変わって名前まで変わる場合だけ古い名前になりうる。
  実機で再現していないので今回は直さない。起きたら `InlinedBeforeDelete` にクラスidを持たせ、命名後の Codebase から名前を引く
- 操作の結果(`operationResult`)・採点の文言など、ほかの表示のクラス名。これらは `commit()` 後の命名済み Codebase から作られている
- 自動命名のルール(`autoNameClasses` の重み付け・重複時の連番)そのもの
