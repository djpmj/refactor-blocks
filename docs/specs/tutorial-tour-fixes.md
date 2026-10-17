# tutorial-tour-fixes: 初回ツアーが正しい抽出に導くように手順と文言を直す

## 背景・目的

2026-10-17 にチュートリアル1を初回ツアーどおりに遊んで、ツアーがプレイヤーを**間違った答えに誘導している**ことが分かった。

1. **2つ目の処理を選べない**: 手順4「一緒に切り出したいまとまりを選ぼう」(`advance: click-inside`)は、処理の一覧の中を1回クリックした時点で手順5へ進む。
   手順5は抽出ボタンだけを照らし、暗幕(`spotlight-tour__shade`)が処理の一覧を覆うので、**2つ目以降のチェックを付けられない**。
   チュートリアル1の「前年同月比も出して」(`req-report-yoy`)は責務 `aggregation`(印 A)の変更で、A は「今月の売上を集計する」「前月比を計算する」の2つある。
   ツアーどおりだと「集計」だけを抜き出すことになり、組み替えたあとの手直しで「直し忘れ 2 か所」になる。教えたいこと(同じ責務をまとめる)と逆の体験になっている
2. **同じ英字の意味を教えていない**: 処理の左の A/B/C(`ResponsibilityMark`)は「同じ英字=同じ責務」だが、ツアーで説明していない
3. **行数の数字が食い違う**: 手順6「メソッドが50行以内になるまで続けてみよう」は、チュートリアル1のクリア条件(メソッド28行以内)と合わない
4. **開始ボタンを照らしていない**: 手順2は `.app__body`(画面全体)を対象にしていて、「実際に直してみる」ボタンを指していない。ボタンは左パネルの下の方にあり、画面外のこともある。
   また手順2はリリースしたあとも「…リリースしよう」のまま残り、「組み替えを始める」を押すまで進まない(`endManualFix` で進むため)が、それが文に書かれていない

## 変更対象ファイル一覧

| 種別 | パス | 層 | 役割 |
| --- | --- | --- | --- |
| 変更 | `src/presentation/tour/tourSteps.ts` | presentation | 手順と文言を直す。`manual-fix-started` を足し、使わなくなる `click-inside` を消す |
| 変更 | `src/presentation/tour/tourSteps.test.ts` | presentation | 上のテスト |
| 変更 | `src/presentation/tour/SpotlightTour.tsx` | presentation | 手順の対象が画面外なら、手順の開始時に1回だけ画面内へスクロールする。`useClickAdvance` を消す |
| 変更 | `src/presentation/store/useGameStore.ts` | presentation | `startManualFix` で、ツアーが `manual-fix-started` 待ちなら進める |
| 変更 | `src/presentation/stage/ChangePainCard.tsx` | presentation | 「実際に直してみる」に `data-tour="manual-fix-start"` を付ける(`manual-fix-clarity` が先にマージされていれば付与済み) |
| 変更 | `src/presentation/editor/MethodEditor.tsx` | presentation | 処理の一覧と抽出ボタンを包む要素に `data-tour="extract-area"` を付ける |
| 変更 | `e2e/first-visit-tour.spec.ts` | E2E | 新しい手順に合わせ、下の受け入れ基準を確かめる |

`domain` / `application` / `infrastructure` は変更しない。

## データ・型の変更

`TourAdvance` / `TourEvent`(`presentation/tour/tourSteps.ts`)を次のようにする。

- 足す: `{ kind: 'manual-fix-started' }`(advance と event の両方)
- 消す: `{ kind: 'click-inside' }` / `{ kind: 'clicked-inside' }`(新しい手順では使わない)

## 手順(`TOUR_STEPS`、6手順のまま)

| # | 対象(`target`) | 文 | 進む条件 |
| --- | --- | --- | --- |
| 1 | `#stage-sidebar` | 今のまま | `next` |
| 2 | `[data-tour="manual-fix-start"]` | `組み替える前に、まずこのコードのまま変更を入れてみよう。「実際に直してみる」を押そう。` | `manual-fix-started` |
| 3 | `.app__body` | `直す必要があるメソッドをクリックして「直した」印を付け、左の「リリースする」を押そう。結果を読んだら「組み替えを始める」へ。` | `manual-fix-released`(今どおり `endManualFix` で進む) |
| 4 | `[data-testid="method-printMonthlyReport"]` | 今のまま | `select-method`(`printMonthlyReport`) |
| 5 | `[data-tour="extract-area"]` | `処理がまとまりごとに並んでいます。左の英字は責務の印で、同じ英字は同じ仕事です。A の処理を全部選んで「選んだ処理をメソッドとして抽出」を押そう。` | `extract` |
| 6 | `.score-badge` | `新しいメソッドができ、点数とクリア条件が変わりました。メソッドがクリア条件の行数以内になるまで続けてみよう。` | `next` |

- 手順6の文には行数の数字を書かない(ステージ定義の `limits` と二重に持たないため)
- 手順5は処理の一覧と抽出ボタンを一緒に照らすので、ツアー中でも複数のチェックを付けられる

## スクロール

- `SpotlightTour` は、手順が変わったとき、対象の要素がビューポートの外にあれば `scrollIntoView({ block: 'nearest' })` を1回呼ぶ
  (左パネルなど、スクロールできる親の中で画面外にある場合を含む)。毎フレームの位置合わせ(`useSpotlightPosition`)は今のまま

## TDD対象の純粋関数

### `nextTourStep`(`presentation/tour/tourSteps.ts`)

- 手順2(`manual-fix-started` 待ち)に `manual-fix-started` → 手順3へ
- 手順2に `manual-fix-released` → 進まない
- 手順3(`manual-fix-released` 待ち)に `manual-fix-released` → 手順4へ
- 手順5(`extract` 待ち)に `method-count`(開始時より多い)→ 手順6へ
- どの手順でも `next` → 次へ(今どおり)
- `TOUR_STEPS[5].text` に数字の `行` を含まない(`/\d+行/` に一致しない)

スクロールと照らす範囲は表示の変更なので E2E で確かめる。

## 受け入れ基準

1. 初回ツアーの手順2で「実際に直してみる」ボタンが照らされ、画面の高さが 700px でもボタンが画面内に見えている。押すと手順3へ進む
2. 手順5で「今月の売上を集計する」と「前月比を計算する」の両方にチェックを付けられ、抽出すると1つのメソッドにまとまって手順6へ進む
3. 2のあと、組み替えを終えて100点にしてから「もう一度」の手直しで「前年同月比も出して」を入れると、直す場所は1か所で、直し忘れが出ない
4. 手順6の文に「50行」が無い
5. `npm run check` と `npm run test:e2e` が通る

## スコープ外

- ほかのステージへのツアーの追加
- 責務の印(A/B/C)の名前を見せること(`responsibility-colors` で意図的に隠している)
- 手で直す流れの文言や答えの表示(`manual-fix-clarity` で扱う)
