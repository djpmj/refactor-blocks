# mixed-extract-name: 責務の違う処理をまとめて選ぶと、自動のメソッド名が1つの責務しか表さず、混ざることにも抽出前に気づけない

## 症状

2026-11-03 にチュートリアル2「太った placeOrder」で見つかった。

1. `placeOrder` をクリックし、メソッドエディタで「注文をDBに保存する」(印 D・`persistence`・3行)と「確認メールを送る」(印 E・`notification`・3行)の2つにチェックを入れる
2. 名前欄に自動で `saveOrder` が入り、プレビューに「抽出すると: placeOrder …行 → …行 / 新しい saveOrder 6行」と出る
3. 抽出すると、メール送信まで入っているのに名前は DB 保存だけを表す `saveOrder()` になる(名前が中身と合わない)。そのうえ抽出したあとで初めて「責務の混ざったメソッド」の減点(-10)が出る。抽出前のプレビューでは、責務が混ざることに気づけない

チュートリアル1で「表のヘッダー」「表の行」(`formatting`)と「画面に出力する」(`output`)を一緒に選んだときも同じ。名前は `printReport` になり、抽出すると同じ減点が出る。

## 原因

- `suggestMethodName`(`src/domain/codebase/suggestMethodName.ts`)の `responsibilityName` は、選んだ処理の責務を数え、**行数がいちばん多い責務(同じ行数なら先に選んだ責務)の名前を1つだけ**返す。責務が2種類以上あっても、残りの責務は名前に入らない。D と E はどちらも3行なので、先に選んだ `persistence` の `saveOrder` になる。
- 採点の「責務の混ざったメソッド」は `findMixedMethods`(`src/domain/scoring/mixedMethods.ts`)の `isMixedMethod` が決めている(`call` を除いた責務が2種類以上あり、`stage.cohesiveResponsibilities` のどの組にも収まらない)。ところが抽出前のプレビュー(`MethodEditor.tsx` の `useExtractPreviewSummary` → `describeExtractPreview` / `describeGrowthHeadsUp`)は行数しか伝えず、この判定を使っていない。
- `suggestMethodName` を呼んでいるのは `src/presentation/editor/MethodEditor.tsx` と `src/infrastructure/stages/stageCatalog.test.ts` だけ。命名は `suggestMethodName` の1か所、混在の判定は `mixedMethods.ts` の1か所で直せば済む。

## 修正

方針: **名前とプレビューの警告の両方を直す**。どちらも、採点と同じ「混ざっている」の判定を1つの関数で共有する。

- 名前だけを直すと、`saveOrderAndSendConfirmationMail` の `And` が混在のしるしだと新卒のプレイヤーは気づきにくく、なぜ減点されるのかが抽出前に分からない。
- 警告だけを直すと、抽出したメソッドの名前が嘘のまま残る(症状の本体が直らない)。
- 本当に両方要るか: 名前は原因(1つの責務しか表さない)を直すもの、警告は「抽出前に気づけない」を直すもので、役割が違う。どちらも既存の関数の分岐1つと、短い文言関数1つで済むので両方やる。
- プレイヤーに名前を入力させる案は採らない(自動で付ける方針)。名前欄の手入力は今どおり残す(この修正では触らない)。

### 1. 混在の判定を切り出す(domain)

`src/domain/scoring/mixedMethods.ts` に次を足し、`isMixedMethod` もこれを使う形に直す(判定の中身は今と同じ)。

```ts
/**
 * 処理の並びから、混ざっている責務(call を除き、出てくる順・重複なし)を返す。
 * 責務が1種類以下、または cohesiveResponsibilities のどれかの組に収まるときは [] を返す。
 */
export function mixedResponsibilities(
  fragments: readonly Pick<Fragment, 'responsibility'>[],
  cohesiveResponsibilities: readonly (readonly string[])[] = [],
): readonly string[];
```

