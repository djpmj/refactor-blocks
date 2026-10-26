# antipattern-gallery: ステージ一覧に「コードの臭い図鑑」を足し、臭い・原則ごとに症状・弊害・直し方・練習できるステージを読めるようにする

## 背景・目的

ステージ一覧(`StageRoadmapDialog`)のカードには `Stage.learns` のタグとして「Feature Envy」「貧血ドメインモデル」「Middle Man」「循環依存」「ISP」などが出る。
ただし、**それがどんな症状で、放っておくと何が困り、どう直すのか**を、臭いごとにまとめて読める場所が無い。

- 「学べることごと」(`concept-mastery-map`、実装済み)は概念ごとの**クリア件数と未クリアのステージ**を出すだけで、中身の説明は無い。
  また `Extract Method`・`Move Method` のような操作名と、`Feature Envy` のような臭いの名前が区別されずに並ぶ
- 用語のポップオーバー(`term-glossary-popover`、仕様のみ・未実装)は**1〜2文の意味**を引くもので、弊害・直し方は書かないと決めている
- 減点の「なぜ?」(`src/presentation/stage/ruleWhy.ts` の `RULE_WHY`)は**採点ルールごと**の困りごとで、臭いの名前(Long Method・Middle Man など)とは対応していない
- ステージ定義に臭いの名前があっても「Long Method」はタグに無く(`Extract Method` のタグで練習する)、名前からステージを逆引きできない

ステージ一覧の表示切り替えに3つ目の `コードの臭い図鑑` を足し、臭い・設計の原則ごとに「症状・弊害・直し方・練習できるステージ」を1画面で読めるようにする。
ステージへのリンクを押せば、そのまま練習に移れる。

本当に別画面・新しい保存データが要るか → 要らない。表示切り替えはすでに `ViewSwitch` があり、ステージとの対応は既存の `Stage.learns` のタグで引ける。
図鑑の文章データ1ファイルと、タグからステージを引く純粋関数1つ、表示コンポーネント1つで足りる。

## 変更対象ファイル一覧

| 種別 | パス | 層 | 役割 |
| --- | --- | --- | --- |
| 新規 | `src/domain/gallery/Antipattern.ts` | domain | 型 `AntipatternEntry` と、項目のタグから練習できるステージを引く純粋関数 `practiceStages`(`src/domain/story/Story.ts` と同じ「型+純粋関数」の置き方) |
| 新規 | `src/domain/gallery/Antipattern.test.ts` | domain | `practiceStages` のテスト(先に書く) |
| 新規 | `src/infrastructure/gallery/antipatterns.ts` | infrastructure | 図鑑データ `antipatterns: readonly AntipatternEntry[]`(`src/infrastructure/story/storyChapters.ts` と同じ置き方) |
| 新規 | `src/infrastructure/gallery/antipatterns.test.ts` | infrastructure | データの整合性テスト(下記) |
| 新規 | `src/presentation/stage/AntipatternGallery.tsx` | presentation | 図鑑の表示専用コンポーネント(`ConceptMasteryList.tsx` と同じ置き方・同じ `onChoose` の受け方) |
| 変更 | `src/presentation/stage/StageRoadmapDialog.tsx` | presentation | `RoadmapView` に `'gallery'` を足し、`ViewSwitch` に3つ目のボタンを足して `AntipatternGallery` を出す |
| 変更 | `src/index.css` | presentation | `.antipattern-gallery` のスタイル(`.concept-mastery` に合わせた最小限) |
| 変更 | `e2e/roadmap.spec.ts` | E2E | 図鑑の表示・ステージへの移動・キーボード操作のテストを足す |

`application` 層は変更しない(ユースケースが無い表示データの引き当てのため。`storyChapters`・`comparisonQuizzes` と同じく presentation から infrastructure のデータを直接 import する)。
`Stage` 型・ステージ定義(`learns` の中身)・`useGameStore`・`domain/progress/roadmap.ts`・保存形式は変更しない。新しい依存は足さない。

