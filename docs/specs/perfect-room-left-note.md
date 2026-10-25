# perfect-room-left-note: 100点のあとに「さらに良くできるところ」を1〜3件、控えめに知らせる

## 背景・目的

学習者としてチュートリアル1「長いメソッドを分ける」を実機で遊んで、次の不足に気付いた。

1. `printMonthlyReport` を選び、「今月の売上を集計する」「前月比を計算する」(責務 A)だけを `aggregateSales` に1回抽出する
2. メソッドの行数が上限(28行)に収まり、**100点・「✅ 減点なし」**になる
3. しかし `printMonthlyReport` の中には、まだ「表のヘッダーを組み立てる」「表の行を組み立てる」(責務 B)と「画面に出力する」(責務 C)が一緒に残っている。
   `ReportService` も責務 3種類のまま(`responsibilityLimit: 3` なので減点にならない)。解答例(`sampleAnswerSteps['tutorial-extract-method']`)は3つとも別のメソッド・別のクラスに分けている

100点を「完成」と受け取ったプレイヤーは、まだ混ざっている責務に気付かないまま次へ進み、「行数が収まれば終わり」という浅い理解が残る。
今、100点のあとに出るのは「外から使われていない公開メンバー」のお知らせ(`UnusedPublicNote`、[unused-public-member-notes](unused-public-member-notes.md))だけで、責務の残り方は知らせていない。

そこで、100点のときに「100点だけど、さらに良くできる余地」を1〜3件、左サイドバーの控えめな欄で知らせる。**点数・クリア条件・採点ルールは変えない(情報提供のみ)。**

## 変更対象ファイル一覧

| 種別 | パス | 層 | 役割 |
| --- | --- | --- | --- |
| 新規 | `src/domain/scoring/roomToImprove.ts` | domain | 今のコードと解答例のコードを比べ、「さらに良くできるところ」を最大3件返す純粋関数 |
| 新規 | `src/domain/scoring/roomToImprove.test.ts` | domain | 上のテスト |
| 新規 | `src/presentation/stage/RoomToImproveNote.tsx` | presentation | 100点のときに出すカード |
| 変更 | `src/presentation/stage/StagePanel.tsx` | presentation | `StageSidebar` で、100点のとき `UnusedPublicNote` の**上**にカードを置く |
| 変更 | `src/infrastructure/stages/stageCatalog.test.ts` | infrastructure | チュートリアル1の実際の定義で判定を確かめる(下記「TDD対象」) |
| 新規 | `e2e/perfect-room-left-note.spec.ts` | E2E | 受け入れ基準を確かめる |

- `application` 層は変更しない(ユースケースを通さない読み取り専用の計算で、`UnusedPublicNote` と同じく presentation から domain を直接呼ぶ)
- ステージ定義(`src/infrastructure/stages/*.ts`)・`Stage` 型・採点(`score.ts`)は変更しない。新しい依存は足さない
- CSS は既存の `.rumor-list`(`UnusedPublicNote` と同じ見た目)を使い、新しいクラスは足さない

## データ・型の変更

```ts
// src/domain/scoring/roomToImprove.ts
export type RoomToImprove =
  | {
      /** 1つのメソッドに、別々の責務の処理がまだ一緒に入っている。 */
      readonly kind: 'mixed-method';
      readonly methodId: string;
      readonly classId: string;
      /** メソッドの中の責務(call を除く)。処理の出現順、重複なし。 */
      readonly responsibilities: readonly string[];
      /** 責務ごとの代表の処理名(その責務で最初に出てくる Fragment の label)。responsibilities と同じ順・同じ長さ。 */
      readonly fragmentLabels: readonly string[];
    }
  | {
      /** クラスの責務の種類数が、上限ちょうど(減点にならない最大)。 */
      readonly kind: 'crowded-class';
      readonly classId: string;
      /** classResponsibilities(codeClass) の結果。 */
      readonly responsibilities: readonly string[];
    };

/** カードに出す件数の上限。 */
export const ROOM_TO_IMPROVE_LIMIT = 3;

export function findRoomToImprove(
  codebase: Codebase,
  /** 比べる相手。presentation では sampleAnswerCodebase(stage) を渡す。 */
  reference: Codebase,
  stage: Pick<Stage, 'responsibilityLimit' | 'cohesiveResponsibilities'>,
): RoomToImprove[];
```

### 判定

既存のヘルパーを再利用する: `classResponsibilities`・`CALL_RESPONSIBILITY`(`domain/scoring/responsibilities.ts`)、`allClasses`(`domain/codebase/Codebase.ts`)。

- **`mixed-method`**: 次をすべて満たすメソッド
  1. call を除いた責務が2種類以上ある(初期からあるメソッドも、抽出で作ったメソッドも対象。`findMixedMethods` と違い、ID が初期にあるかは見ない)
  2. その責務が、`cohesiveResponsibilities` のどれか1つの組に全部含まれる、ということが**ない**(`mixedMethods.ts` の `isInCohesiveGroup` と同じ考え。必要なら `mixedMethods.ts` から export して再利用する)
  3. `reference` のどのメソッドも、その責務を全部含んでいない(解答例でも一緒に置いている責務の組なら、意図的な形とみなして出さない)
