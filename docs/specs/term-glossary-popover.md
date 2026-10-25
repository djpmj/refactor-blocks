# term-glossary-popover: 専門用語に点線の下線を引き、その場で短い定義を引けるようにする

## 背景・目的

新卒〜4年目の学習者の目線で実機を遊ぶと、画面のあちこちに専門用語が説明なしで出てくる。

- クリア条件(`ClearConditionList`): 「結合度: 依存先は3クラスまで」「責務の混在: 1クラス4種類まで」「空のクラス・ファイル: 0件にする」「循環依存: 輪を0組にする」「他クラスのデータを触りすぎ(Feature Envy): 0件にする」など
- ステージ一覧(`StageRoadmapDialog`)のタグ(`stage.learns`): 「Feature Envy」「貧血ドメインモデル」「Middle Man」「Collapse Hierarchy」「ISP」「Value Object」「Strategy」など
- 減点の内訳(`ScoreBreakdown`)の項目名(`RULE_LABEL`): 「結合度 ×2」「無関係なデータの塊が同居(凝集度が低い) ×1」など

減点ルールごとの「なぜ?」(`rule-why-explanations`)は**なぜ困るか**を説明するが、**用語そのものの意味**(「結合度とは」「責務とは」「Feature Envyとは」)は
どこにも無い(`rule-why-explanations` も `stage-roadmap` も用語集をスコープ外にしている)。学習者は外部で調べるか、意味が分からないまま進むことになる。

用語の語に点線の下線を引き、ホバー・フォーカス・タップで「1〜2文の定義+一言の例」を小さなポップオーバーで出す。
対象は上の3か所に限る。

## 変更対象ファイル一覧

| 種別 | パス | 層 | 役割 |
| --- | --- | --- | --- |
| 新規 | `src/domain/glossary/Glossary.ts` | domain | 型 `GlossaryTerm` / `TextSegment` と、文字列を用語とそれ以外に分ける純粋関数 `splitByTerms`(`domain/story/Story.ts` と同じく「型+純粋関数」の置き方) |
| 新規 | `src/domain/glossary/Glossary.test.ts` | domain | `splitByTerms` のテスト(先に書く) |
| 新規 | `src/infrastructure/glossary/glossaryTerms.ts` | infrastructure | 用語データ `glossaryTerms: readonly GlossaryTerm[]`(1ファイル。`storyChapters.ts` と同じ置き方) |
| 新規 | `src/infrastructure/glossary/glossaryTerms.test.ts` | infrastructure | データの整合性テスト(下記) |
| 新規 | `src/presentation/glossary/GlossaryText.tsx` | presentation | `GlossaryText`(文字列を受け取り、用語を `GlossaryTerm` ボタンで包んで描く)と、用語1つ分のボタン+ポップオーバー |
| 変更 | `src/presentation/stage/ClearConditionList.tsx` | presentation | `description.goal` を `<GlossaryText text={description.goal} />` で描く |
| 変更 | `src/presentation/stage/StageRoadmapDialog.tsx` | presentation | カードの構造を変え(下記)、タグを `GlossaryText` で描く |
| 変更 | `src/presentation/stage/ScoreBreakdown.tsx` | presentation | 「なぜ?」を開いたブロックの先頭に「ことば:」の行を足す(下記) |
| 変更 | `src/index.css` | presentation | `.glossary-term`(点線下線のボタン)と `.glossary-term__popover`、ロードマップのカードの構造変更ぶん(最小限) |
| 新規 | `e2e/glossary.spec.ts` | E2E | 開閉・キーボード・ダイアログ内のEsc(下記) |
| 変更 | `e2e/roadmap.spec.ts` | E2E | 27行目のタグの確認先を、カードの外枠(`roadmap-card-<id>`)に変える |

`application` 層は変更しない(ユースケースが無い表示データの引き当てのため)。`usePopoverDismiss`(`src/presentation/stage/usePopoverDismiss.ts`)は変更せず再利用する。新しい依存は足さない。

## データ・型の変更

```ts
// src/domain/glossary/Glossary.ts
export type GlossaryTerm = {
  readonly id: string;              // 例: 'coupling'。data-testid に使う
  readonly name: string;            // 見出し。例: '結合度'。name 自体も見つける対象に含める
  readonly aliases: readonly string[]; // 別表記。例: ['依存先']。無ければ []
  readonly definition: string;      // 1〜2文
  readonly example: string;         // 一言の例(「例:」は表示側で付ける)
};

export type TextSegment =
  | { readonly kind: 'text'; readonly text: string }
  | { readonly kind: 'term'; readonly text: string; readonly termId: string };

export function splitByTerms(text: string, terms: readonly GlossaryTerm[]): readonly TextSegment[];
```

