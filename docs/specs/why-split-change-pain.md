# 「なぜ分けるのか」を体験させる(変更の痛みカード+達成時の理由)

## 背景・目的

プレイヤーは減点を消すために責務を分けてクラスを作るが、**問題を解いても「なぜ分けるのか」が分からない**。

- 採点(行数・責務の混在・結合度)は「ルールを満たす作業」になりやすく、分けて何が嬉しいかを伝えない
- 「分けると変更が楽になる」を体験させる変更依頼(`change-request`)は、**100点になるまで押せない**。分ける前に困る体験が無い
- ステージの課題文(`goal`)は「何をするか」で、理由は書かれていない

そこで次の2つを足す。

1. **変更の痛みカード(先に困る)**: ステージ画面の左サイドバーに「もし、この変更が来たら?」のカードを常に出す。
   そのステージの変更依頼(ルールの変更)を**初期のコードに当てたとき、何か所を直す必要があるか**を、リファクタリングを始める前から見せる。
   分けていくと「今のコードなら何か所で済むか」の数字がリアルタイムに減る。
2. **達成時の理由(なぜを言葉にする)**: 100点になったら、同じカードに**そのステージの「なぜ分けたか」の一言**と、変更の手間が減った事実
   (「5か所 → 1か所」)を出す。サイドバーが閉じていても気づけるよう、初めて100点になったときに自動で開く。

採点・点数・既存の変更依頼(挑戦・結果表示)の挙動は変えない。

## 変更対象ファイル一覧

| パス | 層 | 新規/変更 | 役割 |
| --- | --- | --- | --- |
| `src/domain/stage/Stage.ts` | domain | 変更 | `why: string`(必須。「なぜ分けるのか」の1〜2文)を追加 |
| `src/domain/change/changePain.ts` + `.test.ts` | domain | 新規 | `measurePain`: 初期のコードと今のコードで、変更依頼1件の手間を比べる純粋関数(TDD、下記) |
| `src/infrastructure/stages/*Stages.ts` | infrastructure | 変更 | 全ステージに `why` を足す(下記の書き方) |
| `src/infrastructure/stages/stageCatalog.test.ts` | infrastructure | 変更 | 全ステージの `why` が空でないこと、変更の痛みを測れること(下記) |
| `src/presentation/stage/ChangePainCard.tsx` | presentation | 新規 | 変更の痛みカード(下記) |
| `src/presentation/stage/describePain.ts` | presentation | 新規 | カードの文言(場所の表示名、「N か所 → M か所」)を作る関数 |
| `src/presentation/stage/StagePanel.tsx` | presentation | 変更 | サイドバー(課題とヒント)に `ChangePainCard` を置く。初めて100点になったときにサイドバーを自動で開く |
| `src/index.css` | presentation | 変更 | `.change-pain` のスタイル |
| `e2e/change-pain.spec.ts` | E2E | 新規 | 開始時に痛みが出る、分けると数字が減る、100点で「なぜ」が出る(下記) |

`application` 層の変更は無い(`measureChange` を呼ぶだけの純粋関数を `domain/change/` に足す)。

## 見た目・内容の仕様

### 変更の痛みカード(`ChangePainCard`)

左サイドバーの「課題とヒント」の中、課題文(`goal`)とヒントの間に置く。リファクタリングのモードのときだけ。変更依頼の調査・実装中(`changeSession !== null`)は出さない。

**対象の変更依頼**: そのステージの `changeRequests` のうち、最初の `kind` が `'modify'`(省略含む)のもの。無ければカードごと出さない。

**100点になるまで**(`score.total < 100`)

- 見出し: `もし、この変更が来たら?`
- 依頼の見出し(`request.title`)と説明(`request.description`)
- 「**直す場所は今 N か所**(M クラス・K ファイル)」(今のコードでの数字。`<strong>` で強調)
- 初期から数字が減っているときは、続けて「(最初は P か所でした)」
- 直す場所の一覧: 今のコードでの該当メソッドを `クラス名.メソッド名` の箇条書きで出す(最大6件、超えたら「ほか n 件」)
- 理由はまだ出さない(自分で気づく余地を残す。答えは100点で見せる)

**100点になったら**(`score.total >= 100`)

- 見出し: `なぜ分けるのか`
- そのステージの `why` の文章
- 変更の手間が減っていれば(`improved`)、「同じ変更が **P か所 → N か所** で済むようになりました」。減っていなければ、この行は出さない(嘘の「改善」は出さない)
- 最後に1行: 「『変更依頼に挑戦』で、実際に確かめてみましょう」(ボタンの案内。ボタン自体は既存)

**サイドバーの自動オープン**: 狭い画面ではサイドバーが閉じて始まる(`sidebarOpen` の初期値)。そのステージで**初めて100点になったとき**に、サイドバーを自動で開く。
ステージを切り替えたら、その記録は忘れる(ヒントの `revealed` と同じ作法)。取り消して100点を割って再び100点になっても、同じステージでは2度目は開かない(プレイヤーが閉じたものを開き直さない)。

**アクセシビリティ**: カードは `<section aria-labelledby>`。数字の更新は `aria-live="polite"`(スコアバッジと同じ)。色だけに頼らない。

