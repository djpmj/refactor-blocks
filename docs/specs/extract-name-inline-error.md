# extract-name-inline-error: 抽出するメソッド名が重複しているとき、押す前に入力欄のそばで伝える

## 背景・目的

メソッドエディタで処理を選ぶと、新しいメソッドの名前が自動で入る(入力して変えることもできる)。
実機でチュートリアル1の `printMonthlyReport()` から「表のヘッダーを組み立てる」を選び、名前を既存の `aggregateSales` に書き換えると:

- 入力した瞬間に、これまで出ていた `抽出すると: …` のプレビューが**説明なしに消える**
- 「メソッドとして抽出」ボタンは押せる状態のまま
- 押して初めて、キャンバスの下端に「同じクラスに同じ名前のメソッドがあります」とトーストが出る。入力欄から離れた場所で、×を押すまで残る

重複は、押す前にその場で分かるのが自然。`extractDisabledReason(selected.size, newName)` がすでに「選択なし」「名前が空」でボタンを押せなくして、ボタンの下に理由を出している。そこに「重複」も加える。

## 変更対象ファイル一覧

| 種別 | パス | 層 | 役割 |
| --- | --- | --- | --- |
| 変更 | `src/presentation/editor/MethodEditor.tsx` | presentation | `extractDisabledReason` に、同じクラスの既存のメソッド名との重複を加える(引数に既存の名前の一覧) |
| 変更 | `src/presentation/editor/` の `extractDisabledReason` の単体テスト(なければ新規で `extractDisabledReason.test.ts` に切り出す) | presentation | 上のテスト |
| 新規 | `e2e/extract-name-inline-error.spec.ts` | E2E | 受け入れ基準を確かめる |

`domain`(`extractMethod` の `duplicate-method-name` の検証)は今のまま残す(最後の砦)。`application` は変更しない。

## データ・型の変更

```ts
// 今: extractDisabledReason(selectedCount: number, name: string): string | null
// 新: 既存の名前の一覧を足す(引数は4つ以内)
export function extractDisabledReason(selectedCount: number, name: string, existingNames: readonly string[]): string | null;
```

- `existingNames` は、抽出元メソッドのクラス(`owner`)の全メソッドの名前。**抽出元のメソッド自身の名前も含む**(`extractMethod` の検証は、同じクラスの全メソッドと比べるため)
- 名前は `trim()` してから比べる(`extractMethod` と同じ)

## 動きの仕様

- 重複しているとき:
  - 「メソッドとして抽出」ボタンは押せない
  - ボタンの下の説明文に `同じクラスに「<名前>」というメソッドがあります。別の名前にしてください` と出す(今の `処理を1つ以上選ぶと押せます` と同じ場所・同じスタイル)
  - 名前の入力欄は `aria-invalid="true"`、説明文と `aria-describedby` でつなぐ
  - 抽出のプレビュー(`抽出すると: …`)は、重複しているときは出さない代わりに上の説明文が出る(プレビューが黙って消えない)
- 入力が空のときの文は今のまま
- 重複と「選択なし」が両方ならば、「選択なし」の文を優先する(今の優先順を保つ)
- 自動で付けた名前が重複することはない(`suggestMethodName` は既存の名前を避ける。今のまま)

## TDD対象

### `extractDisabledReason`

- 選択なし → 今の文
- 名前が空 → 今の文
- 名前が既存の名前と同じ → `同じクラスに「aggregateSales」というメソッドがあります。別の名前にしてください`
- 名前の前後に空白があっても、trim して重複と判定する
- 重複していない名前 → `null`
- 選択なし かつ 重複 → 選択なしの文

## 受け入れ基準

1. チュートリアル1で、処理を選び、名前を既存の `aggregateSales` に書き換えると、押す前にボタンが押せなくなり、入力欄の下に重複の説明が出る。別の名前に直すとボタンが押せて、プレビューが戻る
2. 抽出元のメソッド自身の名前(`printMonthlyReport`)にしても、同じ説明が出る
3. 入力欄に `aria-invalid` が付き、説明文と関連づく
4. 既存の抽出の E2E が通る
5. `npm run check` と `npm run test:e2e` が通る

## スコープ外

- 名前の書式の検証(空白を含む・数字で始まる、など。必要だと実機で分かったら別の仕様にする)
- 他のクラスにある同名のメソッドとの重複(今の `extractMethod` も同じクラスだけを見る)
- 失敗トースト(`message`)の出し方の変更
