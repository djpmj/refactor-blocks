#!/usr/bin/env bash
# csharp-export で書き出した各プロジェクトを dotnet build / dotnet run で確かめる。
# 使い方: bash scripts/verify-csharp.sh out/csharp
# 同じステージの全スナップショットの標準出力が、初期状態(00-initial)と一致することを確かめる。1つでも失敗したら終了コード1。
set -u

root="${1:-out/csharp}"
failed=0
checked=0

if [ ! -d "$root" ]; then
  echo "書き出し先がありません: $root" >&2
  exit 1
fi

for stage_dir in "$root"/*/; do
  stage=$(basename "$stage_dir")
  expected=""
  for snapshot_dir in "$stage_dir"*/; do
    snapshot=$(basename "$snapshot_dir")
    project=$(find "$snapshot_dir" -name '*.csproj' | head -n 1)
    if [ -z "$project" ]; then
      echo "NG  $stage/$snapshot: .csproj がありません"
      failed=1
      continue
    fi
    checked=$((checked + 1))
    if ! dotnet build "$project" -p:TreatWarningsAsErrors=false -nologo -v quiet >"$snapshot_dir/build.log" 2>&1; then
      echo "NG  $stage/$snapshot: dotnet build に失敗"
      sed -n "1,20p" "$snapshot_dir/build.log"
      failed=1
      continue
    fi
    if ! output=$(dotnet run --no-build --project "$project" 2>&1); then
      echo "NG  $stage/$snapshot: dotnet run に失敗"
      echo "$output" | sed -n '1,20p'
      failed=1
      continue
    fi
    if [ "$snapshot" = "00-initial" ]; then
      expected="$output"
      echo "OK  $stage/$snapshot"
    elif [ "$output" = "$expected" ]; then
      echo "OK  $stage/$snapshot"
    else
      echo "NG  $stage/$snapshot: 標準出力が初期状態と違います"
      diff <(echo "$expected") <(echo "$output") | sed -n '1,20p'
      failed=1
    fi
  done
done

echo "検証したプロジェクト: $checked 件"
if [ "$checked" -eq 0 ]; then
  echo "検証対象がありません" >&2
  exit 1
fi
exit "$failed"
