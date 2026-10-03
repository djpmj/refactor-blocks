---
name: codex-implement
description: 「実装してください」と依頼されたとき、またはGitHubのIssue番号・プルリクエスト番号を指定されたときに起動します。IssueやPRの内容・レビュー指摘を実装し、チェックとセルフレビューを行って、プルリクエストの更新または作成を準備します。
---

# Issueまたはプルリクエストの指摘を実装する

`$codex-implement <issue-or-pr-number>` でこのワークフローを開始します。ユーザーが「実装してください」と依頼した場合もこのスキルを起動します。対象のIssueまたはPR番号が会話やリポジトリの文脈から分からないときは、番号を尋ねます。番号がIssueなら、関連するプルリクエストを探し、存在する場合はそのレビュー指摘と会話コメントへの対応を優先します。関連するプルリクエストがなければ、Issueの内容を実装します。番号が指定されていない場合は、ユーザーに番号を尋ねます。

このワークフローは現在のワークツリーで実行します。実装とセルフレビューは、このスキルを実行するエージェントが行います。

## 手順

1. 指定された番号を確認し、既存のプルリクエストがないか調べます。プルリクエストがある場合は、そのレビュー指摘と会話コメントを優先し、関連Issueの受け入れ条件も確認します。関連するプルリクエストがない場合に限り、Issue単独の作業として進めます。
   - まず `gh pr view <number> --json number,title,body,headRefName,closingIssuesReferences,reviews,comments` を実行します。
   - 対象がプルリクエストなら、`closingIssuesReferences` から関連Issueを特定し、`gh issue view <issue-number> --json title,body` を実行します。
   - プルリクエストでなければ、`gh issue view <number> --json title,body` を実行し、続けて `gh issue develop <number> --list` でブランチを確認します。そのブランチのプルリクエストを `gh pr list --head <branch> --json number,title,headRefName,closingIssuesReferences,reviews,comments` で検索します。
2. 既存のプルリクエストがある場合はその `headRefName` を、Issueのブランチが見つかった場合はそのブランチを使用します。ブランチが存在しない場合は、`gh issue develop <issue-number> --checkout` で作成する前にユーザーに確認します。
3. ブランチに切り替えます。`git fetch origin` を実行し、続けて `git checkout -B <branch> origin/<branch>` を実行します。
4. `npm ci` を実行します。
5. プルリクエストがある場合は、すべてのレビューの `body`（特に `state` が `CHANGES_REQUESTED` のレビュー）と、会話コメントの本文をすべて収集します。作業の開始がIssue番号かプルリクエスト番号かにかかわらず、収集した内容はすべて対応対象です。
6. Issueの受け入れ条件を満たし、収集したコメントすべてに対応します。`CLAUDE.md` の開発ルールに従い、DDDのレイヤー構成、`domain` と `application` でのTDD、`eslint.config.js` の規約を守ります。`npm run check` を実行し、失敗があれば解消します。
7. 受け入れ条件、収集したすべての指摘、`CLAUDE.md` に照らして `git diff origin/master...HEAD` をセルフレビューします。直すべき指摘(blocker)が1件でもあれば `NEEDS_FIX`、なければ `PASS` で終わらせます。`NEEDS_FIX` の場合は指摘に基づいて実装を修正し、レビューを繰り返します。およそ2～3回試しても収束しない場合は、作業を止めて報告します。
8. `PASS` の後、変更内容を要約し、コミットとプッシュを行ってよいかユーザーに確認します。承認されたら `git add -A` を実行し、たとえば `実装 <issue title>` のようなメッセージと、次のトレーラーを付けてコミットします。
   `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`
   続けて `git push -u origin <branch>` を実行します。
9. 既存のプルリクエストがある場合、プッシュによって更新されます。既存のプルリクエストがない場合は、承認後に次のコマンドで作成します。
   `gh pr create --base master --head <branch> --title "<issue title>" --body "Closes #<issue-number>\n\n<セルフレビューの最終要約>"`

## 報告

プルリクエストのURL、対応した指摘、セルフレビューで見つけて修正した内容を報告します。次のレビュー手順には `/review-pr <pr-number>` を使えることも伝えます。

## 制約

- ユーザーの承認なしに、プッシュ、プルリクエストの作成、既存プルリクエストの更新を行ってはいけません。
- 見つかったレビュー指摘や会話コメントを省略してはいけません。
- セルフレビューで `PASS` と判定できていないのに、レビューに合格したと報告してはいけません。