`isMixedMethod` は `!initialMethodIds.has(method.id) && mixedResponsibilities(method.fragments, cohesiveResponsibilities).length > 0` になる。

### 2. 自動命名を直す(domain)

`src/domain/codebase/suggestMethodName.ts`:

- `MethodNaming` に省略できる `readonly cohesiveResponsibilities?: readonly (readonly string[])[]` を足す(`NO_METHOD_NAMING` やテストのリテラルは変えなくてよい)。
- 処理が2つ以上で模範解答の組(`groups`)に一致しないときの決め方を、次のように変える。
  1. `mixedResponsibilities(fragments, naming.cohesiveResponsibilities ?? [])` が空でなければ(= 採点で混在になる選び方)、その責務を出てくる順に `byResponsibility` の名前へ置き換え、既存の `combine` でつなぐ。例: `['saveOrder', 'sendConfirmationMail']` → `saveOrderAndSendConfirmationMail`、`['buildTable', 'printReport']` → `buildTableAndPrintReport`。混ざる責務のどれか1つでも表に名前が無ければ、今の最後の手段(各処理の `suggestedName` を `combine`)にする。
  2. 混在でなければ今どおり(行数最大の責務の名前 → 無ければ `suggestedName` の組み合わせ)。
- 模範解答の組との一致を最優先にすること、1処理のときの決め方、既存名との重複に番号を付けることは今どおり。

`src/domain/stage/methodNaming.ts`: `methodNamingOf` の引数の `Pick` に `'cohesiveResponsibilities'` を足し、そのまま `MethodNaming` に入れる(ステージに無ければ入れない、または `undefined`)。採点と命名で「混ざっている」の判断がずれないようにするため(口座のステージ `intermediateStages.ts` の `['account-status', 'withdrawal-limit', 'balance']` の組は混在扱いにしない)。

### 3. プレビューに警告を出す(presentation)

新規 `src/presentation/editor/describeMixedHeadsUp.ts`:

```ts
/** 抽出しようとしている処理の責務が混ざるとき、印と名前で伝える。混ざらなければ undefined。 */
export function describeMixedHeadsUp(
  responsibilities: readonly string[],      // mixedResponsibilities の戻り値
  marks: ReadonlyMap<string, number>,
  names: Readonly<Record<string, string>>,
): string | undefined;
```

- `responsibilities` が空なら `undefined`
- それ以外は `責務が混ざります(${responsibilityBreakdown(responsibilities, marks, names)})。責務ごとに分けて抽出すると「責務の混ざったメソッド」の減点を避けられます`
  - 例(チュートリアル2): `責務が混ざります(D DBへの保存・E メール通知)。責務ごとに分けて抽出すると「責務の混ざったメソッド」の減点を避けられます`
  - 印と名前は既存の `responsibilityBreakdown`(`responsibilityLabel.ts`)をそのまま使う。処理一覧の印(D・E)と同じ文字になるので、どれとどれが混ざるかが分かる

`src/presentation/editor/MethodEditor.tsx`:

- `useExtractPreviewSummary` に `marks` を渡し(引数は4つまで)、戻り値に `mixedHeadsUp: string | undefined` を足す。選んだ処理は `method.fragments.filter((fragment) => selected.has(fragment.id))`、責務の組と名前は store の `state.stage.cohesiveResponsibilities` / `state.stage.responsibilityNames` から取る。`preview` が `undefined` のとき(変更依頼中・手直し中・未選択)は `mixedHeadsUp` も `undefined`。
- `ExtractControls` に `mixedHeadsUp` を渡し、既存の `aria-live="polite"` の `div` の中、`growthHeadsUp` と並べて `<p className="method-editor__mixed-heads-up" data-testid="extract-mixed-heads-up">` で出す。CSS は `method-editor__growth-heads-up` と同じ見た目でよい(既存のスタイルを流用し、新しい色は足さない)。
- 名前欄を手で書き換えても警告は出し続ける(警告は名前ではなく選んだ処理で決まる)。
- 抽出ボタンは無効にしない(混ぜて抽出することもプレイヤーの選択として残す。減点で学ぶ)。

