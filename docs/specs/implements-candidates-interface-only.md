# implements-candidates-interface-only: 「実装するインターフェースを設定」の候補をインターフェース役のクラスに絞る

## 背景・目的

2026-10-17 に上級2「決済ゲートウェイをインターフェース越しに呼ぶ」で `StripeGateway` を右クリックし、「実装するインターフェースを設定」を開くと、
候補に `PaymentService`・`PaypalGateway`・`PaymentGateway` の3つが並んだ。インターフェースは `PaymentGateway` だけで、
**`PaymentService`(決済の流れを持つ具象クラス)や `PaypalGateway`(兄弟の実装クラス)まで「実装するインターフェース」として選べる**。

- 「implements の相手はインターフェース(約束だけを持つ型)」という基本が、操作から学べない
- 間違って具象クラスを選んでも、その場では理由が分からない

インターフェース役の判定は `isInterfaceLike`(メソッドが1つ以上あり、すべて public で中身が無い)として、採点ですでに使っている。
(継承元のメニューからインターフェース役を除く件は `extends-interface-loophole` でスコープ外にしたもの。今回は実装先の側だけを扱う。)

## 変更対象ファイル一覧

| 種別 | パス | 層 | 役割 |
| --- | --- | --- | --- |
| 変更 | `src/domain/codebase/setSuperclass.ts` | domain | 実装先の候補を返す `availableInterfaces(codebase, classId)` を足す(`availableParents` のうち `isInterfaceLike` のもの) |
| 変更 | `src/domain/codebase/setSuperclass.test.ts` | domain | 上のテスト |
| 変更 | `src/domain/codebase/setSuperclass.ts`(`addInterface`) | domain | インターフェース役でないクラスを実装先にしようとしたら `Result` のエラー `'not-interface'` を返す |
| 変更 | `src/presentation/canvas/CanvasContextMenu.tsx` | presentation | 「実装するインターフェースを設定」の候補を `availableInterfaces` にする。候補が無いときは説明の項目を出す |
| 変更 | エラーの文言の表(`describe` 相当) | presentation | `'not-interface'` の文を足す |
| 変更 | `e2e/` の継承・実装のメニューの E2E | E2E | 下の受け入れ基準を確かめる |

## データ・型の変更

- `AddInterfaceError` に `'not-interface'` を足す
- 模範解答の手順(`addInterface`)で、インターフェース役でないクラスを指定しているステージがあれば、テストで見つけて直す(今のところ無い想定。あればステージのデータ側を直す)

## 表示の仕様

- 候補はインターフェース役のクラスだけ。すでに実装しているものはチェック付きで今どおり出す(外せる)
- インターフェース役のクラスが1つも無いとき: 押せない項目 `インターフェース役のクラスがありません(中身の無い public メソッドだけのクラス)` を1つ出す
- `'not-interface'` の文: `<名前> はインターフェースではありません。中身の無い public メソッドだけを持つクラスを選んでください`

## TDD対象の純粋関数

### `availableInterfaces`(`domain/codebase/setSuperclass.ts`)

- 上級2の初期コード、`StripeGateway` について → `[PaymentGateway]` だけ
- 自分自身・自分の子孫は含まない(`availableParents` と同じ)
- メソッドの無い空のクラスは含まない

### `addInterface`

- 具象クラスを指定 → `err('not-interface')`、元のコードは変わらない
- インターフェース役を指定 → 今どおり成功

## 受け入れ基準

1. 上級2で `StripeGateway` を右クリック →「実装するインターフェースを設定」の候補が `PaymentGateway` だけになる
2. インターフェース役のクラスが無いステージ(例: 中級1)で同じメニューを開くと、押せない説明の項目が出る
3. 全ステージの解答例の点数(`npm run stage-report`)が変わらない
4. `npm run check` と `npm run test:e2e` が通る

## スコープ外

- 継承元のメニューからインターフェース役を除くこと
- インターフェースを新しく作る操作の追加