保存形式の変更は無い(進捗・下書きに何も足さない)。

### 用語データ(`glossaryTerms.ts`、初版25語)

対象3か所に実際に出る語だけを入れる(推測で増やさない)。文言は実装者が日本語として自然に整えてよいが、**解き方(どう直すか)は書かない**(ヒントの領分)、**困りごとではなく意味を書く**(困りごとは `RULE_WHY` の領分)。

| id | name | aliases | 定義(要旨) | 例(要旨) |
| --- | --- | --- | --- | --- |
| `coupling` | 結合度 | | クラスどうしがどれだけ強く・多く依存しているか。低いほど、1か所の変更がほかへ響きにくい | `OrderService` が5つのクラスを呼んでいれば、依存先は5クラス |
| `dependency` | 依存 | 依存先 | あるクラスが、別のクラスのメソッドを呼んだりデータを使ったりしていること。呼ばれる側を依存先という | `A` が `B.save()` を呼ぶなら、AはBに依存している |
| `cycle` | 循環依存 | | 依存をたどると元のクラスに戻ってくる輪になっていること | `A` → `B` → `A` |
| `responsibility` | 責務 | | そのクラス・メソッドが受け持つ仕事。「変わる理由」が同じものを1つの責務とみなす | 「注文の計算」と「メール送信」は別の責務 |
| `cohesion` | 凝集度 | | 1つのクラスの中のデータと処理が、どれだけ同じ目的でまとまっているか。高いほどよい | 住所と在庫数を同じクラスで持っていると凝集度が低い |
| `empty` | 空のクラス・ファイル | | 中にメソッドもデータも無いクラス、クラスの無いファイル | 処理をすべて移したあとに残った `Helper` クラス |
| `encapsulation` | カプセル化 | | データを持ち主のクラスの中に閉じ込め、外からは決めたメソッド経由でしか変えさせないこと | 残高を直接書き換えさせず `withdraw()` だけを公開する |
| `visibility` | private / public | private、public、アクセス制御 | メソッドやデータを外から呼べるか(public)、自分のクラスの中だけか(private)の区別 | `private calcTax()` は他のクラスから呼べない |
| `inheritance` | 継承 | | 親クラスの性質を子クラスが引き継ぎ、違う部分だけを書き換える仕組み | `CreditPayment extends Payment` |
| `interface` | インターフェース | implements | メソッドの名前と形だけを決めた約束。クラスは `implements` でその約束を守ると宣言する | `class SmtpSender implements Sender` |
| `extract-method` | Extract Method | | メソッドの一部の処理を、名前を付けた新しいメソッドとして切り出すリファクタリング | 長い `placeOrder()` から `calcTotal()` を切り出す |
| `move-method` | Move Method | | メソッドを、それが使うデータを持つ別のクラスへ移すリファクタリング | `Order` の送料計算を `Shipping` へ移す |
| `extract-class` | Extract Class | | 1つのクラスの一部の責務を、新しいクラスとして切り出すリファクタリング | `User` から住所まわりを `Address` に分ける |
| `inline` | Inline Method / Inline Class | Inline Method、Inline Class | 役に立っていないメソッドやクラスを、呼び出し元へ戻して消すリファクタリング | 横流しするだけの `Manager` を消して直接呼ぶ |
| `merge-methods` | Merge Methods | | 同じ処理をしている複数のメソッドを1つにまとめる操作(このゲームの操作名) | 2クラスにある同じ `formatPrice()` を1つにする |
| `feature-envy` | Feature Envy | | 自分のデータより、他のクラスのデータばかり使っているメソッドのこと(コードの臭いの1つ) | `Invoice` のメソッドが `Customer` の項目ばかり読む |
| `anemic` | 貧血ドメインモデル | | データとgetter/setterだけを持ち、そのデータを使う処理が別のクラスにある状態 | `Account` は残高を持つだけで、引き出しの判定は `AccountService` にある |
| `middle-man` | Middle Man | 横流しするだけのクラス | 受け取った呼び出しを、ほぼそのまま別のクラスへ渡すだけのクラス | `Manager.save()` が `Repository.save()` を呼ぶだけ |
| `collapse-hierarchy` | Collapse Hierarchy | | 親と子の違いがほとんど無い継承を、1つのクラスにたたむリファクタリング | 子が1つしかない `BaseReport` を畳む |
| `isp` | ISP | インターフェース分離の原則 | インターフェース分離の原則。使わないメソッドまで実装させる大きなインターフェースを、役割ごとに分けるという考え方 | 印刷しかしない機械に `fax()` を実装させない |
| `value-object` | Value Object | | 金額や住所のような「値」を表す小さなクラス。中身を変えず、値が同じなら同じものとして扱う | `Money(100, 'JPY')` |
| `strategy` | Strategy | | 切り替えたい処理をインターフェースの裏に置き、実行時に差し替えられるようにする設計パターン | 割引の計算方法を会員ランクごとのクラスに分ける |
| `factory` | Factory | | どのクラスのインスタンスを作るかの判断を、1か所に集める設計パターン | 種類に応じて `CsvReport` か `PdfReport` を作る |
| `template-method` | Template Method | | 処理の流れを親クラスに書き、違う手順だけを子クラスで書き換える設計パターン | 出力の流れは共通、見出しの書き方だけ子が決める |
| `layer` | レイヤー(層) | 層 | 役割ごとにクラスを段に分け、依存を上の段から下の段への一方通行にする構成 | Controller → Service → Repository |