## データ・型の変更

保存形式の変更はなし。

```ts
// src/domain/gallery/Antipattern.ts
import type { Stage } from '../stage/Stage';

/** 図鑑の1項目。コードの臭い、または設計の原則。 */
export type AntipatternEntry = {
  /** 例: 'feature-envy'。data-testid に使う */
  readonly id: string;
  /** 'smell' = コードの臭い、'principle' = 設計の原則。見出しの分け方にだけ使う */
  readonly kind: 'smell' | 'principle';
  /** 見出し。例: 'Feature Envy(他クラスのデータを触りすぎ)' */
  readonly name: string;
  /** どんな見た目のコードか(1〜2文) */
  readonly symptom: string;
  /** 放っておくと何が困るか(1〜2文) */
  readonly harm: string;
  /** どう直すか。このゲームの操作名(Extract Method・Move Method など)で書く(1〜2文) */
  readonly remedy: string;
  /** 練習できるステージを引くためのタグ。`Stage.learns` の文字列と完全一致させる */
  readonly learns: readonly string[];
};

/**
 * entry.learns のどれかを learns に持つステージを、stages の並び順で返す。
 * 1つのステージが複数のタグに当たっても1回だけ。
 */
export function practiceStages(entry: AntipatternEntry, stages: readonly Stage[]): readonly Stage[];
```

### 図鑑データ(`antipatterns.ts`、初版15項目)

文言は実装者が日本語として自然に整えてよい。ただし次を守る。

- `remedy` は**一般的な直し方**を書き、特定のステージの答え(どのメソッドをどのクラスへ、など)は書かない(ステージのヒントの領分)
- `symptom`・`harm`・`remedy` はそれぞれ1〜2文
- `learns` は下の表のとおり(すべて実在するタグ。`src/infrastructure/stages/*Stages.ts` の `learns` で確認済み)

