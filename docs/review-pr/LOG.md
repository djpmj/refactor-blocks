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

## 2026-10-17 10:50 UTC PR #214 feat: refit the canvas on resize without hiding method details

- 判定: 合格(blocker無し)
- 確認した内容: npm run check(lint / typecheck / test 1797件)✅。E2Eはレビュー環境で実行不可(ブラウザ未導入。PR本文では252件通過)。Issue #180・#189 と docs/specs/canvas-refit-on-resize.md・detail-zoom-floor.md の、リサイズ時の自動再フィット(ユーザー操作後は抑止)・DETAIL_ZOOM未満にしない autoViewport・縮小中の案内を差分で確認。変更は presentation 層のみで純粋関数にユニットテストあり
- マージ: squash & delete-branch

## 2026-10-17 10:30 UTC PR #213 feat: add a boss change request where refactoring pays off

- 判定: 合格(blocker無し)
- 確認した内容: npm run check(lint / typecheck / test 1789件)✅ / E2E 243件中240通過(hint-highlight・score-jump の2件はmasterでも同様に失敗する既存問題、operation-guide はflaky)。Issue #170 の受け入れ基準を差分で確認(boss フラグ・痛みカードからの除外・bossCounterfactual・比較表示・11ステージのボス・カタログテスト)
- マージ: squash & delete-branch

## 2026-10-17 10:10 UTC PR #212 test: make the E2E port configurable

- 判定: 合格(blocker無し)
- 確認した内容: npm run check(lint / typecheck / test 1777件)✅ / E2Eはこの環境でChromiumが無く実行できず未実行(PR記載の238件成功を前提とした)。Issue #211 の受け入れ基準を差分で確認(E2E_PORT検証・E2E_REUSE_SERVER・storageState内包・相対パスのcritique endpoint・storage-state.json削除)。e2e側のモックは `**/__critique-test__` で相対パスでも一致
- マージ: squash & delete-branch

## 2026-10-17 06:10 UTC PR #210 feat: show class and file relief in the change pain card

- 判定: 合格(blocker無し)
- 確認した内容: npm run check(lint / typecheck / test 1773件)✅ / E2Eはこの環境で実行できず未実行(PR記載の240件成功を前提とした)。Issue #181 の受け入れ基準を差分で確認。suggestion: ModifyBeforeでfirstSitesTextを2回呼んでいる
- マージ: squash & delete-branch

## 2026-10-17 06:00 UTC PR #209 feat: show where field accesses come from

- 判定: 合格(blocker無し)
- 確認した内容: npm test ✅(1767件) / npm run lint ✅ / npm run typecheck ✅ / E2Eはこの環境で実行できず未実行(PR記載の239件成功を前提とした)。Issue #187 の受け入れ基準1〜4を差分で確認
- マージ: squash & delete-branch

## 2026-10-17 03:20 UTC PR #208 fix: align critique request contract

- 判定: 合格(blocker無し)
- 確認した内容: npm run check(lint/typecheck/vitest 1763件) ✅ / workers/critique typecheck ✅ / E2Eはこの環境で実行できず未実行(PR記載の238件成功を前提とした)。Issue #188 の受け入れ基準(path必須の撤廃・契約テスト・400専用メッセージ)を差分で確認。Worker再デプロイは人が実施
- マージ: squash & delete-branch

## 2026-10-17 02:45 UTC PR #207 Explain visibility and dependency limits

- 判定: 合格(blocker無し)
- 確認した内容: npm test ✅(1759件) / npm run lint ✅ / npm run typecheck ✅ / E2EはChromium未導入で実行不可(PR記載の237件成功と差分で確認)。Issue #186 の受け入れ基準1〜3を差分で確認
- マージ: squash & delete-branch

## 2026-10-17 02:30 UTC PR #206 Reduce member ranks in intermediate stage

- 判定: 合格(blocker無し)
- 確認した内容: npm test ✅(1755件) / npm run lint ✅ / npm run typecheck ✅(E2Eはこの環境で実行できず未実行。差分はステージ定義とテストのみ)
- マージ: squash & delete-branch

## 2026-10-17 UTC PR #205 feat: group context menu actions

- 判定: 合格(blocker無し)
- 確認した内容: npm run check(lint/typecheck/vitest 1751件) ✅ / E2EはCI環境にPlaywrightブラウザが無く再実行できず、PR本文の成功報告(237件)に依拠
- マージ: squash & delete-branch

## 2026-10-17 01:00 UTC PR #204 feat: show progress below the score floor

- 判定: 合格(blocker無し)
- 確認した内容: npm test ✅(1748件) / npm run lint ✅ / npm run typecheck ✅ / E2Eはレビュー環境にChromiumが無く未実行のためPR記載の235件成功を前提とした。Issue #183 の受け入れ基準(0点時の減点合計表示・減点減少時のゲージ発光と読み上げ・1点以上は従来表示)を差分で確認
- マージ: squash & delete-branch

