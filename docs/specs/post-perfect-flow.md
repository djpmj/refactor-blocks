# post-perfect-flow: 同じ変更を「組み替える前」と「後」に手で直させ、変更依頼へ順番どおりに進める

> 改訂(2026-10-12): 初版は「100点のあとに手で直す問題を解く」だけだった。設計の良さを因果として体験させるため、
> **同じ変更をステージの冒頭(組み替える前)にも手で直させ、前後で比べる**流れに改めた。

## 背景・目的

設計の妙味は、「動くコードを、未来の変更に強いコードに組み替える」ことにある。
「この設計にしておいたおかげで、後から来た変更を一撃で入れられた」という因果がつながったときに、深い納得が生まれる。
その因果は、**同じ変更を組み替える前と後の2回体験して、比べたとき**にしか実感できない。

今のゲームの問題は次の3つ。

- 「もし、この変更が来たら?」の手で直すシミュレーション(`ManualFixPanel`)は100点前に出るが、任意である。
  しかも直す場所が2か所以上のときしか出ないので、組み替える前の痛みを体験しないまま組み替えを始められる
- 100点を取ると、カード・理解度チェック・「変更依頼に挑戦」が同時に使えるようになり、順番が無い
- 変更依頼をすべて終えると、結果画面に切り替わった瞬間にキャンバスが挑戦前のコードへ戻る(`finishImplementation` が `session.base` に戻している)。
  そのため「置いたメソッドがどこかに消えた」ように見える

そこで、ステージの流れを次の順番に固定する(modify の変更依頼があるステージ)。

1. **冒頭の手直し**: 組み替える前のコードで、変更依頼を手で直す(印を付けてリリースする)。直し忘れてよい。痛みを体験するのが目的。終えるまで組み替えの操作はできない
2. **組み替え**: 100点を目指す(今のゲーム本体)
3. **仕上げの手直し**: 組み替えたあとのコードで、**同じ**変更を手で直す。正解(直し忘れも関係ない印も無い)するまで先へ進めない。正解したら、冒頭の自分と比べた結果を1行で出す
4. **変更依頼に挑戦**: 3を正解したら押せる

あわせて、変更依頼の結果画面では、最後に置いたコードをキャンバスに残す。

前後の比べ方を作り込んだ「答え合わせ画面」は別の仕様で扱う(スコープ外を参照)。ここでは、その材料になる冒頭の結果をストアに持つところまでを行う。

## 変更対象ファイル一覧

| 種別 | パス | 層 | 役割 |
| --- | --- | --- | --- |
| 新規 | `src/domain/change/stageStep.ts` | domain | ステージの中で今どの段階にいるかを返す純粋関数 |
| 新規 | `src/domain/change/stageStep.test.ts` | domain | 上のテスト |
| 変更 | `src/domain/change/checkManualFix.ts` | domain | `isManualFixSolved(result)` を足す |
| 変更 | `src/domain/change/checkManualFix.test.ts` | domain | `isManualFixSolved` のテストを足す |
| 変更 | `src/presentation/store/useGameStore.ts` | presentation | 冒頭の手直しの結果(ステージごと)・仕上げの手直しの正解を持つ。冒頭の手直しを終えるまで組み替えの操作を止める。結果画面で置いたコードを残す |
| 変更 | `src/presentation/store/useGameStore.test.ts` | presentation | ストアの振る舞いのテスト |
| 変更 | `src/presentation/stage/ChangePainCard.tsx` | presentation | 段階ごとに見出し・本文・「実際に直してみる」の出し方を変える |
| 変更 | `src/presentation/stage/ManualFixPanel.tsx` | presentation | 冒頭と仕上げで文言を変える。仕上げで正解したら冒頭との比較を1行出す |
| 変更 | `src/presentation/stage/StagePanel.tsx` | presentation | 「変更依頼に挑戦」を段階で有効・無効にする |
| 変更 | `src/presentation/tour/tourSteps.ts` | presentation | ツアーの最初に「まず手で直してみよう」の手順を足す |
| 変更 | `src/presentation/tour/tourSteps.test.ts` | presentation | 新しい進め方(`manual-fix-released`)のテスト |
| 変更 | `src/presentation/tour/SpotlightTour.tsx` | presentation | 手直しのリリースをツアーのイベントとして渡す |
| 変更 | `e2e/selectStage.ts` | E2E | 冒頭の手直しを済ませる共通ヘルパーを足す |
| 変更 | 組み替え操作や `change-request-start` を使う既存の E2E | E2E | 先に冒頭の手直し(と、必要なら仕上げの手直し)を済ませるように直す |
| 新規 | `e2e/stage-flow.spec.ts` | E2E | 冒頭 → 組み替え → 仕上げ → 変更依頼の流れを確かめる |

