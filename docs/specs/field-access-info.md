# field-access-info: フィールドの説明に、どのクラスから読み書きされているかと直し方を出す

## 背景・目的

中級6(`intermediate-feature-envy`)の減点には「カプセル化の破れ -20」がある。「なぜ?」を開くと次のように説明される。

> データを外から自由に書き換えられると、マイナスの残高のような不正な状態が作れ、どこで壊れたのか追えなくなります

ところが、キャンバスでフィールド(例: `Subscription.status`)をクリックしたときの説明は、次のような形である。

```
このフィールドを使うメソッド
renewSubscription — 読む
cancelSubscription — 読み書き
```

これでは、次のことが分からない。

- それぞれのメソッドが**どのクラスにあるか**、つまり持ち主の外からの読み書きなのか
- 何をすれば直るのか。フィールドの可視性を変える操作は無く、直し方は「書き換える処理を持ち主のクラスへ移す」である

## 変更対象ファイル一覧

| 種別 | パス | 層 | 役割 |
| --- | --- | --- | --- |
| 新規 | `src/domain/codebase/fieldAccessors.ts` | domain | フィールドを使うメソッドを、クラス・読み書き・外からかどうかつきで返す純粋関数 |
| 新規 | `src/domain/codebase/fieldAccessors.test.ts` | domain | 上のテスト |
| 変更 | フィールドの説明を出すコンポーネント(`MethodEditor.tsx` の `FieldInfo`) | presentation | 使うメソッドをクラス名つきで出し、外からの書き換えを強調し、直し方を添える |
| 変更 | `src/index.css` | presentation | 外からの読み書きの強調 |
| 変更 | フィールドの説明を確かめている既存の E2E | E2E | 新しい文言に合わせる |
| 新規 | `e2e/field-access-info.spec.ts` | E2E | 下の受け入れ基準を確かめる |

`application` / `infrastructure` は変更しない。

## データ・型の変更

```ts
// src/domain/codebase/fieldAccessors.ts
export type FieldAccessor = {
  readonly methodId: string;
  readonly methodName: string;
  readonly className: string;
  readonly access: 'read' | 'write' | 'read-write';
  /** メソッドのクラスが、フィールドの持ち主のクラスと違う。 */
  readonly outside: boolean;
};

/** フィールドを読み書きするメソッドを、コードの出現順で返す。読み書きの判定は今の FieldInfo と同じ(Fragment の読む・書くの記録)。 */
export function fieldAccessors(codebase: Codebase, fieldId: string): readonly FieldAccessor[];
```

## 見た目・動きの仕様

- 「このフィールドを使うメソッド」の各行を `<クラス名>.<メソッド名>() — 読む / 書く / 読み書き` にする
- 持ち主の外からの行には `外から` のラベルを付ける。書く・読み書きなら `var(--danger)`、読むだけなら `var(--warning)` 相当の色にする(色だけに頼らず、ラベルの文字も付ける)
- 外から書き換えているメソッドが1つ以上あるとき、一覧の下に直し方を出す(`data-testid="field-fix-hint"`)
  - `<クラス名>.<メソッド名>() が、<持ち主> の外からこのデータを書き換えています。書き換える処理を <持ち主> へ移すと、カプセル化の破れが直ります`
  - 複数あれば、メソッド名を `・` でつなぐ
- 外から読むだけのメソッドがあるとき(書き換えは無い)、直し方として次を出す
  - `<クラス名>.<メソッド名>() が <持ち主> のデータを読んでいます。読む処理が多いなら、<持ち主> へ移すことを考えてみよう`

## TDD対象の純粋関数

### `fieldAccessors`(`domain/codebase/fieldAccessors.ts`)

- 持ち主のクラスのメソッドだけが読む → 1件、`outside: false`、`access: 'read'`
- 別のクラスのメソッドが読み書き → `outside: true`、`access: 'read-write'`
- 誰も使わない → 空
- 同じメソッドの複数の処理が読む・書く → 1件にまとめて `read-write`

## 受け入れ基準

1. 中級6で `Subscription.status` をクリックすると、`BillingService.cancelSubscription() — 読み書き` に `外から` のラベルが付き、強調されている
2. 一覧の下に、`BillingService.cancelSubscription() が、Subscription の外からこのデータを書き換えています。…Subscription へ移すと…` の直し方が出る
3. `cancelSubscription()` の書き換えの処理を `Subscription` へ移すと、`cancelSubscription()` の行から `外から` のラベルと書き換えの強調が消え、書き換えの直し方も消える。
   外から読むだけのメソッドが残る場合(中級6では `BillingService.renewSubscription()`)は、その行の `外から`(読むだけの色)と、読む処理の直し方(`… が Subscription のデータを読んでいます。…`)に変わる(「見た目・動きの仕様」のとおり)
4. 持ち主の中だけで使われるフィールドには、`外から` も直し方も出ない
5. `npm run check` と `npm run test:e2e` が通る

## スコープ外

- フィールドの可視性を変える操作
- キャンバスのフィールドの箱(`FieldChip`)への印の追加
- Feature Envy の採点の変更
