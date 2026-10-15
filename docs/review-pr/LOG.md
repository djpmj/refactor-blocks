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

## 2026-10-12 01:05 UTC PR #157 feat: score mixed responsibilities in extracted methods

- 判定: 合格(blocker無し)
- 確認した内容: npm test ✅(1665件) / npm run lint ✅ / npm run typecheck ✅。E2Eはレビュー環境で実行不可(ブラウザ未導入。PR本文では199件通過)。Issue #150・docs/specs/mixed-responsibility-method.mdの`mixed-method`ルール(初期にないメソッド・call除外・cohesiveResponsibilities)の実装とdomain層の純粋関数であることを確認
- マージ: squash & delete-branch

## 2026-10-12 00:45 UTC PR #156 fix: bring open warning popovers to front

- 判定: 合格(blocker無し)
- 確認した内容: npm test ✅(1651件) / npm run lint ✅ / npm run typecheck ✅ / E2E(visibility-violation-edge.spec.ts 3件) ✅。Issue #149・docs/specs/warning-edge-popover-front.mdの原因と振る舞い、最小変更(開いた時だけz-index 30)を確認
- マージ: squash & delete-branch

## 2026-10-12 00:35 UTC PR #155 feat: resize preview method panels

- 判定: 合格(blocker無し)
- 確認した内容: npm run check ✅(1641件のtest / lint / typecheck) / E2E: 環境にchromiumが無く未実行(PR本文は195/195 PASS)。Issue #148・docs/specs/preview-panel-resizable.mdの振る舞い、既存フック再利用、DDD層境界を確認
- マージ: squash & delete-branch

## 2026-10-12 00:30 UTC PR #154 feat: shorten suggested names for extracted methods

- 判定: 合格(blocker無し)
- 確認した内容: npm test ✅(1651件) / npm run lint ✅ / npm run typecheck ✅ / E2E: 環境にchromiumが無く未実行(PR本文は193/193 PASS、差分の期待値は実装と整合)。Issue #147の振る舞い・DDD層境界を確認。suggestion: JSDocがsuggestMethodNameから離れている
- マージ: squash & delete-branch

## 2026-10-11 23:42 UTC PR #153 feat: show method details during manual fix

- 判定: 合格(blocker無し)
- 確認した内容: npm test ✅(1629件) / npm run lint ✅ / npm run typecheck ✅(E2EはChromium未導入のため未実行。PR本文では全E2E 191/191 PASSの報告)
- マージ: squash & delete-branch

## 2026-10-11 23:40 UTC PR #152 feat: automatically name new classes by role

- 判定: 合格(blocker無し)
- 確認した内容: npm test ✅(1637件) / npm run lint ✅ / npm run typecheck ✅(E2EはChromium未導入のため未実行。PR本文では全E2E 189/190、失敗1件は単独再実行でPASSの報告)
- マージ: squash & delete-branch

## 2026-10-11 15:30 UTC PR #145 feat: add method panel to code previews

- 判定: 合格(blocker無し)
- 確認した内容: npm test ✅(1625件) / npm run lint ✅ / npm run typecheck ✅(E2EはPR記載のPASSを確認、本レビューでは未実行)
- マージ: squash & delete-branch

## 2026-10-11 14:55 UTC PR #144 feat: keep existing file positions stable

- 判定: 合格(blocker無し)
- 確認した内容: npm run check(lint/typecheck/test 1625件)✅(E2EはChromium未導入のため未実行。PR本文では187件成功の報告)
- マージ: squash & delete-branch

## 2026-10-11 14:12 UTC PR #143 feat: score misplaced class responsibilities

- 判定: 合格(blocker無し)
- 確認した内容: npm test ✅ / npm run lint ✅ / npm run typecheck ✅(E2EはChromium未導入のため未実行。差分は目視確認、PR本文では186件成功の報告)
- マージ: squash & delete-branch

## 2026-10-11 04:40 UTC PR #142 Wait for drag overlay before clicking in anemic model E2E

- 判定: 合格(blocker無し)
- 確認した内容: npm test ✅ / npm run lint ✅ / npm run typecheck ✅(E2EはChromium未導入のため未実行。PR本文では185件成功の報告)
- マージ: squash & delete-branch

## 2026-10-11 02:55 UTC PR #141 Show fragment labels as comments in the code tab

- 判定: 合格(blocker無し)
- 確認した内容: npm run check(test 1610件/lint/typecheck) ✅。E2Eはレビュー環境にChromiumが無く未実行(PR本文は185件成功と報告、E2E期待値の更新は差分で確認)。Issue #133・仕様書fragment-label-commentsの受け入れ基準を差分で確認(fragmentCodeで表示と行数計算の判定を共通化)
- マージ: squash & delete-branch

## 2026-10-11 01:40 UTC PR #140 Enable story mode by default

- 判定: 合格(blocker無し)
- 確認した内容: npm run check(test 1610件/lint/typecheck) ✅。E2Eはレビュー環境にChromiumが無く未実行(PR本文は185件成功と報告)。Issue #132の受け入れ基準を差分で確認(ボタンのCSSセレクタが実DOMに一致)
- マージ: squash & delete-branch

## 2026-10-11 01:25 UTC PR #139 解答の再生ダイアログのウィンドウコントロールをそろえる

- 判定: 合格(blocker無し)
- 確認した内容: npm run check(test 1607件/lint/typecheck) ✅。E2Eはレビュー環境で起動できず未実行(PR本文は185件成功と報告)。Issue #131の受け入れ基準(window-controls/SVGアイコン/aria-label・title/CSS)を差分で確認
- マージ: squash & delete-branch

## 2026-10-10 15:05 UTC PR #137 ボタンの見た目を共通の既定スタイルにそろえる

- 判定: 合格(blocker無し)
- 確認した内容: npm run check(test 1607件/lint/typecheck) ✅。E2Eはレビュー環境で起動できず未実行(PR本文は185件成功と報告)。Issue #130の受け入れ基準(重複定義の削除・`!important`除去・ChangePainCardの主要ボタン化)を差分で確認
- マージ: squash & delete-branch

## 2026-10-10 10:20 UTC PR #129 減点内訳をホバーして原因をプレビュー

- 判定: 合格(blocker無し)
- 確認した内容: npm run check(test 1607件/lint/typecheck) ✅。E2Eはレビュー環境にChromiumが無く未実行(PR本文は184件成功と報告)。Issue #114の受け入れ基準を差分で確認
- マージ: squash & delete-branch
