# unused-public-member-notes: 外から使われていない public のフィールド・getter・setter を、100点のあとに知らせる

## 背景・目的

2026-10-17 に中級6・中級7を100点まで遊んで、**100点になっても、隠すべきものが公開されたまま**だと気付いた。

- 中級6「他人のデータばかり触るメソッド」: 計算を `Subscription` へ移したあと、`Subscription` の `status`・`startedAt`・`seats`・`unitPrice`・`canceledAt` は
  どこからも外から触られなくなったが、`+`(public)のまま。解答例の図でも public のまま
- 中級7「getter/setter だけの口座クラス」: ルールを `Account` へ移して100点になっても、`getBalance()`・`getStatus()`・`getDailyWithdrawn()` が public のまま残る。
  外からは誰も呼んでいない。題名が「getter/setter だけの口座クラス」なのに、100点の形にも getter が並んでいる

カプセル化の採点(`encapsulation`)は「外から触っている」ことを数えるので、触る側を無くせば減点は消える。それ自体は正しいが、
**「使われていない公開を閉じる」という仕上げ**を学ぶ機会が無い。減点にすると今のステージの点数が大きく変わるので、まずは知らせる。

## 変更対象ファイル一覧

| 種別 | パス | 層 | 役割 |
| --- | --- | --- | --- |
| 新規 | `src/domain/scoring/unusedPublicMembers.ts` | domain | 外(持ち主のクラスと子孫以外)から使われていない public のフィールド・メソッドを列挙する |
| 新規 | `src/domain/scoring/unusedPublicMembers.test.ts` | domain | 上のテスト |
| 新規 | `src/presentation/stage/UnusedPublicNote.tsx` | presentation | 100点のあとに出すお知らせのカード |
| 変更 | `src/presentation/stage/StagePanel.tsx` | presentation | 100点のとき、理解度チェックの上にカードを置く |
| 新規 | `e2e/unused-public-member-notes.spec.ts` | E2E | 下の受け入れ基準を確かめる |

## データ・型の変更

```ts
export type UnusedPublicMember = { readonly kind: 'field' | 'method'; readonly id: string; readonly classId: string };
export function findUnusedPublicMembers(codebase: Codebase, options: { readonly entryPointIds: readonly string[] }): UnusedPublicMember[];
```

- 対象: `public` のフィールドとメソッドのうち、**持ち主のクラスとその子孫以外のどこからも**読まれていない・書かれていない・呼ばれていないもの
- 除外:
  - 入口のメソッド(外の世界から呼ばれる前提のもの)。ステージの初期コードで、どのクラスからも呼ばれていない public メソッドを入口とみなし、`entryPointIds` として渡す(例: `withdraw()`・`renewSubscription()`)
  - インターフェース役・抽象クラス役のクラスのメソッド(`isInterfaceLike` / `isAbstractLike`)と、それを実装・上書きしているメソッド
  - 変更依頼の部品置き場

## 表示の仕様

- 100点のときだけ、左パネルに「仕上げのヒント」カード(`data-testid="unused-public-note"`)を出す。点数は変えない
- 文: `外から使われていない公開メンバーがあります。隠せるものは隠すと、あとで中身を変えても外に影響しません`
- 一覧: `Subscription.status(フィールド)`、`Account.getBalance()` のように出す。名前を押すとキャンバスで選ぶ
- 可視性を変えられるステージ(`visibilityEnforced`)では `メソッドエディタの「可視性」で private にできます` を添える。変えられないステージでは添えない
- 対象が無いときはカードを出さない

## TDD対象の純粋関数

### `findUnusedPublicMembers`(`domain/scoring/unusedPublicMembers.ts`)

- 別クラスから読まれている public フィールド → 対象外
- どこからも触られていない public フィールド → 対象
- 同じクラスの中からだけ呼ばれる public メソッド → 対象
- 子クラスからだけ呼ばれる public メソッド → 対象
- `entryPointIds` に含まれるメソッド → 対象外
- インターフェース役のクラスのメソッド → 対象外

## 受け入れ基準

1. 中級7を解答例どおりに100点にすると、仕上げのヒントに `Account.getBalance()`・`Account.getStatus()`・`Account.getDailyWithdrawn()` が出る(外から呼ばれていないもの)
2. 中級6を解答例どおりに100点にすると、`Subscription` の外から使われていないフィールドが出る
3. 100点になる前は出ない。点数は今と同じ
4. `npm run check` と `npm run test:e2e` が通る

## スコープ外

- 使われていない public を減点にすること
- フィールドの可視性をプレイヤーが変えられるようにすること(今の可視性の操作の範囲のまま)