- **`crowded-class`**: 次をすべて満たすクラス
  1. `classResponsibilities(codeClass).length` が2以上、かつ `stage.responsibilityLimit` と等しい(上限ちょうど。超えていれば減点の側で出るので対象外)
  2. `reference` のどのクラスも、その責務を全部含んでいない
- **並べ方と上限**: `mixed-method` を先(`allClasses` の順・メソッドの順)、続けて `crowded-class`(`allClasses` の順)。先頭から `ROOM_TO_IMPROVE_LIMIT`(3)件で切る

## 動きの仕様

- 表示する条件は `UnusedPublicNote` と同じ: `!investigating && score.total >= 100`。かつ `findRoomToImprove` の結果が1件以上。0件ならカードを出さない
- `reference` は `sampleAnswerCodebase(stage)`。`sampleAnswerSteps[stage.id]` が無いステージではカードを出さない(全ステージに解答例があることは `stageCatalog.test.ts` で保証済み)
- 計算は `useMemo` で `codebase`・`stage` が変わったときだけ行う
- 置き場所: `StageSidebar` の中で、`UnusedPublicNote` の直前(並びは「さらに良くできるところ → 仕上げのヒント(公開メンバー) → 理解度チェック → ストーリーの結び → 次のステージ」)
- カード: `<section className="rumor-list" aria-labelledby="room-to-improve-title" data-testid="room-to-improve-note">`
  - 見出し(`h3#room-to-improve-title`): `さらに良くできるところ`
  - 本文: `100点です。減点にはなりませんが、まだ分けられるところがあります`
  - 一覧(`ul`、各項目に `data-testid="room-to-improve-item"`)。責務名(`responsibility` の値)は出さず、キャンバス・メソッドエディタと同じ **`ResponsibilityMark`(色と英字)** で示す。英字は `responsibilityMarks(stage.codebase, codebase, stage.changeRequests.map((request) => request.responsibility))` で引く(`ClassNode`・`MethodEditor` と同じ引き方なので英字が一致する)
    - `mixed-method`: `[printMonthlyReport()] の中に、` + 責務ごとに「印 + 「代表の処理名」」を `・` でつないで + `がまだ一緒に入っています。責務ごとにメソッドへ抽出すると、名前で中身が分かります`
      - 例: `printMonthlyReport() の中に、B「表のヘッダーを組み立てる」・C「画面に出力する」がまだ一緒に入っています。…`
      - メソッド名はボタン。押すと `selectMethod(methodId)`(メソッドエディタが開く)
    - `crowded-class`: `[ReportService] は 3種類の責務(A・B・C)を受け持っていて、上限ちょうどです。責務ごとにクラスを分けると、1つの変更で読む範囲がさらに狭くなります`
      - クラス名はボタン。押すと `focusHint({ fileIds: [], classIds: [classId], methodIds: [] })`(既存のヒントの強調。コードが変わると消える既存の挙動のまま)
- 点数・減点の内訳・クリア条件・「変更依頼に挑戦」の可否は一切変えない

## 設計判断(確定)

1. **「意図的に残す余地」はステージ定義に新しい項目を足さず、解答例と比べて判断する。**
   全ステージに解答例があり、解答例はステージ作者が「このステージで目指す形」として書いたもの。解答例でも同じ責務を一緒に置いているなら、
   それは次のステージで扱う・この題材ではまとめるのが正しい、のどちらかなので出さない。新しい項目を足すと全ステージの定義を見直す必要が出て、
   解答例と食い違ったときにどちらが正しいか分からなくなる(本当に新しい項目が要るか → 解答例で足りる)
2. **判定は「責務」の2種類だけにする(メソッド内の混在、クラスの上限ちょうど)。** 不足点の本体は「責務がまだ混ざっている」ことで、行数・結合度の「ぎりぎり」は
   その症状にすぎない。行数ぎりぎりを出すと「数字を合わせる」方向へ誘導し、理解度チェック(チュートリアル1の check-1)が否定している考え方と逆になる
3. **メソッドの混在は上限と関係なく出し、クラスは「上限ちょうど」のときだけ出す。** メソッドは1つのことをする、が原則で上限が無い。
   クラスは上限未満なら作者が許した範囲なので、ぎりぎりのときだけ知らせて誤検知を抑える
4. **上限は3件、メソッドを先に出す。** 1件目に「次の一手」(抽出)が来るようにする。チュートリアル1の例では2件(メソッド1・クラス1)になる
5. **責務名は出さず、既存の印(英字と色)と処理のラベルで示す。** `Fragment.responsibility` はプレイヤーに見せない隠しタグ(`Codebase.ts` のコメント、`StagePanel` の方針)。
   印とラベルはすでに画面に出ている情報なので、ネタバレにならない
