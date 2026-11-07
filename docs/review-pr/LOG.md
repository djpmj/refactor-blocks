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

## 2026-11-07 22:35 UTC PR #469 部品置き場のファイルへのドロップの読み上げを余白落下に揃える(#449)

- 判定: 合格(blocker無し)
- 確認した内容: npm test ✅ / npm run lint ✅ / npm run typecheck ✅ / E2EはこのランナーにChromiumが無く未実行(CIで確認)
- マージ: squash & delete-branch

## 2026-11-07 14:40 UTC PR #468 ライトテーマの文字色・アクセント色のコントラストを4.5:1以上にする (#443)

- 判定: 合格(blocker無し)
- 確認した内容: npm test ✅ / npm run lint ✅ / npm run typecheck ✅(E2Eはこの環境で実行できず未実施、PR本文の事前実測とCIに依拠) 評価サイクル: 2回
- マージ: squash & delete-branch

## 2026-11-07 12:30 UTC PR #464 無効なボタンに操作できない理由を表示する (#423)

- 判定: 合格(blocker無し)
- 確認した内容: npm run check(lint/typecheck/test 2876件) ✅。E2Eはこの環境で実行できず、PR記載の全件E2E結果に依拠。ReasonButton+純粋関数への集約・DDD境界を差分で確認
- マージ: squash & delete-branch

## 2026-11-07 05:00 UTC PR #463 用語集のコード片を等幅表示する (#441)

- 判定: 合格(blocker無し)
- 確認した内容: npm test ✅(2846 passed) / npm run lint ✅ / npm run typecheck ✅。差分をIssue #441 と照合。E2Eはレビュー環境で実行できず(Chromium未導入)、CIのe2e全件passを確認。suggestion: infrastructureのテストがpresentationのsplitInlineCodeをimportしている
- マージ: squash & delete-branch

## 2026-11-07 05:00 UTC PR #462 短い画面でも白紙設計の部品を操作できるようにする (#434)

- 判定: 合格(blocker無し)
- 確認した内容: npm test ✅(2836 passed) / npm run lint ✅ / npm run typecheck ✅。CSSのみの最小変更をIssue #434 と照合。E2Eはレビュー環境で実行できず(Chromium未導入)、CIのe2e全件passを確認
- マージ: squash & delete-branch

## 2026-11-07 05:00 UTC PR #457 メソッドエディタを開いて狭くなったキャンバスで、選んだクラスが見えるようパンする (#430)

- 判定: 合格(blocker無し)
- 確認した内容: npm test ✅(2831 passed) / npm run lint ✅ / npm run typecheck ✅。revealInViewport が既存の panToReveal を再利用していることをIssue #430 と照合。E2Eはレビュー環境で実行できず(Chromium未導入)、CIのe2e全件passを確認
- マージ: squash & delete-branch

## 2026-11-07 05:00 UTC PR #453 狭いデスクトップ幅でサイドバー幅を画面に収める (#429)

- 判定: 合格(blocker無し)
- 確認した内容: npm test ✅(2822 passed) / npm run lint ✅ / npm run typecheck ✅。sidebarWidthBounds の境界値テストをIssue #429 と照合。E2Eはレビュー環境で実行できず(Chromium未導入)、CIのe2e全件passを確認
- マージ: squash & delete-branch

## 2026-11-07 UTC PR #461 クラス追加時の名前入力を廃止する (#426)

- 判定: 合格(blocker無し)
- 確認した内容: npm test ✅(2836 passed / 1 skipped)/ npm run lint ✅ / npm run typecheck ✅。差分をIssue #426・仕様書add-class-name-inputと照合(addClassUseCaseの名前引数削除とuniqueNameでNewClass連番、名前入力欄の削除、domainのaddClassは未変更)。E2Eはこの環境で実行できず未実行(PR本文では関連5 spec・全件成功)
- マージ: squash & delete-branch

## 2026-11-07 UTC PR #460 クリア画面の100点表示を1行に収める (#437)

- 判定: 合格(blocker無し)
- 確認した内容: npm run check(lint・typecheck・Vitest 2833 passed)✅。差分(CSS 1行 nowrap+font-size とE2E1本)をIssue #437・仕様書と照合。E2EはレビューCIにChromiumが無く未実行、PR記載の結果を確認
- マージ: squash & delete-branch

## 2026-11-07 UTC PR #459 エディタ見出しが長いメソッド名で溢れないようにする (#433)

