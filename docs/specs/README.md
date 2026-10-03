# 開発ハーネス: 仕様設計 → 実装 → 評価

このリポジトリで新機能を追加するときは、役割を分けた3フェーズで進める。1人(1エージェント)が仕様も実装もレビューも兼ねると、思い込みに気づけないまま実装が仕様からズレたり、バグを見落としたりしやすいため。

## 仕様書の状態

`docs/specs/<slug>.md` がどの作成経路(`feature-harness` skill・`/spec-to-issue` コマンドなど)で作られたかは問わず、未決事項と実装済みの状態を次で管理する。実装待ちの対象と仕様書パスは Issue 本文に記載する。

- [draft.md](draft.md) — 未決事項が残っていてユーザー確定が済んでいない仕様書
- [implemented.md](implemented.md) — 実装が `master` にマージ済みの仕様書

未決事項がある仕様書は `draft.md` に追加する。仕様が確定したらその一覧から外し、仕様書のパスを記した Issue を作る。実装がマージされたら `implemented.md` に追加する。

## フェーズ

1. **仕様設計**(`.claude/agents/spec-designer.md`) — 要求を読み解き、`docs/specs/<機能名>.md` に実装可能な仕様書を書く。コードは書かない。
2. **実装**(Codex: `.codex/agents/codex-implement.toml`、Claude Code: `.claude/agents/codex-implement.md`) — 承認された仕様書の受け入れ基準に従い、TDD(Red→Green→Refactor)で実装する。仕様にない拡張はしない。
3. **評価**(Codex: `.codex/agents/evaluator.toml`、Claude Code: `.claude/agents/evaluator.md`) — 実装者とは別のエージェントスレッドで、チェックを実行し、仕様の受け入れ基準を満たしているかレビューする。コードは直さない。

## 呼び出し方

Codex での実装・評価は引数なしの `$implement` を入力する。Codex のオーケストレーターが Issue 本文の仕様書パスを読み、既存の未完了対象を順に選ぶ。Claude Code を使う場合の入口は `/implement <仕様書パス>` である。新機能の仕様づくりから始めたい場合、Claude Code には `feature-harness` skill(`.claude/skills/feature-harness/SKILL.md`)がある。

- 小さな機能追加や、仕様がすでに会話の中で固まっている場合は、仕様設計は呼び出し元(オーケストレーター)が直接行ってよい。**評価フェーズは必ず実装者と別のエージェントスレッドで実行する**。
- 評価者の会話には実装者の説明や判断を渡さず、仕様と差分だけで独立評価する。

## アーキテクチャの前提

`CLAUDE.md` に記載のDDD構成(`domain` / `application` / `infrastructure` / `presentation`)を前提に設計・実装する。仕様書には、新規/変更する型・関数がどの層に属するかを明記する。