## 動きの仕様

### 用語の見つけ方(`splitByTerms`)

- 文字列を左から走査し、各位置で**全用語の `name` と `aliases` のうち最も長く一致するもの**を用語とする(例: 「循環依存」は「依存」より優先)
- 一致したら、その分だけ進めて走査を続ける。一致しなければ1文字進める。**同じ用語が何度出ても全部包む**
- 英字で始まる・終わる表記は、その外側が英数字なら一致させない(「ISP」は「DISPLAY」の中では一致しない)。日本語の文字との境目は区切りとみなす(「未使用のprivateメソッド」の「private」は一致する)
- 大文字小文字は区別する(表記はデータ側でそろえる)。空文字の表記は無視する
- 隣り合う `text` は1つにまとめて返す。空文字列なら `[]`

### 表示(`GlossaryText` / 用語ボタン)

- 用語の部分は `<button type="button" className="glossary-term">` で描く。見た目は周りの文字と同じ書体・色で、**点線の下線**とカーソル `help` だけを付ける(フォーカス時は `:focus-visible` の枠を出す)。`data-testid="glossary-term-<id>"`
- ボタンとポップオーバーを `<span className="glossary-term-wrap">`(`position: relative`、`display: inline`)で包む。ポップオーバーはその下に `position: absolute` で出す(最大幅 240px 程度)
- ポップオーバーの中身: 見出し(`name`、太字)/ `definition` / 「例: 」+ `example`。`data-testid="glossary-popover-<id>"`
- 開く: ラッパーへの `mouseenter`、ボタンの `focus`、ボタンの `click`(タップ)。`click` はトグルではなく「開く」にする(タッチ端末でタップ時の疑似ホバーとクリックが打ち消し合わないように)
- 閉じる: ラッパーからの `mouseleave`(ポップオーバーの上にマウスを移しても閉じない。WCAG 1.4.13)、ボタンの `blur`、`usePopoverDismiss` による Esc と外側の `pointerdown`
  - `usePopoverDismiss(open, wrapRef, buttonRef, close)` をそのまま使う。Esc でボタンにフォーカスが戻るとき、その `focus` で開き直さないよう、`close` の中で「次の focus を無視する」フラグを立て、`queueMicrotask` で下ろす(`.focus()` は同期で focus イベントを出すため、これで足りる)
- 用語ボタン1つずつが自分の `open` を持つ(ストアには持たない)

### スクリーンリーダー

- ポップオーバーの要素は**常に描画**し、`hidden={!open}` と `aria-hidden="true"` を付ける。`id` は `useId()`
- ボタンには常に `aria-describedby={popoverId}` を付ける。accname の仕様上、`aria-describedby` の参照先は隠れていても読まれるので、**フォーカスするだけで定義が読み上げられる**(見た目で開いているかに関係なく)
- `aria-hidden` にする理由: クリア条件の `<ul aria-live="polite">` の中で開閉したとき、定義が達成の通知と一緒に読み上げられないようにするため
- `role="tooltip"` は付けない(`aria-hidden` の要素に役割を付けても意味が無いため)。`aria-expanded` も付けない(開閉はホバーと連動する補助表示で、操作対象のパネルではないため)

### 3か所への適用

