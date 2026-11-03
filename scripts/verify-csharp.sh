#!/usr/bin/env bash
# csharp-export で書き出した各プロジェクトを dotnet build / dotnet run で確かめる。
# 使い方: bash scripts/verify-csharp.sh out/csharp
# 同じステージの全スナップショットの標準出力が、初期状態(00-initial)と一致することを確かめる。1つでも失敗したら終了コード1。
# bindings で選んだ実装を見せる補助コード(runtime.bindingDemos)の出力は各行が `[bindings] ` で始まる。
# 手順によって選ばれる実装(と、その出力)が変わるので、手順どうしの比較からは `[bindings]` の行を除く。
# その代わり完成形(final)では、見出し行(`[bindings] クラス名.操作名`)が runtime.json の expectedBindings(bindingDemos から書き出した期待値)と
# 過不足なく一致することを確かめる(選んだ実装が実際に呼ばれたか。例外で落ちれば dotnet run が失敗して NG)。
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
  has_expected=0
  expected_bindings=$(node -e 'const fs = require("fs"); process.stdout.write(JSON.parse(fs.readFileSync(process.argv[1], "utf8")).expectedBindings.join("\n"))' "$stage_dir/runtime.json")
  allowed_failures=$(node -e 'const fs = require("fs"); const file = process.argv[1]; process.stdout.write(JSON.parse(fs.readFileSync(file, "utf8")).expectedBuildFailures.join("\n"))' "$stage_dir/runtime.json")
  for snapshot_dir in "$stage_dir"*/; do
    snapshot=$(basename "$snapshot_dir")
    snapshot_name=${snapshot#00-}
    project=$(find "$snapshot_dir" -name '*.csproj' | head -n 1)
    if [ -z "$project" ]; then
      echo "NG  $stage/$snapshot: .csproj がありません"
      failed=1
      continue
    fi
    checked=$((checked + 1))
    if ! dotnet build "$project" -p:TreatWarningsAsErrors=false -nologo -v quiet >"$snapshot_dir/build.log" 2>&1; then
      if printf '%s\n' "$allowed_failures" | grep -Fxq "$snapshot_name"; then
        echo "OK  $stage/$snapshot: 予定されたビルド失敗"
        continue
      fi
      echo "NG  $stage/$snapshot: dotnet build に失敗"
      sed -n "1,20p" "$snapshot_dir/build.log"
      failed=1
      continue
    fi
    if printf '%s\n' "$allowed_failures" | grep -Fxq "$snapshot_name"; then
      echo "NG  $stage/$snapshot: ビルド失敗予定でしたが成功しました"
      failed=1
      continue
    fi
    if ! output=$(dotnet run --no-build --project "$project" 2>&1); then
      echo "NG  $stage/$snapshot: dotnet run に失敗"
      echo "$output" | sed -n '1,20p'
      failed=1
      continue
    fi
    if [ "$snapshot" = "final" ]; then
      # 見出し行は `[bindings] ` の直後が空白でない行(出力の行は `[bindings]   ` と空白が続く)
      actual_bindings=$(printf '%s\n' "$output" | grep '^\[bindings\] [^ ]')
      if [ "$actual_bindings" != "$expected_bindings" ]; then
        echo "NG  $stage/$snapshot: [bindings] の見出し行が期待と違います"
        diff <(echo "$expected_bindings") <(echo "$actual_bindings") | sed -n '1,20p'
        failed=1
        continue
      fi
    fi
    output=$(printf '%s\n' "$output" | grep -v '^\[bindings\]')
    if [ "$has_expected" -eq 0 ]; then
      expected="$output"
      has_expected=1
      echo "OK  $stage/$snapshot"
    elif [ "$output" = "$expected" ]; then
      echo "OK  $stage/$snapshot"
    else
      echo "NG  $stage/$snapshot: 標準出力が最初の成功スナップショットと違います"
      diff <(echo "$expected") <(echo "$output") | sed -n '1,20p'
      failed=1
    fi
  done
  if [ "$has_expected" -eq 0 ]; then
    echo "NG  $stage: ビルド・実行できたスナップショットがありません"
    failed=1
  fi
done

echo "検証したプロジェクト: $checked 件"
if [ "$checked" -eq 0 ]; then
  echo "検証対象がありません" >&2
  exit 1
fi
exit "$failed"
