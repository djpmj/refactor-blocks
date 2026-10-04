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

## 2026-10-04 11:00 UTC PR #65 新規ファイルをドロップ位置に配置 (#44)

- 判定: 合格(blocker無し)
- 確認した内容: npm test ✅(1024件) / npm run lint ✅ / npm run typecheck ✅(E2EはChromium未導入で実行不可。PR本文では104件成功と報告)
- マージ: squash & delete-branch

## 2026-10-04 04:00 UTC PR #46 メソッドエディタのタブをタブバーにする (#34)

- 判定: 合格(blocker無し)
- 確認した内容: npm test ✅(995件) / npm run lint ✅ / npm run typecheck ✅(前回指摘のコンフリクト解消を確認。CSSと aria-hidden アイコンのみの変更でE2Eは未実行、PR本文では94件成功と報告)
- マージ: squash & delete-branch

## 2026-10-04 03:50 UTC PR #55 継承と実装の矢印を色と線種で分ける (#43)

- 判定: 合格(blocker無し)
- 確認した内容: npm test ✅(1021件) / npm run lint ✅ / npm run typecheck ✅(E2EはChromium未導入で実行不可。PR本文では102件成功と報告)
- マージ: squash & delete-branch

## 2026-10-04 03:40 UTC PR #54 継承の矢じりと着地点を見やすくする (#42)

- 判定: 合格(blocker無し)
- 確認した内容: npm test ✅(1020件) / npm run lint ✅ / npm run typecheck ✅(E2EはChromium未導入で実行不可。PR本文では102件成功と報告)
- マージ: squash & delete-branch

## 2026-10-04 03:10 UTC PR #53 ファイル名を画面に出さず自動追加する (#40)

- 判定: 合格(blocker無し)
- 確認した内容: npm test ✅(1018件) / npm run lint ✅ / npm run typecheck ✅(E2EはChromium未導入で実行不可。PR本文では101件成功と報告)
- マージ: squash & delete-branch

## 2026-10-04 02:40 UTC PR #52 可視性が関係するステージだけ選択欄を出す (#39)

- 判定: 合格(blocker無し)
- 確認した内容: npm test ✅ / npm run lint ✅ / npm run typecheck ✅(E2EはChromium未導入で実行不可。差分を読んで確認)
- マージ: squash & delete-branch

## 2026-10-04 02:30 UTC PR #51 元のメソッド可視性へ戻せるようにする (#37)

- 判定: 合格(blocker無し)
- 確認した内容: npm test ✅ / npm run lint ✅ / npm run typecheck ✅(E2EはChromium未導入で実行不可。差分を読んで確認)
- マージ: squash & delete-branch

## 2026-10-04 02:15 UTC PR #50 ファイル位置に合わせて矢印の接続点を切り替える (#36)

- 判定: 合格(blocker無し。suggestion: 古いdocコメントの残り・論理位置/矩形の二重ルートの一本化)
- 確認した内容: npm test 1005件 ✅ / npm run lint ✅ / npm run typecheck ✅ / E2Eはローカルにブラウザが無く未実行、PRのCI(e2e)pass
- マージ: squash & delete-branch

## 2026-10-03 19:30 UTC PR #47 左サイドバー開閉ボタンを境界へ移す (#35)

- 判定: 合格(blocker無し)
- 確認した内容: master取り込み後 npm test 995件 ✅ / npm run lint ✅ / npm run typecheck ✅ / E2Eはローカルにブラウザが無く未実行、PRのCI(e2e)pass
- マージ: squash & delete-branch

## 2026-10-03 19:20 UTC PR #41 右サイドバーの幅を変更できるようにする (#32)

- 判定: 合格(blocker無し。suggestion: pointercancel時のドラッグ状態クリア)
- 確認した内容: master取り込み後 npm test 995件 ✅ / npm run lint ✅ / npm run typecheck ✅ / E2Eはローカルにブラウザが無く未実行、PRのCI(e2e)pass
- マージ: squash & delete-branch

## 2026-10-03 19:10 UTC PR #38 call Fragment を呼び出し文で表示する (#31)

- 判定: 合格(blocker無し)
- 確認した内容: npm test 992件 ✅ / npm run lint ✅ / npm run typecheck ✅ / E2Eはローカルにブラウザが無く未実行、PRのCI(e2e)pass
- マージ: squash & delete-branch

## 2026-10-03 11:01 UTC PR #8 chore(deps): Bump actions/checkout from 4 to 7

- 判定: 合格(blocker無し。review-pr.ymlがCIでレビュー・承認済み)
- 確認した内容: workflow内のバージョン番号のみの変更でsrc/変更なし。PRのCI(check/e2e/knip/jscpd)全てpass
- マージ: review-pr.ymlの自動マージがGitHubの権限制限(GitHub Appはreview-pr.yml自身を書き換えるマージ不可)で
  失敗したため、人が手動でsquash & delete-branch

## 2026-10-03 11:01 UTC PR #9 chore(deps): Bump actions/setup-node from 4 to 7

- 判定: 合格(blocker無し。review-pr.ymlがCIでレビュー・承認済み)
- 確認した内容: workflow内のバージョン番号のみの変更でsrc/変更なし。PRのCI(check/e2e/knip/jscpd)全てpass
- マージ: review-pr.ymlの自動マージがGitHubの権限制限(GitHub Appはreview-pr.yml自身を書き換えるマージ不可)で
  失敗したため、人が手動でsquash & delete-branch

## 2026-10-03 10:44 UTC PR #3 chore(deps): Bump @types/node from 24.13.6 to 26.6.1

- 判定: 合格(blocker無し)
- 確認した内容: ブランチが古いためmasterにマージした状態で npm ci ✅ / npm test 982件 ✅ / npm run lint ✅ / npm run typecheck ✅
- マージ: squash & delete-branch

## 2026-10-03 10:42 UTC PR #1 chore(deps): Bump jsdom from 27.0.1 to 30.1.0

- 判定: 合格(blocker無し)
- 確認した内容: ブランチが古いためmasterにマージした状態で npm ci ✅ / npm test 982件 ✅ / npm run lint ✅ / npm run typecheck ✅
- マージ: squash & delete-branch

## 2026-10-03 10:41 UTC PR #6 chore(deps): Bump actions/upload-artifact from 4 to 7

- 判定: 合格(blocker無し)
- 確認した内容: workflow 1箇所のみの変更でsrc/変更なし。CI(check/e2e)pass、masterで npm test 982件 ✅ / lint ✅ / typecheck ✅
- マージ: squash & delete-branch

## 2026-10-03 10:41 UTC PR #7 chore(deps): Bump github/codeql-action from 3 to 4

- 判定: 合格(blocker無し)
- 確認した内容: workflow 1箇所のみの変更でsrc/変更なし。CI(check/e2e/jscpd)pass、masterで npm test 982件 ✅ / lint ✅ / typecheck ✅
- マージ: squash & delete-branch