`application` / `infrastructure` は変更しない。

## データ・型の変更

### domain

```ts
// src/domain/change/checkManualFix.ts
/** 直し忘れも、関係ないメソッドへの印も無ければ正解。(印を全部に付ければ通る、を防ぐため extra も見る) */
export function isManualFixSolved(result: ManualFixResult): boolean;
// result.missed.length === 0 && result.extra.length === 0

// src/domain/change/stageStep.ts
export type StageStep =
  | 'opening-fix'     // 冒頭の手直しをする段階(組み替えはまだできない)
  | 'refactor'        // 組み替えて100点を目指す段階
  | 'closing-fix'     // 100点。組み替えたあとのコードで、同じ変更を手で直す段階
  | 'change-request'; // 変更依頼に挑戦できる段階

export function stageStep(input: Readonly<{
  /** 今のコードの点数。 */
  score: number;
  /** ステージに modify の変更依頼があるか(painRequestsOf(stage).modify !== undefined)。 */
  hasModifyRequest: boolean;
  /** このステージで冒頭の手直しを終えたか(リリースしたか。正解かどうかは問わない)。 */
  openingDone: boolean;
  /** このステージで仕上げの手直しを正解したか。 */
  closingSolved: boolean;
}>): StageStep;
```

判定の順:

1. modify の依頼が無い → 100点未満なら `'refactor'`、100点なら `'change-request'`(手直しは両方とも飛ばす)
2. 冒頭の手直しを終えていない → `'opening-fix'`(点数に関係なく)
3. 100点未満 → `'refactor'`
4. 仕上げの手直しを正解していない → `'closing-fix'`
5. それ以外 → `'change-request'`

### presentation(ストア)

```ts
/** 冒頭の手直しの結果。比べるためにプレイヤーの結果だけを持つ(直す場所の数・読む行数は初期コードから計算し直せる)。 */
type OpeningFix = { readonly missed: number; readonly extra: number; readonly sites: number };

// GameState に足す
openingFixes: Readonly<Partial<Record<string, OpeningFix | null>>>; // ステージID → 冒頭の結果。null は「終えた扱いだが結果は無い」
closingFixSolved: boolean;
```

- **冒頭の手直し**
  - 段階が `'opening-fix'` のとき、`releaseManualFix` で `checkManualFix(codebase, modify, fixedIds)` を数え、`openingFixes[stage.id]` に入れる。
    正解・不正解は問わない
  - 冒頭の手直しは、ステージの初期コード(`stage.codebase`)で行う。段階が `'opening-fix'` の間は組み替えができないので、今の `codebase` が初期コードのままになる
  - 下書きを復元してステージを開いたとき(`restoredDraft` が `true`。すでに組み替えたあと)は、`openingFixes[stage.id] = null` として終えた扱いにする
    (組み替えたあとのコードで冒頭をやり直させない。比較は出せない)
  - 「最初に戻す」では消さない(痛みはもう体験したため、組み替えのやり直しだけをさせる)
  - ステージを切り替えても、同じタブを開いている間は残す(保存はしない。再読み込みしたら、下書きがあれば上のとおり `null`、無ければもう一度冒頭から)
- **組み替えの操作を止める**
  - 段階が `'opening-fix'` の間は、`codebase` を変える操作(抽出・移動・削除・名前の変更・継承の設定など、`commit` を通る操作)を行わず、
    `message` に「まず「もし、この変更が来たら?」で、この変更を手で入れてみてください」を出す
  - 「手で直す」の印を付けるためのメソッドのクリック(`toggleFixed`)と、メソッドの選択・中身の表示は今どおりできる
- **仕上げの手直し**
  - 段階が `'closing-fix'` のとき、`releaseManualFix` で `isManualFixSolved(checkManualFix(...))` が `true` なら `closingFixSolved = true`
  - ステージを切り替えたとき・「最初に戻す」のときは `false` に戻す。それ以外(変更依頼から戻った、点数が一度下がってまた100点になった)では戻さない
- **変更依頼の結果画面**
  - `finishImplementation` で最後の依頼を終えたとき、`codebase` を `session.base` ではなく `carried`(部品置き場を除いた、置いたあとのコード)にする
  - 「リファクタリングに戻る」(`endChangeRequests`)で今までどおり `base` と `baseHistory` に戻す。結果画面でキャンバスを触っても、戻るときに捨てる

