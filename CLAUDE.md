# Refactor Blocks(リポジトリ名: refactor-blocks)

メソッド分け・クラス分け・ファイル分けを、Scratchのようなドラッグ&ドロップで練習するリファクタリング学習ゲーム。
対象プレイヤーは新卒〜4年目くらいのエンジニア。

- ファイル・クラス・メソッド・処理のまとまり(Fragment)をブロックとして表示し、それぞれが行数を持つ
- メソッドの中の処理を選んで新しいメソッドとして抽出したり(Extract Method)、メソッドを別クラスへドラッグで移したり(Move Method)して分解・統合する
- 難しいステージでは public / private、継承、依存関係が加わり、最終的に保守しやすい形やデザインパターンへ組み替える
- リファクタリング後に「新機能の追加」課題を出し、何個のブロックを触る必要があったかで設計の良し悪しを実感させる
- 採点はルールベース(行数・責務の混在・結合度・循環依存など)と、AIによる講評の2段構え

## 画面構成(パターンB主役 + パターンAの良いところ)

- メイン: React Flowのキャンバス。ファイルを箱(親ノード)、クラスをその子ノードとして表示し、将来は依存・継承を矢印で描く。
  クラスノードの中のメソッドはdnd-kitでドラッグして別クラスへ直接移せる
- サイドパネル: メソッドエディタ(クリックしたメソッドの中の処理を選んで抽出する)
- 予定: VSCodeのエクスプローラー風ファイルツリー(dnd-kit)、ズーム倍率で表示の細かさを変えるセマンティックズーム

### React Flow と dnd-kit を併用するときの約束

- dnd-kitで掴む要素(メソッドなど)には `nodrag nopan` クラスを付け、React Flowのノードドラッグ・パンに奪われないようにする
- `DragOverlay` は `createPortal` で `document.body` に出す(React Flowのビューポートの `transform: scale()` でずれるため)
- `PointerSensor` には `activationConstraint: { distance: 5 }` を付け、クリック(選択)とドラッグを区別する
- ドラッグ&ドロップの操作は壊れやすいので、PlaywrightのE2Eテスト(`e2e/`)で必ず守る

## 技術スタック

- Vite + React + TypeScript
- 状態管理: Zustand
- キャンバス: `@xyflow/react`(React Flow)
- ドラッグ&ドロップ: `@dnd-kit/core`
- テスト: Vitest(`*.test.ts`)、E2E: Playwright(`e2e/*.spec.ts`)
- Lint: ESLint(`eslint.config.js`)

## アーキテクチャ(DDD)

`src/` を4層に分割する。依存の向きは `presentation → application → domain`、`infrastructure` は `application` が定義したインターフェースを実装する形で参照される。

- `src/domain/` — フレームワーク非依存の純粋なドメインモデル。コードベース(ファイル/クラス/メソッド/処理)、リファクタリング操作、採点ルール
- `src/application/` — ユースケース層。`domain` を呼び出して1つの操作(抽出・移動・採点)を組み立てる。ID採番などの副作用は注入する
- `src/infrastructure/` — ステージ定義の読み込み、保存、AI講評APIのクライアントなど
- `src/presentation/` — Reactコンポーネント・React Flowのカスタムノード・Zustandストア

リファクタリング操作(`domain/codebase/`)は必ず**元のCodebaseを変更せず新しいCodebaseを返す**純粋関数にし、失敗は例外ではなく `Result` 型(`domain/shared/Result.ts`)で返す。
行数は Fragment の `lines` の合計から計算で出す(`domain/codebase/lineCount.ts`)。行数をデータとして重複して持たない。

各層の詳細は各ディレクトリの `README.md` を参照。

## 開発の進め方: TDD

新しいロジック(`domain`/`application`層)は**必ずテストを先に書いてから実装する**(Red→Green→Refactor)。
テストは `// Arrange` `// Act` `// Assert` を明示するAAAパターンで、Vitestを使う。表示のみのコンポーネント
やI/Oを含む副作用コード(`infrastructure`層)はユニットテスト対象外としてよい。
ただし、ドラッグ&ドロップ・抽出などプレイヤーの操作に関わる変更は、PlaywrightのE2Eテストを追加・更新する。
カバレッジは `domain`/`application` 層に閾値をかけている(`vite.config.ts`)。

## 開発ハーネス(仕様設計・実装・評価)

新機能を追加するときの進め方を `docs/specs/README.md` にまとめている。仕様設計者・実装者・評価者の
3ロールに分けて進めるためのサブエージェント定義が `.claude/agents/` にある(Claude Codeを使う場合)。
まとめて回したいときは `feature-harness` skill(`.claude/skills/feature-harness/SKILL.md`)を使う。

## 自動開発(auto-dev)

`docs/auto-dev/TASKS.md` にタスクを追記しておくと、`.github/workflows/auto-dev.yml` が
未完了タスク(`### [ ]`)を上から順に実装・`npm run check`・コミット・pushし、`docs/auto-dev/IMPLEMENTATION_LOG.md`
に記録する。定期実行(schedule)は、リポジトリのSecretsに `CLAUDE_CODE_OAUTH_TOKEN` を登録してから
ワークフロー内のコメントを外して有効にする(それまでは手動実行 `workflow_dispatch` のみ)。
`npm run check` を通せなかったタスクは `### [!]`(保留)に書き換えられIssueが作られる。
対話セッションで同じ流れを手動起動したいときは `/auto-dev` コマンド(`.claude/commands/auto-dev.md`)を使う。

## Lint

`eslint.config.js` で以下を強制している(logic-tree-studio と同じ設定)。

- 循環的複雑度: 12以下
- ネストの深さ: 4段まで
- 1関数あたりの行数: 60行まで(空行・コメント除く、テストファイルは対象外)
- 引数の数: 4つまで、コールバックのネスト: 3段まで
- 命名規則(`src/**/*.ts(x)`): 変数・関数はcamelCase(Reactコンポーネントを除く)、型/interfaceはPascalCase
- 型チェック付きlint(`tseslint.configs.recommendedTypeChecked`)と `eslint-plugin-sonarjs`(`recommended`)を有効化
- 非nullアサーション(`!`)禁止、型キャスト(`as`)禁止(`consistent-type-assertions: 'never'`)
- `enum` 禁止。代わりにUnion type(`"A" | "B"`)を使う(`no-restricted-syntax`)
- 常にtrue/falseになる条件・不要な `?.` / `??` を禁止(`no-unnecessary-condition`)
- `tsconfig.app.json`/`tsconfig.node.json` は `strict: true`(暗黙の`any`禁止)

## コマンド

```bash
npm run dev          # 開発サーバー
npm run lint         # ESLint
npm run typecheck    # tsc -b
npm test             # Vitest
npm run test:e2e     # Playwright(初回は npx playwright install chromium)
npm run check        # lint + typecheck + test をまとめて実行
npm run build        # 本番ビルド
```
