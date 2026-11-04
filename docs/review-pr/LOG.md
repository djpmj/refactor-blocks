# PRレビューログ

`.github/workflows/review-pr.yml` が定期実行でPRをレビュー・マージした際の記録。
ヘッドレス実行でユーザーのリアルタイム承認を得られないため、マージ前に何を確認したかを
ここに記録し、事後に追跡できるようにする。

## 書式

### 自動マージした場合

```
## YYYY-MM-DD HH:MM UTC PR #<番号> <タイトル>

- 判定: 合格(blocker無し)
- 確認した内容: npm test ✅ / npm run lint ✅ / npm run typecheck ✅(必要に応じてE2Eも)
- マージ: squash & delete-branch
```

### `.github/workflows/` 配下を含み自動マージを見送った場合

`claude_code_oauth_token` が使うGitHub Appには GitHub の `workflows` 権限が無く、
`.github/workflows/` 配下を変更するPRのマージはGraphQL API側で必ず拒否される
(`refusing to allow a GitHub App to create or update workflow ... without 'workflows' permission`)。
このケースは承認コメントのみ投稿し、`gh pr merge` は実行しない(失敗するのを承知で試行しない)。

```
## YYYY-MM-DD HH:MM UTC PR #<番号> <タイトル>

- 判定: 合格(blocker無し)
- 確認した内容: npm test ✅ / npm run lint ✅ / npm run typecheck ✅
- マージ: 見送り(.github/workflows/配下を含むためGitHub Appの権限で自動マージ不可。人が手動でマージする)
```

- 新しい記録は「## ログ一覧」見出し直後(一覧の先頭)に追記する
- 記録が30件を超えたら、古いものから削除して直近30件までに収める
  (削除した内容はgit履歴 `git log -p docs/review-pr/LOG.md` から参照できる)
- blockerがあってマージしなかったPRはここに書かない(PR側のレビューコメントで追える)

## ログ一覧

## 2026-11-04 UTC PR #444 クリア直後のステージを次のおすすめから外す (#420)

- 判定: 合格(blocker無し)
- 確認した内容: npm test ✅(2743 passed) / npm run lint ✅ / npm run typecheck ✅。Issue #420の決定事項と差分を照合。E2Eはレビュー環境で実行できず未実施(PR本文では全件通過と記載)
- マージ: squash & delete-branch

## 2026-11-03 UTC PR #413 上級ステージの C# 実行化と bindings 選択結果の検証 (#395)

- 判定: 合格(blocker無し)
- 確認した内容: npm run check ✅(lint・typecheck・Vitest 2736件)。Issue #395の内容と差分を照合。.github/workflows/配下なし。E2E・dotnetはこの環境で未実行、PR記載のCI実績に依拠
- マージ: squash & delete-branch

## 2026-11-03 UTC PR #412 狭い画面で変更依頼を始めたとき課題サイドバーを自動で閉じる (#404)

- 判定: 合格(blocker無し)
- 確認した内容: npm test ✅(2717件) / npm run lint ✅ / npm run typecheck ✅。Issue #404の受け入れ基準と差分を照合(701〜1399pxで自動クローズ・フォーカス移動・読み上げ・1366幅へのE2E復帰)。E2Eはこの環境で実行できず、PR記載のCI実績に依拠
- マージ: squash & delete-branch

## 2026-11-03 UTC PR #411 CI の C# 検証で全手順を書き出して、master の csharp ジョブを直す

- 判定: 合格(blocker無し)
- 確認した内容: npm test ✅ / npm run lint ✅ / npm run typecheck ✅
- マージ: 見送り(.github/workflows/配下を含むためGitHub Appの権限で自動マージ不可。人が手動でマージする)

## 2026-11-03 00:30 UTC PR #408 chore(deps): bump the development-dependencies group across 1 directory with 4 updates

- 判定: 合格(blocker無し)
- 確認した内容: npm ci ✅ / npm test ✅ / npm run lint ✅ / npm run typecheck ✅
- マージ: squash & delete-branch

## 2026-11-02 20:30 UTC PR #409 chore(deps): bump actions/setup-dotnet from 5 to 6

