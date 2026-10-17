---
name: implement
description: refactor-blocks の未完了な実装対象を Orca orchestration 管理下で最大5件ずつ並列に実装・独立評価する。「実装してください」や $implement で使う。
---

# implement

このスキルが利用者の入口。利用者は引数なしで `$implement` と入力する。自然文の「実装してください」でも、このスキルが選ばれたら同じ手順で進める。会話で特定の対象が明示された場合は、その指定を優先する。

最初に orchestration スキルを読み、そこで解決した Orca CLI の `skills get orchestration` から版一致ガイドを読む。モデル指定と並列 wave のため `references/coordinator-loop.md`、worktree 作成のため `references/placement-and-remote.md` も必要時に読む。Orca runtime の Run / Task / Dispatch で管理し、非 Orca subagent や生の Codex CLI 外部実行で代用しない。

この入口を読む親スレッド自身が `.codex/agents/implementation-orchestrator.toml` の `developer_instructions` を読み、Orca coordinator として直接監督する。implementation-orchestrator カスタムエージェントを別スレッドに起動して監督を委ねない。Run の作成・管理と実装者・評価者の直接起動は親が行い、派遣された worker に新しい Run の作成や子 worker の起動を要求しない。これにより nested worker depth 1 でも実装者と評価者を親の直下に置ける。開いている Issue と関連 PR から既存の未完了対象を収集し、各 Issue の本文を読んで仕様と受け入れ基準を確認してから、独立した最大5 Issueを1組として並列着手する。本文に仕様書パスがあればそのファイルを読む。パスがなくても本文に実装可能な仕様が記載されていれば、本文を仕様として使う。パスの欠落だけを理由に対象から外さない。監督者は実装や評価を兼ねない。

オーケストレーターは `.codex/agents/codex-implement.toml` と `.codex/agents/evaluator.toml` の役割を Orca の正規 `orchestration worker-start` で**別々のエージェントスレッド**に起動し、Issue ごとに実装 → 独立評価 → 指摘修正の順に進める。実装者は `gpt-6-luna`、評価者は `gpt-6-sol` を起動時に指定し、receipt の requested / effective でモデルを確認する。各 TOML の指示を対応する依頼文に含めるか、作業場所の TOML を読ませる。評価者には実装者の判断や会話を渡さない。起動できない場合は正確な制約を報告し、独立評価を実施したとは報告しない。深さ上限を新しい Run や別の起動経路で迂回しない。

同じ組の全実装者を起動してから待つ。Issue・branch・worktree・E2E_PORT を分離し、既に別の管理下で実装中の対象も同じ組の枠として数え、重複起動しない。依存がある対象だけ根拠付きで順序を付け、独立した対象を先に進める。組の全対象が PR 作成・更新または根拠付き未解決報告まで到達してから次の組を集める。

開いている PR のレビュー本文・行コメントと最新差分・CI を照合し、未対応の指摘があれば新しい Issue より優先して修正する。依存更新 PR も指摘があれば対象に含める。指摘を修正したら必要なチェックと独立評価を行い、同じ PR にプッシュする。外部依存により修正できない場合は、確認した根拠と残る指摘を報告する。

独立評価が PASS なら、その対象の変更をコミット・プッシュし、すぐに PR を作成する。同じ対象の PR が既にあれば更新し、重複して作らない。PR には対応する Issue、変更内容、実行したチェック、独立評価の結果を記載する。PR の作成に失敗した場合は理由を報告する。

組が完了したら未処理のレビュー指摘と開いている Issue を再収集し、実装可能な対象が残っていれば次の最大5件へ進む。対応済みの Issue や作成した PR を再処理しない。評価は各 Issue 最大3回。PR マージと Issue 閉鎖は行わない。全 Dispatch の結果を確認し、版一致ガイドに従って完了端末の再利用または解放を済ませ、着手可能な対象がなくなるまで続ける。

利用者にはオーケストレーターの最終報告を返す。
