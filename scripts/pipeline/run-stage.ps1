<#
docs/pipeline/README.md の開発パイプラインを、GitHub Actions(旧 .github/workflows/pipeline.yml)の
代わりにOrca(ローカルにインストール・ログイン済みのAgent Development Environment)のターミナルとして
実行するための唯一のスクリプト。各ステージの最後で、次のステージを `orca terminal create` で
起動して連鎖する(旧 `gh workflow run pipeline.yml -f stage=X` の置き換え)。

前提:
- Orca CLI(`orca`)・GitHub CLI(`gh`)・Codex CLI(`codex`)・Claude Code CLI(`claude`)が
  すべてPATHに通っていて、ログイン済みであること
- このリポジトリが Orca に `refactor-blocks` という表示名で登録済みであること(`orca repo list --json`)
#>

param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('discover', 'spec-draft', 'final-spec', 'implement', 'codex-review', 'claude-review', 'evaluate')]
    [string]$Stage,

    [string]$Slug
)

$ErrorActionPreference = 'Stop'
# Windows PowerShell 5.1はコンソール出力・ファイル書き込みの既定エンコードがUTF-8ではないため、
# 明示しないと日本語の出力・Add-Content先が文字化けする。
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
$RepoSelector = 'name:refactor-blocks'
$CoAuthor = 'Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>'
$BotUserName = 'refactor-blocks-pipeline'
$BotUserEmail = 'refactor-blocks-pipeline@localhost'

function Invoke-Native {
    param([string]$Exe, [string[]]$ArgList, [string]$StdinText)
    if ($StdinText) {
        $StdinText | & $Exe @ArgList
    } else {
        & $Exe @ArgList
    }
    if ($LASTEXITCODE -ne 0) {
        throw "$Exe $($ArgList -join ' ') が失敗しました(exit $LASTEXITCODE)"
    }
}

# ラベルの付け外しなど、失敗しても処理を止めたくない呼び出し用(旧pipeline.ymlの `|| true` 相当)。
function Invoke-BestEffort {
    param([string]$Exe, [string[]]$ArgList)
    try { & $Exe @ArgList } catch {}
}

# ponytail: GitHub Actions版にあった timeout-minutes(暴走したジョブを強制終了する安全策)は
# 移植しない。Orca経由の実行は人がターミナルを開いて生の出力をそのまま見られる前提(セッション共有)
# なので、暴走に気づいたら `orca terminal send --interrupt` 等で人が止められる。もし無人運用
# (Scheduled Automations)で頻繁に暴走するようなら、そのときに時間打ち切りを足す。
# --permission-mode acceptEdits + --permission-prompts none で実機テストしたところ、
# Windows(PowerShell)上ではBashツールのgitコマンドが「権限チェックで解析できず自動拒否」
# され、エージェントがコミットを実行せず提案だけして終わる不具合が2回連続で再現した
# (このセッションには承認する人がいないため、noneだと拒否のまま進めなくなる)。
# --allowedTools による使えるツール自体の絞り込みは維持されるので、bypassPermissionsで
# 個々の呼び出しごとの承認チェックだけを外す。
# 長い複数行プロンプトを `-p <text>` の引数として渡すと、claude.ps1 ラッパー経由で
# 途中(末尾付近)から切れる不具合が実機で2回再現した(エージェントが「指示文が途中で
# 切れていたのでpushしなかった」と自己申告した)。標準入力経由なら全文渡ることを
# 動作確認済みなので、プロンプトは引数ではなく標準入力で渡す。
function Invoke-ClaudeAgent {
    param([string]$Prompt, [string]$Model, [string]$AllowedTools)
    Invoke-Native -Exe 'claude' -StdinText $Prompt -ArgList @(
        '-p',
        '--model', $Model,
        '--allowedTools', $AllowedTools,
        '--permission-mode', 'bypassPermissions'
    )
}

function Set-BotGitIdentity {
    git config user.name $BotUserName | Out-Null
    git config user.email $BotUserEmail | Out-Null
}