### 変更対象ファイル

| 新規/変更 | パス | 層 | 役割 |
| --- | --- | --- | --- |
| 変更 | `src/domain/scoring/mixedMethods.ts` + `.test.ts` | domain | `mixedResponsibilities` を足し、`isMixedMethod` から使う |
| 変更 | `src/domain/codebase/suggestMethodName.ts` + `.test.ts` | domain | 混在のときは責務ごとの名前を `And` でつなぐ。`MethodNaming.cohesiveResponsibilities?` |
| 変更 | `src/domain/stage/methodNaming.ts` + `.test.ts` | domain | `cohesiveResponsibilities` を `MethodNaming` へ渡す |
| 新規 | `src/presentation/editor/describeMixedHeadsUp.ts` + `.test.ts` | presentation | 警告の文言 |
| 変更 | `src/presentation/editor/MethodEditor.tsx` | presentation | 警告を計算して表示する |
| 変更 | `src/infrastructure/stages/stageCatalog.test.ts` | infrastructure | チュートリアル1の3処理の期待名を `buildTableAndPrintReport` に直す。チュートリアル2の D+E を足す |
| 変更 | `e2e/extract-preview.spec.ts` | E2E | 下記 |

データ・永続化スキーマの変更は無い(ステージ定義の `methodNames` などは書き換えない)。

## テスト

先に書いて失敗させるテスト(AAA パターン)。

### `mixedResponsibilities`(`mixedMethods.test.ts`)

- `persistence`・`notification` の2処理 → `['persistence', 'notification']`(出てくる順)
- 同じ責務の2処理(`validation` ×2)→ `[]`
- `call` と `formatting` → `[]`(`call` は数えない)
- `formatting`・`output`・`formatting` → `['formatting', 'output']`(重複なし)
- 3責務がすべて `cohesiveResponsibilities` の1つの組に入る → `[]`。組からはみ出す責務が1つでもある → 全責務を返す
- 処理が0個 → `[]`
- 既存の `findMixedMethods` のテストはそのまま通る

### `suggestMethodName`(`suggestMethodName.test.ts`)

- `persistence`(3行・表 `saveOrder`)+ `notification`(3行・表 `sendConfirmationMail`)→ `saveOrderAndSendConfirmationMail`(今は `saveOrder`。これが症状のテスト)
- 既存「一致する模範解答がなくても、行数が最大の責務名を使う」(formatting 5行 + output 9行)→ 期待を `buildTableAndPrintReport` に直し、テスト名も「責務が混ざるときは、責務ごとの名前を出てくる順に And でつなぐ」にする
- 既存「責務の行数が同じなら、先に選んだ責務名を使う」→ 期待を `buildTableAndPrintReport` に直し、テスト名を「責務が混ざるときは行数に関係なく両方の責務名を入れる」にする
- 既存「模範解答のID集合に一部しか一致しなければ責務表を使う」(validation + persistence)→ 期待を `validateOrderAndSaveOrder` に直す
- 混ざる責務のうち1つが表に無い → 各処理の `suggestedName` の組み合わせ(例: `saveOrderAndSendConfirmationMail`)
- `cohesiveResponsibilities` に `['formatting', 'output']` があると混在扱いにならず、今どおり行数最大の `printReport`
- 同じ動詞の責務名(`validateItems`・`validateStock` が別責務)→ `validateItemsAndStock`(`combine` の動詞まとめが効く)
- 混在の名前が既存名と重なる → 末尾に `2`
- 模範解答の組と一致すれば、混在していても組の名前(今どおり)
- `call` + 1責務 → 今どおりその責務の名前(既存テスト)

### `methodNamingOf`(`methodNaming.test.ts`)

