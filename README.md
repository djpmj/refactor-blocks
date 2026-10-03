# Refactor Blocks

メソッド分け・クラス分け・ファイル分けを、ドラッグ&ドロップで練習するリファクタリング学習ゲームです。

## 遊び方(プロトタイプ)

1. キャンバス上のクラスの中にあるメソッド(`placeOrder()` など)をクリックすると、右のメソッドエディタに中の処理が表示されます。
2. 処理にチェックを入れ、新しいメソッド名を入力して「選んだ処理をメソッドとして抽出」を押すと、同じクラスに private メソッドが増えます。
3. メソッドを別のクラスへドラッグ&ドロップすると、メソッドを移動できます。
4. 画面上部に、行数の上限を超えているメソッド・クラス・ファイルの数が表示されます。すべて解消するのが目標です。

## セットアップ

```bash
npm install
npx playwright install chromium   # E2Eテストを動かす場合のみ
npm run dev
```

開発ルールは [CLAUDE.md](./CLAUDE.md) を参照してください。

## Codex で実装する

Codex のチャットで引数なしの `$implement` と入力します。「実装してください」という依頼でも起動できます。実装オーケストレーターが開いている Issue に記載された仕様書を読み、着手可能な対象を一件ずつ処理します。実装者・評価者は独立したエージェントスレッドで動き、評価結果を受けて修正を繰り返します。Codex CLI の起動は不要です。

Codex 用の入口は [.agents/skills/implement/SKILL.md](./.agents/skills/implement/SKILL.md)、エージェント定義は [.codex/agents/](./.codex/agents/) にあります。`.claude/commands/implement.md` は Claude Code 専用です。

実装者は `gpt-6-luna`、評価者は `gpt-6-sol` を使用します。