- 判定: 合格(blocker無し)
- 確認した内容: npm test ✅(2833 passed) / npm run lint ✅ / npm run typecheck ✅。差分(CSS 1行 overflow-wrap: anywhere とE2E追加)をIssue #433 の修正方針と照合。新規E2Eはレビュー環境で実行できず未実行、PR記載の結果を確認。評価サイクル: 1回
- マージ: squash & delete-branch

## 2026-11-07 00:25 UTC PR #456 モーダル表示中は Undo/Redo と ? を背面に効かせない (#428)

- 判定: 合格(blocker無し)
- 確認した内容: npm test ✅(2827 passed) / npm run lint ✅ / npm run typecheck ✅。差分をIssue #428 の仕様(isShortcutBlocked・data-allows-shortcuts による操作ガイドの例外)と照合。E2Eはレビュー環境で実行できず、PR記載の実測結果を確認。評価サイクル: 1回
- マージ: squash & delete-branch

## 2026-11-06 23:40 UTC PR #454 講評パネルを閉じられるようにする (#416)

- 判定: 合格(blocker無し)
- 確認した内容: npm test ✅(2815 passed) / npm run lint ✅ / npm run typecheck ✅。差分をIssue #416 の仕様(キャンバス右上に重ねる・閉じるボタン・dismissCritique)と照合。E2Eはレビュー環境で実行できず(Chromium未導入)、PR記載の実測結果を確認。評価サイクル: 1回
- マージ: squash & delete-branch

## 2026-11-05 15:00 UTC PR #452 ツアーのポップオーバーが対象を覆わないようにする (#419)

- 判定: 合格(blocker無し)
- 確認した内容: npm test ✅(2814 passed) / npm run lint ✅ / npm run typecheck ✅。差分をIssue #419 の仕様(calloutPlacement・avoid・実測サイズ)と照合。E2Eはレビュー環境で実行できず(Chromium未導入)、CIのe2e全件passを確認
- マージ: squash & delete-branch

## 2026-11-05 14:15 UTC PR #451 キーボードだけでメソッドを開いて抽出できるようにする (#424)

- 判定: 合格(blocker無し)
- 確認した内容: npm test ✅(2773 passed) / npm run lint ✅ / npm run typecheck ✅。KeyboardSensor の開始キーを Space のみにする修正をIssue #424 の原因と照合。E2Eはレビュー環境で実行できず(Chromium未導入)、PR記載の実測結果を確認
- マージ: squash & delete-branch

## 2026-11-05 14:10 UTC PR #450 クラス名とメソッド名の識別子検証を統一する (#425)

- 判定: 合格(blocker無し)
- 確認した内容: npm test ✅(2802 passed) / npm run lint ✅ / npm run typecheck ✅。E2Eはレビュー環境で実行できず、PR記載の実測結果を確認
- マージ: squash & delete-branch

## 2026-11-05 12:40 UTC PR #448 React Flow の外枠が0pxになる警告(error#004)を止める (#422)

- 判定: 合格(blocker無し)
- 確認した内容: npm run check(lint/typecheck/vitest 2766 passed)✅。差分(.react-flow の min-size 1px とE2E追加)をIssue #422 の原因と照合。E2Eはレビュー環境で実行できず未実施(CI待ち)
- マージ: squash & delete-branch

## 2026-11-05 12:32 UTC PR #447 講評の取得タイミングを案内し、古い講評の再表示を防ぐ (#415)

- 判定: 合格(blocker無し)
- 確認した内容: npm test ✅(2773 passed) / npm run lint ✅ / npm run typecheck ✅。Issue #415・仕様(feedback-snapshot-staleness)と差分を照合。E2Eはレビュー環境で実行できず未実施(PR本文の全件565 passedに依存)
- マージ: squash & delete-branch

## 2026-11-04 UTC PR #446 メソッド名の提案と混在判定を改善し、混在の警告を表示する (#417)

- 判定: 合格(blocker無し)
- 確認した内容: npm test ✅(2766 passed) / npm run lint ✅ / npm run typecheck ✅。Issue #417の方針と差分を照合。E2Eはレビュー環境で実行できず未実施(PR本文の結果とCIに依存)
- マージ: squash & delete-branch

## 2026-11-04 UTC PR #445 ツアー終了時にクリア画面を出す (#414)

- 判定: 合格(blocker無し)
- 確認した内容: npm test ✅(2749 passed) / npm run lint ✅ / npm run typecheck ✅。Issue #414の方針・受け入れ基準と差分を照合。E2Eはレビュー環境で実行できず未実施(PR本文では560 passed と記載)
- マージ: squash & delete-branch

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


