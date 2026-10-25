# ECC(affaan-m/ECC)の取り込み方針

[ECC](https://github.com/affaan-m/ECC)(MIT、エージェント71・スキル311・フック・rules)から、このリポジトリのハーネスに必要なものだけを厳選して取り込む。
ECC全体はプラグインとして入れない(`ponytail` 方針に反し、既存の spec-designer / codex-implement / evaluator と役割が重なるため)。

## 取り込んだもの

| ECC | このリポジトリ | 内容 |
|---|---|---|
| `agents/silent-failure-hunter` | `.claude/agents/silent-failure-hunter.md` | `Result` 型・信頼境界・日本語に合わせて書き直し。evaluator の手順8とCodex版evaluatorから参照 |

## 取り込まなかったもの(いつ足すか)

- `tdd-workflow` / `verification-loop`: すでに `npm run check` とCLAUDE.mdのTDD規約で足りている。
- `typescript-reviewer` / `code-simplifier`: lintルールと `ponytail-review` が担う。
- フック・Memory Vault・instinct学習: ユーザー全体(`~/.claude`)に影響するため未導入。必要になったら個別に検討する。

## ハーネス最適化(2026-10-25)

ECC の `harness-optimizer` / `context-budget` は、ECC 自前の採点スクリプトや `/context` への案内が中身のため移植しなかった。代わりに次を行った。

- `CLAUDE.md` を 12KB → 約9.6KB に削減。masterへの直接push の詳細は [MASTER-PUSH.md](MASTER-PUSH.md) へ移動。
- オーケストレーター(Claude/Codex)が PASS 時に「評価サイクル: N回(NEEDS_FIX m回)」を報告と PR 本文に書き、`review-pr.yml` が `docs/review-pr/LOG.md` に併記する。往復回数の効果測定用。