- ステージの `cohesiveResponsibilities` がそのまま `MethodNaming.cohesiveResponsibilities` に入る。無いステージでは混在判定が `[]` の組で行われる(既存ケースが通る)

### `describeMixedHeadsUp`(`describeMixedHeadsUp.test.ts`)

- `[]` → `undefined`
- `['persistence', 'notification']`、印 `persistence→3`・`notification→4`、名前 `DBへの保存`・`メール通知` → `責務が混ざります(D DBへの保存・E メール通知)。責務ごとに分けて抽出すると「責務の混ざったメソッド」の減点を避けられます`
- 名前が無い責務は印だけ(`D・E`。`responsibilityBreakdown` の既存の挙動)

### ステージカタログ(`stageCatalog.test.ts`)

- 既存「チュートリアル1でヘッダー・行・出力を選ぶとprintReportを提案する」→ `buildTableAndPrintReport` に直す
- チュートリアル2で `frag-save`・`frag-mail` → `saveOrderAndSendConfirmationMail`

### E2E(`e2e/extract-preview.spec.ts`)

- 既存「チュートリアル1で表のヘッダー・行・出力を抽出すると、責務に沿った短い名前になる」→ 名前欄と抽出後のメソッドを `buildTableAndPrintReport` に直し、`extract-mixed-heads-up` が見えることも確かめる
- 新規: チュートリアル2で `placeOrder` を開き「注文をDBに保存する」「確認メールを送る」を選ぶ → 名前欄が `saveOrderAndSendConfirmationMail`、`extract-mixed-heads-up` に `D DBへの保存・E メール通知` が含まれる。「確認メールを送る」のチェックを外す → 警告が消え、名前欄が `saveOrder` に戻る
- 新規(同じテストの続きでよい): 「在庫があるか検証する」「商品が空でないか検証する」(同じ責務)だけを選ぶ → 警告は出ない
- `e2e/` で、責務の違う処理を2つ以上まとめて抽出し、自動の名前(`method-xxx` の testid など)を前提にしているテストが他にあれば、新しい名前に直す(`grep` で `extract(` の呼び出しのうち処理を2つ以上渡しているものを確かめる)

## 受け入れ基準

1. チュートリアル2で D と E を一緒に選ぶと、名前欄が `saveOrderAndSendConfirmationMail` になり、プレビューの下に「責務が混ざります(D DBへの保存・E メール通知)。…」が出る。抽出すると `saveOrderAndSendConfirmationMail()` ができる
2. D だけ、E だけ、検証の2処理だけを選んだときは警告が出ず、名前は今どおり(`saveOrder`・`sendConfirmationMail`・`validateOrder`)
3. 口座のステージ(`cohesiveResponsibilities` があるステージ)で、組の中の責務だけを選んだときは警告が出ず、名前も今の決め方のまま
4. 警告が出る選び方と、抽出後に「責務の混ざったメソッド」の減点が出る選び方が一致する(どちらも `mixedResponsibilities` を使っている)
5. 変更依頼の作業中・手直し中など、プレビューが出ないときは警告も出ない
6. 採点・模範解答の再生・既存ステージの点数は変わらない(`findMixedMethods` の結果は今と同じ)
7. `npm run check` と `npm run test:e2e` が通る

## スコープ外

- 抽出ボタンを無効にする・確認ダイアログを出すなど、混ぜた抽出を止めること
- 混在の警告を、移動(Move Method)・統合(Merge Methods)・インライン化のプレビューに出すこと
- ステージ定義の `methodNames`・`suggestedName`・模範解答の名前の書き換え
- 1処理だけを選んだときの名前の決め方
- 抽出済みのメソッドの名前を、後から中身に合わせて付け直すこと
- `And` でつないだ名前を短くする工夫(混ざっていることが名前で分かるほうを優先する)
- 名前欄の手入力の廃止(今の UI のまま触らない)
