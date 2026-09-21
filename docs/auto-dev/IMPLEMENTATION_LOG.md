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

## 2026-09-22 00:10 (JST) — 修正が必要なファイルにエラーマーク・危険マークを付ける

- 対応タスク: docs/auto-dev/TASKS.md の「修正が必要なファイルにエラーマーク・危険マークを付ける」
- コミット: 53bab53dbbb46d703632c47444bd50a4148055c3
- 実装内容:
  - `fileDeductions`(`domain/scoring/fileScores.ts`)でファイルごとの減点を算出。行数・責務は持ち主のファイル、結合度・循環依存は依存元クラスのファイルに数え、合計が `scoreCodebase` の減点と一致することをテストで確認
  - 結合度の判定を `findCouplingViolations` として切り出し、採点とファイル別減点で共用
  - ファイルノードのヘッダーに、減点ありは ⚠️(修正が必要)、30点以上は ⛔(危険)を表示。`aria-label`/`title` 付きで、ズームで詳細を隠していても出る
- 変更ファイル:
  - src/domain/scoring/fileScores.ts(新規)、fileScores.test.ts(新規)
  - src/domain/scoring/score.ts
  - src/presentation/canvas/FileNode.tsx
  - src/index.css
  - e2e/refactor.spec.ts
- 確認してほしいこと:
  - 各ステージで、違反のあるファイルにだけ印が付き、分解して違反が消えると印が消える・軽くなるか
  - 危険(30点以上)の見た目が、エラーと区別できるか。ズームアウト時にも印が見えるか
  - 危険マークが出る状況はE2Eでは見ていない(ユニットテストのみ)

## 2026-09-21 23:40 (JST) — 依存の矢印が途切れたり逆向きに回り込んだりするのを直す

- 対応タスク: docs/auto-dev/TASKS.md の「依存の矢印が途切れたり逆向きに回り込んだりするのを直す」
- コミット: 9455a3635f3983b91abf83bf45fddf6a311b455f
- 実装内容:
  - クラスノードの左右に source/target のハンドルを置き、`dependencyEdges` がファイルの並び順から向かい合う側(右→左、左→右、同一ファイルは右→右)を選ぶようにした
  - source は上寄り・target は下寄りにずらし、双方向の依存が別々の線として見えるようにした
  - 矢印に `zIndex` を付け、ファイルの箱より手前に描くようにした
- 変更ファイル:
  - src/presentation/canvas/layoutCodebase.ts
  - src/presentation/canvas/layoutCodebase.test.ts(新規)
  - src/presentation/canvas/ClassNode.tsx
  - src/index.css
- 確認してほしいこと:
  - 中級1で、Order⇄Customer の2本の赤い矢印が交差する別の線になり、両端に矢じりが見えるか
  - 同じファイル内のクラス間の矢印(右端どうし)の見た目が許容できるか(自動テストでは経路の見た目までは見ていない)

## 2026-09-21 21:51 (JST) — セマンティックズームを入れる

- 対応タスク: docs/auto-dev/TASKS.md の「セマンティックズームを入れる」
- コミット: 6f70bb9d1e1fcee291548886b6cfd5e6455f066e
- 実装内容:
  - React Flow の `useStore` でズーム倍率を読み、閾値 `DETAIL_ZOOM`(0.6)を `semanticZoom.ts` にまとめた
  - 倍率が閾値未満のときはファイルのパスとクラス名だけを表示し、メソッド一覧と行数バッジを隠す。閾値以上で元の表示に戻る
  - 倍率そのものではなく「詳細を出すか」の真偽値を購読し、ズーム操作中に毎フレーム再描画しないようにした
- 変更ファイル:
  - src/presentation/canvas/semanticZoom.ts(新規)
  - src/presentation/canvas/ClassNode.tsx、FileNode.tsx
  - e2e/refactor.spec.ts
- 確認してほしいこと:
  - 左下の「−」ボタンやホイールでズームアウトすると、0.6倍を境にメソッドと行数が消え、ズームインで戻るか。切り替わりの倍率が早すぎ・遅すぎないか
  - ファイルを4つ以上に増やすと自動のfitViewで0.6倍を下回り、メソッドが見えなくなる(ズームインすれば出る)。これで困らないか
  - 詳細を隠してもクラスノードの枠の大きさは変わらないため、概要表示では空白が目立つ

