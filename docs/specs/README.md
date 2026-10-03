# 開発ハーネス: 仕様設計 → 実装 → 評価

このリポジトリで新機能を追加するときは、役割を分けた3フェーズで進める。1人(1エージェント)が仕様も実装もレビューも兼ねると、思い込みに気づけないまま実装が仕様からズレたり、バグを見落としたりしやすいため。

## フェーズ

1. **仕様設計**(`.claude/agents/spec-designer.md`) — 要求を読み解き、`docs/specs/<機能名>.md` に実装可能な仕様書を書く。コードは書かない。
2. **実装**(Codex CLI) — 承認された仕様書(`docs/specs/<機能名>.md`)だけを渡し、TDD(Red→Green→Refactor)でコードを書かせる。仕様にない拡張はしない。`.claude/agents/implementer.md` は使わない(大規模パイプライン `docs/pipeline/README.md` の `implement` ステージと実行者をそろえている)。
3. **評価**(`.claude/agents/evaluator.md`) — 実装の文脈を共有しない独立した視点で、`npm test` / `npm run lint` / `npm run typecheck` を実際に実行し、仕様の受け入れ基準を満たしているかをレビューする。コードは直さない。

## 呼び出し方

仕様設計・評価はClaude Codeの `Agent` ツールで `subagent_type` に `spec-designer` / `evaluator` を指定して呼び出す。実装は `codex exec` をBash/PowerShellツールで直接実行する(プロンプトは仕様書のパスと `CLAUDE.md` の開発ルールを渡し、終了後に `npm run check` で確認する)。まとめて回したい場合は `feature-harness` skill(`.claude/skills/feature-harness/SKILL.md`)を使う。

- 小さな機能追加や、仕様がすでに会話の中で固まっている場合は、仕様設計は呼び出し元(オーケストレーター)が直接行ってよい(調査の二重作業を避けるため)。ただし**評価フェーズは必ず独立したサブエージェントとして実行する**。これが「別の目」でのレビューという、このハーネスの一番の価値だから。
- 実装は常にCodexに任せる。大きめの機能や、実装を隔離して壊れても本流に影響させたくない場合は、`git worktree` を作ってその中で `codex exec` を実行してからマージする。

## アーキテクチャの前提

`CLAUDE.md` に記載のDDD構成(`domain` / `application` / `infrastructure` / `presentation`)を前提に設計・実装する。仕様書には、新規/変更する型・関数がどの層に属するかを明記する。
