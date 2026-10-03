---
description: プルリクエストの内容をレビューし、実装への指摘を行い、問題なければマージする
allowed-tools: Read, Glob, Grep, Bash(git:*), Bash(npm:*), Bash(gh pr:*), Bash(gh issue:*)
---

`$ARGUMENTS` で渡されたPR番号(無ければユーザーに尋ねる)を、`.claude/agents/evaluator.md` と
同じ観点(仕様との整合性・DDDレイヤー境界・lint/testの実際の実行・ponytail観点の過剰設計チェック)で
**独立した立場**でレビューし、問題が無ければマージします。

## 手順

1. `gh pr view <番号> --json number,title,headRefName,body` でPR情報を取得する。
   本文に `Closes #<issue番号>` があれば `gh issue view <issue番号>` でIssue本文(仕様)も取得する。
   `docs/specs/<slug>.md` が存在すればそちらも仕様として読む。
2. `git fetch origin` し、`git checkout <headRefName>` でPRのブランチに切り替える。`npm ci` する。
3. 以下を実際に実行して結果を確認する: `npm test` / `npm run lint` / `npm run typecheck`
   (ドラッグ&ドロップ等プレイヤー操作に関わる変更があれば `npm run test:e2e` も)。
4. `git diff origin/master...HEAD` を読み、Issue/仕様書の受け入れ基準を満たしているか、
   `CLAUDE.md` のDDD層境界・命名規則・ponytail観点(過剰設計)で問題が無いかをレビューする。
   指摘は `.claude/agents/evaluator.md` の出力形式(重大度 blocker/suggestion・該当ファイル:行・
   問題の内容・推奨対応)でまとめる。

5. **blockerが無い場合**:
   - 判定(合格)と指摘内容(suggestionがあれば併記)をユーザーに報告し、マージしてよいか確認する
   - 承認されたら `gh pr review <番号> --approve --body "<要約>"` のうえ、
     `gh pr merge <番号> --squash --delete-branch` でマージする
   - 関連Issueが自動クローズされていなければ(`gh issue view <issue番号>` で確認)、
     ユーザーに確認のうえ `gh issue close <issue番号>` で閉じる

6. **blockerがある場合**:
   - マージしない。指摘内容をユーザーに提示し、PRに投稿してよいか確認したうえで
     `gh pr review <番号> --request-changes --body "<指摘内容>"` を実行する
   - ユーザーに、この `/codex-implement <PR番号>` を再実行すれば、今回投稿した指摘を含めて
     Codexが対応できる旨を伝える(Issue番号・PR番号のどちらでも動く)

## 注意

- レビューの指摘はIssue・仕様書に書かれた受け入れ基準と、`CLAUDE.md` の既存ルールに基づいて行う
  (個人的な好みで不合格にしない)。
- コードの修正は行わない(指摘のみ。修正はCodexが `/codex-implement` の再実行で行う)。
- レビューコメントの投稿・マージ・Issueのクローズは、いずれもユーザーに確認してから行う
  (無断で実行しない)。
