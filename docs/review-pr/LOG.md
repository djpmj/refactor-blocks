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

## 2026-10-28 12:55 UTC PR #371 コードの臭い図鑑を追加 (#343)

- 判定: 合格(blocker無し)
- 確認した内容: npm test ✅(2338件) / npm run lint ✅ / npm run typecheck ✅ / E2Eはブラウザ未導入で実行不可(コードのみ確認)
- マージ: squash & delete-branch

## 2026-10-28 12:30 UTC PR #370 設計くらべを4問から8問に増やす (#347)

- 判定: 合格(blocker無し)
- 確認した内容: npm run check(lint / typecheck / vitest 2332件)✅。Issue #347の仕様と差分を照合(5〜8問目のデータ・requestById・E2Eの8問対応・domain変更なし)。E2Eはレビュー環境にChromiumが無く未実行(PR本文では473件成功)
- マージ: squash & delete-branch

## 2026-10-28 UTC PR #369 白紙設計の答え合わせが押せない理由を表示する (#344)

- 判定: 合格(blocker無し)
- 確認した内容: npm run check(lint / typecheck / vitest 2326件)✅。Issue #344の仕様と差分を照合(理由文・aria-describedby・全配置後は非表示・CSS再利用・domain変更なし)。E2Eはレビュー環境にChromiumが無く未実行(PR本文では468件成功)、追加E2Eの期待値はコードと整合を目視確認
- マージ: squash & delete-branch

## 2026-10-28 UTC PR #365 用語ボタン(用語集)を追加し、目標文・採点の用語から意味を引けるようにする (#326)

- 判定: 合格(blocker無し)
- 確認した内容: npm test ✅(2326件) / npm run lint ✅ / npm run typecheck ✅。仕様書term-glossary-popoverと照合し、masterとの競合解消コミット(StageCardの用語ボタン構成とretry・復習バッジの統合)も確認。E2Eはレビュー環境にChromiumが無く未実行(PR本文では460件成功)
- マージ: squash & delete-branch

## 2026-10-27 15:20 UTC PR #368 初回満点時のクリア画面と遷移選択を追加 (#315)

- 判定: 合格(blocker無し)
- 確認した内容: npm test ✅(2309件) / npm run lint ✅ / npm run typecheck ✅(前回指摘のe2e DOM型エラーは7dc2925で解消)。E2E(clear-screen)はレビュー環境にChromiumが無く未実行(PR本文では全466件成功)。Issue #315・docs/specs/clear-celebration-screen.mdの変更対象と差分を照合
- マージ: squash & delete-branch

## 2026-10-27 12:50 UTC PR #366 助けの使用記録を保存し、弱点ステージの復習に反映する (#325)

- 判定: 合格(blocker無し)
- 確認した内容: npm test ✅(2300件) / npm run lint ✅ / npm run typecheck ✅。E2E(review-weak-stages)はレビュー環境にChromiumが無く未実行(PR本文では全462件成功)。Issue #325の設計判断との整合を差分で確認
- マージ: squash & delete-branch

## 2026-10-27 12:46 UTC PR #367 ローカルのE2E並列数を既定で1にしてPCの負荷を下げる

- 判定: 合格(blocker無し)
- 確認した内容: npm test ✅(2271件) / npm run lint ✅ / npm run typecheck ✅(playwright.config.tsとCLAUDE.mdのみの変更。E2Eは未実行)
- マージ: squash & delete-branch

## 2026-10-27 01:00 UTC PR #364 chore(deps): bump the development-dependencies group across 1 directory with 4 updates

- 判定: 合格(blocker無し)
- 確認した内容: npm test ✅(2271件) / npm run lint ✅ / npm run typecheck ✅ / npm run build ✅(package.json/lockのみの変更。E2E未実行)
- マージ: squash & delete-branch

## 2026-10-26 21:00 UTC PR #363 chore(deps): bump the production-dependencies group with 3 updates

- 判定: 合格(blocker無し)
- 確認した内容: npm test ✅ / npm run lint ✅ / npm run typecheck ✅(package.json/lockのみの変更。E2E未実行)
- マージ: squash & delete-branch

## 2026-10-26 11:10 UTC PR #342 ステージに設計原則を紐づけて表示する (#322)

- 判定: 合格(blocker無し)
- 確認した内容: npm test ✅(2271件) / npm run lint ✅ / npm run typecheck ✅。E2Eはこの環境で実行不可(PR本文では440件成功)。仕様書principle-labelsと差分を照合
- マージ: squash & delete-branch

## 2026-10-26 11:00 UTC PR #340 操作結果のフィードバックを表示する (#320)

- 判定: 合格(blocker無し)
- 確認した内容: npm run check(lint・typecheck・Vitest 2222件)✅。差分をIssue #320の設計判断と照合(domain層は無変更)。E2Eはこの環境にChromiumが無く未実行(PR本文では446件成功・1件は単独再実行で成功)
- マージ: squash & delete-branch

## 2026-10-26 10:50 UTC PR #341 学習記録をロードマップに表示する (#323)

- 判定: 合格(blocker無し)
- 確認した内容: npm test(2228件)✅ / npm run lint ✅ / npm run typecheck ✅。差分をIssue #323・docs/specs/progress-export-import.mdと照合(入力検証・層境界)。E2Eはこの環境で実行できず未実行(PR本文では446件成功)
- マージ: squash & delete-branch

## 2026-10-26 10:30 UTC PR #339 手数チャレンジ: 最少手数との比較とベスト記録を追加 (#319)

- 判定: 合格(blocker無し)
- 確認した内容: npm test(2205件)✅ / npm run lint ✅ / npm run typecheck ✅。差分をIssue #319・docs/specs/move-count-challenge.mdの設計判断と照合。E2Eはこの環境でブラウザ未導入のため未実行(PR本文では440件成功)
- マージ: squash & delete-branch

## 2026-10-26 09:45 UTC PR #338 手で直す最中の「読む」クリックと「直した」印を別の操作に分ける (#318)

- 判定: 合格(blocker無し)
- 確認した内容: npm test(2154件)✅ / npm run lint ✅ / npm run typecheck ✅。差分をIssue #318・docs/specs/manual-fix-read-vs-mark.mdの設計判断と照合。E2Eはこの環境でブラウザ未導入のため未実行(PR本文では429件成功)
- マージ: squash & delete-branch

## 2026-10-26 09:30 UTC PR #337 クリアを習得として扱い、マイルストーン表示を追加する (#316)

- 判定: 合格(blocker無し)
- 確認した内容: npm test(2177件)✅ / npm run lint ✅ / npm run typecheck ✅。差分をIssue #316・docs/specs/clear-means-learned.mdと照合(DDD層境界・isMilestonesの入力検証を確認)。E2Eはこの環境で実行許可が無く未実行(PR本文では434件成功)
- マージ: squash & delete-branch

