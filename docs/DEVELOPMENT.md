# 開発フロー全体像

このリポジトリでの開発には、独立した3つの経路がある。以前あった「大規模パイプライン」
(discover→spec-draft→final-spec→implement→codex-review→claude-review→evaluateの7段)は
削除済みで、現在は下記の3経路に統一されている。

## ① 仕様ベースの開発(メインフロー)

```mermaid
flowchart TD
    Req["機能要求(会話・Issue・ブレスト案など)"]

    Req -->|"対話で即確定したい・Issue化したい"| SpecToIssue["/spec-to-issue コマンド<br/>(対話で未決事項をその場で確定)"]
    SpecToIssue --> SpecFileDirect["docs/specs/&lt;slug&gt;.md を直接作成"]
    SpecFileDirect --> GhIssue["gh issue create<br/>+ gh issue develop(実装用ブランチ作成)"]

    Req -->|"仕様設計からまとめて進めたい"| Harness["feature-harness skill<br/>(spec-designerエージェント、または自分で設計)"]
    Harness --> DraftSpec["docs/specs/&lt;slug&gt;.md 草案を作成"]
    DraftSpec --> Undecided{"未決事項が残っている?"}
    Undecided -->|"はい"| DraftList["docs/specs/draft.md に記載<br/>ユーザーに確認して確定させる"]
    DraftList --> UnimplList["docs/specs/unimplemented.md に移動"]
    Undecided -->|"いいえ"| UnimplList

    GhIssue --> Impl
    UnimplList --> Impl

    Impl["実装は常に Codex CLI(codex exec)"]
    Impl -->|"feature-harness内でその場で呼ぶ"| CheckInline["npm run check"]
    Impl -->|"/codex-implement &lt;issue/PR番号&gt;<br/>(GitHub起点)"| SelfReview["Codexが自己レビュー<br/>(NEEDS_FIX ⇄ PASS)"]
    SelfReview --> PR["PR作成・更新"]

    CheckInline --> ReviewInline["evaluatorエージェントが独立レビュー<br/>(同じセッション内)"]
    PR --> ReviewPr["/review-pr &lt;PR番号&gt;<br/>(evaluatorと同じ観点で独立レビュー)"]

    ReviewInline --> Blocker{"blockerあり?"}
    ReviewPr --> Blocker
    Blocker -->|"あり"| Impl
    Blocker -->|"なし"| Merge["完了・マージ"]

    Merge --> ImplList["docs/specs/implemented.md に移動"]
```

**ポイント**: 仕様書の入口は2つ(`/spec-to-issue`=対話で即確定、`feature-harness`=未決事項を残せる)だが、
実装は必ずCodex CLI、評価は必ず独立したレビュー(evaluatorエージェントまたは`/review-pr`)という
1本の流れに合流する。仕様書の状態は `docs/specs/draft.md → unimplemented.md → implemented.md`
の3ファイルで追跡する(詳細は [docs/specs/README.md](specs/README.md))。

## ② 機能案のブレスト(実装には繋がらない)

```mermaid
flowchart LR
    Cron["GitHub Actions: feature-ideas.yml<br/>(毎日実行予定・現在はworkflow_dispatchのみ)"]
    Cron --> Ideas["docs/feature-ideas/YYYY-MM-DD.md<br/>(10個の機能案を列挙するだけ)"]
    Ideas -.->|"人が選んで手で転記"| SpecToIssue2["/spec-to-issue または feature-harness"]
    Ideas -.->|"人が選んで手で転記"| Tasks2["docs/auto-dev/TASKS.md"]
```

**ポイント**: ここは純粋なアイデア出しで、自動では①③のどちらにも繋がらない。気になる案があれば
人が手で転記する(詳細は [docs/feature-ideas/README.md](feature-ideas/README.md))。

## ③ タスクリスト駆動のauto-dev(仕様書を経由しない別経路)

```mermaid
flowchart TD
    Tasks["docs/auto-dev/TASKS.md にタスクを追記"]
    Tasks --> Trigger["auto-dev.yml(定期実行予定・現在は手動)<br/>または /auto-dev コマンド(対話セッション)"]
    Trigger --> Pick["未完了(### [ ])タスクを1件選ぶ"]
    Pick --> Run["実装 → npm run check"]
    Run -->|"成功"| Done["### [x] にしてIMPLEMENTATION_LOG.mdへ追記<br/>直接masterへpush"]
    Run -->|"失敗"| Hold["### [!](保留)にしてIssue作成"]
    Done --> Pick
    Hold --> Pick
```

**ポイント**: ①とは完全に別経路。`docs/specs/` を経由せず、タスクを直接実装してmasterへpushする
(PR・レビューのステップが無い)。小さな改善・雑務向け。

## 全体の使い分け

| 状況 | 使うもの |
| --- | --- |
| 新機能を仕様からきちんと作りたい | ①(`/spec-to-issue` か `feature-harness`) |
| ネタが無くてアイデアだけ欲しい | ②(毎日の機能案ブレスト。手で①か③に転記) |
| 小さな雑務・改善を溜めて流したい | ③(`docs/auto-dev/TASKS.md`) |
| 既存PRをレビューしたい | `/review-pr <PR番号>` |
| 既存Issue/PRを実装・修正したい | `/codex-implement <issue/PR番号>` |
