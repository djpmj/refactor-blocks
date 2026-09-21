# 変更依頼(新機能追加課題)

## 目的

リファクタリングした設計が「変更に強いか」を、実務の流れ(依頼 → 影響調査 → 実装 → PR/レビュー/テストの負担)で体感させる。
採点ルール(行数・結合度・循環・責務)は「今のコードの形」を見るが、この機能は「変更が来たときの手間」を見る。
同じ変更依頼を**初期状態のコード**と**リファクタリング後のコード**の両方に当て、コストの差を並べて見せる。これが「なぜ設計が良いか」の説明になる。

AI講評・継承・プレイヤーによるコードの直接編集は今回の範囲外。

## 用語

- **変更依頼(ChangeRequest)**: 「軽減税率に対応して」のような要望。1つの**責務**(`Fragment.responsibility`)に対する変更として表す。
- **変更箇所(site)**: 依頼の責務を持つ Fragment を含む**メソッド**。実務でいう「実際に修正が必要なファイル/関数」。

## 体験の流れ

1. ステージ画面の「変更依頼に挑戦」ボタンを押す(いつでも押せる。リファクタリング前でもよい)。
2. **依頼票**が出る(タイトル・説明)。依頼は1ステージに2〜3件、順番に出る。
3. **影響調査**: キャンバス上のメソッドをクリックして「変更が必要だと思う場所」を選び、「調査を終える」を押す。
4. **実装**: 変更が自動で適用され、影響が計算される(下記)。キャンバスには反映しない。
5. 次の依頼へ。全件終わったら**結果**を出す: 依頼ごとのコスト内訳と、初期状態のコードとの比較。

適用した変更はキャンバス(現在のCodebase)には**反映せず、残さない**。依頼はそれぞれ独立に、今のCodebaseへ当てる(前の依頼の変更は積み上げない)。結果を見たら、リファクタリングの続きに戻れる(元のCodebaseはそのまま)。

## ドメインモデル(domain: `src/domain/change/`)

`Stage` に `changeRequests: readonly ChangeRequest[]` を追加する(`domain/stage/Stage.ts`)。

```ts
export type ChangeRequest = {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly responsibility: string;   // 変更が必要な責務(Fragment.responsibility と一致)
  readonly linesPerSite: number;     // 変更箇所1つあたりに増える行数
};
```

### 変更箇所の特定 `findChangeSites.ts`

```ts
export function findChangeSites(codebase: Codebase, request: ChangeRequest): string[]; // メソッドIDの配列
```

- `request.responsibility` と同じ責務のFragmentを1つでも持つメソッドのID。出現順。
- リファクタリングで責務が1メソッド/1クラスに集まっていれば少なく、散らばっていれば多くなる。
- `'call'`(抽出で入る呼び出し行)は責務として数えない(既存の `responsibilities.ts` の扱いに合わせる)。

### 変更の適用 `applyChangeRequest.ts`

```ts
export function applyChangeRequest(codebase: Codebase, request: ChangeRequest): Result<Codebase, ChangeError>;
type ChangeError = 'no-sites';   // 変更箇所が0件
```

- 変更箇所の各メソッドに、Fragment `{ id: '<requestId>:<methodId>', label: request.title, lines: request.linesPerSite, responsibility: request.responsibility }` を末尾に足した**新しいCodebase**を返す(元は変更しない)。
- 変更後のCodebaseに既存の `findLineLimitViolations` をそのまま使える。巨大メソッドに行が足されて上限を超える、という実務的な副作用が自然に出る。

### 影響の計測 `measureChange.ts`

```ts
export type ChangeImpact = {
  readonly sites: readonly string[];          // 変更したメソッドID
  readonly classesTouched: number;            // 散らばり: 変更箇所を含むクラス数
  readonly filesTouched: number;              // 変更箇所を含むファイル数
  readonly linesAdded: number;                // sites.length × linesPerSite
  readonly rippleClasses: readonly string[];  // 波及: 変更したクラスに依存している(呼んでいる)、変更対象ではないクラスのID
  readonly mixedResponsibilities: number;     // 巻き込み: 変更箇所のメソッドに同居している、依頼と無関係な責務の種類数(の合計)
  readonly overLimitTouched: number;          // 触ったメソッド・クラス・ファイルのうち、変更後に行数上限を超えているものの数
};
export function measureChange(before: Codebase, request: ChangeRequest, limits: LineLimits): Result<ChangeImpact, ChangeError>;
```

- 波及は既存の `classDependencies`(`domain/codebase/dependencies.ts`)を使い、`to` が変更したクラスで `from` が変更したクラスでないもの(直接の依存元のみ。推移的な波及は数えない)。
- 巻き込みは、変更箇所メソッドごとに「依頼の責務でも `'call'` でもない責務」の種類数を数えて合計する。
- `overLimitTouched` = 触ったメソッド・そのクラス・そのファイルのうち、適用後の `findLineLimitViolations` に出てくるものの数。

### コスト採点 `scoreChange.ts`

```ts
export type ChangeScore = { readonly total: number; readonly deductions: readonly ScoreDeduction[] };
export function scoreChange(impact: ChangeImpact, investigation: InvestigationResult): ChangeScore;
```

依頼1件の点数は100から次を引く(下限0)。

| ルール(`rule`) | 数えるもの | 1件あたり |
| --- | --- | --- |
| `shotgun` | 変更が必要な**クラス**数 − 1(散らばり。メソッドを同じクラスに集めれば減る) | -10 |
| `ripple` | `rippleClasses` の数 | -5 |
| `entangled` | `mixedResponsibilities` | -5 |
| `limit-break` | `overLimitTouched`(すでに上限超えのメソッドに行を足す場合も数える) | -10 |
| `missed` | 調査で選び漏らした変更箇所 | -10 |
| `extra` | 調査で選んだが変更箇所ではなかったメソッド | -5 |

