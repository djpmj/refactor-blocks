#!/usr/bin/env bash
# 仕様書を master へ安全に反映し、Issue と実装用ブランチを作る(/spec-to-issue の手順6を1コマンドにしたもの)。
#
# 使い方:
#   bash scripts/spec-publish.sh start                       # origin/master の detached worktree を作り、パスを表示する
#   (表示されたパスの docs/specs/<slug>.md に仕様書を書く)
#   bash scripts/spec-publish.sh publish "<コミットメッセージ>" <slug>...
#
# publish は、仕様書だけをコミットし、master との差分がそのコミットだけであることを確かめてから push する。
# worktree は detached HEAD なので、作業中の feature ブランチのコミットが master へ混ざらない(CLAUDE.md の安全策)。
# Issue ごとに `gh issue develop` でブランチも作る。作業ディレクトリは触らないので --checkout は付けない。
set -euo pipefail

root=$(git rev-parse --show-toplevel)
wt="$(dirname "$root")/refactor-blocks-spec-writer"

case "${1:-}" in
  start)
    git fetch -q origin
    [ -d "$wt" ] || git worktree add -q --detach "$wt" origin/master
    echo "$wt"
    ;;
  publish)
    msg=${2:?コミットメッセージを渡してください}
    shift 2
    [ $# -gt 0 ] || { echo "slug を1つ以上渡してください" >&2; exit 1; }
    [ -d "$wt" ] || { echo "先に start を実行してください" >&2; exit 1; }
    cd "$wt"
    for slug in "$@"; do
      [ -f "docs/specs/$slug.md" ] || { echo "docs/specs/$slug.md がありません" >&2; exit 1; }
      git add "docs/specs/$slug.md"
    done
    git commit -q -m "$msg

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
    git fetch -q origin
    # 送るのは仕様書のコミットだけか(他のファイルが混ざっていたら止める)
    others=$(git diff --name-only origin/master..HEAD | grep -v -E '^docs/specs/[^/]+\.md$' || true)
    [ -z "$others" ] || { echo "仕様書以外が混ざっています: $others" >&2; exit 1; }
    git log --oneline origin/master..HEAD
    git push origin HEAD:master
    for slug in "$@"; do
      url=$(gh issue create --title "$slug" --body-file "docs/specs/$slug.md" | tail -1)
      num=${url##*/}
      gh issue develop "$num" --name "$slug" >/dev/null
      echo "#$num $slug $url"
    done
    cd "$root"
    git worktree remove "$wt"
    ;;
  *)
    echo "使い方: spec-publish.sh start | publish \"<メッセージ>\" <slug>..." >&2
    exit 1
    ;;
esac
