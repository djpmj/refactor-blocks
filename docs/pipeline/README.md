# 開発パイプライン: 機能探索 → 仕様設計 → ユーザ確定 → 最終仕様 → 実装 → レビュー → 評価

`docs/specs/README.md` の開発ハーネス(仕様設計→実装→評価、同一セッション内でサブエージェントを呼ぶ形)を、
役割ごとに**別セッション**(別のGitHub Actionsジョブ実行、または別のCLI呼び出し)に分割したもの。
`.github/workflows/pipeline.yml` が1つのステートマシンとして各ステージを順に起動する。

## 全体の流れ

```
1. discover(機能探索、Claude)
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
8. evaluate(評価、Claude Opus 5.5。PRマージ後に起動)
   → docs/pipeline/<slug>/06-evaluation.md
9. [ユーザーが実機で動かして直してほしい内容を発見]
   → docs/pipeline/USER_FIXES.md に追記
   → 次回の discover はこのファイルの未完了項目を最優先で取り込む
```

各ステージが読み書きするmdファイルが、そのまま次のステージへの引き継ぎ資料になる。
すべてのステージは `workflow_dispatch`(`gh workflow run pipeline.yml -f stage=... -f slug=...`)
からしか起動しない(`push`/`pull_request` イベントは使わない。claude-code-actionが
`workflow_dispatch` 以外のイベント種別を受け付けないため)。ステージ間の連鎖は、前段のステップが
成功した最後に次段を `gh workflow run` で明示的に呼ぶことで行う(discoverの最後・final-specの
最後・codex-reviewの最後・claude-review合格時)。`/spec-confirm` コマンドの最後も同様に
`final-spec` を呼ぶ。連鎖が止まっても、mdファイルさえ残っていれば手動で次のステージを
`workflow_dispatch` から再実行できる。

## 各役割定義

GitHub Actions側のプロンプトは、以下の `.claude/agents/*.md` の内容をそのまま埋め込んで使う。
役割の中身(何を守るか・何をしてはいけないか)を二重管理しないため。

| ステージ | 役割定義 | 実行者 |
| --- | --- | --- |
| discover | `.claude/agents/feature-scout.md` | Claude(claude-code-action) |
| spec-draft | `.claude/agents/spec-designer.md` | Claude Opus 5.5 |
| final-spec | `.claude/agents/final-spec-writer.md` | Claude Opus 5.5 |
| implement / codex-review | (エージェント定義なし。`codex exec` / `codex exec review` を直接呼ぶ) | Codex CLI |
| claude-review / evaluate | `.claude/agents/evaluator.md` | Claude Sonnet 5 / Opus 5.5 |

`.claude/agents/implementer.md` はこのパイプラインでは使わない(Codexに置き換わったため)。
同一セッション内で小規模な機能を作る場合の `feature-harness` skill では引き続き使う。

## ローカルコマンド: `/spec-confirm`

`spec-draft` ステージが書いた `docs/pipeline/<slug>/02-draft-spec.md` の「未決事項」を、
ユーザーが対話で1問ずつ選んで確定させるためのスラッシュコマンド。GitHub Actions側では
ユーザー入力を取れないため、ここだけはローカルのClaude Codeセッションで実行する。

```
/spec-confirm
```

`03-confirmed-answers.md` を書いてコミットした後、pushしてよいかユーザーに確認する
(`auto-dev.md` コマンドと同じ流儀。無断でpushしない)。push後、このコマンド自身が
`gh workflow run pipeline.yml -f stage=final-spec -f slug=<slug>` を実行して次のステージを起動する。

## 必要なSecrets

| Secret名 | 用途 | 未登録のときの挙動 |
| --- | --- | --- |
| `CLAUDE_CODE_OAUTH_TOKEN` | Claudeを使う全ステージ(既存の `auto-dev.yml` と共用) | 該当ステージが失敗する |
| `CODEX_AUTH_JSON_B64` | `implement`/`codex-review` ステージでのCodex認証(ChatGPT Plusのセッション) | Codexステージが失敗する |

Codexは **APIキーではなくChatGPT Plusのセッションを使う**(API従量課金ではなく、契約済みの
Plusプランを使うため)。GitHub Actions上のヘッドレス環境ではブラウザログインができないため、
ローカルでログイン済みの認証情報(`auth.json`)をSecretsに入れておき、CI側でそのファイルを
復元してから `codex exec` を実行する。

### `CODEX_AUTH_JSON_B64` の作り方

1. 自分のPCで `codex login` を済ませておく(`codex login status` で `Logged in using ChatGPT` と出ればOK)
2. `codex doctor` の出力にある `CODEX_HOME available` の行、または環境変数 `CODEX_HOME`
   (未設定なら既定で `%USERPROFILE%\.codex` / `~/.codex`)から、その中の `auth.json` の場所を確認する
3. `auth.json` の中身をBase64化してSecretに登録する(PowerShellの例):
   ```powershell
   $authPath = if ($env:CODEX_HOME) { Join-Path $env:CODEX_HOME 'auth.json' } else { Join-Path $env:USERPROFILE '.codex\auth.json' }
   $b64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes($authPath))
   $b64 | gh secret set CODEX_AUTH_JSON_B64 --repo <owner>/<repo>
   ```
   (`gh secret set` はパイプ経由で値を渡せるので、値がターミナルの画面やコマンド履歴に残らない)

### 注意(セキュリティ・運用)

- `auth.json` は自分のChatGPT/OpenAIアカウントのセッションそのものなので、パスワードと同じ扱いで
  他人に見せない・公開リポジトリの誰でも読めるログに出さない
- このワークフローはフォークからのPull Requestでは実行されない前提で設計している
  (フォークPRでSecretsを使うワークフローを動かすと、第三者にセッションを悪用され得る。
  `pull_request_target` 等でフォークPRからも動かす変更はしないこと)
- セッションには有効期限があるため、しばらく経ってCodexステージが認証エラーで失敗し始めたら、
  ローカルで `codex login` をやり直し、上記の手順で `CODEX_AUTH_JSON_B64` を登録し直す
  (自動更新の仕組みは持たせていない。既知の運用コストとして許容する)

登録手順: リポジトリの Settings → Secrets and variables → Actions、または `gh secret set` で登録する。

## 自動起動(schedule)について

`auto-dev.yml` と同じく、`pipeline.yml` の `discover` ステージの `schedule` トリガーは
最初はコメントアウトしてある。上記のSecretsを登録し、パイプライン全体を一度手動で
通しで確認できたら、コメントを外して定期実行を有効化する。

## 自動マージについて

`claude-review` に合格すると、`gh pr merge --squash --delete-branch` でそのPRを**自動でマージする**
(ユーザーの選択により、手動マージの安全弁は設けていない。Codexが書いてClaudeがレビューしたコードが、
人の目を介さずmasterに入る設計であることに注意)。マージ直後に `claude-review` ジョブ自身が
`gh workflow run pipeline.yml -f stage=evaluate -f slug=<slug>` を実行し、`evaluate` ステージを
起動する(`pull_request` イベントのトリガーは使わない。前述のとおりclaude-code-actionが
未対応のため)。

マージには「Settings → Actions → General → Allow GitHub Actions to create and approve pull
requests」の有効化に加え、`master` にブランチ保護(必須レビューなど)が設定されている場合は
それを緩めるか `gh pr merge --admin` への変更が必要になる場合がある(このワークフローは
`--admin` は使わない。保護ルールに阻まれて失敗したら、その旨がジョブのログに出る)。
