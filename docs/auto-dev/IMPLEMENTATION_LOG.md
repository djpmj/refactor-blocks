# 自動実装ログ

`.github/workflows/auto-dev.yml` がタスクを実装してmasterにpushするたびに、
その内容をここに追記する。新しい記録は**このファイルの一番上(このすぐ下)**に追加する。

人間が後から読んで「何が実装されたか」「動作確認として何をすればよいか」が
分かることを目的とする。差分(diff)そのものはgitログで見られるので、ここには
diffは書かず、要約と確認観点だけを書く。

ファイルが肥大化しないよう、**記録は直近30件までとし、31件目以降(古いもの)は削除する**。
削除した記録の内容はgit履歴(`git log -p docs/auto-dev/IMPLEMENTATION_LOG.md`)から参照できる。

## 記録の書式

```
## YYYY-MM-DD HH:MM (JST) — タスクのタイトル

- 対応タスク: docs/auto-dev/TASKS.md の「タスクのタイトル」
- コミット: <コミットハッシュ>
- 実装内容:
  - 何をどう実装したか(箇条書き2〜5行程度、diffの丸写しではなく要約)
- 変更ファイル:
  - path/to/file.ts
- 確認してほしいこと:
  - 人間が目視・実操作で確認すべき具体的な観点(例: ○○画面で△△した時に□□になるか)
  - 自動テストではカバーしていない可能性がある懸念点があれば明記する
```

## ログ一覧

## 2026-09-21 20:25 (JST) — メソッドの統合(Inline Method)を追加する

- 対応タスク: docs/auto-dev/TASKS.md の「メソッドの統合(Inline Method)を追加する」
- コミット: 3805430ef55a806fbe1ef363d59759177994acc6
- 実装内容:
  - private メソッドの処理を、呼び出し元に残っている呼び出し行(`<id>:call`)の位置へ戻し、メソッド自体を消す `inlineMethod` をドメイン層に追加した(抽出→戻すで元どおりになる)
  - public メソッド・呼び出し行が見つからない場合は `Result` のエラーで返し、日本語メッセージで表示する
  - メソッドエディタで private メソッドを開いたときだけ「呼び出し元へ戻す」ボタンを出し、戻したあとは呼び出し元のメソッドを選択状態にする
  - 呼び出し行IDの組み立て(`callFragmentId`)を Extract Method と共有した
- 変更ファイル:
  - src/domain/codebase/inlineMethod.ts / inlineMethod.test.ts(新規)
  - src/domain/codebase/extractMethod.ts
  - src/application/RefactorUseCases.ts / RefactorUseCases.test.ts
  - src/presentation/store/useGameStore.ts
  - src/presentation/editor/MethodEditor.tsx
  - e2e/refactor.spec.ts
- 確認してほしいこと:
  - placeOrder から処理を抽出 → 抽出したメソッドをクリック →「呼び出し元へ戻す」で、処理が元の位置(順番)に戻り、行数・点数も元に戻るか
  - 抽出したメソッドを TaxCalculator へドラッグで移したあとでも戻せ、依存の矢印が消えるか
  - 抽出メソッドの中からさらに抽出した場合(入れ子)に、外側を戻すと内側の呼び出し行が placeOrder 側へ移り、内側も続けて戻せるか
  - 呼び出し行以外(ステージ定義の `uses` など)から参照されているメソッドを戻すと、参照が宙に浮く(現状はチェックしていない)