## 2026-09-21 21:49 (JST) — 責務の混在を採点する

- 対応タスク: docs/auto-dev/TASKS.md の「責務の混在を採点する」
- コミット: 6218e6fa5b30d22f445e7e65d9dfa949b894b3e3
- 実装内容:
  - クラスごとに、中の処理(Fragment)の `responsibility` が何種類あるかを数えるルールを採点に追加した。抽出で残る呼び出し行(`call`)は数えない
  - ステージ定義に `responsibilityLimit`(1クラスあたりの責務の上限)を追加し、超えたクラス1つにつき10点減点する
  - 画面上部の点数表示に「責務の混在 -10」の形で出す。どの責務が混ざっているか(`responsibility` の値)は表示しない
  - チュートリアルは上限を4にした(初期の OrderService は5種類で減点。税の計算を TaxCalculator へ移すと4種類になり解消)
- 変更ファイル:
  - src/domain/scoring/responsibilities.ts / responsibilities.test.ts(新規)
  - src/domain/scoring/score.ts / score.test.ts、src/domain/stage/Stage.ts
  - src/infrastructure/samples/tutorialStage.ts
  - src/presentation/stage/StagePanel.tsx
  - e2e/refactor.spec.ts
- 確認してほしいこと:
  - 初期表示が「80点(行数 -10 / 責務の混在 -10)」になり、税の計算を抽出して TaxCalculator へ移すと責務の混在の減点が消えるか
  - チュートリアルの上限4がゲームとして妥当か(3にすると、メール送信なども別クラスへ出す必要が出る)。上限値は実装者の判断で決めた
  - 違反しているクラスがどれかは点数表示からは分からない。クラスノード側にも印を出すべきかは未対応

## 2026-09-21 21:47 (JST) — クラスの新規作成とファイルの新規作成をできるようにする

- 対応タスク: docs/auto-dev/TASKS.md の「クラスの新規作成とファイルの新規作成をできるようにする」
- コミット: f5fd511db42a76d929a5c0fc014e145ec6b39798
- 実装内容:
  - ドメイン層に `addClass`(クラス名はコードベース全体で重複禁止)・`addFile`(同じパスは禁止)・`moveClass` を追加した。IDはユースケース層で採番して注入する
  - キャンバス左上(React Flow の `Panel`)に「クラス名+追加先ファイル+クラスを追加」「パス+ファイルを追加」のフォームを置いた。失敗理由はメソッドエディタ下のメッセージ欄に出る
  - クラスのヘッダー部分を掴むと、クラスごと別ファイルへドラッグできる(ファイルの中のクラスの上に落としても、そのファイルへの移動になる)
  - ファイルが増えたら全体が収まるよう表示し直し、クラスが空のファイルには「ここにクラスをドロップ」を出す
  - 新しいファイルはIDがUUIDになるため、ファイルノードの `data-testid` をパス基準(`file-<path>`)に変えた
- 変更ファイル:
  - src/domain/codebase/addClass.ts / addFile.ts / moveClass.ts(各テストとも新規)、Codebase.ts(`findFileOfClass`)
  - src/application/RefactorUseCases.ts / RefactorUseCases.test.ts
  - src/presentation/canvas/CanvasToolbar.tsx(新規)、ClassNode.tsx、FileNode.tsx、CodebaseCanvas.tsx、dndIds.ts、layoutCodebase.ts
  - src/presentation/store/useGameStore.ts、src/index.css
  - e2e/refactor.spec.ts
- 確認してほしいこと:
  - ファイルを追加すると右に新しいファイルが現れ、画面全体が収まるようにズームし直されるか(ズームが急に変わって気持ち悪くないか)
  - クラスのヘッダーを掴んでドラッグしたとき、プレビュー(クラス名の札)が出て、別ファイルに落とすと移動し、行数バッジが更新されるか
  - クラスのヘッダーをクリックしただけではドラッグにならないか、キーボード(Tab→Space→矢印→Space)でも移動できるか
  - クラスが空になったファイルは残る(削除機能はない)。ツールバーがキャンバス左上のノードに重なって操作しづらくないか

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
