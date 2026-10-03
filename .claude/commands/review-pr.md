---
description: プルリクエストの内容をレビューし、実装への指摘を行い、問題なければマージする
allowed-tools: Read, Glob, Grep, Bash(git:*), Bash(npm:*), Bash(gh pr:*), Bash(gh issue:*)
---

`$ARGUMENTS` で渡されたPR番号を、`.claude/agents/evaluator.md` と
同じ観点(仕様との整合性・DDDレイヤー境界・lint/testの実際の実行・ponytail観点の過剰設計チェック)で
**独立した立場**でレビューし、問題が無ければマージします。PR番号が指定されていなければ、
オープンな全PRを対象にします(下記手順0)。

## 手順

0. **PR番号が指定されていないとき**: `gh pr list --state open --json number,title,headRefName,isDraft,updatedAt`
   でオープンなPRを一覧する。ドラフトPRは対象外にする。対象PRが無ければ何もせず終了する。
   各PRについて `gh pr view <番号> --json reviews,commits` を見て、このレビュー
   (Claude Code経由のレビュー、または `.github/workflows/review-pr.yml` による自動レビュー)が
   現在の最新コミットに対して既に行われているかを確認する。**前回レビューで指摘(blocker)した後、
   それに対応する新しいコミットが無いPRはスキップしてよい**(一度指摘して対応されていない内容を
   何度も同じように指摘しない)。残ったPRを番号・タイトルの一覧でユーザーに見せ、1件ずつ
   下記の手順1〜6を実行する。
   PR番号が指定されているときはこの手順を飛ばし、そのPR1件だけに手順1〜6を適用する。
1. `gh pr view <番号> --json number,title,headRefName,body` でPR情報を取得する。
   本文に `Closes #<issue番号>` があれば `gh issue view <issue番号>` でIssue本文(仕様)も取得する。
   `docs/specs/<slug>.md` が存在すればそちらも仕様として読む。
2. `git fetch origin` し、`git checkout <headRefName>` でPRのブランチに切り替える。`npm ci` する。
   このコマンドの実行中(複数PRを順にチェックしている間)は、今どのブランチに乗っているかを
   見失いやすい。レビューと無関係な変更(コマンド定義の修正など)を`master`へ直接pushする必要が
   同時に生じたときは、必ず`git branch --show-current`で`master`であることを確認してから
   pushする(`CLAUDE.md`「masterへの直接pushの安全策」を参照。PRのfeatureブランチに乗ったまま
   `master`へpushすると、そのPRの未レビューコミットが混入する)。
3. 以下を実際に実行して結果を確認する: `npm test` / `npm run lint` / `npm run typecheck`
   (ドラッグ&ドロップ等プレイヤー操作に関わる変更があれば `npm run test:e2e` も)。
4. `git diff origin/master...HEAD` を読み、Issue/仕様書の受け入れ基準を満たしているか、
   `CLAUDE.md` のDDD層境界・命名規則・ponytail観点(過剰設計)で問題が無いかをレビューする。
   指摘は `.claude/agents/evaluator.md` の出力形式(重大度 blocker/suggestion・該当ファイル:行・
   問題の内容・推奨対応)でまとめる。

5. **blockerが無い場合**: 確認を取らずそのまま進めてよい。
   - `gh pr review <番号> --approve --body "<要約>"` を試す。PR作成者とレビュー実行アカウントが同じ
     (例: `djpmj` 名義で作成したPRを同じ認証で見る)場合、GitHubの仕様上
     `Can not approve your own pull request` で失敗する。その場合は承認を諦め、
     `gh pr merge <番号> --squash --delete-branch --body "<要約>"` で直接マージする
     (`--body` にレビュー要約を残すことで、承認コメントの代わりにする)
   - 関連Issueが自動クローズされていなければ(`gh issue view <issue番号>` で確認)、
     `gh issue close <issue番号>` で閉じる
   - マージしたPRに対応する `docs/specs/<slug>.md` があれば、`docs/specs/implemented.md` の
     「## 一覧」表に `| [<slug>](<slug>.md) | <機能の一言説明> |` の形式で1行追加し(末尾に追記)、
     `master` にいることを確認してから(手順2参照)`git add docs/specs/implemented.md` し
     「<slug>を実装済み一覧に追加」のような日本語コミットメッセージでコミット・push する。
     仕様書が無いPR(dependabotの依存更新・プロセス文書のみの変更など)はこの手順を行わない
   - `gh pr merge` が「ローカルブランチの削除に失敗した」エラーを返しても、PRのマージ自体
     (`gh pr view <番号> --json state,mergedAt` で `MERGED` を確認)が成功していればよい。
     そのローカルブランチがgit worktreeで別ディレクトリにチェックアウトされているとき
     (`/spec-to-issue` がworktreeを作ることがある)に起きる。`git worktree remove <パス>` で
     worktreeを片付けてから `git branch -d <ブランチ名>` する
   - 判定(合格)と指摘内容(suggestionがあれば併記)・マージ結果をユーザーに報告する(事後報告でよい)

6. **blockerがある場合**:
   - マージしない。指摘内容をユーザーに提示し、PRに投稿してよいか確認したうえで
     `gh pr review <番号> --request-changes --body "<指摘内容>"` を実行する
   - ユーザーに `/implement <PR番号>` を実行すれば、今回投稿した指摘を含めて独立セッションの実装者が対応し、評価者の再評価まで進められる旨を伝える(Issue番号・PR番号のどちらでも動く)

## 注意

- レビューの指摘はIssue・仕様書に書かれた受け入れ基準と、`CLAUDE.md` の既存ルールに基づいて行う
  (個人的な好みで不合格にしない)。
- コードの修正は行わない(指摘のみ。修正は `/implement` の修正ループで行う)。
- **blockerが無い場合の承認・マージ・Issueクローズはユーザーに確認せずそのまま実行してよい**
  (結果は事後報告する)。**blockerがある場合**の指摘コメント投稿は、従来どおりユーザーに確認してから行う
  (無断で実行しない)。
