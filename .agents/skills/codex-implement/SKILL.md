---
name: codex-implement
description: Implement a GitHub issue or pull request review feedback using Codex CLI, run checks and self review, then prepare a pull request update or creation. Use when asked to implement an issue or address PR feedback through the repository workflow.
---

# Implement an issue or PR feedback

Use `$codex-implement <issue-or-pr-number>` to start this workflow. Prioritize feedback on an existing PR over implementing new issue work. If the supplied number is an issue, first look for a linked PR and address its review and conversation feedback; if no PR exists, implement the issue. If no number is provided, ask for one.

The workflow runs in the current worktree. Codex CLI must perform both implementation and self review. Do not substitute your own code changes or review verdict for Codex's work.

## Steps

1. Resolve the supplied number and check for an existing PR before starting issue implementation. When a PR exists, its review and conversation feedback takes priority; also gather the linked issue's acceptance criteria when available. Only proceed as issue-only work when no linked PR exists.
   - Try `gh pr view <number> --json number,title,body,headRefName,closingIssuesReferences,reviews,comments`.
   - If it is a PR, use `closingIssuesReferences` to identify its issue, then run `gh issue view <issue-number> --json title,body`.
   - If it is not a PR, run `gh issue view <number> --json title,body`, then `gh issue develop <number> --list` to find a branch. Search for its PR with `gh pr list --head <branch> --json number,title,headRefName,closingIssuesReferences,reviews,comments`.
2. Use the existing PR's `headRefName` or the issue branch found above. If no branch exists, ask the user before creating one with `gh issue develop <issue-number> --checkout`.
3. Switch to the branch: run `git fetch origin`, then `git checkout -B <branch> origin/<branch>`.
4. Run `npm ci`.
5. If a PR exists, collect every review `body` (especially reviews with `state` `CHANGES_REQUESTED`) and every conversation comment body. Treat all of them as in-scope feedback, regardless of whether the workflow started from the issue or PR number.
6. Have Codex CLI implement the issue acceptance criteria and address every collected comment. Follow `CLAUDE.md` development rules, including the DDD layers, TDD in `domain` and `application`, and `eslint.config.js` conventions. Run `npm run check` and resolve failures. Invoke Codex with a prompt through stdin, for example `codex exec - --approve-for-me --skip-git-repo-check -o <temporary-file>`.
7. Have Codex CLI self-review `git diff origin/master...HEAD` against the acceptance criteria, all collected feedback, and `CLAUDE.md`. Follow the `codex-review` stage policy in `scripts/pipeline/run-stage.ps1`: end with `NEEDS_FIX` if there is a blocker, otherwise `PASS`. For `NEEDS_FIX`, pass its findings back to Codex and repeat implementation and review. Stop and report if it does not converge after about 2–3 attempts.
8. After `PASS`, summarize the changes and ask the user to approve committing and pushing. After approval, run `git add -A`, commit with a message such as `Codex実装: <issue title>` and trailer `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`, then run `git push -u origin <branch>`.
9. An existing PR is updated by the push. If none exists, after approval create one with `gh pr create --base master --head <branch> --title "<issue title>" --body "Closes #<issue-number>\n\n<Codex final self-review summary>"`.

## Report

Report the PR URL, all feedback addressed, and any findings fixed during self-review. Mention that `/review-pr <pr-number>` can be used for the next review step.

## Constraints

- Do not push, create a PR, or update an existing PR without user approval.
- Do not omit any discovered review or conversation feedback.
- Codex CLI owns implementation and self-review; do not claim its review passed unless it returned `PASS`.
