# 開発パイプライン: 機能探索 → 仕様設計 → ユーザ確定 → 最終仕様 → 実装 → レビュー → 評価

`docs/specs/README.md` の開発ハーネス(仕様設計→実装→評価、同一セッション内でサブエージェントを呼ぶ形)を、
役割ごとに**別プロセス**(Orcaが起動する別ターミナル)に分割したもの。`scripts/pipeline/run-stage.ps1`
が1つのステートマシンとして各ステージを順に実行する。

Orca(StablyAIのAgent Development Environment、ローカルPCにインストール・ログイン済み)が、
このスクリプトを実行するターミナルのランチャー役を担う。`claude`/`codex` CLIはこのPC上の実ログイン
セッションのまま起動されるため、GitHub Actions版で必要だったSecretsの登録・失効時の再登録は不要になった。

## 機能の一覧

- [未実装の機能](unimplemented.md) — 探索済みで、実装のマージがまだ完了していない機能
- [実装済みの機能](implemented.md) — 実装がマージされた機能

機能候補の `01-discovered.md` と仕様草案の `02-draft-spec.md` は、パイプラインが参照するため機能ごとのディレクトリに残す。新しい機能を探索したときは未実装の一覧に追加し、実装がマージされたときは実装済みの一覧へ移す。評価が未完了の場合は評価欄を「未評価」とする。

## 全体の流れ

```
1. discover(機能探索、Claude Opus 5.5)
   → docs/pipeline/<slug>/01-discovered.md
2. spec-draft(仕様設計、Claude Opus 5.5)
   → docs/pipeline/<slug>/02-draft-spec.md(未決事項は選択肢付き)
3. [ユーザ確定](ローカル対話、/spec-confirm コマンド)
   → docs/pipeline/<slug>/03-confirmed-answers.md
4. final-spec(最終仕様、Claude Opus 5.5)
   → docs/specs/<slug>.md(実装の正本)+ docs/pipeline/<slug>/04-final-spec.md(同内容・進捗マーカー)
5. implement(実装、Codex CLI)
   → ブランチ pipeline/<slug> を作成し、PR(ラベル codex-pipeline)を作成
6. codex-review(Codexの自己レビュー)
   → 指摘があれば 5 に差し戻し、無ければ codex-approved ラベルを付けて 7 へ
7. claude-review(Claude Sonnet 5によるレビュー)
   → 指摘があれば 5 に差し戻し、無ければ claude-approved ラベルを付けて**自動マージ**する

   5↔6↔7 の往復は `Codex実装` コミットの数で数え、`$MaxImplementAttempts`(既定3)を超えたら
   自動では差し戻さず、ラベルは付けたままIssueを作って止める(同じ指摘が解消されず無限に往復する
   事故が実機で発生したため)。止まったPRは人が内容を確認して直す。
8. evaluate(評価、Claude Opus 5.5。PRマージ後に起動)
   → docs/pipeline/<slug>/06-evaluation.md
9. [ユーザーが実機で動かして直してほしい内容を発見]
   → docs/pipeline/USER_FIXES.md に追記
   → 次回の discover はこのファイルの未完了項目を最優先で取り込む
```

各ステージが読み書きするmdファイルが、そのまま次のステージへの引き継ぎ資料になる。

## 実行方法(Orca経由)

すべてのステージは `scripts/pipeline/run-stage.ps1 -Stage <stage> -Slug <slug>`(discoverのみslug不要)
を、Orca管理下のworktreeの中で実行する。手動で最初の1段(discover)を起動するには:

```powershell
orca terminal create --worktree name:pipeline-master --command "powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/pipeline/run-stage.ps1 -Stage discover"
```

`pipeline-master` という名前のworktreeが無ければスクリプトが初回に自動で作る
(`orca worktree create --repo name:refactor-blocks --name pipeline-master --base-branch master`)。
各ステージが成功すると、スクリプト自身が最後に次ステージ用のターミナルを `orca terminal create` で
起動して連鎖する(旧GitHub Actions版の `gh workflow run pipeline.yml -f stage=...` に相当)。
連鎖が止まっても、mdファイルさえ残っていれば同じコマンドを手動で再実行すれば途中から再開できる。

ステージとworktreeの対応:

| ステージ | 実行worktree | 対象ブランチ |
| --- | --- | --- |
| discover / spec-draft / final-spec / evaluate | `pipeline-master`(専用worktree) | `master`(直接push) |
| implement / codex-review / claude-review | `pipeline-<slug>`(専用worktree) | `pipeline/<slug>` |

