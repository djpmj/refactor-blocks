---
description: Issue・PR・仕様書・会話中の実装依頼を、独立した実装者と評価者の修正ループで進める
---

このコマンドは `.claude/agents/implementation-orchestrator.md` の指示で実行してください。利用者が実行する入口はこのコマンドだけです。

`$ARGUMENTS` と現在の会話・作業ツリーから対象を判断し、Issue/PR・仕様書パス・通常の実装依頼に対応してください。不足情報があるときだけ利用者に質問してください。

必ずClaude Code Agent Teamsを使って、`.claude/agents/codex-implement.md` の実装担当と `.claude/agents/evaluator.md` の評価担当を**別々の独立セッション**として起動してください。実装→独立評価→指摘を実装担当へ返す修正ループを `PASS` まで行い、最大3回の評価サイクルで収束しない場合は停止・報告します。通常の同一セッション内サブエージェントやCodex CLIによる代替はしません。

利用者が承認していないコミット、プッシュ、PRの作成・更新・マージは行いません。
