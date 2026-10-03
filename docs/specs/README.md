# 開発ハーネス: 仕様設計 → 実装 → 評価

このリポジトリで新機能を追加するときは、役割を分けた3フェーズで進める。1人(1エージェント)が仕様も実装もレビューも兼ねると、思い込みに気づけないまま実装が仕様からズレたり、バグを見落としたりしやすいため。

## 仕様書の状態

`docs/specs/<slug>.md` がどの作成経路(`feature-harness` skill・`/spec-to-issue` コマンドなど)で作られたかは問わず、状態は以下の3つの一覧で一元管理する。

- [draft.md](draft.md) — 未決事項が残っていてユーザー確定が済んでいない仕様書
- [unimplemented.md](unimplemented.md) — 内容は確定したが、実装がまだ `master` にマージされていない仕様書
- [implemented.md](implemented.md) — 実装が `master` にマージ済みの仕様書

新しい仕様書を書いたら `draft.md` に追加し、確定したら `unimplemented.md` へ、実装がマージされたら `implemented.md` へ移す。

## フェーズ

1. **仕様設計**(`.claude/agents/spec-designer.md`) — 要求を読み解き、`docs/specs/<機能名>.md` に実装可能な仕様書を書く。コードは書かない。
2. **実装**(`.claude/agents/codex-implement.md`) — 承認された仕様書の受け入れ基準に従い、TDD(Red→Green→Refactor)で実装する。仕様にない拡張はしない。
3. **評価**(`.claude/agents/evaluator.md`) — 実装者とは別のClaudeセッションで、チェックを実行し、仕様の受け入れ基準を満たしているかレビューする。コードは直さない。

## 呼び出し方

仕様ベースの実装・評価は `/implement <仕様書パス>` を実行する。このコマンドがAgent Teamsで独立した実装者・評価者セッションを起動し、評価者の判定が `PASS` になるまで修正ループを管理する。新機能の仕様づくりから始めたい場合は `feature-harness` skill(`.claude/skills/feature-harness/SKILL.md`)を使い、確定後に同コマンドへ仕様書を渡す。

- 小さな機能追加や、仕様がすでに会話の中で固まっている場合は、仕様設計は呼び出し元(オーケストレーター)が直接行ってよい(調査の二重作業を避けるため)。ただし**評価フェーズは必ず独立したClaudeセッションとして実行する**。これが「別の目」でのレビューという、このハーネスの一番の価値だから。
- 実装者・評価者は別々のClaudeセッションで動かす。評価者の会話には実装者の説明や判断を渡さず、仕様と差分だけで独立評価する。

## アーキテクチャの前提

`CLAUDE.md` に記載のDDD構成(`domain` / `application` / `infrastructure` / `presentation`)を前提に設計・実装する。仕様書には、新規/変更する型・関数がどの層に属するかを明記する。