- 判定: 合格(blocker無し)
- 確認した内容: 変更は .github/workflows/ci.yml の setup-dotnet バージョン1行のみ。CLAUDE.mdの開発ルールに反しない
- マージ: 見送り(.github/workflows/配下を含むためGitHub Appの権限で自動マージ不可。人が手動でマージする)

## 2026-11-02 20:30 UTC PR #407 chore(deps): bump @rolldown/binding-linux-x64-gnu from 1.2.15 to 1.2.16 in the production-dependencies group

- 判定: 合格(blocker無し)
- 確認した内容: npm test ✅ / npm run lint ✅ / npm run typecheck ✅ / npm run build ✅
- マージ: squash & delete-branch

## 2026-11-01 13:20 UTC PR #405 狭い画面で課題サイドバーがキャンバスを覆わないよう幅を抑える (#400)

- 判定: 合格(blocker無し)
- 確認した内容: npm test ✅ / npm run lint ✅ / npm run typecheck ✅(E2Eはレビュー環境で実行できず、PR本文の実測結果539通過・1件は負荷タイムアウトで単独再実行は通過を根拠にした)
- マージ: squash & delete-branch

## 2026-11-01 12:10 UTC PR #403 C#書き出しでクラス間の依存をコンストラクタ注入として配線する (#392)

- 判定: 合格(blocker無し)
- 確認した内容: npm test ✅ / npm run lint ✅ / npm run typecheck ✅、差分がIssue #392・仕様 csharp-move-wiring とDDD層境界に沿うことを確認(E2EはPR本文の全件通過報告を参照)
- マージ: squash & delete-branch

## 2026-11-01 11:20 UTC PR #402 メソッド抽出・統合で変数の受け渡しをC#コードに反映する (#391)

- 判定: 合格(blocker無し)
- 確認した内容: npm run check(lint・typecheck・Vitest 183ファイル/2690件)✅。差分をIssue #391・docs/specs/csharp-extract-dataflow.md と照合(domainのmethodSignature/extractMethod/fragmentCode/generateClassSource/isCodebase)。E2Eはこの環境で未実行(PR本文では538件成功)
- マージ: squash & delete-branch

## 2026-11-01 10:50 UTC PR #401 左サイドバーの初期幅を480に統一する (#388)

- 判定: 合格(blocker無し)
- 確認した内容: npm test ✅(179ファイル/2637件) / npm run lint ✅ / npm run typecheck ✅。差分をIssue #388・docs/specs/left-sidebar-default-max-width.mdと照合(上限定数の共通化、CSSフォールバック480px、E2E期待値/ビューポートの更新のみ)。E2Eはこの環境で実行できず未実行(PR本文に実測結果あり)
- マージ: squash & delete-branch

## 2026-11-01 09:30 UTC PR #399 ステージのソースをC#の実行可能プロジェクトとして書き出す (#390)

- 判定: 合格(blocker無し)
- 確認した内容: npm test ✅(181ファイル/2654件) / npm run lint ✅ / npm run typecheck ✅。差分をIssue #390と照合(domainのcsharpProject/buildIssues/StageRuntime、infrastructureのzip、presentationのSourceDownloadDialog。zip-slipはsanitizeSourcePath経由で対策済み)。E2E(reference-menu)とdotnet検証はこの環境で実行できず未実行(PR本文に実測結果あり)
- マージ: 見送り(.github/workflows/配下を含むためGitHub Appの権限で自動マージ不可。人が手動でマージする)

## 2026-11-01 09:20 UTC PR #398 サイドバーで変更カードをクリア条件より上に並べる (#389)

- 判定: 合格(blocker無し)
- 確認した内容: npm test ✅(179ファイル/2637件) / npm run lint ✅ / npm run typecheck ✅。差分をIssue #389と照合(StageSidebarの並び替え1行+E2E期待順序の更新のみ、順序依存CSSなし)。E2E(sidebar-structure)はこの環境でブラウザ未導入のため未実行(PR本文では単独再実行で全件成功)
- マージ: squash & delete-branch

## 2026-11-01 07:55 UTC PR #397 ステージ一覧から1ステージ分の記録をリセットできるようにする (#360)

- 判定: 合格(blocker無し)
- 確認した内容: npm run check(lint・typecheck・Vitest 179ファイル/2637件)✅。差分をIssue #360・docs/specs/stage-record-reset.mdと照合(withoutStageをdomainにテスト先行で追加、storeに resetStageRecord、UIは確認付きボタン)。E2E(roadmap.spec.ts)はこの環境でブラウザ未導入のため未実行(PR本文では19件成功)
- マージ: squash & delete-branch