# discover/spec-draft/final-spec/evaluate は専用worktree上で直接masterへコミット・pushする。
# Orcaのworktreeは常に独自ブランチを切るため、masterという名前のローカルブランチは使わず、
# 毎回 origin/master の内容にリセットしてから作業し、pushだけ明示的にmasterへ向ける。
#
# | Out-Null で標準出力だけを捨てる: PowerShellの関数は、リダイレクトしていない出力を
# 呼び出し元へ全部流す(戻り値の一部として混ざる)ため、`$wtPath = Sync-...` のように
# 戻り値を受け取ると、gitの"Switched to a new branch"等の出力が$wtPathに混入し、
# 後続のJoin-Pathで壊れたパスになる不具合が実機で再現した。
# ただし `*> $null`/`2>$null`のようにstderr(ストリーム2)を巻き込む形は避ける:
# Windows PowerShell 5.1では、ネイティブコマンドのstderr出力をリダイレクトすると
# $ErrorActionPreference='Stop'下で終端エラー化される(exit 0でも)という仕様があり、
# git checkout等の「成功時にもstderrへ案内文を書く」コマンドがそれで落ちる不具合も
# 実機で再現した。
function Sync-MasterWorktree {
    $wtPath = Get-OrCreateWorktree -Name 'pipeline-master'
    Set-Location $wtPath
    Set-BotGitIdentity
    git fetch origin master | Out-Null
    git reset --hard origin/master | Out-Null
    git clean -fd | Out-Null
    return $wtPath
}

function Get-OrCreateWorktree {
    param([string]$Name, [string]$BaseBranch = 'master')
    $list = orca worktree list --repo $RepoSelector --json | ConvertFrom-Json
    $existing = $list.result.worktrees | Where-Object { $_.displayName -eq $Name }
    if ($existing) { return $existing.path }
    $created = orca worktree create --repo $RepoSelector --name $Name --base-branch $BaseBranch --no-parent --json | ConvertFrom-Json
    return $created.result.worktree.path
}

# implement/codex-review/claude-review 用。pipeline-<slug> という専用worktreeを使い回し、
# 実際のPRブランチ名(pipeline/<slug>)はOrcaが割り振るローカルブランチ名とは独立に、
# 毎回 origin から明示的に同期する。
function Sync-SlugWorktree {
    param([string]$Slug)
    $wtPath = Get-OrCreateWorktree -Name "pipeline-$Slug"
    Set-Location $wtPath
    Set-BotGitIdentity
    git fetch origin | Out-Null
    $branch = "pipeline/$Slug"
    # $ErrorActionPreference = 'Stop' の下では、git rev-parse --verify のstderr出力
    # (ブランチが無いときの"fatal: ...")が終端エラーとして扱われてしまう不具合が
    # 実機で再現した(2>$nullのようなstderrリダイレクトでは防げない)。
    # stderrを出さない show-ref で存在確認する。
    git show-ref --verify --quiet "refs/remotes/origin/$branch"
    if ($LASTEXITCODE -eq 0) {
        git checkout -B $branch "origin/$branch" | Out-Null
        $script:IsRework = $true
    } else {
        git checkout -B $branch origin/master | Out-Null
        $script:IsRework = $false
    }
    return $wtPath
}

function Start-NextStage {
    param([string]$Worktree, [string]$Stage, [string]$Slug)
    $cmd = "powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/pipeline/run-stage.ps1 -Stage $Stage"
    if ($Slug) { $cmd += " -Slug $Slug" }
    orca terminal create --worktree "name:$Worktree" --command $cmd --json | Out-Null
}

function Get-NewSlugFromLastCommit {
    param([string]$Pattern)
    $file = (git log -1 --diff-filter=A --name-only --pretty=format: -- $Pattern | Select-Object -First 1)
    if (-not $file) { throw "$Pattern に一致する新規ファイルが直近のコミットに見つかりません" }
    if ($file -notmatch [regex]::Escape('docs/pipeline/') + '([^/]+)/') { throw "$file からslugを取り出せません" }
    return $Matches[1]
}

# pipeline-master / pipeline-<slug> は複数ステージが使い回す共有worktreeなので、
# ここでpush済みを確認せずに次ステージを起動すると、次ステージの同期処理
# (git reset --hard / git checkout -B)が「まだpushされていないローカルコミット」を
# 黙って消してしまう(実際にこのバグでdiscoverの成果を1回失った)。エージェントに
# pushを指示しても実行を忘れる/失敗することがあるため、ここで必ず検証する。
function Assert-Pushed {
    param([string]$RemoteRef)
    git fetch origin | Out-Null
    $localHead = git rev-parse HEAD
    $remoteHead = git rev-parse $RemoteRef
    if ($localHead -ne $remoteHead) {
        throw "pushが確認できません(HEAD: $localHead / ${RemoteRef}: $remoteHead)。エージェントがpushを完了できなかった可能性があります。手動で確認してください。"
    }
}

