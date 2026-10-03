# 可視性の選択欄は、可視性が課題に関係するステージだけに出す

## 背景・目的

メソッドエディタ(`src/presentation/editor/MethodEditor.tsx`)の「可視性」セレクト(`VisibilitySelect`)は、本体のあるメソッドを選ぶと
**全ステージで常に表示**される。しかし多くのステージ(例: 上級1「通知クラスの共通処理を基底クラスへ集める」)は課題が
可視性と無関係で、`visibilityEnforced` も無いため、private メソッドの越境呼び出しは減点されない。それでも欄とヒント文
(「可視性を広げるには呼び出し元が必要です…」)が出るので、初学者が「これも操作しなければいけないのか」と迷う。

可視性が課題に関係するステージ(可視性を採点する・protected を使う設計を学ぶ)と、自由に設計する白紙設計モードだけで欄を表示し、
それ以外のステージでは出さない。

## 変更対象ファイル一覧

| パス | 層 | 新規/変更 | 役割 |
| --- | --- | --- | --- |
| `src/domain/stage/showsVisibilityControl.ts` | domain | 新規 | ステージが可視性の選択欄を出すべきかを返す純粋関数 |
| `src/domain/stage/showsVisibilityControl.test.ts` | domain(test) | 新規 | 下記のテスト(TDD、先に書く) |
| `src/presentation/editor/MethodEditor.tsx` | presentation | 変更 | `VisibilitySelect` を表示する条件に、`showsVisibilityControl(stage)`(または後述の白紙設計モードの指定)を加える。条件を満たさないときは欄とヒント文をまとめて出さない |
| `src/presentation/blank/BlankDesignView.tsx` | presentation | 変更 | 白紙設計モードでは `MethodEditor` に常に欄を出す指定を渡す |
| `e2e/` の可視性に関する既存spec | E2E | 変更・追加 | 欄が出る/出ないステージの確認を追加し、欄が出なくなるステージで可視性セレクトを使っている既存テストを直す |

## 表示条件(`showsVisibilityControl`)

`showsVisibilityControl(stage: Pick<Stage, 'visibilityEnforced' | 'codebase'>): boolean` は、次のいずれかなら `true`:

1. `stage.visibilityEnforced === true`(private の越境を採点するステージ。中級3「越境する private メソッド」・中級7 など)
2. ステージ開始時のコードベース(`stage.codebase`)に `visibility === 'protected'` のメソッドが1つでもある
   (protected の越境は全ステージで採点される。継承を扱うステージ。例: 上級8 Template Method)

それ以外は `false`。新しいステージ定義のフラグは足さない(1・2が既存データから導ける。ponytail: 「protected を使うのが正解のステージ」だが
開始時に protected が無いものが出てきたら、`Stage` に明示的なフラグを足す)。

白紙設計モード(`BlankDesignView`)はステージを持たず自由に設計するので、常に表示する。
`MethodEditor` に任意の props(例: `alwaysShowVisibility?: boolean`)を足して `BlankDesignView` から `true` を渡す。通常のステージ画面は渡さない。

## データ・型の変更

`Stage` は変更しない。`MethodEditor` に任意の props を1つ追加するだけ(上記)。

## TDD対象の純粋関数

`showsVisibilityControl(stage)`。テスト(AAA):

1. `visibilityEnforced: true` → `true`(`codebase` に protected が無くても)
2. `visibilityEnforced` が未指定・`false`、`codebase` にも protected が無い → `false`
3. `visibilityEnforced` が未指定で、`codebase` のどれかのクラスに `protected` のメソッドがある → `true`
4. `visibilityEnforced: false` と明示されていても、`protected` のメソッドがあれば `true`
5. ファイルもクラスもメソッドも空の `codebase` → `false`

## 受け入れ基準

- `npm run check`(lint + typecheck + test)が通る
- `npm run test:e2e` が通る
- 上級1「通知クラスの共通処理を基底クラスへ集める」でメソッドを選んでも、「可視性」の欄とそのヒント文が表示されない
- チュートリアル1・チュートリアル2・初級など、`visibilityEnforced` も protected も無いステージでも欄が出ない
- 中級3(`visibilityEnforced: true`)・中級7・上級8(開始時に protected あり)では、これまでどおり欄が表示され、変更もできる
- 白紙設計モードでは、本体のあるメソッドを選ぶと欄が表示される
- 欄が出ない場合も、「呼び出し元へ戻す」「メソッドを削除」など他のボタンは変わらず表示される(欄だけを隠す)
- 可視性の採点・Extract Method が作る private の扱い・`visibility-restore-original`(Issue #37)の戻す操作は変更しない
- 既存E2Eで可視性セレクトを使っているテストは、欄が出るステージで動くよう直す。特に `e2e/delete-guard.spec.ts` の
  「public にした抽出メソッドが残るクラスは削除できない」はチュートリアル2を使っており、欄が出なくなる。そのテストの目的
  (public にした抽出メソッドが残るクラスは削除できない)を保ったまま、欄が出るステージに移す(Extract Method で作った private が
  既定のままだと目的の状態にならないため。難しければ、テストの前提を満たす別の手段を実装者が選び、PRに理由を書く)

## スコープ外

- 欄が出ないステージでの可視性の採点そのものの変更(`countedVisibilityViolations` はそのまま)
- ステージ定義への表示フラグの追加、可視性の説明文・ヒント文の変更
- 欄を出さないステージで、protected の越境を減点しないようにすること(今の採点を変えない)
- `ClassNode` など、キャンバス上の可視性マーク(+ / − / #)の表示変更
