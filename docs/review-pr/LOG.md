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

## 2026-10-10 09:55 UTC PR #128 正しい操作の成功演出

- 判定: 合格(blocker無し。suggestion: commit のJSDocが celebrationFor に付いている)
- 確認した内容: npm test 1607件 ✅ / npm run lint ✅ / npm run typecheck ✅ / E2Eはローカルにブラウザが無く未実行、PRのCI(e2e)pass
- マージ: squash & delete-branch

## 2026-10-10 09:10 UTC PR #127 抽出前に結果をプレビュー

- 判定: 合格(blocker無し。suggestion: ClassNodeの仮メソッド行数の `-3` は METHOD_OVERHEAD_LINES を使う)
- 確認した内容: npm run check(test 1602件/lint/typecheck) ✅。E2Eはレビュー環境にChromiumが無く起動できず未確認(PR本文は177件成功と報告)
- マージ: squash & delete-branch

## 2026-10-10 08:40 UTC PR #126 ドラッグ中に移動可能な場所を強調

- 判定: 合格(blocker無し。suggestion: 仕様は既存E2E無変更だがrefactor.spec.tsのキーボードfieldテストを更新)
- 確認した内容: npm run check(test 1592件/lint/typecheck) ✅。E2Eはレビュー環境にChromiumが無く起動できず未確認(PR本文は176件成功と報告)
- マージ: squash & delete-branch

## 2026-10-10 08:20 UTC PR #125 feat: add subtle ghost movement hints

- 判定: 合格(blocker無し)
- 確認した内容: npm test ✅ 1586件 / npm run lint ✅ / npm run typecheck ✅。E2Eはレビュー環境にChromiumが無く起動できず未確認(PR本文は174件成功と報告)
- マージ: squash & delete-branch

## 2026-10-10 06:52 UTC PR #123 feat: 初回スポットライトガイドを追加

- 判定: 合格(blocker無し。suggestion: methodCountがuseGameStore.tsとSpotlightTour.tsxで重複)
- 確認した内容: npm test ✅ 1571件 / npm run lint ✅ / npm run typecheck ✅。E2Eはレビュー環境にChromiumが無く起動できず未確認(PR本文は168件成功と報告)
- マージ: squash & delete-branch

## 2026-10-10 06:30 UTC PR #122 feat: highlight hint targets on canvas

- 判定: 合格(blocker無し)
- 確認した内容: npm test ✅ 1566件 / npm run lint ✅ / npm run typecheck ✅。E2Eはレビュー環境にChromiumが無く起動できず未確認(PR本文は163件成功と報告)。stepTargetsのdomain実装とテスト、focusRuleとの相互排他、対象消失時の解除を差分で確認
- マージ: squash & delete-branch

## 2026-10-10 05:58 UTC PR #121 feat: clarify action affordances

- 判定: 合格(blocker無し。suggestion: button--primaryの!importantは詳細度で解決したい)
- 確認した内容: npm test ✅ 1561件 / npm run lint ✅ / npm run typecheck ✅。E2Eはレビュー環境にChromiumが無く起動できず未確認(PR本文は161件成功と報告)、E2E specは静的に確認
- マージ: squash & delete-branch

## 2026-10-10 05:31 UTC PR #120 feat: restructure stage problem sidebar

- 判定: 合格(blocker無し)
- 確認した内容: npm test ✅ 1561件 / npm run lint ✅ / npm run typecheck ✅。E2Eはレビュー環境にChromiumが無く起動できず未確認(PR本文は159件成功と報告)
- マージ: squash & delete-branch

## 2026-10-10 05:10 UTC PR #119 feat: implement inline middle man refactoring

- 判定: 合格(blocker無し)
- 確認した内容: npm run check(lint ✅ / typecheck ✅ / test ✅ 1550件)。E2Eはこの環境で実行許可が得られず未実行、PR本文の報告(inline/削除E2E 4/4、全体154/155でfield keyboard moveはmasterでも再現)を参照
- マージ: squash & delete-branch

## 2026-10-10 03:15 UTC PR #118 Remove redundant stage select

- 判定: 合格(blocker無し)
- 確認した内容: npm run check(lint ✅ / typecheck ✅ / test ✅ 1508件)。E2Eはブラウザ未導入のためローカル実行できず、差分を静的に確認(getByLabel('ステージ')の残りなし、selectStageヘルパーで集約)
- マージ: squash & delete-branch

## 2026-10-10 02:40 UTC PR #117 Verify sidebar toggle avoids scrollbar overlap

- 判定: 合格(blocker無し)
- 確認した内容: npm test ✅ 1508件 / npm run lint ✅ / npm run typecheck ✅。E2Eはブラウザ未導入のためローカル実行できず、CIのe2eジョブ成功を参照
- マージ: squash & delete-branch

## 2026-10-10 02:20 UTC PR #116 Add resizable left sidebar

- 判定: 合格(blocker無し)
- 確認した内容: npm run check(lint ✅ / typecheck ✅ / test ✅ 1508件)。E2Eはブラウザ未導入のため再実行できず、PR本文の報告(151件pass)を参照
- マージ: squash & delete-branch

## 2026-10-10 02:00 UTC PR #115 Implement issue 95 code fragments

- 判定: 合格(blocker無し)
- 確認した内容: npm test ✅(1501件) / npm run lint ✅ / npm run typecheck ✅ / stage-report再生成で差分なし ✅。E2Eはブラウザ未導入のため再実行できず、PR本文の報告(148件pass)を参照
- マージ: squash & delete-branch

## 2026-10-05 14:15 UTC PR #105 Add replay maximize and read-only method panel

- 判定: 合格(blocker無し)
- 確認した内容: npm run check(lint ✅ / typecheck ✅ / test ✅ 1392件)。E2Eはブラウザ未導入のため再実行できず、PR本文の報告(148件pass)を参照
- マージ: squash & delete-branch

## 2026-10-05 13:57 UTC PR #104 Align displayed line counts with C# source

- 判定: 合格(blocker無し)
- 確認した内容: npm test ✅ / npm run lint ✅ / npm run typecheck ✅ / E2E: レビュー環境で実行不可(chromium未導入。PR本文では147件通過、e2e差分は読解で確認)
- マージ: squash & delete-branch

## 2026-10-04 15:52 UTC PR #101 変更の痛みカードの長い名前を折り返す

- 判定: 合格(blocker無し)
- 確認した内容: npm test ✅ / npm run lint ✅ / npm run typecheck ✅ / E2E: レビュー環境で実行不可(PR本文では147件通過)
- マージ: squash & delete-branch

## 2026-10-04 15:45 UTC PR #96 コードプレビューを幅に合わせて折り返す

- 判定: 合格(blocker無し)
- 確認した内容: npm test ✅(1385件) / npm run lint ✅ / npm run typecheck ✅ / E2E: レビュー環境にChromiumが無く実行不可(PR本文では147件通過)
- マージ: squash & delete-branch