## 見た目・動きの仕様

### 左パネルのカード(`ChangePainCard`)

| 段階 | 見出し | 本文 | 「実際に直してみる」 |
| --- | --- | --- | --- |
| `'opening-fix'` | もし、この変更が来たら? | 今の `ModifyBefore`(依頼・直す場所の数・読む行数・場所の一覧)に続けて「組み替える前に、まずこのコードのままで変更を入れてみよう。直す必要があるメソッドに印を付けてリリースします」。`details` は開いた状態 | 直す場所の数に関係なく出す。ボタンを目立たせる(`button--primary`) |
| `'refactor'` | 今のまま(もし、この変更が来たら?) | 今のまま | 今のまま(直す場所が2か所以上のとき) |
| `'closing-fix'` | もし、この変更が来たら?(もう一度) | 「組み替えたあとのコードで、同じ変更をもう一度入れてみよう」。答えになる `ModifyAfter`(○か所 → ○か所)は正解するまで出さない | 直す場所の数に関係なく出す |
| `'change-request'` | なぜ分けるのか | 今と同じ(`stage.why`・`ModifyAfter`・「「変更依頼に挑戦」で、実際に確かめてみましょう」) | 出さない |

### 手で直すパネル(`ManualFixPanel`)

- `'opening-fix'` でリリースしたあと
  - 結果の出し方は今と同じ(直し忘れなし/直し忘れ N か所。本番でバグになります/関係のない印)
  - 続けて「この痛みを覚えておこう。組み替えたあと、同じ変更がどう変わるかを確かめます」と出し、ボタンは「組み替えを始める」(押すとパネルを閉じる)だけにする(「もう一度やる」は出さない)
- `'closing-fix'` でリリースしたあと
  - 不正解: 今の表示に加えて「もう一度やる」で解き直すよう促す。`extra` があるときも不正解
  - 正解: `✅ 直し忘れなし` に続けて、冒頭との比較を1行出す(`data-testid="fix-comparison"`)
    - 冒頭の結果がある: 「冒頭: 直す場所 A か所・読む量 B 行(直し忘れ C か所) → 今回: 直す場所 D か所・読む量 E 行」。
      A・B は `measurePain(stage, codebase).initial`、D・E は `.current` から出す
    - 冒頭の結果が無い(`null`、下書きから再開した): 「直す場所 A か所 → D か所、読む量 B 行 → E 行になりました」
  - さらに「次は「変更依頼に挑戦」で、新しい機能を実際に足してみましょう」と出す

### ツールバー(`StagePanel` の `ActionToolbar`)

- 「変更依頼に挑戦」(「もう一度挑戦」)は段階が `'change-request'` のときだけ押せる。押せないときの `title`:
  - `'opening-fix'` / `'refactor'`: 今と同じ「点数が100点になると挑戦できます」
  - `'closing-fix'`: 「先に「もし、この変更が来たら?」をもう一度解いてください」

### 初回訪問のツアー(チュートリアル1)

- `TOUR_STEPS` の、課題の説明(1つ目)の次に、次の手順を足す
  - 対象: 左パネルのカードの「実際に直してみる」と、手で直すパネル
  - 文言: 「組み替える前に、まずこのコードのまま変更を入れてみよう。「実際に直してみる」を押し、直す必要があるメソッドをクリックして印を付け、リリースしよう。」
  - 進め方: 新しい `TourAdvance` の `{ kind: 'manual-fix-released' }`。冒頭の手直しをリリースしたら進む
- `TourEvent` に `{ kind: 'manual-fix-released' }` を足し、`nextTourStep` で扱う
- その後の手順(メソッドを選ぶ → 抽出)は今のまま

### 変更依頼の結果画面

- 最後の依頼の「実装を終える」を押して結果画面になったとき、キャンバスには置いたあとのコードが残る(部品置き場は出さない)
- 「リファクタリングに戻る」を押すと、挑戦前のコードと取り消し履歴に戻る(今と同じ)

## TDD対象の純粋関数

### `isManualFixSolved`(`domain/change/checkManualFix.ts`)

- 正常系: `missed` も `extra` も空 → `true`
- 異常系: `missed` がある → `false`
- 異常系: `missed` は空だが `extra` がある → `false`
- 境界: 変更箇所が1か所で、その1か所だけに印 → `checkManualFix` と組み合わせて `true`