1. **クリア条件**: `ClearConditionList` の `clear-condition__goal` の中身を `<GlossaryText text={description.goal} />` にする。`li` の `aria-label`(`conditionLabel`)・`describeCondition` の文言は変えない
2. **ステージ一覧のタグ**: いまはカード全体が `<button>` で、その中にタグがあるため、ボタンの中にボタンは置けない。カードを次の構造に変える
   - 外枠 `<div className="stage-roadmap__card ...--current" data-testid="roadmap-card-<id>">`(枠線・背景・現在の強調は外枠に移す)
   - その中の `<button className="stage-roadmap__choose" data-testid="roadmap-stage-<id>" aria-current>`: タイトルと状態(未挑戦・点数・おすすめ)。押すとこれまでどおりステージを選ぶ
   - ボタンの外(下)にタグの列 `stage-roadmap__learns`。各タグの中身を `<GlossaryText text={item} />` にする
   - タグの用語を押してもステージは選ばれない(用語のポップオーバーが開くだけ)
3. **減点の内訳**: 項目名は `focusRule` のボタンの中にあり、そこへは包めない。そこで「なぜ?」を開いたブロック(`score-breakdown__why`)の先頭に、`RULE_LABEL[rule]` に用語が1つ以上見つかるときだけ `<p className="score-breakdown__terms">ことば: <GlossaryText text={RULE_LABEL[rule]} /></p>` を足す(見つからなければ行ごと出さない)。`WhyText` の文言・ジャンプの挙動は変えない

## 設計判断(確定)

- **データは infrastructure、型と見つけ方は domain**: `StoryChapter`(domain)+`storyChapters`(infrastructure)、`ComparisonQuiz`+`comparisonQuizzes` と同じ分け方。`splitByTerms` を domain に置くことで、カバレッジ閾値のかかる層でTDDできる
- **最長一致・全出現を包む**: 「循環依存」と「依存」のように包含関係のある語があるため最長一致が要る。「最初の1回だけ」にする工夫は、対象の文字列が短く同じ語が2回出ることがほぼ無いので入れない(YAGNI)
- **トリガーは `<button>`**: ホバーだけではキーボード・タッチで引けない。`<abbr title>` やネイティブの `title` はタッチで出ず、Escで消せないため使わない
- **`aria-describedby`+常時描画+`aria-hidden`**: 開閉の状態に関係なく、フォーカスで定義が読まれる。ライブ領域の中での二重読み上げも避けられる
- **ポップオーバーは portal にしない**: ステージ一覧は `showModal()` のトップレイヤーにあり、`document.body` へ出すとダイアログの裏に隠れる。CSS の絶対配置で足りる
- **ロードマップのカードを分割する**: ボタンの中にボタンを入れるのはHTMLとして不正で、キーボード操作もできない。押せる範囲がタイトル+状態の部分に狭まるが、カードの大部分は残る
- **減点の内訳は「なぜ?」の中に置く**: 項目名のボタン(ジャンプ)を分割すると #58 の挙動とE2Eに広く響く。「なぜ?」を開く人が意味も知りたい人なので、そこに置けば足りる
- **Escの開き直し防止は `queueMicrotask` のフラグ**: `usePopoverDismiss` を変えずに再利用するため。フック側に「フォーカスを戻さない」引数を足すことも考えたが、既存の3つのポップオーバーに影響するので避けた

## TDD対象

### `splitByTerms`(domain、`src/domain/glossary/Glossary.test.ts`)

テスト用の用語は、テスト内で小さく作る(`glossaryTerms` には依存しない)。

- 空文字列 → `[]`
- 用語を含まない文字列 → `[{ kind: 'text', text: 元の文字列 }]`
- 文字列の途中に用語 1つ(「結合度: 依存先は3クラスまで」と用語 結合度・依存(別表記 依存先))→ `[term 結合度, text ': ', term 依存先(termId: dependency), text 'は3クラスまで']`
- 文字列全体が用語 → `[term]` だけ(前後に空の text を付けない)
- 最長一致: 用語「依存」と「循環依存」があるとき、「循環依存: 輪を0組にする」 → 先頭は `循環依存`(termId: cycle)
- 別表記と name の最長一致: name「Inline Method / Inline Class」、別表記「Inline Method」「Inline Class」 → 「Inline Method / Inline Class」全体が1つの term
- 同じ用語が2回 → 2つとも term
- 隣り合う用語(間に文字が無い)→ term が2つ続く
- 英字の境界: 用語「ISP」で「DISPLAY」 → text だけ。「ISPを守る」 → `ISP` が term
- 日本語との境目: 用語「private」で「未使用のprivateメソッド」 → `private` が term
- 大文字小文字: 用語「Strategy」で「strategy」 → text だけ
- 空文字の別表記(`aliases: ['']`)を持つ用語があっても、無限ループせず、空の term を作らない
- 用語の配列が空 → 元の文字列1つの text