switch ($Stage) {

    'discover' {
        Sync-MasterWorktree | Out-Null
        $prompt = @"
.claude/agents/feature-scout.md をReadツールで読み、その役割になりきって
docs/pipeline/README.md の「discover」ステージを実行してください。

機能を1件選んだら docs/pipeline/<slug>/01-discovered.md を書き、
(docs/pipeline/USER_FIXES.md から採用した場合はその見出しの書き換えも含めて)
git add し、「機能探索: <タイトル>」のような日本語のコミットメッセージ
(末尾に「$CoAuthor」を付ける)でコミットして、git push origin HEAD:master を実行してください。
"@
        Invoke-ClaudeAgent -Prompt $prompt -Model 'claude-opus-5-5' -AllowedTools 'Read,Write,Glob,Grep,Bash(git:*)'
        Assert-Pushed -RemoteRef 'origin/master'
        $newSlug = Get-NewSlugFromLastCommit -Pattern 'docs/pipeline/*/01-discovered.md'
        Start-NextStage -Worktree 'pipeline-master' -Stage 'spec-draft' -Slug $newSlug
    }

    'spec-draft' {
        if (-not $Slug) { throw 'spec-draft には -Slug が必要です' }
        Sync-MasterWorktree | Out-Null
        $prompt = @"
SLUG: $Slug

.claude/agents/spec-designer.md をReadツールで読み、その役割になりきって、
docs/pipeline/$Slug/01-discovered.md に書かれた機能の仕様草案を
docs/pipeline/$Slug/02-draft-spec.md として書いてください
(spec-designer.mdの「未決事項の書式」に従うこと)。

書けたら git add し、「仕様設計(草案): $Slug」のようなコミットメッセージ
(末尾に「$CoAuthor」を付ける)でコミットして、git push origin HEAD:master を実行してください。
"@
        Invoke-ClaudeAgent -Prompt $prompt -Model 'claude-opus-5-5' -AllowedTools 'Read,Write,Glob,Grep,Bash(git:*)'
        Assert-Pushed -RemoteRef 'origin/master'
        Invoke-Native -Exe 'gh' -ArgList @(
            'issue', 'create',
            '--title', "仕様確定待ち: $Slug",
            '--body', "docs/pipeline/$Slug/02-draft-spec.md の未決事項を、ローカルのClaude Codeで ``/spec-confirm`` コマンドを実行して確定させてください。確定すると自動的に final-spec ステージが起動します。"
        )
    }

    'final-spec' {
        if (-not $Slug) { throw 'final-spec には -Slug が必要です' }
        Sync-MasterWorktree | Out-Null
        $prompt = @"
SLUG: $Slug

.claude/agents/final-spec-writer.md をReadツールで読み、その役割になりきって、
docs/pipeline/$Slug/02-draft-spec.md と docs/pipeline/$Slug/03-confirmed-answers.md を統合し、
docs/specs/$Slug.md と docs/pipeline/$Slug/04-final-spec.md を書いてください。

書けたら git add し、「最終仕様: $Slug」のようなコミットメッセージ
(末尾に「$CoAuthor」を付ける)でコミットして、git push origin HEAD:master を実行してください。
"@
        Invoke-ClaudeAgent -Prompt $prompt -Model 'claude-opus-5-5' -AllowedTools 'Read,Write,Glob,Grep,Bash(git:*)'
        Assert-Pushed -RemoteRef 'origin/master'
        Start-NextStage -Worktree 'pipeline-master' -Stage 'implement' -Slug $Slug
    }

    'implement' {
        if (-not $Slug) { throw 'implement には -Slug が必要です' }
        $wtPath = Sync-SlugWorktree -Slug $Slug
        Invoke-Native -Exe 'npm' -ArgList @('ci')

        $promptLines = @(
            "docs/specs/$Slug.md の仕様に従って実装してください。",
            'CLAUDE.mdの開発ルール(DDDのレイヤー構成、domain/application層のTDD、eslint.config.jsの規約)に従うこと。',
            '実装が終わったら npm run check(lint + typecheck + test)を実行し、失敗する場合は原因を直してすべて通した状態で終えてください。'
        )
        $reviewNotes = Join-Path $wtPath "docs/pipeline/$Slug/05-review-notes.md"
        if (Test-Path $reviewNotes) {
            $promptLines += ''
            $promptLines += '以下はこれまでのレビュー指摘です。特に blocker を優先して直してください。'
            $promptLines += ''
            $promptLines += (Get-Content $reviewNotes -Raw -Encoding UTF8)
        }
        $codexPrompt = $promptLines -join "`n"
        $lastMessageFile = Join-Path $env:TEMP 'codex-last-message.md'

        $codexFailed = $false
        try {
            Invoke-Native -Exe 'codex' -StdinText $codexPrompt -ArgList @(
                'exec', '-', '--approve-for-me', '--skip-git-repo-check', '-o', $lastMessageFile
            )
        } catch {
            $codexFailed = $true
        }

        $checkFailed = $false
        if (-not $codexFailed) {
            try { Invoke-Native -Exe 'npm' -ArgList @('run', 'check') } catch { $checkFailed = $true }
        }

        if ($codexFailed -or $checkFailed) {
            Invoke-Native -Exe 'gh' -ArgList @(
                'issue', 'create',
                '--title', "Codex実装が完了しませんでした: $Slug",
                '--body', "ワークツリー pipeline-$Slug の実装(codex exec または npm run check)が失敗しています。手動で確認してください。"
            )
            return
        }

        git add -A
        git diff --cached --quiet
        $hasChanges = ($LASTEXITCODE -ne 0)
        if ($hasChanges) {
            $msg = if ($script:IsRework) { "Codex実装: $Slug のレビュー指摘に対応" } else { "Codex実装: $Slug" }
            Invoke-Native -Exe 'git' -ArgList @('commit', '-m', $msg)
        }
        Invoke-Native -Exe 'git' -ArgList @('push', 'origin', "pipeline/$Slug")
        Assert-Pushed -RemoteRef "origin/pipeline/$Slug"

        $prCount = gh pr list --head "pipeline/$Slug" --json number --jq '.[0].number'
        if (-not $prCount) {
            Invoke-Native -Exe 'gh' -ArgList @(
                'pr', 'create',
                '--head', "pipeline/$Slug",
                '--base', 'master',
                '--title', $Slug,
                '--label', 'codex-pipeline',
                '--body-file', $lastMessageFile
            )
        }
        Start-NextStage -Worktree "pipeline-$Slug" -Stage 'codex-review' -Slug $Slug
    }

    'codex-review' {
        if (-not $Slug) { throw 'codex-review には -Slug が必要です' }
        Sync-SlugWorktree -Slug $Slug | Out-Null
        $verdictFile = Join-Path $env:TEMP 'codex-verdict.md'
        Invoke-Native -Exe 'codex' -ArgList @(
            'exec',
            "docs/specs/$Slug.md の受け入れ基準と、CLAUDE.mdのDDD構成・eslint規約に照らして、master からのこのブランチの差分(git diff master...HEAD)をレビューしてください。指摘があれば具体的な指摘を書いてください。最後に、直すべき指摘(blocker)が1件でもあれば最後の1行だけに NEEDS_FIX と書き、無ければ最後の1行だけに PASS と書いてください。",
            '--approve-for-me', '--skip-git-repo-check', '-o', $verdictFile
        )

        $notesPath = "docs/pipeline/$Slug/05-review-notes.md"
        $header = "`n## $(Get-Date -Format 'yyyy-MM-dd HH:mm') — Codex自己レビュー`n`n"
        Add-Content -Path $notesPath -Encoding UTF8 -Value ($header + (Get-Content $verdictFile -Raw -Encoding UTF8))
        Invoke-Native -Exe 'git' -ArgList @('add', $notesPath)
        Invoke-Native -Exe 'git' -ArgList @('commit', '-m', "Codex自己レビュー: $Slug")
        Invoke-Native -Exe 'git' -ArgList @('push', 'origin', "pipeline/$Slug")
        Assert-Pushed -RemoteRef "origin/pipeline/$Slug"

        $lastLine = Get-Content $verdictFile -Tail 1 -Encoding UTF8
        if ($lastLine -match 'NEEDS_FIX') {
            Invoke-BestEffort -Exe 'gh' -ArgList @('pr', 'edit', "pipeline/$Slug", '--add-label', 'changes-requested', '--remove-label', 'codex-approved')
            Start-NextStage -Worktree "pipeline-$Slug" -Stage 'implement' -Slug $Slug
        } else {
            Invoke-BestEffort -Exe 'gh' -ArgList @('pr', 'edit', "pipeline/$Slug", '--add-label', 'codex-approved', '--remove-label', 'changes-requested')
            Start-NextStage -Worktree "pipeline-$Slug" -Stage 'claude-review' -Slug $Slug
        }
    }

    'claude-review' {
        if (-not $Slug) { throw 'claude-review には -Slug が必要です' }
        Sync-SlugWorktree -Slug $Slug | Out-Null
        Invoke-Native -Exe 'npm' -ArgList @('ci')
        $prompt = @"
SLUG: $Slug

.claude/agents/evaluator.md をReadツールで読み、その役割になりきって、
この開発パイプラインの「claude-review」として、docs/specs/$Slug.md を
仕様書に、現在のブランチ(master からの git diff master...HEAD)を対象の差分として
レビューしてください。evaluator.mdの「開発パイプライン経由の場合」の指示に従い、
docs/pipeline/$Slug/05-review-notes.md に追記してください
(末尾の判定見出しの文言は変えないこと)。

書けたら git add し、「Claudeレビュー: $Slug」のようなコミットメッセージ
(末尾に「$CoAuthor」を付ける)でコミットして、git push origin HEAD を実行してください。
"@
        Invoke-ClaudeAgent -Prompt $prompt -Model 'claude-sonnet-5' -AllowedTools 'Read,Write,Glob,Grep,Bash(npm:*),Bash(git:*)'
        Assert-Pushed -RemoteRef "origin/pipeline/$Slug"

        $notesPath = "docs/pipeline/$Slug/05-review-notes.md"
        $verdictLine = (Get-Content $notesPath -Encoding UTF8 | Select-String -Pattern '^## 判定: .*$' | Select-Object -Last 1).Line
        if ($verdictLine -eq '## 判定: 要修正') {
            Invoke-BestEffort -Exe 'gh' -ArgList @('pr', 'edit', "pipeline/$Slug", '--add-label', 'changes-requested', '--remove-label', 'claude-approved')
            Invoke-Native -Exe 'gh' -ArgList @('pr', 'comment', "pipeline/$Slug", '--body', "Claudeレビューで修正が必要な指摘がありました。docs/pipeline/$Slug/05-review-notes.md を参照してください。Codexによる再実装を起動します。")
            Start-NextStage -Worktree "pipeline-$Slug" -Stage 'implement' -Slug $Slug
        } else {
            Invoke-BestEffort -Exe 'gh' -ArgList @('pr', 'edit', "pipeline/$Slug", '--add-label', 'claude-approved', '--remove-label', 'changes-requested')
            Invoke-Native -Exe 'gh' -ArgList @('pr', 'comment', "pipeline/$Slug", '--body', "Claudeレビューが完了しました。指摘はありません。自動マージします。マージ後に評価ステージが自動で起動します。")
            Invoke-Native -Exe 'gh' -ArgList @('pr', 'merge', "pipeline/$Slug", '--squash', '--delete-branch')
            Start-NextStage -Worktree 'pipeline-master' -Stage 'evaluate' -Slug $Slug
        }
    }

    'evaluate' {
        if (-not $Slug) { throw 'evaluate には -Slug が必要です' }
        Sync-MasterWorktree | Out-Null
        Invoke-Native -Exe 'npm' -ArgList @('ci')
        $prompt = @"
SLUG: $Slug

.claude/agents/evaluator.md をReadツールで読み、その役割になりきって、
この開発パイプラインの「evaluate」として、docs/specs/$Slug.md を
仕様書に、直近のマージコミット(pipeline/$Slug だったブランチの内容、
git log でコミット履歴を確認できる)を対象として評価し、
docs/pipeline/$Slug/06-evaluation.md に書いてください。

書けたら git add し、「評価: $Slug」のようなコミットメッセージ
(末尾に「$CoAuthor」を付ける)でコミットして、git push origin HEAD:master を実行してください。
"@
        Invoke-ClaudeAgent -Prompt $prompt -Model 'claude-opus-5-5' -AllowedTools 'Read,Write,Glob,Grep,Bash(npm:*),Bash(git:*)'
        Assert-Pushed -RemoteRef 'origin/master'
    }
}
