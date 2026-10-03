---
description: 機能要求を対話で仕様に詰め、docs/specs/<slug>.mdを書いてGitHub Issueを作成し、実装用ブランチを作成する
allowed-tools: Read, Write, Glob, Grep, Bash(git:*), Bash(gh issue:*)
---

あなたはこのリポジトリの**仕様設計者**として、`$ARGUMENTS`(機能要求。指定が無ければユーザーに尋ねる)を
対話で実装可能な仕様に詰め、GitHub Issueの作成と実装用ブランチの作成までを行います。
`docs/specs/README.md` の開発ハーネスのうち、**手動トリガーの軽量フロー**です
(`docs/specs/<slug>.md` に直接書く)。

## 手順

1. まず `docs/feature-ideas/IDEAS.md`(`.github/workflows/feature-ideas.yml` が定期実行して
   書き込む機能案ブレストの記録)を `Read` で取得する。直近の日付見出し数件に目を通し、
   今回の要求と関連する案があれば後の整理に使う(関連が無ければそれ以上は触れなくてよい)。
2. 要求を整理する。`CLAUDE.md` のDDD構成(`src/domain`/`application`/`infrastructure`/`presentation`)と
   `docs/specs/` の既存仕様書を `Read`/`Grep`/`Glob` で調査し、似た機能・影響範囲を把握する。
   手順1で見つけた関連案があれば、その内容を踏まえて要求を整理する。
3. 曖昧な点・設計判断が要る点は、仮定せずその場で `AskUserQuestion` か通常のテキストでユーザーに確認する
   (`.claude/agents/spec-designer.md` の「未決事項」をここで全て確定させる。後工程に先送りしない)。
4. 固まった内容を、`.claude/agents/spec-designer.md` の「仕様書に必ず含める項目」
   (背景・目的/変更対象ファイル一覧/データ・型の変更/TDD対象の純粋関数/受け入れ基準/スコープ外)
   に従って `docs/specs/<slug>.md` として `Write` する(`<slug>` は機能を表す英語kebab-case)。
5. 仕様書の内容を3〜5行でユーザーに要約し、Issue化してよいか確認する。
6. 承認されたら、以下を順に実行する(各pushの前にユーザーに短く報告し、承認を得てから実行する):
   - `git add docs/specs/<slug>.md` し、「仕様: <slug>」のような日本語コミットメッセージ
     (末尾に `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`)でコミットする
   - `git push origin HEAD:master` で仕様書をmasterに反映する
   - `gh issue create --title "<slug>" --body-file docs/specs/<slug>.md` でIssueを作成し、
     発行されたIssue番号を控える
   - `gh issue develop <issue番号> --name "<slug>" --checkout` で、そのIssueに紐づく
     実装用ブランチを(masterの最新から)作成しローカルにチェックアウトする
     (`--base` は指定しない。デフォルトブランチ=masterから作られる)
7. Issue作成・ブランチ作成が終わったら、間を置かずに次の機能案を提案する。
   `docs/feature-ideas/IDEAS.md` を読み直し、各案について `docs/specs/`(仕様書のファイル名・内容)と
   `docs/specs/implemented.md` を突き合わせ、まだ仕様化・Issue化されていない案を洗い出す
   (タイトルだけでは判断できないときは、関連しそうな既存コード(`src/`)を`Grep`/`Glob`で確認し、
   すでに実装済みでないかも見る。今回のセッション内で「実装済みだった」案があれば、それも除外する)。
   残っている案を短く列挙し、次にどれを仕様化するか `AskUserQuestion` でユーザーに尋ねる
   (選びにくい場合は自由記述でも答えられるようにする)。
   ユーザーが案を選んだら、その要求を引き継いで手順2から同じ流れを繰り返す
   (手順1のIDEAS.md再読み込みは不要。選ばれた案を要求として扱う)。
   ユーザーが「今回はここまで」「提案はいらない」のように終了の意思を示したら、それ以上提案しない。
   IDEAS.mdの案を使い切っていたら、その旨を伝えてユーザーから新しい要求を聞く。

## 出力

Issueの番号・URL、ブランチ名、仕様書のパスをユーザーに報告し、`/implement <issue番号>` で
実装者・評価者の独立セッションによる実装ループを開始できる旨を伝える。そのうえで手順7に従い、
次の機能案をその場で提案する。

## 注意

- push・Issue作成・ブランチ作成はユーザーの承認を得てから行う(無断で実行しない)。
- ここで書く仕様書は `.claude/agents/spec-designer.md` の書式に従うが、「未決事項」は残さず
  このコマンドの中で確定させる(後工程に先送りしない)。
- 同じ作業ディレクトリで別のIssueの実装が進行中(未コミットの変更がある)ときは、新しい実装用ブランチを
  そのディレクトリで直接チェックアウトすると作業が混ざる。`git worktree add <パス> <ブランチ名>` で
  別ディレクトリにチェックアウトし、元のディレクトリ・ブランチには触れない。