実装は O(文字数 × 表記数) の素朴な走査でよい。`// ponytail: 表記数×文字数の素朴な走査。数百語・長文に広げるときは表記を長さ順の正規表現1本にまとめる` を残す。

### `glossaryTerms` のデータ(infrastructure、`glossaryTerms.test.ts`)

- `id` が重複しない
- `name` と `aliases` を全用語で合わせて、表記が重複しない(重複すると最長一致で同じ長さが2つになり、どちらになるか決まらない)
- `name`・`definition`・`example` が前後の空白を除いて空でない。`definition` は「。」が2つ以下(1〜2文)
- `stages`(`stageCatalog`)の全ステージの `learns` のうち、英字を含むタグ(「Extract Method」「ISP」など)は、`splitByTerms` で用語が1つ以上見つかる(タグを足したときの用語の書き忘れを検出する)

## 受け入れ基準

1. クリア条件に「結合度: 依存先はNクラスまで」が出るステージで、「結合度」「依存先」に点線の下線が付く。「結合度」にマウスを乗せると、見出し・定義・「例: …」のポップオーバーが出る。ポップオーバーの上へマウスを移しても消えず、外へ出すと消える
2. Tab で「結合度」にフォーカスするとポップオーバーが出る。Esc で消え、フォーカスは「結合度」のボタンに残り、ポップオーバーは開き直らない。Tab で次へ移ると消える
3. 用語のボタンに `aria-describedby` があり、その参照先の要素のテキストに定義が含まれる(閉じているときも)
4. 用語をクリック(タップ)するとポップオーバーが出て、画面の別の場所を押すと消える
5. ステージ一覧を開くと、「Feature Envy」「Middle Man」「ISP」などのタグに点線の下線が付く。タグの用語を押すとポップオーバーが出て、**ステージは切り替わらず、ダイアログも閉じない**。カードのタイトル部分(`roadmap-stage-<id>`)を押すと、これまでどおりそのステージへ移る
6. ステージ一覧で用語のポップオーバーを開いたまま Esc を押すと、ポップオーバーだけが閉じてダイアログは開いたまま。もう一度 Esc でダイアログが閉じる
7. 減点の内訳で「結合度 ×N」の「なぜ?」を開くと、先頭に「ことば: 結合度」の行が出て、「結合度」から定義を引ける。用語を含まない項目(例: 「極小メソッドの量産」)では「ことば:」の行が出ない。「なぜ?」の既存の文言・ジャンプの挙動は変わらない
8. 用語の無い文字列(例: クリア条件「行数: …」)は、見た目もDOMもこれまでどおり(ボタンが入らない)
9. 採点・点数・`describeCondition`・`RULE_LABEL`・`RULE_WHY` の文言は変わらない
10. 既存の `e2e/roadmap.spec.ts` は、27行目のタグの確認先を `roadmap-card-tutorial-extract-method` に変えるだけで通る。`e2e/selectStage.ts`・`explore/stage-invariants.spec.ts` の `roadmap-stage-` の使い方はそのまま動く
11. `e2e/glossary.spec.ts` で 1・2・3・5・6・7 を守る
12. `npm run check` と `npm run test:e2e` が通る

## スコープ外

- 3か所以外(ヒント、うわさ、変更依頼、メソッドエディタ、`RULE_WHY` の本文、物語、概念チェック、白紙設計、設計くらべクイズ、キャンバスのノード)への適用
- 減点の内訳の項目名ボタンそのものを分割して、項目名の中の語に直接下線を引くこと(ジャンプの挙動・#58 のE2Eに広く響くため)
- 用語集の一覧画面・検索・用語どうしの相互リンク・外部の解説へのリンク(`stage-roadmap` のスコープ外の「用語集へのリンク」も今回はやらない)
- 減点ルールの「なぜ困るか」の説明(既存の `rule-why-explanations`。用語の定義とは別物として残す)
- ステージごとの理由(`why`)・ヒントとの統合
- ポップオーバーが画面端やサイドパネルのスクロール領域で切れたときの位置の自動調整(はみ出したら、`context-menu-viewport-clamp` と同じ考え方で別途対応する)
- 大文字小文字・表記ゆれ(全角英字など)のあいまい一致
- 用語の定義をAIで生成・補足すること、多言語化、プレイヤーが編集できるようにすること
- 一度見た用語の記録・既読の印