- `ScoreDeduction` の `rule` の型は既存の `'line-limit' | 'coupling' | 'cycle' | 'responsibility'` と別に、`ChangeDeduction`(上の6つ)を新設する。既存の型は変えない。
- 全依頼の点数の平均(四捨五入)を、そのステージの**変更容易性スコア**とする。

### 調査の照合 `checkInvestigation.ts`

```ts
export type InvestigationResult = { readonly missed: readonly string[]; readonly extra: readonly string[] };
export function checkInvestigation(selected: readonly string[], sites: readonly string[]): InvestigationResult;
```

## アプリケーション層(`src/application/`)

新ファイル `ChangeRequestUseCases.ts` に、現在のCodebaseと依頼から「影響・点数」を返す薄いユースケースを置く。
ID採番は不要(適用で作るFragmentのIDは `<requestId>:<methodId>` で決まる)。

- `evaluateChangeRequestUseCase(stage, codebase, request, selected)`(`src/application/ChangeRequestUseCases.ts`) → `Result<ChangeOutcome, ChangeError>`。`ChangeOutcome` は依頼・調査結果・今のコードの結果(`current`)・初期状態の結果(`initial`)
- 結果画面の「初期状態との比較」は、`stage.codebase`(初期のコードベース)に同じ計測を当てて求める。初期状態でも調査は同じ選択で採点する(プレイヤーが選んだメソッドIDは初期状態には存在しないことがあるため、初期状態側は**調査の減点なし(選択=正解と仮定)**で比べる)。

## 画面(presentation)

- `StagePanel` に「変更依頼に挑戦」ボタン(`data-testid="change-request-start"`)。全ステージに依頼があるので常に出す(依頼のないステージが増えたら出し分ける)。
- `ChangeRequestPanel`(サイドパネル): 依頼票 → 調査 → 結果を、ステップ表示で切り替える。
  - 調査中はメソッドをクリックで選択/解除する(選択中は枠を強調。`data-testid="method-<name>"` の既存属性を使い、選択状態は `data-investigated`)。調査中は抽出・移動・Undoなどの編集操作を受け付けない(ストアの `commit` で弾く)。
  - 結果: 依頼ごとに点数と内訳(変更ファイル数・追加行数・波及クラス・巻き込み・上限超過・調査の漏れ)を表に出す。
    「初期状態」列と「現在」列を並べ、コストがどう変わったかを見せる。
    各行に一言の理由を付ける(例: 「税の処理が3つのメソッドに散らばっているため、3か所を直す必要があった」)。理由の文は `domain` の `ScoreDeduction` の種類から `presentation` で組み立てる。
  - 結果画面の「リファクタリングに戻る」で、パネルを閉じてキャンバスを元の編集状態に戻す。
- ストア(`useGameStore`)に `changeSession`(現在の依頼番号・選択メソッド・各依頼の結果)を持たせる。Undo/Redoの履歴には**含めない**。

## ステージ定義(infrastructure)

- 全6ステージに `changeRequests` を2〜3件書く。責務は、そのステージのFragmentが持つ責務の中から選ぶ(存在しない責務は `no-sites` になるため)。
- 例(チュートリアル2 `placeOrder`): 「軽減税率(8%)に対応して」= `responsibility: 'tax'`, `linesPerSite: 8`。
  税計算を `TaxCalculator` に移した設計なら変更箇所は1、`placeOrder` に埋まったままなら `placeOrder` 内で1か所だが、巻き込みが大きく上限超過も起きる、という差が出る。
- 依頼は「ルール変更」「バリエーションの追加」「横断的な変更(ログ・監査など)」のように性質の違うものを混ぜる。1つの設計が全部に強いことはない、と感じさせるため。
- `stageCatalog.test.ts` に次を足す: ①全依頼の責務がそのステージの初期Codebaseに存在する ②模範解答では変更が必要なクラス数が初期状態以下 ③模範解答の変更容易性スコアが初期状態より高い。

## 受け入れ基準

1. `findChangeSites` / `applyChangeRequest` / `measureChange` / `scoreChange` / `checkInvestigation` のAAAパターンのユニットテストがある。
   責務が1メソッドに集約・複数メソッドに散在・`'call'` 行を含む・責務が存在しない(`no-sites`)・波及あり/なし・上限超過が新たに起きる、を含む。
2. `applyChangeRequest` は元のCodebaseを変更しない(テストで確認)。
3. E2E: チュートリアル2で「変更依頼に挑戦」を押し、`placeOrder` を選んで調査を終えると、結果画面に点数と内訳が出る。
4. E2E: `calculateTax` を抽出して `TaxCalculator` へ移した後に同じ依頼を行うと、初期状態より変更容易性スコアが高くなる(比較表に両方出る)。
5. E2E: 結果画面から「リファクタリングに戻る」を押すと、キャンバスは適用前の状態で、変更依頼で足されたFragmentは残っていない。
6. `npm run check` と `npm run test:e2e` が通る。

## 省いたもの(いつ足すか)

- **「修正ではなく追加で済んだか」(開放閉鎖の原則)の指標**: 継承・interfaceがないと、追加だけで済む設計をモデルで表せないため。継承を入れるときに `ChangeImpact` へ足す。
- **推移的な波及**: 直接の依存元だけ数える。ステージは小さいので十分。深い依存を扱うステージができたら追加する。
- **プレイヤーによる実装内容の選択・コードの直接編集**: 変更は自動適用。必要になったら「修正/追加」の選択UIを足す。
- **変更依頼の量・種類のバランス調整**: 減点の数値は仮置き。プレイして偏るなら調整する。
