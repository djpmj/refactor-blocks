# method-chip-accessible-name: メソッドのボタンの読み上げ名に、可視性・選択中・警告を言葉で入れる

## 背景・目的

2026-10-17 にキャンバスのメソッドのボタン(`MethodChip`、`data-testid="method-<名前>"`)の読み上げ名を調べると、
見えている文字をそのまま連結した `+ getBalance() 7行` だった(`aria-label` なし)。

- 可視性が記号(`+` / `-` / `#`)のまま読まれ、「プラス」「マイナス」では public / private と分からない
- クリックして選んだメソッド(右のエディタで開いているもの)かどうかが伝わらない(見た目は枠の色だけ)
- 行数の上限を超えている(赤枠)・処理が混在している、などの警告が色だけで、読み上げでは分からない

キーボード・スクリーンリーダーでも遊べることは ponytail の「手を抜かないもの」に入っている。

## 変更対象ファイル一覧

| 種別 | パス | 層 | 役割 |
| --- | --- | --- | --- |
| 新規 | `src/presentation/canvas/methodChipLabel.ts` | presentation | 読み上げ名を作る純粋関数 |
| 新規 | `src/presentation/canvas/methodChipLabel.test.ts` | presentation | 上のテスト |
| 変更 | `src/presentation/canvas/MethodChip.tsx` | presentation | ボタンに `aria-label` と `aria-pressed`(選択中)を付ける。記号の `+`/`-` は `aria-hidden` にする |
| 変更 | フィールドのチップ(`FieldChip` 相当) | presentation | 同じ規則で可視性を言葉にする |
| 新規 | `e2e/method-chip-accessible-name.spec.ts` | E2E | 下の受け入れ基準を確かめる |

`domain` は変更しない。

## データ・型の変更

なし。

## 読み上げ名の規則

`<名前>()、<可視性>、<行数>行[、<警告>…][、「直した」印あり]`

- 可視性: `public` → `public`、`private` → `private`、`protected` → `protected`(英語のまま。画面の他の場所の用語と合わせる)
- 警告(当てはまるものだけ、この順):
  - 行数の上限を超えている → `行数の上限 <上限>行を超えています`
  - 処理の責務が混ざっている(`mixed-method` の対象) → `別々の仕事が混ざっています`
- 手直し中に「直した」印が付いている → `「直した」印あり`
- 選択中かどうかは名前に入れず、`aria-pressed="true"` で伝える
- `title`(マウスの説明)は今のまま

## TDD対象の純粋関数

### `methodChipLabel(input)`(`presentation/canvas/methodChipLabel.ts`)

入力: `{ name, visibility, lines, lineLimit?: number, overLimit: boolean, mixed: boolean, fixed: boolean }`

- public・7行・警告なし → `getBalance()、public、7行`
- private・23行・上限20行超え → `checkout()、private、23行、行数の上限 20行を超えています`
- 混在と「直した」印あり → `…、別々の仕事が混ざっています、「直した」印あり`

## 受け入れ基準

1. 中級2の `getBalance()` のボタンの読み上げ名(アクセシブルネーム)が `getBalance()、public、7行` で、`+` を含まない
2. `calculateShippingFee()` は `private` を含む
3. メソッドをクリックして選ぶと、そのボタンが `aria-pressed="true"` になり、ほかのメソッドは `false`
4. チュートリアル1の `printMonthlyReport()` の読み上げ名に `行数の上限 28行を超えています` が含まれる
5. `npm run check` と `npm run test:e2e` が通る(`getByRole('button', { name: … })` で探している既存の E2E は新しい名前に合わせる)

## スコープ外

- ドラッグ中の読み上げ(`dnd-announcements-ja` で扱う)
- クラス・ファイルの箱の読み上げ名