| id | kind | name | 症状(要旨) | 弊害(要旨) | 直し方(要旨) | learns |
| --- | --- | --- | --- | --- | --- | --- |
| `long-method` | smell | Long Method(長すぎるメソッド) | 1つのメソッドに入力チェック・計算・保存・通知などが続けて書かれ、数十行ある | どこを直せばよいか読み解くのに時間がかかり、一部だけ再利用・テストできない | ひとまとまりの処理を Extract Method で名前の付いたメソッドに切り出す | `Extract Method` |
| `god-class` | smell | 何でも屋のクラス(God Class) | 1つのクラス・ファイルに、関係の薄い仕事がいくつも同居している | どの変更でもそのクラスを触ることになり、変更がぶつかり、影響範囲が読めない | 仕事ごとにクラスを追加し、Move Method・Extract Class で分ける | `責務の分離`、`Extract Class`、`ファイル分割` |
| `feature-envy` | smell | Feature Envy(他クラスのデータを触りすぎ) | 自分のデータより、他のクラスのデータばかり読み書きしているメソッドがある | データの持ち主が変わると、離れた場所のメソッドまで直す必要が出る | そのメソッドを、使っているデータを持つクラスへ Move Method で移す | `Feature Envy` |
| `anemic-domain-model` | smell | 貧血ドメインモデル | データのクラスが getter/setter だけを持ち、判断や計算は別の Service クラスにある | ルールが Service のあちこちに散り、同じチェックの書き忘れが起きる | データを使う処理を、データを持つクラスへ移して振る舞いを持たせる | `貧血ドメインモデル` |
| `middle-man` | smell | Middle Man(横流しするだけのクラス) | 受け取った呼び出しを、ほぼそのまま別のクラスへ渡すだけのクラスがある | 読む・直すときにたどる段が1つ増えるだけで、何も守っていない | Inline Method / Inline Class で間のクラスを畳み、呼び出し元から直接呼ぶ | `Middle Man` |
| `cyclic-dependency` | smell | 循環依存 | AがBを呼び、BもAを呼ぶように、依存をたどると元に戻る輪がある | 輪の中の1つを変えると全部に響き、どれか1つだけを切り出して使えない | 輪の原因になっているメソッドを Move Method で動かし、依存を一方通行にする | `循環依存` |
| `duplicated-code` | smell | 重複コード(コピペ) | 同じ計算が複数のクラスにコピーされている | 仕様が変わったとき、全部のコピーを漏れなく直す必要がある | 同じ処理を Merge Methods で1か所にまとめ、ほかからはそれを呼ぶ | `重複の排除` |
| `type-switch` | smell | 種類ごとの分岐の散らばり | 会員ランクや状態などの種類ごとの if/switch が、複数のメソッドに同じ形で書かれている | 種類を1つ増やすたびに、すべての分岐を探して書き足す必要がある | 種類ごとのクラスに分け、継承やインターフェースで差し替える | `分岐の分離`、`Strategy`、`State` |
| `primitive-obsession` | smell | 基本データ型への執着 | 金額と通貨のような意味のある値を、数値や文字列のまま別々に持ち回している | 値のチェックや計算が使う側に散らばり、組み合わせの間違いが起きやすい | 値をまとめた小さなクラス(Value Object)を作り、計算をそこへ移す | `Value Object` |
| `useless-hierarchy` | smell | 役に立っていない継承 | 子が1つしかない、または親と子の違いがほとんど無い継承がある | 読む人が2つのクラスを行き来する必要があり、分けた意味が無い | Collapse Hierarchy で親と子を1つのクラスに畳む | `Collapse Hierarchy`、`継承の見直し` |
| `single-responsibility` | principle | 単一責任の原則(責務の分離) | 1つのクラスが「変わる理由」を1つだけ持つようにする考え方 | 守らないと、関係の無い変更どうしが同じクラスでぶつかる | 変わる理由ごとにクラスを分け、メソッドを持ち主へ移す | `責務の分離`、`変わる部分の分離` |
| `encapsulation` | principle | カプセル化 | データとそれを変える処理を同じクラスに閉じ込め、外からは決めたメソッドでしか触らせない考え方 | 守らないと、どこからでもデータを書き換えられ、壊れた状態の原因を追えない | 内側でしか使わないメソッドを private にし、データを使う処理を持ち主へ移す | `カプセル化`、`private` |
| `dependency-direction` | principle | 依存の向き(レイヤー) | Controller → Service → Repository のように、依存を一方通行にそろえる考え方 | 守らないと、画面の都合の変更が保存処理にまで響き、層ごとに直せない | 処理を役割の合う層へ移し、下の層から上の層を呼ばないようにする | `依存の向き`、`層(Controller/Service/Repository)` |
| `interface-segregation` | principle | インターフェース分離の原則(ISP) | 使う側が必要とするメソッドだけを持つ、小さなインターフェースに分ける考え方 | 守らないと、使わないメソッドまで実装させられ、関係の無い変更に巻き込まれる | 大きなインターフェースを役割ごとに分け、必要なものだけを implements する | `ISP`、`インターフェース` |
| `program-to-interface` | principle | 実装ではなくインターフェースに依存する | 呼ぶ側は具体的なクラスではなく、インターフェース(約束)だけを知るようにする考え方 | 守らないと、差し替えたい実装が増えるたびに呼ぶ側を書き換える | インターフェースを作って implements し、呼ぶ側の依存先をインターフェースにする | `implements`、`Strategy`、`Factory` |

## 動きの仕様

### 切り替え

- `ViewSwitch` の `学べることごと` の右に3つ目のボタン `コードの臭い図鑑`(`data-testid="roadmap-view-gallery"`)を足す。
  作りは既存の2つと同じ(`type="button"`・`aria-pressed`)。選択中だけ `aria-pressed="true"`
