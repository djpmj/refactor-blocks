---
name: feature-harness
description: refactor-blocksに新機能を追加するとき、仕様設計→実装→評価の3ロールに分けて進めるための開発ハーネスを実行する。「新機能を追加して」「この機能をハーネスで進めて」のような依頼で使う。
---

# feature-harness

`docs/specs/README.md` に定義された「仕様設計 → 実装 → 評価」の3フェーズを、この機能追加で実行する。

## 手順

1. **仕様設計**: 要求が既に会話の中で十分に具体化されている場合はオーケストレーター(自分)が直接 `docs/specs/<機能名>.md` を書く。要求がまだ曖昧・大きい場合は `Agent` ツールで `subagent_type: "spec-designer"` を呼び出し、仕様書を作らせる。書けたら内容をユーザーに要約して確認を取る。
2. **実装**: 承認された仕様書に基づいて、常にCodex CLI(`codex exec`)に実装させる。`.claude/agents/implementer.md` の`implementer`サブエージェント(Claude)は使わない(大規模パイプラインの `implement` ステージと実行者をそろえるため)。`Bash`ツールで以下のように呼び出す:

   ```
   codex exec - --approve-for-me --skip-git-repo-check -o <出力ファイル>
   ```

   標準入力(stdin)に渡すプロンプトには、`docs/specs/<機能名>.md` の仕様に従うこと・`CLAUDE.md` の開発ルール(DDDのレイヤー構成、domain/application層のTDD、eslint.config.jsの規約)に従うこと・実装後に `npm run check` を実行してすべて通すことを含める(`scripts/pipeline/run-stage.ps1` の `implement` ステージのプロンプトと同じ形でよい)。差し戻し(評価者の指摘)で再実行するときは、その指摘内容もプロンプトに含める。
   大規模・実験的で本流を汚したくない場合は、先に `git worktree add` で作業用のworktreeを作り、その中で `codex exec` を実行してからマージする。
3. **評価**: 実装が終わったら、**必ず** `Agent` ツールで `subagent_type: "evaluator"` を呼び出す(呼び出し元プロンプトに仕様書のパスと対象の差分/ブランチを含める)。ここは省略しない。
4. 評価者からの指摘(blocker)があれば、指摘内容を添えて `codex exec` を再実行する(オーケストレーター自身は直さない)。必要なら再度評価者を呼ぶ。
5. 最終的に `npm test` / `npm run lint` / `npm run typecheck` が全て通っていることを確認してからユーザーに完了を報告する。

## 注意

- 評価フェーズを飛ばして「仕上がったので完了」と報告しない。独立レビューがこのハーネスの目的。
- 仕様設計を人力(オーケストレーター自身)で行った場合は、その旨を明記する。実装は常にCodexが行い、評価は必ず別プロセス(サブエージェント)にする。