## 2026-10-17 00:30 UTC PR #203 feat: improve operation discoverability

- 判定: 合格(blocker無し)
- 確認した内容: npm test ✅(1744件) / npm run lint ✅ / npm run typecheck ✅ / E2Eはレビュー環境にChromiumが無く未実行のためPR記載の233件成功を前提とした。Issue #182 の受け入れ基準(ガイド3項目・統合欄の見出し/ボタン/ラベル・インライン説明)を差分で確認
- マージ: squash & delete-branch

## 2026-10-16 19:30 UTC PR #202 feat: show responsibility colors and counts

- 判定: 合格(blocker無し)
- 確認した内容: npm test ✅(1721件) / npm run lint ✅ / npm run typecheck ✅ / E2Eはレビュー環境にChromiumが無く未実行のためPR記載の226件成功を前提とした。Issue #173 の受け入れ基準(印の色と英字・呼び出し行に印なし・クラスの責務種類数・番号の安定)を差分で確認
- マージ: squash & delete-branch

## 2026-10-15 14:45 UTC PR #199 Clarify change request result scores

- 判定: 合格(blocker無し)
- 確認した内容: npm test ✅(1729件) / npm run lint ✅ / npm run typecheck ✅ / E2Eはこの環境で実行不可のためPR記載の227/227成功を前提とした。Issue #177 の受け入れ基準を差分で確認
- マージ: squash & delete-branch

## 2026-10-15 14:25 UTC PR #201 Fix small change result text issues

- 判定: 合格(blocker無し)
- 確認した内容: npm test ✅ / npm run lint ✅ / npm run typecheck ✅ / E2E 232件中230件成功(hint-highlight・score-jump の2件はmasterでも同一に失敗する既存事象)。Issue #179 の受け入れ基準を差分で確認
- マージ: squash & delete-branch

## 2026-10-15 13:55 UTC PR #200 Publicize inaccessible methods after moves

- 判定: 合格(blocker無し)
- 確認した内容: npm test ✅(1733件) / npm run lint ✅ / npm run typecheck ✅ / E2Eはこの環境で実行不可のためPR記載の結果を前提とした
- マージ: squash & delete-branch

## 2026-10-14 15:00 UTC PR #196 chore(deps): bump the development-dependencies group across 1 directory with 8 updates

- 判定: 合格(blocker無し)
- 確認した内容: npm ci ✅ / npm test ✅ 1720件 / npm run lint ✅ / npm run typecheck ✅。package.json・lockの開発依存更新のみ。E2Eはこの環境にChromiumが無く未実行、CIのe2e/check/knip/jscpdのpassで代替
- マージ: squash & delete-branch

## 2026-10-14 14:40 UTC PR #198 Improve change request sample fairness

- 判定: 合格(blocker無し。suggestion: stacked base の配置点と store での厳密な100点確認のテスト追加)
- 確認した内容: npm run check(lint/typecheck/vitest 1725件)✅。Issue #176 の原因1・2(変更コストの比較条件、解答例ステップ追加)を差分で確認。E2Eはレビュー環境にChromiumが無く未実行(PR本文の227件成功を参照)
- マージ: squash & delete-branch

## 2026-10-14 14:20 UTC PR #197 feat: ヒントを3段階に分ける

- 判定: 合格(blocker無し)
- 確認した内容: npm test ✅ 1722件 / npm run lint ✅ / npm run typecheck ✅。E2Eはこの環境にChromiumが無く実行できなかったため、PR本文の報告(227件PASS)に依拠
- マージ: squash & delete-branch

## 2026-10-14 09:15 UTC PR #195 chore(deps): bump the production-dependencies group with 2 updates