## 2026-11-01 03:38 UTC PR #396 score-floor-progress の E2E で、開いた減点の内訳を閉じてから右クリックする

- 判定: 合格(blocker無し)
- 確認した内容: npm test ✅ / npm run lint ✅ / npm run typecheck ✅。E2Eヘルパー closeBreakdown 追加のみのテスト変更。E2Eはこの環境で実行許可が無く未実行
- マージ: squash & delete-branch

## 2026-10-31 08:40 UTC PR #387 前提ステージが未クリアのとき、課題パネルに先にやるステージを案内する (#359)

- 判定: 合格(blocker無し)
- 確認した内容: npm test ✅(178ファイル/2626件) / npm run lint ✅ / npm run typecheck ✅。差分をIssue #359/仕様書stage-prerequisite-noteと照合(unclearedPrerequisitesをdomainにテスト先行で追加、presentationは表示のみ)。E2E(prerequisite-note.spec.ts)はこの環境でブラウザ未導入のため未実行(CIで確認)
- マージ: squash & delete-branch

## 2026-10-31 07:45 UTC PR #386 ステージを開いた直後の点数に「スタート時の点数」の注記を出す (#361)

- 判定: 合格(blocker無し)
- 確認した内容: npm test ✅(178ファイル/2618件) / npm run lint ✅ / npm run typecheck ✅。差分をIssue #361/仕様書start-score-untouched-labelと照合(presentation層のみ、isStartingScoreで点数同一の間だけ注記)。E2Eはこの環境でブラウザ未導入のため未実行(PR本文では全件527 passed)
- マージ: squash & delete-branch

## 2026-10-31 03:30 UTC PR #385 減点が変わらなかった組み替えに、効いていない理由を出す (#362)

- 判定: 合格(blocker無し)
- 確認した内容: npm test ✅(178ファイル/2613件) / npm run lint ✅ / npm run typecheck ✅。差分をIssue #362と仕様書wrong-move-reason-hintの設計判断(配置が変わった時のみ・減点0と白紙設計は除外・presentation層のみ)と照合。E2Eはこの環境でブラウザ未導入のため未実行(PR本文では関係E2E 20件通過)
- マージ: squash & delete-branch

## 2026-10-31 02:15 UTC PR #384 クイズ・ブランクモードの初回紹介ガイドを追加する (#354)

- 判定: 合格(blocker無し)
- 確認した内容: npm run check(lint・typecheck・Vitest 2602件)✅。差分をIssue #354/仕様書mode-intro-guidesと照合(presentation/infrastructureのみ、SpotlightOverlayのtotal・testId化で既存ツアー維持、storageState追加)。E2Eはこの環境でブラウザ未導入のため未実行(PR本文では関係E2E 60件成功)
- マージ: squash & delete-branch

## 2026-10-31 01:35 UTC PR #382 操作ごとの採点の推移を履歴として見られるようにする (#355)

- 判定: 合格(blocker無し)
- 確認した内容: npm run check(lint・typecheck・Vitest 2594件)✅。差分をIssue #355の設計判断と照合(operationLabelsのMap・Historyは不変・presentation層のみ)。E2Eはこの環境で実行許可が無く未実行(PR本文では関係E2E 70件成功)
- マージ: squash & delete-branch

## 2026-10-30 11:20 UTC PR #381 似たパターンの使い分けを比較表で見られるようにする (#356)

- 判定: 合格(blocker無し)
- 確認した内容: npm test ✅(2575件) / npm run lint ✅ / npm run typecheck ✅ / docs/specs/pattern-comparison-table.md と差分を照合(presentationのみの変更・静的データとステージ定義のずれ検出テスト・E2E追加)。E2Eはこの環境で実行許可が無く未実行(PR本文ではroadmap.spec 14件通過と記載)
- マージ: squash & delete-branch

## 2026-10-30 10:45 UTC PR #380 抽出・移動の前後のコード差分を表示する (#357)