- 既存の `handleClosed` がそのまま `setView('stages')` するので、閉じて開き直すと `ステージ順` に戻る(追加の処理は要らない)
- 「次のおすすめ」の行と `LearningRecordSection` は、ほかの表示と同じく図鑑でも出る

### 図鑑の表示(`AntipatternGallery`、`data-testid="antipattern-gallery"`)

Props は `{ entries: readonly AntipatternEntry[]; stages: readonly Stage[]; onChoose: (stageId: string) => void }`。
`StageRoadmapDialog` からは `entries={antipatterns}`・`stages={stages}`(ストアのもの)・`onChoose={choose}` を渡す。

- 見出し `<h3>コードの臭い</h3>` の下に `kind === 'smell'` の項目、`<h3>設計の原則</h3>` の下に `kind === 'principle'` の項目を、データの並び順で出す
- 1項目は `<article className="antipattern-gallery__entry" data-testid="gallery-entry-<id>">`
  - `<h4>`: `name`
  - `<dl>`: `症状` / `symptom`、`弊害` / `harm`、`直し方` / `remedy` の3組(`<dt>`・`<dd>`)
  - `練習できるステージ:` に続けて、`practiceStages(entry, stages)` の各ステージの `title` を書いたボタン(`data-testid="gallery-stage-<stage.id>"`。同じステージが複数の項目に出るので、テストでは項目の中で探す)
  - ボタンを押したときの動きは「学べることごと」のリンクと同じ `choose`(今いるステージ以外なら `selectStage`、どちらでもダイアログを閉じる)
  - `practiceStages` が空なら、ボタンの代わりに `練習できるステージはまだありません` と出す(データの整合性テストで起きないようにするが、ステージ定義を変えたときに画面が崩れないための保険)
- クリアの有無・点数は図鑑では出さない(習得状況は「学べることごと」の領分)
- 狭い画面では1列で、既存の `.stage-roadmap__body` のスクロールに乗る

## 設計判断(確定)

1. **置き場所はステージ一覧の3つ目の表示切り替え**。別のダイアログ・ヘッダーボタンは足さない。導線を1か所にし、既存の `ViewSwitch`・`choose`・閉じたときの初期化をそのまま使える
2. **ステージとの対応はステージIDではなく `Stage.learns` のタグで引く**。ステージを足したり並べ替えたりしても、同じタグを付ければ自動で図鑑にリンクが増える。
   「Long Method」のようにタグに無い臭いも、練習に使うタグ(`Extract Method`)を `learns` に書けば引ける
3. **データは infrastructure、型と引き当ては domain**。`StoryChapter`+`storyChapters`、`ComparisonQuiz`+`comparisonQuizzes` と同じ分け方で、`practiceStages` をカバレッジ閾値のかかる domain でTDDする
4. **`term-glossary-popover` の用語データとは共有しない**。用語集は「意味(1〜2文)」で解き方を書かない、図鑑は「症状・弊害・直し方」と目的が違う。用語集はまだ未実装なので依存もしない。
   どちらかが入ったあとで、図鑑の見出しに用語のポップオーバーを付けるかは別途決める(スコープ外)
5. **`RULE_WHY` は流用しない**。`RULE_WHY` は採点ルール単位で、臭いの名前と1対1に対応しない。図鑑の `harm` は臭いの言葉で書く
6. **臭いと原則の2つに分けるのは `kind` の1フィールドだけ**。カテゴリの階層・タグの絞り込みは作らない
7. **クラス名・メソッド名をプレイヤーに付けさせる・答えさせる要素は入れない**。図鑑は読むだけで、採点にも進捗にも影響しない

## TDD対象

### `practiceStages`(domain、`src/domain/gallery/Antipattern.test.ts`)

テスト用のステージは `id` と `learns` だけを変えて作る(`src/domain/progress/roadmap.test.ts` のステージ生成のやり方に合わせる)。項目もテスト内で小さく作る。

