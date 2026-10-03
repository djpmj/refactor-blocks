---
description: Issueまたはプルリクエストの指摘をすべてCodexに実装させ、プルリクエストを作成・更新する
allowed-tools: Read, Glob, Grep, Bash(git:*), Bash(npm:*), Bash(gh issue:*), Bash(gh pr:*), Bash(codex:*)
---

`$ARGUMENTS` で渡された番号(Issue番号でもPR番号でもよい。無ければユーザーに尋ねる)を手がかりに、
Issueの受け入れ基準と、紐づくPRに付いているレビュー・会話コメントをすべて集め、**Codex CLI**に
実装・自己レビューさせてプルリクエストを作成または更新するまでを担当します。実装とレビューの中身は
必ずCodexに行わせること(このコマンド自身=Claudeはコードを書かない)。`docs/pipeline/README.md` の
`implement`/`codex-review` ステージと役割配分は同じだが、Orcaのworktreeではなく現在の作業ツリーで
動く手動トリガー版です。

## 手順

1. `$ARGUMENTS` の番号がIssueかPRかを判定し、Issue本文と紐づくPRの両方を特定する。
   - まず `gh pr view <番号> --json number,title,body,headRefName,closingIssuesReferences,reviews,comments`
     を試す。成功すればPR番号として扱い、`closingIssuesReferences` から紐づくIssue番号を取り、
     `gh issue view <Issue番号> --json title,body` でIssue本文(受け入れ基準)を取得する。
   - 失敗したらIssue番号として扱い、`gh issue view <番号> --json title,body` でIssue本文を取得する。
     `gh issue develop <番号> --list` で紐づくブランチ名を取得し、見つかればそのブランチに対応する
     PRを `gh pr list --head <branch> --json number,title,headRefName,closingIssuesReferences,reviews,comments`
     で探す(見つからなければ手順2でユーザーに確認したうえで新しくブランチを作る。この時点では
     PRはまだ無い)。
2. ブランチ名を特定する。PRが見つかっていればその `headRefName`。無ければユーザーに確認したうえで
   `gh issue develop <Issue番号> --checkout` で新しく作る。
3. `git fetch origin` し、`git checkout -B <branch> origin/<branch>` でそのブランチに切り替える。
4. `npm ci` を実行する。
5. 手順1でPRが見つかっている場合、そのPRに付いている指摘をすべて集めて一覧化する。
   - `reviews` の各 `body`(特に `state` が `CHANGES_REQUESTED` のもの)
   - `comments` の各会話コメントの本文
   Issue番号・PR番号のどちらで呼ばれたか、指摘が「正式なレビュー」か「会話コメント」かは区別せず、
   見つかった指摘は取りこぼさずすべて対応対象にする。
6. `codex exec` に実装させる(標準入力でプロンプトを渡す。コマンド例:
   `codex exec - --approve-for-me --skip-git-repo-check -o <一時ファイル>`)。
   プロンプトには以下を含める:
   - 手順1で取得したIssue本文(受け入れ基準)に従って実装すること
   - 手順5で集めた指摘がある場合、そのすべてに対応すること(一部だけ対応して終えない)
   - `CLAUDE.md` の開発ルール(DDDレイヤー構成、`domain`/`application`層のTDD、
     `eslint.config.js` の規約)に従うこと
   - 実装後に `npm run check`(lint + typecheck + test)を実行し、失敗したら原因を直して
     すべて通した状態にすること
7. 実装が終わったら、`codex exec` をもう一度呼び、`git diff origin/master...HEAD` を
   Issue本文の受け入れ基準・手順5で集めた指摘・`CLAUDE.md` の規約に照らして自己レビューさせる
   (`scripts/pipeline/run-stage.ps1` の `codex-review` ステージと同じ方針: 指摘があれば具体的に
   書かせ、最後の1行だけに blockerがあれば `NEEDS_FIX`、無ければ `PASS` と書かせる)。
   `NEEDS_FIX` なら、その指摘を渡して手順6のcodexを呼び直す
   (目安2〜3回で収束しなければ、そこで止めてユーザーに報告する)。
8. `PASS` になったら、変更内容をユーザーに短く報告し、承認を得てから:
   - `git add -A` し、「Codex実装: <Issueタイトル>」のようなコミットメッセージ
     (末尾に `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`)でコミットする
   - `git push -u origin <branch>` する
9. 手順1でPRが見つかっていれば、pushにより自動的に反映されるので新規作成は不要。
   見つかっていなければ
   `gh pr create --base master --head <branch> --title "<Issueタイトル>" --body "Closes #<Issue番号>\n\n<Codexの最終自己レビューの要約>"`
   でPRを作成する。

## 出力

最後に、対象のPR URL(更新または作成したPR)と、対応した指摘の一覧、自己レビューで指摘され
直した点をユーザーに報告する。次は `/review-pr <PR番号>` でClaudeにレビュー・マージしてもらう旨を
伝える。

## 注意

- 実装・自己レビューの中身は必ずCodex CLIに行わせる。Claude自身が代わりにコードを書いたり
  レビュー判定を下したりしない。
- 指摘は見つかった分をすべて対応対象にする。Issue番号・PR番号どちらで呼ばれたかにはこだわらない。
- git push・PR作成・既存PRへの反映は、いずれもユーザーに確認してから行う(無断で実行しない)。
