# 「種類を足すとき既存コードを書き換える痛み」を見せる(機能の追加の痛み+中級9)

> **前提**: `why-split-change-pain`(Issue #60)のマージ後に実装する。`ChangePainCard` と `src/domain/change/changePain.ts` に足す形で作る。
> 中級9は `missed-fix-experience`(Issue #62)も「中級9」を名乗る。**先にマージされた方が中級9、あとの方が中級10**にする(実装者がマージ済みの
> `stageCatalog` を見て番号を決める)。

## 背景・目的

「なぜオブジェクト指向を使うのか」が伝わっていない。上級3(Strategy)・上級2(インターフェース)はオブジェクト指向の本題に答えるが、
そこへ着くまでに「分けると何が嬉しいか」を感じる機会が無い。

オブジェクト指向(継承・インターフェース)の一番わかりやすい利点は、**種類が増えたとき、既存のコードを書き換えずに新しいクラスを足すだけで済む**こと。
逆に、種類ごとのif分岐でできたコードは、種類が増えるたびに**既存のクラスを開いて書き換える**ことになり、そのたびに既存の動作を壊すおそれがある。

#60 の変更の痛みカードは「ルールの変更(`modify`)」だけを扱う。**機能の追加(`extend`)**の依頼は、100点後の「実装」でしか体験できない。
そこで次の2つを足す。

1. **機能の追加の痛み**: 変更の痛みカードに、`extend` の依頼も出す。「新しい種類を足すとしたら、今のコードでは**既存のクラスを何個書き換える**ことになるか」を、
   最善の置き方で見せる。オブジェクト指向に組み替えると「0個(新しいクラスを足すだけ)」になる。
2. **オブジェクト指向の入口になる中級ステージ**: 会員ランクごとのif分岐が、価格と送料の2クラスに散らばるコード。ランクごとのクラスに組み替えると、
   「ゴールド会員を追加して」が、既存クラスに触らず新しいクラス1つで済む。上級3(割引のStrategy)より前に、同じ発想を小さく体験させる。

採点・既存の変更依頼の実装/結果表示・#60 の `modify` のカードは変えない。

## 変更対象ファイル一覧

| パス | 層 | 新規/変更 | 役割 |
| --- | --- | --- | --- |
| `src/domain/change/changePain.ts` + `.test.ts` | domain | 変更 | `painRequestOf` を `modify` と `extend` の両方に広げる。`measureExtendPain` を新規追加(下記) |
| `src/presentation/stage/ChangePainCard.tsx` | presentation | 変更 | `extend` のブロックを足す(下記) |
| `src/presentation/stage/describePain.ts` | presentation | 変更 | `extend` の文言を作る |
| `src/infrastructure/stages/intermediateStages.ts` / `stageCatalog.ts` | infrastructure | 変更 | 中級9(または10)「会員ランクごとのif分岐」を足す(下記) |
| `src/infrastructure/stages/stageCatalog.test.ts` | infrastructure | 変更 | 新ステージの検証(下記)。ほかの `extend` を持つステージ(上級2・上級8)でカードが出せること |
| `src/index.css` | presentation | 変更 | 必要なら最小限 |
| `e2e/change-pain.spec.ts` | E2E | 変更 | `extend` のブロックが出る、組み替えると「0個」になる |

`application` 層の変更は無い。`sampleImplementation`・`measurePlacement` の既存の関数を再利用する(置き方の探索と数え方を複製しない)。

## 見た目・内容の仕様

### 機能の追加のブロック(`ChangePainCard`)

#60 のカードの中に、`modify` のブロックと並べて出す(その順)。リファクタリングのモードのときだけ。変更依頼の調査・実装中は出さない。
対象の依頼は、`changeRequests` のうち**最初の `extend`**。`extend` が無ければこのブロックは出さない(`modify` が無く `extend` だけのステージでは、このブロックだけでカードを出す)。

**100点になるまで**

- 小見出し: `新しい種類を足すなら?`
- 依頼の見出し(`request.title`)と説明
- 「今のコードでは、最善の置き方でも**既存の N クラスを書き換えます**」(`<strong>`)。N が1以上のとき、書き換えるクラス名の一覧(最大6件)
- 初期から N が減っているときは「(最初は P クラスでした)」
- N が0のときは「**既存のクラスを書き換えずに、新しいクラスを足すだけで済みます**」(`<strong>`)
- 理由はまだ出さない

**100点になったら**

- N が初期より減っていれば、「既存の P クラスを書き換えていたのが、**N クラス**で済みます」。減っていなければ、この行は出さない(嘘の改善は出さない)
- `modify` のブロックが先にあれば、そちらの `why`(#60)はそのまま。`extend` のブロックだけのステージでは、`why` の文章を見出し「なぜ分けるのか」の下に出す(#60 の挙動を `extend` だけのときにも適用する)

### 中級9「会員ランクごとのif分岐」(番号は前提の注意を参照)

- `id: 'intermediate-member-rank-branching'`、`level: 'intermediate'`、`title: '中級9: 会員ランクごとのif分岐をクラスに分ける'`(番号は実装時に確定)
- 題材: `PriceCalculator.calculatePrice`(価格)と `ShippingCalculator.calculateShipping`(送料)が、会員ランク(通常・プレミアム・VIP)ごとの分岐を**それぞれ**持つ。
  各分岐は別のFragment(責務は `price-regular`/`price-premium`/`price-vip`、`shipping-regular`/… のようにランクごと)。
  契約だけを持つ(`fragments: []`)インターフェース役 `MemberRank`(`calculatePrice` と `calculateShipping` の2メソッド)が用意されているが、どのクラスとも結ばれていない
- 解き方: 各分岐を Extract Method で抜き出し、ランクごとの新しいクラス(`RegularRank` / `PremiumRank` / `VipRank`)へ Move Method で集め、
  3クラスとも `MemberRank` を実装(implements)する。**1クラスが価格と送料の両方を持つ**ので、ランクの追加が1クラスで済むことが体験できる
  (既存の操作だけで解ける。新しい操作・概念は作らない)
- 制限値・`dependencyLimit`・`responsibilityLimit` は、初期状態は100点にならず、模範解答(ランクごとのクラス+implements)で100点になる値にする。
  Extract Method だけで同じクラスに残した場合は100点にならないよう、制限値で調整する(模範解答と抜け道の両方を `stageCatalog.test.ts` で検証する)
- `changeRequests`: `kind: 'extend'` の「ゴールド会員を追加して」(1件目)。`kind: 'modify'` の「プレミアムの送料を変えて」(2件目)。`partName` を全件に書く
- `why`(#60 の必須項目): 「会員ランクが増えるたびに、価格と送料の2つのクラスを開いて分岐を足していました。ランクごとのクラスにしたので、新しいランクはクラスを1つ足すだけで済み、既存のコードを壊す心配がありません」
- 上級3(割引のStrategy)とは題材・解き方を変える(上級3は受け皿が割引1メソッド。こちらは価格と送料の2メソッドを1クラスにまとめる入口)

## データ・型の変更

`src/domain/change/changePain.ts`:

```ts
/** 'modify' とは別に、機能の追加の依頼を痛みの対象にする。 */
export function painRequestsOf(stage: Pick<Stage, 'changeRequests'>): { readonly modify?: ChangeRequest; readonly extend?: ChangeRequest };

export type ExtendPain = {
  readonly request: ChangeRequest;
  /** 最善の置き方(`sampleImplementation`)をしたときに、書き換えることになる既存クラスのID(挑戦前のコードにあるクラス)。 */
  readonly initialModified: readonly string[];
  readonly currentModified: readonly string[];
  /** 最善の置き方の説明。新しいクラスなら実装するインターフェース名。 */
  readonly currentTarget: SampleTarget;
  readonly improved: boolean; // currentModified.length < initialModified.length
};

/** 初期のコードと今のコードで、機能の追加の依頼を最善の置き方で入れたとき、既存のクラスを何個書き換えるかを比べる。解答例が作れない(`sampleImplementation` が undefined)なら undefined。 */
export function measureExtendPain(stage: Pick<Stage, 'codebase'>, current: Codebase, request: ChangeRequest): ExtendPain | undefined;
```

#60 で追加した `painRequestOf`(最初の `modify` を返す)は、呼び出し元を `painRequestsOf` に置き換えて消す(重複した判定を残さない)。
`measureExtendPain` は `sampleImplementation(base, request)` の `codebase` と `measurePlacement(base, sample.codebase, request)` の `modifiedClassIds` を使う。

`// ponytail: 痛みは「既存クラスを書き換える数」で数える。実務では1クラスの中の複数メソッドを直すが、部品は1メソッドなので1クラスと数える。種類ごとの分岐が複数メソッドに散らばる感覚が弱いと分かったら、分岐の数を数えるタグをFragmentに足す`

## TDD対象の純粋関数

### `painRequestsOf`

1. `modify` と `extend` の両方があれば、それぞれ最初のものを返す
2. `modify` だけ・`extend` だけなら、片方だけを返す(もう片方は `undefined`)
3. 先頭が `extend` でも、`modify` を別に返す(順番に依らない)
4. どちらも無ければ両方 `undefined`

### `measureExtendPain`

1. 分岐の1クラスしか無いコード(インターフェース役が無い)では、`initialModified` が1クラス、`currentTarget` が `existing-class`
2. インターフェース役のクラスがあって、既存クラスに触らず新しいクラスで実装できるコードでは、`currentModified` が空、`currentTarget` が `new-class`(`implementing` はそのインターフェース名)、`improved` が `true`
3. 今のコード = 初期のコードなら、`initial` と `current` が同じで `improved` は `false`
4. 解答例が作れない(置き先の候補がすべて失敗する)コードでは `undefined`

### ステージカタログ(`stageCatalog.test.ts`)

1. 新ステージの初期状態は100点にならない。模範解答(Extract → ランクごとのクラスへ Move → implements)で100点になる
2. 新ステージで、Extract Method だけして同じクラスに残した状態は100点にならない(抜け道が塞がっている)
3. 初期状態で `measureExtendPain` の `initialModified` が1以上、模範解答では `currentModified` が空(0クラス)
4. 新ステージに `why` があり、`extend` の依頼に `partName` がある
5. `extend` の依頼を持つ既存ステージ(上級2・上級8)で、`measureExtendPain` が `undefined` でない(カードが出せる)

## 受け入れ基準

- `npm run check` が通る
- `npm run test:e2e` が通る
- 新ステージ(中級9または10)を開くと、サイドバーのカードに「新しい種類を足すなら?」と「既存の N クラスを書き換えます」が出て、書き換えるクラス名が一覧に出る
- ランクごとのクラスに組み替えて `MemberRank` を実装すると、「既存のクラスを書き換えずに、新しいクラスを足すだけで済みます」に変わる。「(最初は P クラスでした)」も出る
- 100点で、「既存の P クラスを書き換えていたのが、0クラスで済みます」が出る
- Extract Method だけで同じクラスに分岐を残しても、「書き換えます」のまま(数字が0にならない)で、100点にもならない
- `extend` を持つ既存ステージ(上級2・上級8)にも、`extend` のブロックが出る。`extend` を持たないステージでは出ない
- #60 の `modify` のブロックの表示・`why`・サイドバーの自動オープンが変わらない
- 新ステージが既存のステージ選択に並ぶ。他のステージの採点・点数・進捗が変わらない

## スコープ外

- 分岐(if/switch)をデータとして持つ新しい型の追加。分岐は既存のFragmentで表す(`advanced-discount-strategy` と同じ制約。実行時の切り替えは表現しない)
- 種類ごとの分岐が複数メソッドに散らばる数を数えること(必要と分かったら上記 ponytail のとおり別の仕様にする)
- 新しい操作(ポリモーフィズムの実行・DIコンテナなど)
- 上級3・上級2の題材や採点の変更
- 手で直すシミュレーション(`missed-fix-experience` の領分)
- 白紙設計モード・設計くらべクイズへの適用
