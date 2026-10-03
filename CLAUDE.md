# Refactor Blocks(リポジトリ名: refactor-blocks)

Claudeはこのリポジトリでの会話・報告・コミットメッセージ以外の説明を、常に日本語で行う。

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

## 実装方針: ponytail(怠け者のシニア開発者)

[ponytail](https://github.com/DietrichGebert/ponytail)(MIT)の考え方を取り込んでいる。怠けるのは「書くコードの量」であって、「理解」ではない。
変更が触るコードを読み、実際の処理の流れを追ってから、次の階段を上から順に確かめ、最初に成り立った段で止まる。

1. そもそも作る必要があるか?(YAGNI。推測で必要そうなものは作らず、一言そう書く)
2. このリポジトリにもうあるか?(`Result`・`lineCount` など既存のヘルパー・型・パターンを再利用する)
3. JavaScript/TypeScriptの標準機能でできるか?
4. ブラウザ・CSS・React Flow/dnd-kitの標準機能でできるか?
5. インストール済みの依存(Zustand・React Flow・dnd-kit)で解決できるか?(新しい依存は極力足さない)
6. 短く書けるか?(ただし `eslint.config.js` のルールと読みやすさが優先。コードゴルフはしない)
7. ここまで来て初めて、動く最小限のコードを書く

- 頼まれていない抽象化・設定・「将来のため」の足場は作らない。追加より削除、賢さより退屈さ、ファイルは最小限。
- バグ修正は症状ではなく原因を直す。触る関数の呼び出し元をすべてgrepし、共通の関数で1回直す。
- 既知の上限がある意図的な手抜き(O(n²)の走査、素朴なヒューリスティックなど)には `// ponytail: <上限>、<いつ・どう直すか>` のコメントを残す。
  一覧は `/ponytail-review debt` で出せる。
- 手を抜かないもの: 問題の理解、信頼境界での入力検証(ステージ定義の読み込み・AI講評APIの応答など)、データ消失を防ぐエラー処理、セキュリティ、アクセシビリティ(キーボード操作を含む)、明示的に頼まれたもの。
- **このリポジトリで明示的に決めているルールはponytailより優先する。** DDDの4層構成・`Result`型・TDD(テストを先に書く)・
  E2Eテスト・lintルールは「頼まれた」ものなので、ponytailを理由に省かない。怠けるのはそれぞれの層の中身の量。
- 報告は「コード → 省いたもの・いつ足すか」を短く。求められていない長い設計説明は書かない。

## 開発ハーネス(仕様設計・実装・評価)

開発の2つの経路(仕様ベースの開発・機能案ブレスト)の全体像は
`docs/DEVELOPMENT.md` の図を参照。新機能を追加するときの進め方を `docs/specs/README.md` にまとめている。仕様設計者・実装者・評価者の
3ロールに分けて進めるためのエージェント定義が `.claude/agents/` にある(Claude Codeを使う場合)。
Claude Code では、仕様からまとめて回したいときは `feature-harness` skill(`.claude/skills/feature-harness/SKILL.md`)を使い、Issue/PRや確定仕様の実装・評価には `/implement` コマンドを使う。
Codex では `$implement` を使う。Codex 用の入口は `.agents/skills/implement/SKILL.md`、エージェント定義は `.codex/agents/` にある。両方とも実装者と評価者を独立したスレッドで動かす。

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
