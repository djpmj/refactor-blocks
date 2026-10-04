# レイヤー構成のステージ(Controller / Service / Repository と依存の向き)

> **注意(他の仕様との関係)**:
> - 採点ルール `layer` を足すので、`ScoreRule` を `Record` のキーに使う箇所(`RULE_LABEL`、#58 の `violationTargets`、#64 の `RULE_WHY`)が
>   先にマージされていれば、それぞれに `layer` の項目を足す(型エラーで気づける)
> - 中級のステージ番号は、#62・#63 と先着順。実装時にマージ済みの `stageCatalog` を見て番号を決める
> - #60(`why`)・#67(`learns`)・理解度チェック(`concept-check`)が `Stage` に必須項目を足していれば、このステージにも書く

## 背景・目的

新卒〜4年目のエンジニアが最初に配属されることが多い Web アプリは、**Controller(受け口)/ Service(業務ルール)/ Repository(保存)**の層に分かれている。
しかし実務では、Controller に業務ルールやDBアクセスが直書きされたコードによく出会う。今のステージは「責務ごとにクラスを分ける」ことは練習できるが、
**層と依存の向き**(上の層は下の層だけを呼ぶ。下から上を呼ばない。層を飛ばさない)は練習できない。

そこで次の2つを足す。

1. **層の採点ルール `layer`**: ステージが層の並び(上→下)と、各層に属する責務を定義できるようにする。クラスの層を、その処理の責務から決め、
   **下の層から上の層への依存(逆流)**と、**層を飛ばす依存**(Controller → Repository を直接)を減点する
2. **中級ステージ「Controller に全部書いてある注文API」**: Controller に入力検証・在庫と金額の業務ルール・DB保存・レスポンス組み立てが同居している。
   Service と Repository に分け、Controller → Service → Repository の一方通行にする

ファイル名は画面に出さない方針(`hide-file-names`)なので、層は**ファイルのパスではなく処理の責務**から決める。

## 変更対象ファイル一覧

| パス | 層 | 新規/変更 | 役割 |
| --- | --- | --- | --- |
| `src/domain/stage/Stage.ts` | domain | 変更 | 任意の `layers?: readonly StageLayer[]` を追加(下記) |
| `src/domain/scoring/layers.ts` + `.test.ts` | domain | 新規 | `classLayers` と `findLayerViolations`(TDD、下記) |
| `src/domain/scoring/score.ts` + `.test.ts` | domain | 変更 | `ScoreRule` に `'layer'` を足し、`scoreCodebase` の集計に入れる。`stage` の `Pick` に `layers` を足す |
| `src/presentation/stage/describeScore.ts` | presentation | 変更 | `RULE_LABEL.layer = '層の依存の向き'` |
| `src/presentation/canvas/ClassNode.tsx` | presentation | 変更 | ステージに `layers` があるとき、クラスの見出しに層の名前のタグ(`Controller` など)を出す(下記) |
| `src/infrastructure/stages/intermediateStages.ts` / `stageCatalog.ts` | infrastructure | 変更 | 新ステージを足す(下記) |
| `src/domain/stage/sampleAnswer.ts` | domain | 変更 | 新ステージの模範解答の手順 |
| `src/infrastructure/stages/stageCatalog.test.ts` | infrastructure | 変更 | 新ステージの検証(下記) |
| `src/index.css` | presentation | 変更 | `.class-node__layer` のタグのスタイル |
| `e2e/layered-stage.spec.ts` | E2E | 新規 | 層のタグが出る、層を飛ばす依存で減点される(下記) |

`application` 層の変更は無い。

## データ・型の変更

```ts
// src/domain/stage/Stage.ts
export type StageLayer = {
  /** 画面に出す層の名前。例: 'Controller' / 'Service' / 'Repository' */
  readonly name: string;
  /** この層に属する処理の責務(Fragment.responsibility)。 */
  readonly responsibilities: readonly string[];
};

export type Stage = {
  // …既存
  /** 層の並び(上 → 下)。省略時は層の採点をしない(既存ステージはすべて省略)。 */
  readonly layers?: readonly StageLayer[];
};
```

```ts
// src/domain/scoring/layers.ts
export type LayerViolation = {
  readonly fromClassId: string;
  readonly toClassId: string;
  /** 'upward' = 下の層から上の層を呼んでいる。'skip' = 1つ以上の層を飛ばして下の層を呼んでいる。 */
  readonly kind: 'upward' | 'skip';
};

/** クラスID → 層の添字(0 が一番上)。層に属する処理を1つも持たないクラス(空・インターフェース役・call だけ)は含めない。 */
export function classLayers(codebase: Codebase, layers: readonly StageLayer[]): ReadonlyMap<string, number>;

/** classDependencies の各依存について、両端のクラスに層があるときだけ向きを調べる。 */
export function findLayerViolations(codebase: Codebase, layers: readonly StageLayer[] | undefined): LayerViolation[];
```

**クラスの層の決め方**: クラスの全 Fragment(`responsibility === 'call'` を除く)の責務を、`layers` のどの層に属するか引く。
属する層があるものの中で**一番上の層**(添字が最小)をそのクラスの層にする。どの層にも属さない責務だけのクラスは層なし。
(1クラスに複数の層の処理が混ざっていることは、既存の「責務の混在」で減点される。層の採点は、それとは別に**クラス間の依存の向き**だけを見る)

**違反の判定**: 依存 `from → to`(`classDependencies`。同じクラス内の参照は既に除かれている)について、
- `layer(to) < layer(from)` → `upward`(下が上を呼ぶ)
- `layer(to) > layer(from) + 1` → `skip`(層を飛ばす)
- 同じ層どうし・1つ下の層への依存は違反にしない

`scoreCodebase` の `counts.layer = findLayerViolations(codebase, stage.layers).length`(1件 10点。他のルールと同じ)。

`// ponytail: クラスの層は「一番上の層の処理を1つでも持っていればその層」で決める。混ざったクラスが別の層として扱われて紛らわしいと分かったら、多数決にする`

## 見た目・内容の仕様

### クラスの層のタグ(`ClassNode`)

- ステージに `layers` があり、そのクラスに層があるとき、クラス名の横に小さなタグ `Controller` などを出す(`data-testid="layer-<クラス名>"`)
- 層は操作のたびに再計算される(処理を移すと、そのクラスの層が変わることがある)
- `layers` が無いステージでは何も出さない(既存ステージの見た目は変わらない)
- 色だけに頼らず、層の名前の文字で出す

### 新ステージ「Controller に全部書いてある注文API」

- `id: 'intermediate-layered-order-api'`、`level: 'intermediate'`、タイトルは `中級N: Controller に全部書いてある注文API`(番号は前提の注意を参照)
- `layers`:
  1. `Controller`: `['http']`(リクエストの検証・レスポンスの組み立て)
  2. `Service`: `['order-rule']`(在庫の確認・金額の計算などの業務ルール)
  3. `Repository`: `['persistence']`(注文の保存・在庫の読み書き)
- 題材: `OrderController.placeOrder` と `OrderController.cancelOrder` に、`http` / `order-rule` / `persistence` の処理が同居している。
  空のクラス `OrderService` と `OrderRepository` が用意されている
- 解き方: 業務ルールと保存の処理を Extract Method で抜き出し、業務ルールは `OrderService` へ、保存は `OrderRepository` へ Move Method する。
  **Controller が Repository を直接呼ぶ形(層の飛ばし)にならないよう**、保存を呼ぶ処理も Service 側に置く
  (Controller → Service → Repository)。既存の操作だけで解ける
- **わざと間違えやすくする**: 保存の処理だけを Repository へ移して、呼び出しを Controller に残すと `skip` で減点される。
  業務ルールの中から Controller の処理を呼ぶ形にすると `upward` で減点される(Fragment の `uses` でそうなる題材にする)
- 制限値: 初期状態は100点にならず、模範解答で100点になる。`skip` の形(Repository へ移しただけ)では100点にならない
- `changeRequests`: `modify` の「保存先をDBから外部APIに変えて」(`persistence`)、`modify` の「送料無料の条件を変えて」(`order-rule`)。`partName` を全件に書く
- `description`・`goal` は既存の中級ステージに倣う。`goal` には「Controller → Service → Repository の一方通行にしよう」を含める

## TDD対象の純粋関数

### `classLayers`

1. `http` の処理だけのクラスは層0、`persistence` だけのクラスは層2
2. `http` と `persistence` が混ざったクラスは、上の層の0
3. `call` の処理だけのクラス・空のクラス・どの層の責務も持たないクラスは、Map に含まれない
4. `layers` が空なら空の Map

### `findLayerViolations`

1. `layers` が `undefined` なら空(既存ステージは常に0件)
2. Controller → Service → Repository の一方通行なら0件
3. Controller → Repository を直接呼ぶと `skip` が1件
4. Repository → Service を呼ぶと `upward` が1件
5. 同じ層のクラスどうしの依存は違反にしない
6. 層の無いクラスとの依存は違反にしない

### `scoreCodebase`

1. `layers` があるステージで違反が1件なら、`layer` の減点が10点
2. `layers` が無いステージ(既存の全ステージ)の点数は変わらない(既存のテストがそのまま通る)

### ステージカタログ(`stageCatalog.test.ts`)

1. 新ステージの初期状態は100点にならない。模範解答で100点になる
2. 保存の処理だけを Repository へ移した(呼び出しを Controller に残した)状態では、`layer` の減点がある(`skip`)
3. 既存の全ステージで `layer` の減点が0

## 受け入れ基準

- `npm run check` が通る
- `npm run test:e2e` が通る
- 新ステージを開くと、クラスに層のタグ(`Controller` など)が出る。処理を移すとタグが変わる
- 保存の処理だけを Repository へ移すと、点数の詳細に「層の依存の向き -10」が出る
- Controller → Service → Repository の一方通行にすると、層の減点が消え、模範解答の手順で100点になる
- 既存の全ステージの点数・見た目(層のタグが出ない)が変わらない
- 先にマージされている `RULE_LABEL` / `violationTargets`(#58)/ `RULE_WHY`(#64)に、`layer` の項目がある

## スコープ外

- ファイル・フォルダ単位の層(パッケージ構成)。層はクラスの処理の責務で決める
- 層を跨ぐときのインターフェース(依存関係逆転)を必須にすること(上級2の題材)
- ドメイン層・インフラ層などの4層以上の構成のステージ(`layers` は何層でも定義できるが、今回のステージは3層)
- 層の並びをプレイヤーが設定・変更すること
- キャンバス上で層ごとに帯(レーン)を描く・自動で層ごとに並べるレイアウト
- 白紙設計モード・設計くらべクイズへの適用