### `why` の書き方(全ステージ)

1〜2文、日本語。そのステージの題材に即して、**変更理由が混ざっていると何が困るか → 分けるとどうなるか**を言う。用語の説明ではなく「変更が来たとき」の話にする。例:

- 悪い例: 「責務を分けるとSRPを満たす」
- 良い例: 「メールの文面を変えるだけなのに、ユーザー登録の処理まで読み直すことになっていました。通知を `Mailer` に分けたので、文面の変更は `Mailer` だけを見れば済みます」

ステージの課題・採点・ヒントの内容と矛盾させない。解答をそのまま教えるのではなく、理由を述べる文にする(解き方の手順はヒントの領分)。
対象は `stageCatalog` の全ステージ(チュートリアル2・初級2・中級8・上級8、計20)。

## データ・型の変更

`src/domain/stage/Stage.ts`:

```ts
export type Stage = {
  // …既存
  /** 100点になったときに見せる「なぜ分けるのか」。変更が来たときに何が楽になるかを、題材に即して1〜2文で書く。 */
  readonly why: string;
};
```

`src/domain/change/changePain.ts`:

```ts
export type PainSummary = {
  /** 変更が必要なメソッドのID(`findChangeSites`)。 */
  readonly siteIds: readonly string[];
  readonly classes: number;
  readonly files: number;
};

export type ChangePain = {
  readonly request: ChangeRequest;
  readonly initial: PainSummary;
  readonly current: PainSummary;
  /** 手間が減ったか(今の `siteIds.length` が初期より小さい。同じなら今のクラス数・ファイル数で比べて、どちらかが小さければ true)。 */
  readonly improved: boolean;
};

/** そのステージで痛みを見せる変更依頼(最初の 'modify')。 */
export function painRequestOf(stage: Pick<Stage, 'changeRequests'>): ChangeRequest | undefined;

/** 初期のコードと今のコードに同じ変更依頼を当てた手間を比べる。依頼が無い、またはどちらかのコードに変更箇所が無い(`measureChange` が失敗)なら undefined。 */
export function measurePain(stage: Pick<Stage, 'codebase' | 'changeRequests' | 'limits'>, current: Codebase): ChangePain | undefined;
```

`measureChange` の結果(`sites`・`classesTouched`・`filesTouched`)を `PainSummary` に写すだけにする(数え方を複製しない)。

## TDD対象の純粋関数

### `painRequestOf`

1. `changeRequests` の中で最初の `modify`(`kind` 省略を含む)を返す
2. 先頭が `extend` で、2番目が `modify` なら、2番目を返す
3. `modify` が1件も無い(`extend` だけ・空)なら `undefined`

### `measurePain`

1. 今のコード = 初期のコードなら、`initial` と `current` が同じ内容で、`improved` は `false`
2. 変更箇所のメソッドを別のクラスへ集約したコード(テストで組み立てる)では、`current.siteIds.length` が小さくなり `improved` が `true`
3. 変更箇所の数が同じでも、クラス数・ファイル数が減っていれば `improved` が `true`
4. 変更箇所の数・クラス数・ファイル数が増えたコードでは `improved` は `false`
5. 変更依頼が無い → `undefined`
6. 今のコードから依頼の責務の処理がすべて消えている(`measureChange` が `no-sites`)→ `undefined`

### ステージカタログ(`stageCatalog.test.ts`)

全ステージについて、`why` が空文字でない(前後の空白を除く)こと。`painRequestOf` があるステージでは、`measurePain(stage, stage.codebase)` が `undefined` でないこと(初期状態でカードが出せる)。

## 受け入れ基準

- `npm run check` が通る
- `npm run test:e2e` が通る
- ステージを開くと(例: 初級1)、サイドバーに「もし、この変更が来たら?」と、直す場所の数・一覧が出る
- 責務を分ける操作(Move Method・Extract など)をすると、「直す場所は今 N か所」の N が減る。「(最初は P か所でした)」が出る
- 100点になるまで、`why` の文章は出ない
- 100点になると、見出しが「なぜ分けるのか」に変わり、そのステージの `why` が出る。手間が減っていれば「P か所 → N か所」も出る
- サイドバーが閉じていても、初めて100点になったときに開く。閉じ直したあと、同じステージで100点を割って戻っても、開き直さない
- ステージを切り替えると、上記の「初めて」が初期化され、別ステージのカードに切り替わる
- 変更依頼の調査・実装中はカードを出さない
- 全20ステージに `why` があり、題材に即した内容になっている
- 設計くらべ・白紙設計のモード、既存の採点・点数表示・変更依頼の結果表示が変わらない

## スコープ外

- 変更の痛みの場所をキャンバス上でハイライトすること(`score-jump-to-violations` の強調の仕組みが入ったあとに、流用を検討する)
- 変更依頼ボタンの解放条件(100点)の緩和・100点前の変更依頼の実装体験
- `extend` の依頼(機能の追加)の痛みの表示(置き方の採点で見せているため)
- 100点以外のタイミング(減点ごと)の理由の表示、AIによる理由の生成・問い返し(ソクラテス式講評)
- `why` の多言語化・プレイヤーが編集できるようにすること
- ステージ選択画面での `why` の表示
