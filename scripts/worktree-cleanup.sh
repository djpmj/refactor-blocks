#!/usr/bin/env bash
# 作業が終わった worktree を片付ける(/spec-to-issue の手順0を1コマンドにしたもの)。
#
# 使い方: bash scripts/worktree-cleanup.sh          # 消す候補と残すものを表示するだけ(dry-run)
#         bash scripts/worktree-cleanup.sh --apply   # 候補を実際に削除する
#
# 削除するのは、次の「すべて」を満たす worktree だけ(ローカルブランチは消さない。--force も使わない)。
#   - このリポジトリと同じ親ディレクトリ直下の refactor-blocks-* である(今いる所・master・他ツールの場所は対象外)
#   - 未コミットの変更・未追跡ファイルが無い
#   - マージ済みPRの先頭コミットに HEAD が含まれる、または名前中のIssue番号のIssueが CLOSED
set -euo pipefail

apply=false
[ "${1:-}" = "--apply" ] && apply=true

root=$(git rev-parse --show-toplevel)
parent=$(dirname "$root")
here=$(pwd -P)
git fetch -q origin

git worktree list --porcelain | awk '/^worktree /{p=$2} /^branch /{b=$2} /^detached/{b="DETACHED"} /^$/{print p"|"b; b=""}' |
while IFS='|' read -r path ref; do
  [ -z "$path" ] && continue
  case "$path" in "$parent"/refactor-blocks-*) ;; *) continue ;; esac
  [ "$path" = "$root" ] && continue
  case "$here" in "$path"*) echo "KEEP(今いる所) $path"; continue ;; esac
  branch=${ref#refs/heads/}
  [ "$branch" = "master" ] && continue

  if [ -n "$(git -C "$path" status --porcelain | head -1)" ]; then echo "KEEP(未コミットの変更) $path"; continue; fi

  head=$(git -C "$path" rev-parse HEAD)
  reason=""
  if [ "$ref" != "DETACHED" ]; then
    for oid in $(gh pr list --state merged --head "$branch" --json headRefOid -q '.[].headRefOid' 2>/dev/null); do
      if [ "$oid" = "$head" ] || git merge-base --is-ancestor "$head" "$oid" 2>/dev/null; then reason="マージ済みPR"; fi
    done
  fi
  if [ -z "$reason" ]; then
    num=$(basename "$path" | grep -oE '[0-9]{2,4}' | head -1 || true)
    if [ -n "$num" ] && [ "$(gh issue view "$num" --json state -q .state 2>/dev/null || true)" = "CLOSED" ]; then reason="Issue #$num はCLOSED"; fi
  fi
  if [ -z "$reason" ]; then echo "KEEP(作業中の可能性) $path"; continue; fi

  if $apply; then git worktree remove "$path" && echo "REMOVED($reason) $path"; else echo "CANDIDATE($reason) $path"; fi
done
git worktree prune
