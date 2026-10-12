# visibility-and-limit-notes: 可視性の説明をやさしくし、特別な上限にはその理由を添える

## 背景・目的

中級3(`intermediate-misplaced-private`、越境する private メソッド)を遊んで、分かりにくい表示が2つあった。

### 1. 可視性の説明が専門的

メソッドエディタの可視性のセレクトの下に、次の説明が出る。

> 可視性を広げるには呼び出し元が必要です。ステージ開始時の可視性にはいつでも戻せます。親の抽象宣言を実装する場合も public / protected を選べます

- public / protected / private がそれぞれ何を意味するかが書かれていない
- 「抽象宣言」を実装していないメソッドにも、その話が出る
- protected が選べない(無効になっている)理由が分からない

### 2. 「結合度: 依存先は0クラスまで」の理由が分からない

中級3のクリア条件に `結合度: 依存先は0クラスまで` と出る。
このステージは、`private` を `public` にして逃げるのではなく、処理を持ち主のクラスへ移してほしいので、依存の上限を0にしている(`dependencyLimit: 0`)。
しかし画面にはその理由が無く、「クラスを呼んではいけない?」と戸惑う。

## 変更対象ファイル一覧

| 種別 | パス | 層 | 役割 |
| --- | --- | --- | --- |
| 変更 | `src/domain/stage/Stage.ts` | domain | クリア条件に添える理由の文 `conditionNotes` を足す |
| 変更 | `src/infrastructure/stages/intermediateStages.ts` | infrastructure | 中級3と、依存の上限が0のほかのステージに理由の文を書く |
| 変更 | `src/infrastructure/stages/stageCatalog.test.ts` | infrastructure | 依存の上限が0のステージに理由の文があることを確かめる |
| 変更 | `src/presentation/stage/ClearConditionList.tsx` | presentation | 条件の下に理由の文を出す |
| 新規 | `src/presentation/editor/describeVisibility.ts` | presentation | 可視性の説明の文を組み立てる純粋関数 |
| 新規 | `src/presentation/editor/describeVisibility.test.ts` | presentation | 上のテスト |
| 変更 | `src/presentation/editor/MethodEditor.tsx` | presentation | 可視性の説明を `describeVisibility` で出す |
| 変更 | 可視性の説明を確かめている既存の E2E | E2E | 新しい文言に合わせる |

## データ・型の変更

```ts
// src/domain/stage/Stage.ts
export type Stage = {
  // 既存のフィールドに加えて
  /** クリア条件に添える、そのステージで上限を特別にしている理由。ルールごとに1文。 */
  readonly conditionNotes?: Readonly<Partial<Record<ScoreRule, string>>>;
};
```

## 見た目・動きの仕様

### クリア条件の理由の文

- `stage.conditionNotes[rule]` があれば、その条件の行の下に小さく `理由: <文>` を出す(達成・未達成どちらでも)
- 中級3の `coupling` の文: `private を public にして呼べるようにするのではなく、処理を使う側のクラスへ移して、ほかのクラスを呼ばずに済む形を目指すため`
- 依存の上限が0の、ほかのステージにも同じように理由を書く

### 可視性の説明(`describeVisibility`)

`describeVisibility(input: { current: Visibility; disabled: readonly Visibility[]; implementsAbstract: boolean }): readonly string[]` を作り、1要素を1行として出す。

1. いつも: `public: どのクラスからも呼べる / protected: このクラスと子クラスから呼べる / private: このクラスの中だけで呼べる`
2. 選べない可視性があるとき: `<protected など> が選べないのは、そこまで広げて呼んでいるクラスが無いからです(必要のない公開を避けるため)`
3. いつも: `ステージを始めたときの可視性には、いつでも戻せます`
4. `implementsAbstract` が `true` のときだけ: `親クラスの抽象メソッドを実装しているので、public / protected も選べます`

## TDD対象の純粋関数

### `describeVisibility`(`presentation/editor/describeVisibility.ts`)

- 選べないものなし・抽象の実装でない → 1・3行目だけ
- protected が選べない → 2行目に `protected が選べないのは…`
- 抽象の実装 → 4行目が出る

### ステージカタログ(`stageCatalog.test.ts`)

- `dependencyLimit === 0` のリファクタリングのステージには、`conditionNotes.coupling` がある

## 受け入れ基準

1. 中級3のクリア条件「結合度: 依存先は0クラスまで」の下に、理由の文が出る
2. 中級3で `renderTemplate()` を選ぶと、可視性の説明に public / protected / private の意味が出て、protected が選べない理由が書かれている
3. 抽象メソッドを実装していないメソッドには、抽象の話が出ない
4. `npm run check` と `npm run test:e2e` が通る

## スコープ外

- 可視性の採点・変更の条件(`checkWidening`)の変更
- フィールドの可視性
- 依存の上限が0以外のステージの理由の文(必要になったら足す)