### `stageStep`(`domain/change/stageStep.ts`)

- modify の依頼なし、`score: 50` → `'refactor'`(冒頭を終えていなくても)
- modify の依頼なし、`score: 100` → `'change-request'`
- modify の依頼あり、冒頭未了、`score: 100` → `'opening-fix'`(点数より冒頭が先)
- modify の依頼あり、冒頭未了、`score: 50` → `'opening-fix'`
- 冒頭済み、`score: 99` → `'refactor'`(仕上げを正解済みでも)
- 冒頭済み、`score: 100`、仕上げ未正解 → `'closing-fix'`
- 冒頭済み、`score: 100`、仕上げ正解 → `'change-request'`

### `nextTourStep`(`presentation/tour/tourSteps.ts`)

- `manual-fix-released` の手順で `manual-fix-released` のイベント → 次へ進む
- `manual-fix-released` の手順で `next` 以外の別のイベント(`method-selected` など) → 進まない

### ストア(`useGameStore.test.ts`)

- 冒頭の手直しを終える前は、抽出・移動をしても `codebase` が変わらず、`message` が出る
- 冒頭でリリースすると(不正解でも)`openingFixes[stage.id]` に結果が入り、そのあと抽出できる
- 「最初に戻す」で `openingFixes` は残り、`closingFixSolved` は `false` に戻る
- 100点で正解すると `closingFixSolved` が `true`、100点前のリリースでは変わらない
- 最後の変更依頼を終えた直後の `codebase` が、置いたあとのコード(部品置き場なし)と等しく、`endChangeRequests` のあとは `base` と等しい

## 受け入れ基準

1. modify の依頼があるステージを開くと、カードの「実際に直してみる」が目立つ形で出ていて、手直しを終えるまで抽出・移動ができない(操作するとメッセージが出て、コードは変わらない)
2. 冒頭の手直しは、直し忘れたままリリースしても終えられる。結果(直し忘れ)が出て、「組み替えを始める」を押すと組み替えができるようになる
3. 100点を取ると「変更依頼に挑戦」は無効のままで、カードが「もし、この変更が来たら?(もう一度)」になる。正解するまで「○か所 → ○か所」は出ない
4. 仕上げの手直しで、直す場所すべてに、関係ないメソッドには付けずに印を付けてリリースすると正解になり、冒頭との比較の1行(`fix-comparison`)が出て、「変更依頼に挑戦」が押せるようになる
5. 仕上げで直し忘れがある・関係ない印がある状態でリリースすると不正解で、「変更依頼に挑戦」は無効のまま
6. modify の依頼が無い(extend だけの)ステージでは、冒頭・仕上げの手直しは出ず、今までどおり組み替えられ、100点ですぐ「変更依頼に挑戦」が押せる
7. 「最初に戻す」を押しても冒頭の手直しはやり直さずに組み替えられる。仕上げの手直しはもう一度解く必要がある
8. 組み替えたあとで再読み込みし、下書きから再開したときは、冒頭の手直しを求めない。仕上げで正解すると、冒頭の結果なしの比較の文言が出る
9. 初回訪問のツアー(チュートリアル1)で、課題の説明の次に冒頭の手直しの手順が出て、リリースすると次の手順(メソッドを選ぶ)へ進む
10. 変更依頼の最後の依頼を終えて結果画面になったとき、キャンバスに置いたメソッド(新しいクラスを含む)が残っている。「リファクタリングに戻る」を押すと挑戦前のコードに戻る
11. 1〜10を確かめる E2E を足す。組み替え操作や `change-request-start` を使う既存の E2E は、共通のヘルパー(`e2e/selectStage.ts`)で冒頭の手直し(必要なら仕上げの手直し)を済ませてから進むように直し、すべて通る
12. `npm run check` と `npm run test:e2e` が通る

## スコープ外

- 冒頭と仕上げを並べて比べる「答え合わせ画面」(冒頭で光ったブロックと今回のブロックを並べる、どの組み替えの判断が効いたかを文章で結びつける)。別の仕様で扱う
- 冒頭の結果・仕上げの正解の保存(再読み込みしたらストアから消える)
- extend(新しい種類を足す)依頼の手直し(modify の依頼だけを対象にする)
- 理解度チェックの順番への組み込み(今までどおり100点で出す)
- 結果画面のキャンバスを読み取り専用にすること
- 「次はこれ」と段階を示すステッパーなどの新しいUI部品
- 正解・不正解の演出(`answer-feedback-animation` で扱う)
