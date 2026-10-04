# 全ステージの処理(Fragment)とフィールドにC#コードを入れ、「未入力」をなくす

## 背景・目的

メソッドエディタの「コード」タブ(`generateClassSource`)は、`Fragment.code.csharp` が無い処理を
`// 未入力: 割引を適用する` のコメント1行にし、`Field.type.csharp` が無いフィールドを `// 未入力: フィールド ○○` にする。
チュートリアル1(`tutorialStages.ts`)以外の全ステージ(チュートリアル2・初級・中級・上級・白紙設計)は、
コードを1つも持っていないため、「コード」タブがほとんど「未入力」のコメントで埋まる(例: 初級2 `InvoiceService`)。

プレイヤーが「本物のプログラムを分けている」と感じられるよう、全ステージの処理とフィールドに現実的なC#コードを入れる。
あわせて、直前の Issue #94 `code-lines-match` で入る
「コードを持つFragmentの行数は、そのコードの実際の行数から計算する」ルールが全ステージに及ぶので、
行数が変わるぶん、各ステージの `limits` と目標を調整し直す。

## 前提

- **Issue #94 `code-lines-match` を先にマージする**(`fragmentLines`・`METHOD_OVERHEAD_LINES` 3・`CLASS_OVERHEAD_LINES` 3・
  メソッド間の空行の加算が入っている前提)。実装者は #94 がマージされた `master` から着手する