master系ステージは、Orcaのworktreeが独自ブランチを切る仕様のため、毎回 `git fetch origin master` +
`git reset --hard origin/master` で同期してから作業し、pushだけ明示的に `origin/master` へ向ける。
slug系ステージも同様に、ローカルブランチ名に関係なく常に `origin/pipeline/<slug>` と同期する
(rework時は既存ブランチを、初回は `master` を起点にする)。

## 各役割定義

各ステージのプロンプトは、以下の `.claude/agents/*.md` の内容をそのまま埋め込んで使う。
役割の中身(何を守るか・何をしてはいけないか)を二重管理しないため。

| ステージ | 役割定義 | 実行者 |
| --- | --- | --- |
| discover | `.claude/agents/feature-scout.md` | Claude Opus 5.5(`claude -p`) |
| spec-draft | `.claude/agents/spec-designer.md` | Claude Opus 5.5(`claude -p`) |
| final-spec | `.claude/agents/final-spec-writer.md` | Claude Opus 5.5(`claude -p`) |
| implement / codex-review | (エージェント定義なし。`codex exec` を直接呼ぶ) | Codex CLI |
| claude-review / evaluate | `.claude/agents/evaluator.md` | Claude Sonnet 5 / Opus 5.5(`claude -p`) |

`.claude/agents/implementer.md` はこのパイプライン・`feature-harness` skillのどちらでも使わない。実装は常にCodexが行う
(`docs/specs/README.md` 参照)。

## ローカルコマンド: `/spec-confirm`

`spec-draft` ステージが書いた `docs/pipeline/<slug>/02-draft-spec.md` の「未決事項」を、
ユーザーが対話で1問ずつ選んで確定させるためのスラッシュコマンド。ヘッドレスな `claude -p` 実行は
ユーザー入力を取れないため、ここだけは通常のClaude Codeセッションで対話的に実行する。

```
/spec-confirm
```

`03-confirmed-answers.md` を書いてコミットした後、pushしてよいかユーザーに確認する
(`auto-dev.md` コマンドと同じ流儀。無断でpushしない)。push後、このコマンド自身が
`orca terminal create --worktree name:pipeline-master --command "powershell.exe -NoProfile
-ExecutionPolicy Bypass -File scripts/pipeline/run-stage.ps1 -Stage final-spec -Slug <slug>"`
を実行して次のステージを起動する。

## 前提となるツールのログイン

| ツール | 用途 | 未ログインのときの挙動 |
| --- | --- | --- |
| `claude`(Claude Code CLI) | discover/spec-draft/final-spec/claude-review/evaluate | 該当ステージが失敗する |
| `codex`(Codex CLI) | implement/codex-review(ChatGPT Plusのセッション) | 該当ステージが失敗する |
| `gh`(GitHub CLI) | Issue/PR作成・マージ | 該当コマンドが失敗する |
| `orca` | 次ステージの起動 | 連鎖が止まる(mdファイルは残るので手動で再実行できる) |

いずれもこのPC上で `claude`/`codex login`/`gh auth login` を一度済ませておけば、以降はOrcaが
その実ログインセッションのままターミナルを起動する。GitHub Actions版で必要だった
「`auth.json` をBase64化してSecretsに登録する」運用は不要(セッションそのものをリポジトリの外に
持ち出さないため、フォークPRでの悪用リスクも構造的に発生しない)。

## 自動起動(discoverの定期実行)について

discoverステージは、Orcaの Scheduled Automations で定期実行できる。例えば毎日 JST 3:00 に起動するには:

```powershell
orca automations create `
  --name "refactor-blocks discover" `
  --trigger daily --time 03:00 --timezone Asia/Tokyo `
  --workspace name:pipeline-master `
  --provider claude `
  --prompt "powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/pipeline/run-stage.ps1 -Stage discover"
```

作成後は `orca automations run <id>` で即時実行して動作を確認してから、`orca automations edit <id>
--enabled` で有効化する。まずは手動起動(上記コマンド)で1機能分パイプラインを通しで確認してから
定期実行を有効にすること。

将来、別マシンにRemote Orca Serverを常時起動しておけば、discoverの定期実行や外出先からの
`/spec-confirm` 対応がしやすくなる(今回は未対応。ローカル1台での利用を前提にしている)。

## 自動マージについて

`claude-review` に合格すると、`gh pr merge --squash --delete-branch` でそのPRを**自動でマージする**
(ユーザーの選択により、手動マージの安全弁は設けていない。Codexが書いてClaudeがレビューしたコードが、
人の目を介さずmasterに入る設計であることに注意)。マージ直後に `claude-review` の処理自身が
`evaluate` ステージ用のターミナルを起動する。

マージには、`master` にブランチ保護(必須レビューなど)が設定されている場合はそれを緩める必要が
ある場合がある(このスクリプトは `--admin` は使わない。保護ルールに阻まれて失敗したら、そのステージの
出力にその旨が出る)。
