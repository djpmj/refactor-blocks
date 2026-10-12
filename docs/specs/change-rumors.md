# change-rumors: 後から来る変更依頼を「うわさ」として先に見せ、変更依頼の結果で回収する

## 背景・目的

設計の妙味は、「動くコードを、未来の変更に強いコードに組み替える」ことにある。
ところが今のゲームでは、組み替えの判断の手がかりがルールの点数(行数・責務の混在など)しかない。
「変わりそうな場所で分ける」という、設計で一番大事な動機が働かない。

`post-perfect-flow`(#160)で、ステージの1件目の modify の依頼は冒頭の手直しで全文を見せるようになった。
extend の依頼も、100点前のカード(`ChangePainCard` の「新しい種類を足すなら?」)で全文が見えている。
一方、それ以外の依頼は「変更依頼に挑戦」で突然届くので、組み替えのときに備えようがない。

そこで、まだ見せていない依頼を、全文ではなくぼかした**うわさ**として、ステージを開いたときからサイドバーに出す
(例:「経理の人が、レポートの表の見せ方をそのうち変えたいと言っていたらしい」)。
変更依頼でそのうわさが本当になったら、依頼票と結果画面で**回収**する。
「うわさに備えた設計だったので、既存のクラスを触らずに済んだ」/「備えきれず、既存の2クラスに手を入れた」と結びつける。

## 変更対象ファイル一覧

| 種別 | パス | 層 | 役割 |
| --- | --- | --- | --- |
| 変更 | `src/domain/change/ChangeRequest.ts` | domain | `ChangeRequest` に任意の `rumor` を足す |
| 新規 | `src/domain/change/rumors.ts` | domain | うわさとして見せる依頼を選ぶ純粋関数 |
| 新規 | `src/domain/change/rumors.test.ts` | domain | 上のテスト |
| 新規 | `src/presentation/change/describeRumorPayoff.ts` | presentation | 変更依頼の結果から回収の文を作る純粋関数 |
| 新規 | `src/presentation/change/describeRumorPayoff.test.ts` | presentation | 上のテスト |
| 新規 | `src/presentation/stage/RumorList.tsx` | presentation | サイドバーの「気になるうわさ」欄 |
| 変更 | `src/presentation/stage/StagePanel.tsx` | presentation | サイドバーに `RumorList` を置く |
| 変更 | `src/presentation/change/ChangeRequestPanel.tsx` | presentation | 依頼票と結果カードに回収の表示を足す |
| 変更 | `src/index.css` | presentation | うわさ欄・回収の表示のスタイル |
| 変更 | `src/infrastructure/stages/tutorialStages.ts` / `beginnerStages.ts` / `intermediateStages.ts` / `advancedStages.ts` | infrastructure | うわさの対象になる依頼すべてに `rumor` を書く |
| 変更 | `src/infrastructure/stages/stageCatalog.test.ts` | infrastructure | うわさの書き漏れ・答えの書きすぎを防ぐテスト |
| 新規 | `e2e/change-rumors.spec.ts` | E2E | うわさ欄の表示と、変更依頼での回収を確かめる |

`application` は変更しない(`ChangeOutcome` はそのまま使う)。

## データ・型の変更

```ts
// src/domain/change/ChangeRequest.ts
/** 依頼が届く前に流れてくる、ぼかしたうわさ。何が変わりそうか(変更の軸)だけを書き、どう作るか(置き場所・部品名)は書かない。 */
export type ChangeRumor = {
  /** 誰から聞いた話か。storyChapters の登場人物と同じ書き方(例: '営業の佐藤さん')。 */
  readonly from: string;
  /** うわさの本文。話し手の口調で、1〜2文。 */
  readonly text: string;
};

export type ChangeRequest = {
  // 既存のフィールドに加えて
  readonly rumor?: ChangeRumor;
};

// src/domain/change/rumors.ts
/**
 * うわさとして先に見せる依頼。ステージの変更依頼のうち、冒頭の手直しやカードで全文を見せる依頼
 * (painRequestsOf(stage) の modify と extend)を除いたもの。並びは stage.changeRequests の順。
 */
export function rumoredRequests(stage: Pick<Stage, 'changeRequests'>): readonly ChangeRequest[];
```

- `rumor` は任意項目にする(quiz・blank の依頼には書かない)。リファクタリングのステージで `rumoredRequests` に入る依頼には必ず書く(下のカタログのテストで守る)
- うわさの対象でない依頼(modify の1件目・extend の1件目)に `rumor` を書いても表示には使わない。書かないこと

### うわさの書き方(ステージ定義を書く人向け)

- 何が変わりそうかを書く。例: 「税率」「表の見せ方」「通知の手段」
- 依頼の `title` をそのまま書かない。`partName` や、置くべきクラス名・メソッド名も書かない
- 「〜らしい」「〜かもしれない」のように、確定していない話にする
- 話し手は、そのステージの章(`storyChapters`)の雰囲気に合う人物を `TANAKA`・`SUZUKI`・`SATO`・`TAKAHASHI` と同じ文字列から選ぶ
- 例(チュートリアル1の `req-report-share`「表に「構成比」列を追加して」):
  `{ from: '営業の佐藤さん', text: '経理の人たちが、レポートの表の見せ方をそのうち変えたいと話していたらしいですよ。' }`

## 見た目・動きの仕様

### サイドバーの「気になるうわさ」欄(`RumorList`)

- `rumoredRequests(stage)` のうち `rumor` があるものが1件以上あれば、クリア条件の欄の次(ヒントの欄の前)に出す。
  `section`(`aria-labelledby` で見出しを指す、`data-testid="rumor-list"`)
- 見出し: `気になるうわさ`。見出しの下に小さく「いずれ届くかもしれない変更です。備えておくと、あとで楽になります」
- うわさ1件ごとに1項目(`data-testid="rumor-<依頼のid>"`)
  - ストーリーモードがオンのとき: 1行目に `<from>から` を小さく、2行目に `text`
  - オフのとき: `text` だけ
- 依頼の `title` と `description` は出さない
- 変更依頼に挑戦している間(`changeSession !== null`)は出さない(依頼票で回収するため)
- 段階(#160 の `stageStep`)に関係なく、ステージを開いたときから出す

### 変更依頼の依頼票(`ChangeRequestPanel`)

- 今の依頼に `rumor` があり、それが `rumoredRequests(stage)` に入っているとき、依頼のタイトルの上に
  `うわさが本当になりました: 「<rumor.text>」` を出す(`data-testid="rumor-came-true"`)

### 変更依頼の結果カード(`OutcomeCard`)

- 依頼がうわさの対象のとき、カードのタイトルの下に回収の文(`describeRumorPayoff` の結果)を1行出す(`data-testid="rumor-payoff"`)
- 備えていた(下記)ときは `var(--success)`、備えきれなかったときは `var(--danger)` の左線を付ける。色だけに頼らず文の頭に `✓` / `✗` を付ける

### 回収の文(`describeRumorPayoff`)

`describeRumorPayoff(outcome: ChangeOutcome, codebase: Codebase): string | undefined` を作る。`outcome.request.rumor` が無ければ `undefined`。

- 「備えていた」とは、置き方の点数(`outcome.placement.score.total`)が100点であること(今の結果カードの「減点なし」と同じ基準)
- 備えていた
  - 触った既存クラス(`placement.placement.modifiedClassIds`)が0: `✓ うわさに備えた設計だったので、既存のクラスを書き換えずに済みました`
  - 1つ: `✓ うわさに備えた設計だったので、直したのは <クラス名> だけで済みました`
- 備えきれなかった
  - 触った既存クラスが2つ以上: `✗ うわさに備えきれず、既存の N クラス(<クラス名>・…)に手を入れることになりました`
  - それ以外(1つ以下だが減点がある): `✗ うわさに備えきれず、置き場所に無理が出ました。下の減点の理由を見てみよう`
- クラス名は `codebase`(結果画面で使っている、実装を積み重ねたコード)から引く。見つからなければIDのまま

## TDD対象の純粋関数

### `rumoredRequests`(`domain/change/rumors.ts`)

- modify 2件(1件目は冒頭で見せる) → 2件目だけを返す
- modify 1件 + extend 1件 → 空(両方ともカードで見せている)
- modify 2件 + extend 2件 → modify の2件目と extend の2件目を、`changeRequests` の順で返す
- 変更依頼なし → 空

### `describeRumorPayoff`(`presentation/change/describeRumorPayoff.ts`)

- `rumor` なし → `undefined`
- 100点・触った既存クラス0 → 「既存のクラスを書き換えずに済みました」
- 100点・触った既存クラス1 → 「直したのは <クラス名> だけで済みました」
- 80点・触った既存クラス2 → 「既存の 2 クラス(A・B)に手を入れることになりました」
- 90点・触った既存クラス1 → 「置き場所に無理が出ました」

### ステージカタログ(`stageCatalog.test.ts`)

- リファクタリングの全ステージで、`rumoredRequests(stage)` のすべての依頼に `rumor` がある
- `rumor.text` が依頼の `title` を含まず、`partName` を含まない
- `rumor.from` が `storyChapters.ts` の登場人物(`'先輩の田中さん'`・`'PMの鈴木さん'`・`'営業の佐藤さん'`・`'QAの高橋さん'`)のどれか
- `rumoredRequests` に入らない依頼には `rumor` が無い

## 受け入れ基準

1. チュートリアル1を開くと、サイドバーのクリア条件の次に「気になるうわさ」欄が出て、`req-report-share` のうわさが出ている。依頼のタイトル(「表に「構成比」列を追加して」)は出ていない
2. ストーリーモードをオンにすると、うわさに話し手(`営業の佐藤さんから`)が付く。オフでは本文だけ
3. 変更依頼に挑戦している間は「気になるうわさ」欄が消え、うわさの対象の依頼が来たとき、依頼票に「うわさが本当になりました」が出る
4. 結果画面のうわさの対象の依頼のカードに、置き方の点数に応じた回収の文(`✓ …` / `✗ …`)が出る
5. うわさの対象の依頼が無いステージ(modify 1件 + extend 1件など)では、「気になるうわさ」欄が出ない
6. カタログのテストで、全ステージのうわさの書き漏れ・答えの書きすぎが検出される
7. `npm run check` と `npm run test:e2e` が通る。`npm run stage-report` の出力(`docs/stages/report.md`)に差分が出る場合は再生成してコミットする

## スコープ外

- 1件目の modify・extend の依頼のうわさ(冒頭の手直しやカードで全文を見せているため)
- うわさを見て備えたかどうかを、組み替え中に採点・表示すること(結果画面での回収だけにする)
- 良い設計でしか素直に入らない「2つ目の鬼の変更」を新しく作ること(別の仕様で扱う)
- うわさの文の AI 生成(人が書いた固定の文にする)
- 答え合わせ画面(#164)へのうわさの組み込み
