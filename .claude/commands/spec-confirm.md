---
description: docs/pipeline/*/02-draft-spec.md の未決事項をユーザーに選ばせ、03-confirmed-answers.md として確定させる
allowed-tools: Read, Write, Glob, Bash(git:*), Bash(orca terminal create:*)
---

開発パイプライン(`docs/pipeline/README.md`)の「ユーザ確定」ステップを行います。

1. `docs/pipeline/*/02-draft-spec.md` を `Glob` で探す。それぞれについて、同じディレクトリに
   `03-confirmed-answers.md` が既にあるものは対象外にする。残った中から対象を選ぶ
   (`$ARGUMENTS` でslugが指定されていればそれを優先。指定が無く候補が複数あれば、
   どれを確定させるかユーザーに確認する。候補が無ければ「確定待ちの仕様がありません」と
   報告して終了する)。
2. 対象の `02-draft-spec.md` を `Read` し、内容を3〜5行で要約してユーザーに提示する。
3. 「未決事項」の節を1件ずつ、`AskUserQuestion` ツールで質問する
   (`.claude/agents/spec-designer.md` の「未決事項の書式」通り、選択肢がある場合はそのまま
   optionsに渡す。「自由記述で確認が必要」と書かれた事項は、`AskUserQuestion` ではなく
   通常のテキストでユーザーに直接尋ねる)。
4. すべての未決事項への回答が揃ったら、`docs/pipeline/<slug>/03-confirmed-answers.md` を
   `Write` する。各未決事項の質問文と、確定した回答(選んだ選択肢、または自由記述の内容)を
   対応付けて書く。
5. 変更内容(`03-confirmed-answers.md`)をユーザーに短く報告し、**pushしてよいか確認を取ってから**
   `git add docs/pipeline/<slug>/03-confirmed-answers.md`・コミット
   (コミットメッセージ末尾に `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>` を付ける)・
   `git push origin HEAD:master` を実行する。承認が得られなければコミットまでで止める。
6. pushできたら、`orca terminal create --worktree name:pipeline-master --command "powershell.exe
   -NoProfile -ExecutionPolicy Bypass -File scripts/pipeline/run-stage.ps1 -Stage final-spec
   -Slug <slug>"` を実行して `final-spec` ステージを起動する(ヘッドレスな `claude -p` 実行は人に質問できないため、pushトリガーには
   頼らず、ここから明示的に次ステージ用のターミナルを起動する)。

## 注意

- ここは開発パイプラインの中で**唯一の対話ステップ**です。discover〜evaluateの各ステージは
  ヘッドレスな `claude -p`/`codex exec` で動くため人に質問できません。このコマンドで確定させた
  内容がそのまま `final-spec` ステージ(次のフェーズ)に渡ります。曖昧なまま進めず、ユーザーの
  回答を過不足なく反映してください。
- 未決事項に対してこちらから勝手に「妥当な案」を決めて進めない。必ず `AskUserQuestion` かテキストで
  ユーザー本人に選ばせる。