- コード書式は `code-preview-highlight`(Issue #33)の整形方針に従う: インデント4スペース、1つの文に処理を詰めない、
  `foreach` などは `{ }` ブロック、LINQのチェーンは呼び出しごとに改行、長い式は演算子の位置で改行

## 変更対象ファイル一覧

### 変更

- `src/infrastructure/stages/tutorialStages.ts`: チュートリアル2(`orderServiceStage`)の全Fragmentと、`type` を持たないフィールドにコードを入れる
- `src/infrastructure/stages/beginnerStages.ts`: 初級1・2の全Fragment・フィールド
- `src/infrastructure/stages/intermediateStages.ts`: 中級1〜11の全Fragment・フィールド
- `src/infrastructure/stages/advancedStages.ts`: 上級の全ステージの全Fragment・フィールド
- `src/infrastructure/blankDesigns/blankDesignProblems.ts`: 白紙設計の問題のFragmentにコードを入れる
- 上記の各ファイルのステージ定義: `lines` を `code.csharp` の実際の行数に書き換える。`lines` は計算では使われなくなるが
  `Fragment` 型が必須にしているため、嘘の数字を残さない。あわせてステージごとの `limits`・`goal`・`description` を
  下記「ステージの再調整」に従って見直す
- `src/domain/codebase/mergeMethods.ts`(domain): 統合後のFragmentが `code` を引き継ぐようにする。
  現状は `lines: Math.max(...)` で作るため、`code` を持たない統合Fragmentの行数が実コードとずれる。
  引き継ぐ `code` は統合元(`duplicateGroup` が同じ=コードが文字通り同じ)のどちらかと同じ文字列にする
- `src/domain/codebase/mergeMethods.test.ts`(TDD対象): 統合後のFragmentが `code` を持ち、`fragmentLines` が統合元の行数と等しいケースを追加
- `src/infrastructure/stages/stageCatalog.test.ts` ほか、行数の期待値をハードコードしているテスト・E2E:
  新しい行数に合わせて更新する

### 新規

- `src/infrastructure/stages/stageCode.test.ts`: 「未入力が残っていない」ことを守るテスト(下記「TDD対象」の1・2)

## データ・型の変更

型の変更なし(`Fragment.lines` は残す)。

## コードを書くときの守ること

- 各Fragmentのコードは、そのFragmentの `label` と `responsibility` が示す処理を、現実的なC#で実際に書く。
  1つのFragmentはおおむね2〜15行。`validatePayment` のような「60行」と書かれていた処理も、現実的な長さに収める
- メソッドの途中にある処理なので、メソッドの宣言・波括弧は書かない(`generateClassSource` が囲む)
- `duplicateGroup` が同じFragmentは、**コードの文字列も完全に同一**にする(統合できる=文字通り同じ実装、という約束)
- `stub: true` の空実装は、`return;` や `throw new NotSupportedException();` のように、ラベルの通りの空実装を書く
- `accessor: true` の getter/setter 処理は `return _balance;` / `_balance = value;` のように実際の中身を書く
- `reads` / `writes` / `uses` で宣言した参照と、コード中の識別子を一致させる(読んでいるはずのフィールドはコードで読む、
  呼び出しはFragment自身が `{name}();` を持つか、`responsibility` が呼び出し用のものは従来どおり `uses` から生成する)
- 呼び出し用Fragment(`responsibility` が `CALL_RESPONSIBILITY` で `uses` を持つもの)は、コードを書かない(`uses` から
  `name();` が生成され、1行になる)
- フィールドは `type.csharp`(型名のみ。例 `'decimal'` `'List<OrderItem>'`)を全フィールドに入れる。`description` があれば
  コードのコメントとして出る(既存の挙動)
- 実在しない外部APIでも、Stripe/PayPal・DB・メールのコードは、典型的な呼び出し形(`_httpClient.PostAsync(...)` など)を使う。
  ステージの教材としてコードが読めることが目的で、コンパイルできる完全なプログラムにする必要はない(疑似コードでよい)

## ステージの再調整

行数が実コード基準になると、各ステージのメソッド・クラス・ファイルの行数は大きく変わる。次の2点を満たすよう
各ステージの `limits`(`method` `class` `file`)・`goal` の数字・`description` の文中の行数を決め直す。

1. **初期状態の違反の種類は、今と同じ**にする(今、行数制限・責務の混在・結合度・循環依存などで違反しているものは、新しい行数でも違反する。
   行数が減ったせいで最初からクリア済みになるステージを作らない)
2. **各ステージの模範解答(既存のステージごとのテスト、`stageCatalog.test.ts` など)は、そのまま100点に届く**

基準は「実装者が `limits` を決め、既存のテストが通ること」。数字の決め方は実装者に任せる。

## TDD対象の純粋関数

`stageCode.test.ts`(`infrastructure` のデータの検証テスト。ロジックは増えない):

1. 全ステージ・全クラスについて `generateClassSource(codebase, classId, 'csharp')` の出力に `未入力` が含まれない
2. 全ステージで、`code.csharp` を持つFragmentの `lines` が `code.csharp` の行数と等しい(嘘の数字が残っていない)
3. `duplicateGroup` が同じFragment同士は、`code.csharp` が完全に一致する

`mergeMethods` の `code` 引き継ぎは上記のとおりドメインのテストを追加する(AAA)。

## 受け入れ基準

- `npm run check` と `npm run test:e2e` が通る
- チュートリアル2・初級1・2・中級1〜11・上級の全ステージ、および白紙設計の全問題で、任意のクラスの
  「コード」タブに `未入力` の文字が1つも出ない
- 初級2 `InvoiceService` の `issueInvoice` `sumItems` `sendInvoice` などの各メソッドが、ラベルに合った実際のC#コードで表示される
- すべてのステージで、メソッド・クラス・ファイルに表示される行数が、「コード」タブの実際の行数と一致する
  (フィールド宣言の行は #94 と同じくクラスの行数に含めない)
- 各ステージの初期状態で、今まで違反していたものは引き続き違反として表示され、模範解答は100点に届く
- 既存の表示・操作(抽出・移動・統合・白紙設計・変更依頼・採点・講評)が、行数の数字が変わるほかは変わらない

## スコープ外

- TypeScript など他言語のコード(`CodeLanguage` は `'csharp'` のみ)
- コードの編集機能・実行・コンパイルチェック
- フィールド宣言の行数を `classLines` に含めること(#94 と同じ)
- 新しいステージの追加・既存ステージの教材内容(責務タグ・依存関係・課題)の変更
- AI講評(`critiqueRequest`)へのコード本文の追加送信