1. `stages` が空 → `[]`
2. 項目の learns `['Feature Envy']`、ステージ A(`['Feature Envy', 'Move Method']`)・B(`['Move Method']`)→ `[A]`
3. 項目の learns `['分岐の分離', 'Strategy']`、ステージ A(`['分岐の分離']`)・B(`['Strategy', 'implements']`)・C(`['ISP']`)→ `[A, B]`
4. 1つのステージが項目の2つのタグに当たる(項目 `['カプセル化', 'private']`、ステージ A `['カプセル化', 'private']`)→ `[A]`(重複しない)
5. 並び順は `stages` の順を保つ: `stages` を C, A の順で渡し、どちらも当たる → `[C, A]`(項目の learns の順ではない)
6. 完全一致だけ: 項目 `['継承']` で、ステージ `['継承の見直し']` → `[]`
7. 項目の learns が空 → `[]`

### `antipatterns` のデータ(infrastructure、`src/infrastructure/gallery/antipatterns.test.ts`)

- `id` が重複しない
- `name`・`symptom`・`harm`・`remedy` が前後の空白を除いて空でない。`symptom`・`harm`・`remedy` は「。」が2つ以下(1〜2文)
- `learns` が空でない
- 各項目の `learns` の各タグが、`stages`(`src/infrastructure/stages/stageCatalog.ts`)のどれかのステージの `learns` に実在する(タグの書き間違い・ステージ定義側の改名を検出する)
- 各項目で `practiceStages(entry, stages)` が1件以上
- `kind` が `'smell'` の項目と `'principle'` の項目がそれぞれ1件以上ある

## 受け入れ基準

1. 「ステージ一覧」を開くと、表示切り替えに `ステージ順`・`学べることごと`・`コードの臭い図鑑` の3つが並び、開いた直後は `ステージ順` が `aria-pressed="true"`
2. `コードの臭い図鑑` を押すと、`コードの臭い` と `設計の原則` の2つの見出しの下に項目が並ぶ。`Feature Envy` の項目(`gallery-entry-feature-envy`)に 症状・弊害・直し方 の3つと、`中級6: 他人のデータばかり触るメソッド` のボタンが出る
3. `Long Method` の項目(`gallery-entry-long-method`)に、`チュートリアル1: 長いメソッドを分ける` と `チュートリアル2: 太った placeOrder` のボタンがこの順で出る
4. `Middle Man` の項目の `中級12: 横流しするだけの OrderManager` を押すと、そのステージへ移ってダイアログが閉じる(見出しが変わる)。今いるステージのボタンを押したときは、閉じるだけでステージは変わらない
5. 図鑑に切り替えて Esc で閉じ、もう一度開くと `ステージ順` に戻っている
6. 切り替えボタンと各ステージのボタンを、キーボード(Tab・Enter/Space)だけで操作できる
7. 図鑑を開いても、点数・進捗(`localStorage` の `refactor-blocks:progress`)は変わらない
8. 既存の `e2e/roadmap.spec.ts` のテストが変わらず通る。追加したテストで 1〜6 を守る
9. `npm run check` と `npm run test:e2e` が通る

## スコープ外

- 図鑑の項目ごとのクリア状況・進み具合の表示(`concept-mastery-map` の領分)
- ステージカードのタグ・クリア条件・減点の内訳から図鑑の該当項目へ飛ぶリンク(タグからの導線は `term-glossary-popover` のカード構造の変更とぶつかるため、両方入ってから別途決める)
- 用語のポップオーバー(`term-glossary-popover`)との連携・データの共有
- 図鑑内の検索・絞り込み・並べ替え・お気に入り・既読の印
- 項目ごとのコード例(ビフォー/アフターのコード片)・図・外部の解説へのリンク
- ステージ定義の `learns` の追加・改名(例: 「Long Method」タグを足すこと)。今あるタグで引く
- 白紙設計モード・設計くらべクイズへのリンク
- 図鑑の文言のAI生成・多言語化・プレイヤーによる編集
- 表示切り替えの状態の保存(開くたびに「ステージ順」から)