- 判定: 合格(blocker無し)
- 確認した内容: npm test ✅(2571件) / npm run lint ✅ / npm run typecheck ✅ / 差分をdocs/specs/refactor-code-diff-view.mdと照合(domain純粋関数・Fragment.id対応づけ・application無変更)。E2Eはこの環境にPlaywrightブラウザが無く未実行(PR本文の実測を参照)
- マージ: squash & delete-branch

## 2026-10-30 10:30 UTC PR #379 短い練習問題(マイクロドリル)をステージ一覧に追加する (#353)

- 判定: 合格(blocker無し)
- 確認した内容: npm test ✅(2562件) / npm run lint ✅ / npm run typecheck ✅ / docs/specs/micro-drills.md の変更対象一覧と差分を照合(application層無変更・checks/changeRequests 0件の守り・stageReportのドリル除外)。E2E(micro-drills/roadmap)はこの環境で実行許可が無く未実行(PR本文では既存specの1件のみ失敗、単独では通過と記載)
- マージ: squash & delete-branch

## 2026-10-29 15:10 UTC PR #378 抽出時のクラス上限案内と操作結果を追加 (#351)

- 判定: 合格(blocker無し)
- 確認した内容: npm test ✅(2428件) / npm run lint ✅ / npm run typecheck ✅ / Issue #351の設計判断と差分を照合(新しく超えるときだけ・クラス優先・nextStepはoperationResultがnullなら足さない・domain無変更)。E2E(extract-class-limit-heads-up)はこの環境で実行許可が無く未実行(PR本文では成功と記載)
- マージ: squash & delete-branch

## 2026-10-29 11:15 UTC PR #377 設計くらべの成績を保存し、ステージ一覧に表示する (#349)

- 判定: 合格(blocker無し)
- 確認した内容: npm run check(lint・typecheck・Vitest 2426件)✅ / 仕様(comparison-quiz-score-record)と差分を照合(quizRecord・入力検証つき保存・roadmap-quiz表示・E2E追加)。E2EはChromium未導入で実行不可(PR本文では496件成功)
- マージ: squash & delete-branch

## 2026-10-29 11:10 UTC PR #376 白紙設計の問題を増やし、問題を選べるようにする (#345)

- 判定: 合格(blocker無し)
- 確認した内容: npm test ✅(2391件) / npm run lint ✅ / npm run typecheck ✅ / 仕様(blank-design-more-problems)と差分を照合(検証関数・白紙2/3・問題select・配置済み時の確認・E2E追加)。E2EはChromium未導入で実行不可(PR本文では482件成功)
- マージ: squash & delete-branch

## 2026-10-29 10:50 UTC PR #375 単一処理の抽出にも模範解答の名前を適用する (#352)

- 判定: 合格(blocker無し)
- 確認した内容: npm test ✅(2381件) / npm run lint ✅ / npm run typecheck ✅ / 仕様(hint-extract-name-mismatch)と差分を照合(methodNamingOfのフィルタ撤去・suggestMethodNameの一致優先・ヒント文変更・E2E追加)。E2EはChromium未導入で実行不可(PR本文では487件成功)
- マージ: squash & delete-branch

## 2026-10-29 10:20 UTC PR #374 設計くらべに2段目「理由の3択」を追加する (#348)

- 判定: 合格(blocker無し)
- 確認した内容: npm test ✅(2397件) / npm run lint ✅ / npm run typecheck ✅ / E2Eはブラウザ未導入で実行不可(コードのみ確認)
- マージ: squash & delete-branch

## 2026-10-29 10:00 UTC PR #373 100点後の振り返りメモを追加 (#346)

- 判定: 合格(blocker無し)
- 確認した内容: npm run check(2376件) ✅ / npm run lint ✅ / npm run typecheck ✅(E2EはChromium未導入で実行不可、PR記載の結果を信頼。受け入れ基準は差分で確認)
- マージ: squash & delete-branch

## 2026-10-28 13:15 UTC PR #372 AI講評の失敗時にルールベースの簡易講評を出す (#350)

- 判定: 合格(blocker無し)
- 確認した内容: npm test ✅(2356件) / npm run lint ✅ / npm run typecheck ✅ / 仕様(critique-failure-fallback)と差分を照合(fallback状態・describeFallbackCritique・CritiquePanel表示・E2E追加)。E2Eはレビュー環境で実行できず未実行(PR本文では全件480件成功)
- マージ: squash & delete-branch

