# PRレビューログ

`.github/workflows/review-pr.yml` が定期実行でPRをレビュー・マージした際の記録。
ヘッドレス実行でユーザーのリアルタイム承認を得られないため、マージ前に何を確認したかを
ここに記録し、事後に追跡できるようにする。

## 書式

```
## YYYY-MM-DD HH:MM UTC PR #<番号> <タイトル>

- 判定: 合格(blocker無し)
- 確認した内容: npm test ✅ / npm run lint ✅ / npm run typecheck ✅(必要に応じてE2Eも)
- マージ: squash & delete-branch
```

- 新しい記録は「## ログ一覧」見出し直後(一覧の先頭)に追記する
- 記録が30件を超えたら、古いものから削除して直近30件までに収める
  (削除した内容はgit履歴 `git log -p docs/review-pr/LOG.md` から参照できる)
- blockerがあってマージしなかったPRはここに書かない(PR側のレビューコメントで追える)

## ログ一覧

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