- 判定: 合格(blocker無し)
- 確認した内容: npm test ✅ 1720件 / npm run lint ✅ / npm run typecheck ✅。package.json・lockのパッチ更新のみ(PR #196 は同時に承認したが、#195 マージ後にlock競合したためDependabotの再作成待ち)
- マージ: squash & delete-branch

## 2026-10-13 15:10 UTC PR #194 feat: 循環依存を輪の組で表示

- 判定: 合格(blocker無し)
- 確認した内容: npm test ✅ 1720件 / npm run lint ✅ / npm run typecheck ✅。E2Eはこの実行環境で225件すべて起動失敗のため未検証(E2E差分は目視確認、PR本文では225件PASS)
- マージ: squash & delete-branch

## 2026-10-13 14:40 UTC PR #193 refactor: compute pain trend once

- 判定: 合格(blocker無し)
- 確認した内容: npm test ✅ 1715件 / npm run lint ✅ / npm run typecheck ✅。ChangePainCard.tsxの1ファイルで describePainTrend を1回だけ計算する変更を差分で確認(表示ロジック不変のためE2Eは未実行)
- マージ: squash & delete-branch

## 2026-10-13 14:30 UTC PR #192 抽出行数の説明とエディタレール

- 判定: 合格(blocker無し)
- 確認した内容: npm test ✅(1715件) / npm run lint ✅ / npm run typecheck ✅。Issue #172の受け入れ基準1〜7をdiffで確認。E2Eはこの環境でブラウザを入れられず実行できなかった(PR本文の225件成功を参照)。suggestion: ChangePainCardでdescribePainTrendを2回呼んでいる
- マージ: squash & delete-branch

## 2026-10-13 11:45 UTC PR #191 Add change impact review dialog

- 判定: 合格(blocker無し)
- 確認した内容: npm test ✅(1701件) / npm run lint ✅ / npm run typecheck ✅ / npm run test:e2e(215 passed。hint-highlight・score-jumpの2件はmasterでも同様に失敗する既存問題でPR無関係)
- マージ: squash & delete-branch

## 2026-10-12 19:41 UTC PR #169 feat: surface change request rumors

- 判定: 合格(blocker無し)
- 確認した内容: npm test(1702件) ✅ / npm run lint ✅ / npm run typecheck ✅。docs/specs/change-rumors.mdの変更対象ファイル一覧とrumoredRequests・describeRumorPayoff・RumorListの差分を確認。E2Eはこの環境で実行できず未実行(PR本文の219件成功を参照)
- マージ: squash & delete-branch

## 2026-10-12 13:25 UTC PR #190 feat: add toolbar answer menu

- 判定: 合格(blocker無し)
- 確認した内容: npm run check(lint/typecheck/test 1693件) ✅。docs/specs/toolbar-answer-menu.mdの受け入れ基準をReferenceMenu.tsx・StagePanel.tsx・stageCatalog.testの差分で確認(ヒント総数はuseHintsのtotalと一致)。E2Eはブラウザ未導入のため未実行(CIのe2eジョブ成功を参照)
- マージ: squash & delete-branch

## 2026-10-12 12:50 UTC PR #166 手直しと変更依頼を段階的に進める

- 判定: 合格(blocker無し)
- 確認した内容: npm run check(lint/typecheck/test 1692件) ✅。前回承認(5e6b525)以降はmasterのマージコミットのみ。docs/specs/post-perfect-flow.mdの段階制御・編集ロック・結果画面でのコード保持を確認。E2Eはブラウザ未導入のため未実行(PR本文の207件成功を参照)
- マージ: squash & delete-branch

## 2026-10-12 08:10 UTC PR #168 feat: clarify clear condition status (#162)

- 判定: 合格(blocker無し)
- 確認した内容: npm run check(lint/typecheck/test 1674件) ✅ / E2E 205件 ✅。Issue #162・docs/specs/clear-condition-badges.mdの、goal/current分離、達成数表示、達成瞬間の演出と初期化・リセット・undo/redo時の抑止、reduced-motionを確認。domain/application変更なし
- マージ: squash & delete-branch

## 2026-10-12 07:11 UTC PR #167 ファイルの減点理由をアイコンから表示

- 判定: 合格(blocker無し。suggestion: FileNodeでfileDeductionReasonsを毎レンダー計算しているのでselector化を検討)
- 確認した内容: npm run check(lint/typecheck/test 1676件) ✅。E2Eはレビュー環境で実行許可が得られず未実行(PR本文では204件通過)。Issue #161・docs/specs/file-mark-reasons.mdのfileDeductionsがfileDeductionReasonsの合計から導出されること、AC1の-5点と既存定数10点の矛盾は既存採点との整合を優先した判断として妥当と確認
- マージ: squash & delete-branch

## 2026-10-12 04:46 UTC PR #163 正解・不正解の色分けとアニメーション演出

- 判定: 合格(blocker無し)
- 確認した内容: npm test ✅(1674件) / npm run lint ✅ / npm run typecheck ✅。E2Eはレビュー環境で実行不可(ブラウザ未導入。PR本文では203件通過)。Issue #159・docs/specs/answer-feedback-animation.mdのAnswerVerdict共通化、reduced-motion対応、ライト/ダークの文字色トークンを確認
- マージ: squash & delete-branch

## 2026-10-12 01:30 UTC PR #158 feat: explain inlined methods when deleting classes

- 判定: 合格(blocker無し)
- 確認した内容: npm test ✅(1674件) / npm run lint ✅ / npm run typecheck ✅。E2Eはレビュー環境で実行できず未確認(PR本文では201件通過)。Issue #151・docs/specs/delete-inline-notice.mdの、deleteClass/deleteFileが{codebase, inlined}を返すこと、noticeとmessageの排他、ErrorToastの情報表示(role=status)を確認
- マージ: squash & delete-branch