6. **`UnusedPublicNote` とは別のカードにし、その上に置く。** 責務の分け方は「設計の中身」、公開メンバーは「仕上げ」で、直す順番もこの順。
   `UnusedPublicNote` は変更しない(既存の E2E を壊さない)

## TDD対象

### `findRoomToImprove`(domain、`src/domain/scoring/roomToImprove.test.ts`)

テスト用のコードベースは `domain/codebase/testFixtures.ts` の既存ヘルパーで組む。

- 正常系: 初期からあるメソッドに責務 `b`・`c` が残り、reference では別々のメソッド → `mixed-method` が1件。`responsibilities` は `['b', 'c']`、`fragmentLabels` は各責務で最初の処理のラベル
- 正常系: 責務 `b` の処理が2つ・`c` が1つ → `fragmentLabels` は2件(重複しない)
- 正常系: 抽出で作ったメソッドにも混在があれば対象(ID が初期にあるかは見ない)
- 境界: call + 1種類の責務 → 対象外(call は数えない)
- 境界: 責務がすべて `cohesiveResponsibilities` の1つの組に入る → 対象外。組の外が混ざる → 対象
- 抑止: reference のどれかのメソッドが同じ責務を全部含む(同じ組・それより大きい組) → 対象外
- 正常系: クラスの責務が3種類、`responsibilityLimit: 3`、reference では分かれている → `crowded-class` が1件
- 境界: 責務が2種類で上限3(上限未満) → 対象外。責務が4種類で上限3(超過。減点側で出る) → 対象外
- 境界: 上限1で責務1種類 → 対象外(2種類以上だけを見る)
- 抑止: reference のどれかのクラスが同じ責務を全部含む → 対象外
- 並び: `mixed-method` が `crowded-class` より先。同じ種類の中は `allClasses` の順・メソッドの順
- 上限: 候補が5件あっても先頭3件だけ返す
- `codebase` と `reference` が同じ → 空配列

### `stageCatalog.test.ts`(infrastructure、実際のステージ定義で確かめる)

- チュートリアル1の初期コードから `applySolutionSteps` で `{ extract: { from: 'printMonthlyReport', fragmentIds: ['frag-aggregate-sales', 'frag-compare-last-month'], name: 'aggregateSales' } }` だけを適用すると、
  `scoreCodebase` は100点で、`findRoomToImprove(…, sampleAnswerCodebase(stage), stage)` は
  `[{ kind: 'mixed-method', methodId: 'method-print-monthly-report', … responsibilities: ['formatting', 'output'] }, { kind: 'crowded-class', classId: 'class-report-service', … }]` の2件
- 同じステージで解答例の最初の3手(3つの抽出)まで適用すると、`mixed-method` は消え、`crowded-class` の1件だけになる
- 全ステージで、解答例の最終形に対して `findRoomToImprove` が空(解答例どおりに解いたプレイヤーには出ない)

## 受け入れ基準

1. チュートリアル1で、冒頭の手直しを済ませ(`e2e/selectStage.ts` の `completeOpeningFix`)、100点になる前はカード(`room-to-improve-note`)が出ない
2. 「今月の売上を集計する」「前月比を計算する」だけを1回抽出して100点になると、左サイドバーにカード「さらに良くできるところ」が出て、項目が2件ある
   - 1件目に `printMonthlyReport()` と「表のヘッダーを組み立てる」「画面に出力する」が、印(英字)つきで出る。責務名(`formatting` など)は画面のどこにも出ない
   - 2件目に `ReportService` と「3種類」「上限ちょうど」が出る
3. 1件目の `printMonthlyReport()` を押すとメソッドエディタでそのメソッドが開く。2件目の `ReportService` を押すとキャンバスでそのクラスが強調される
4. 点数は100点のまま、減点の内訳・クリア条件の表示も変わらない。理解度チェックとストーリーの結び・次のステージのカードは今までどおり出る
5. 中級7を解答例どおりに100点にしたとき(`e2e/unused-public-member-notes.spec.ts` の手順)、`unused-public-note` は今までどおり出て、カードが出る場合は `unused-public-note` より上にある
6. 変更依頼に挑戦している間はカードが出ない
7. `npm run check` と `npm run test:e2e` が通る

## スコープ外

- 行数・結合度の「上限ぎりぎり」を知らせること(設計判断2。必要になったら同じ関数に `kind` を足す)
- 「さらに良くできるところ」を減点にすること・点数やクリア条件を変えること
- ステージ定義に「意図的に残す余地」を書く項目を足すこと(設計判断1。解答例と比べて判断する)
- 処理1つずつの置き場所を解答例と比べた詳しい違いの一覧(既存の [answer-comparison-view](answer-comparison-view.md) が「解答例の図を見る」で扱う)
- 外から使われていない公開メンバーのお知らせの変更([unused-public-member-notes](unused-public-member-notes.md)。`UnusedPublicNote` は触らない)
- 白紙設計モードでの表示(白紙設計の問題には `sampleAnswerSteps` が無く、画面も別)
- 3件を超えたときの「ほかに N 件」の表示
- AI講評の文面の変更
