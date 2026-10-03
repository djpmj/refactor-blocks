# 変更依頼を「実装」させる(置き方の採点)

## 背景・目的

今の変更依頼(`docs/specs/change-request.md`)では、依頼の責務を持つメソッドへ `applyChangeRequest` が自動で処理を足す。
プレイヤーがするのは影響箇所を選ぶ「調査」(`checkInvestigation`)だけ。採点は変更コスト(`scoreChange`: 散らばり・波及・巻き込み・上限超え)が中心で、
次の3つは質として測れていない。

- **拡張しやすさ**: 既存クラスを書き換えずに足せたか(開放閉鎖の原則、OCP)
- **責務の自然さ**: 置いた先のクラスに、関係ない責務が混ざらないか
- **依存の適切さ**: 新しいコードが具象クラスに依存していないか

そこで調査の代わりに、プレイヤーに**実際に実装させる**。依頼ごとに「新しく足す処理」の部品(メソッド1つ)を部品置き場に出し、
プレイヤーがそれをキャンバス上のどこかへ置く。置き方を上の3つの観点で採点する。

対象はリファクタリングモードの変更依頼だけ。設計くらべ(quiz)と白紙設計(blank)の挙動は変えない。

**ponytail(作る前に確かめたこと)**

- **置くための新しい操作・UIは作らない。** 白紙設計の部品置き場(`src/domain/blank/tray.ts`)をそのまま使う。
  「今のコード + 部品置き場(部品1つ)」をキャンバスに出せば、既存の操作で置き方をすべて表現できる。
  - 既存クラスに足す = 部品をクラスへドラッグ(`moveMethod`)
  - 新しいクラスを作って足す = 部品を余白へドラッグ(`moveMethodToNewClass`)
  - 継承・インターフェースで足す = そのあと右クリックの「継承元を設定」「実装するインターフェースを設定」(`setSuperclass`)
  - 名前の衝突 = ダブルクリックで名前を変える(`renameMethod`)
- **「既存メソッドの中に処理を1つ足す」操作は作らない。** 部品はメソッドとして置き、採点はクラス単位で行う。
  既存メソッドの中に入れても外に置いても、触る既存クラスと、置いた先のクラスの責務の混ざり方は変わらない。本当に要るか → 要らない。
  メソッド単位の差が要るとプレイで分かったときに足す。
- **置き直し用のボタンは作らない。** 実装中も取り消し(Ctrl+Z・「元に戻す」)を使えるようにする。履歴は依頼ごとに空から始め、終わったら挑戦前の履歴へ戻す。
- **採点は既存の関数で集計できる部分は再利用する**(`classDependencies`・`findUnplacedParts`・`withoutTray`・`trayCodebase`)。
  変更コスト(`measureChange` / `scoreChange`)は**そのまま残す**。置き方の点数はそれとは別に出す(下記)。
- **依頼の種類(`kind`)は足す。** 「ルールの変更」(税率を変える等)は、その責務を持つ既存クラスを1つ直すのが正解になり、OCPで減点すると正解を減点してしまう。
  OCPが意味を持つのは「機能の追加」(決済手段を増やす等)だけなので、2つを見分ける必要がある。
- **初期状態で「一番良い置き方をしたら何点か」の自動計算は作らない**(スコープ外。いつ足すかも書いた)。

## 現状の調査結果

| 場所 | 今の役割 | この仕様での扱い |
| --- | --- | --- |
| `src/domain/change/ChangeRequest.ts` | 依頼の型(`responsibility`・`linesPerSite`)、`ChangeError = 'no-sites'` | `kind?` と `partName?` を足す |
| `src/domain/change/findChangeSites.ts` / `applyChangeRequest.ts` / `measureChange.ts` | 責務を持つメソッドへ自動で処理を足して、コストを数える | **変えない**(quiz・blank も使っている) |
| `src/domain/change/scoreChange.ts` | コストの点数。第2引数で調査の減点(`missed` / `extra`) | 最後の段階で調査の引数とルールだけ消す |
| `src/domain/change/checkInvestigation.ts` | 調査の照合 | 最後の段階で消す |
| `src/domain/blank/tray.ts` | 部品置き場の作成・除去・未配置の判定 | **変えずに import して使う** |
| `src/application/ChangeRequestUseCases.ts` | `evaluateChangeRequestUseCase(stage, codebase, request, selected)` | 置き方の採点を返すように変える |
| `src/presentation/store/useGameStore.ts` | `changeSession`(`index`・`selected`・`inspected`・`outcomes`)。セッション中は `commit`・`applyResult`・`travelTo` で編集を弾く | セッション中も編集と取り消しを許し、挑戦前のコードと履歴を退避する |
| `src/presentation/change/ChangeRequestPanel.tsx` | 依頼票 → 調査(選択・カーソルを合わせた中身の表示)→ 結果 | 調査を実装に置き換え、結果に置き方の点数を足す |
| `src/presentation/change/describeChange.ts` | コストの減点理由の文言 | 置き方の減点理由の文言を足す |
| `src/presentation/change/ChangeMemo.tsx` | 直前の結果を編集パネルに残す | 置き方の減点理由も出す |
| `src/presentation/canvas/MethodChip.tsx` | 調査中のクリック = 選択切り替え、`data-investigated`、変更箇所バッジ | 調査の分岐を消す。バッジは `current` が `null` の依頼を飛ばす |
| `src/presentation/stage/StagePanel.tsx` | 点数表示・進捗記録・各ボタン(調査中は無効) | 点数と進捗はセッション中は挑戦前のコードで数える。セッション中も「元に戻す」「やり直し」を有効にする |
| `src/presentation/App.tsx` | `changeSession !== null` なら `ChangeRequestPanel` | 変えない |
| `src/infrastructure/stages/*.ts` | 全14ステージに依頼が2〜3件 | 全依頼に `partName` を足す。上級2に「機能の追加」の依頼を1件足す |
| `src/infrastructure/stages/stageCatalog.test.ts` | 全依頼にコストのテストをかけている | コストのテストは「ルールの変更」の依頼だけにする。`partName` のテストを足す |
| `src/domain/blank/*`、`src/domain/quiz/*`、`src/infrastructure/blankDesigns/*`、`src/infrastructure/quizzes/*` | `measureChange` / `scoreChange(impact)` を使う | **変えない**(クイズは上級2を使っていないことを確認済み) |

依存の計算(`classDependencies`)は `Fragment.uses` だけを見る。`superclassId` は採点に影響しない宣言用の情報(`docs/specs/inheritance.md`)。
「インターフェース」は `fragments: []` のメソッドだけを持つクラスで表す、という決まりがすでにある(`docs/specs/payment-gateway-true-dip.md`)。この仕様もこの2つを前提にする。

## 変更対象ファイル一覧

| パス | 層 | 新規/変更 | 役割 |
| --- | --- | --- | --- |
| `src/domain/change/ChangeRequest.ts` | domain | 変更 | `ChangeKind`・`kind?`・`partName?`・`changeKindOf` を足す |
| `src/domain/change/changePart.ts` | domain | 新規 | 依頼の新規部品を作る。今のコードに部品置き場を足す。部品を置いたかを判定する |
| `src/domain/change/changePart.test.ts` | domain | 新規 | 上記のテスト |
| `src/domain/change/measurePlacement.ts` | domain | 新規 | 置き方の事実(触った既存クラス・置いた先の責務・つながり方)を数える |
| `src/domain/change/measurePlacement.test.ts` | domain | 新規 | 上記のテスト |
| `src/domain/change/scorePlacement.ts` | domain | 新規 | 置き方の点数(5ルール) |
| `src/domain/change/scorePlacement.test.ts` | domain | 新規 | 上記のテスト |
| `src/domain/change/scoreChange.ts` / `scoreChange.test.ts` | domain | 変更(最後の段階) | 調査の引数と `missed` / `extra` を消す |
| `src/domain/change/checkInvestigation.ts` / `.test.ts` | domain | 削除(最後の段階) | 調査の照合 |
| `src/application/ChangeRequestUseCases.ts` / `.test.ts` | application | 変更 | `evaluateImplementationUseCase` を足し、最後の段階で `evaluateChangeRequestUseCase` を消す |
| `src/presentation/store/useGameStore.ts` | presentation | 変更 | `ChangeSession` の形、実装の開始・終了、編集と取り消しの許可 |
| `src/presentation/change/ChangeRequestPanel.tsx` | presentation | 変更 | 実装のステップ、結果に置き方の点数を足す |
| `src/presentation/change/describeChange.ts` | presentation | 変更 | `PLACEMENT_RULE_LABEL` と `describePlacement` を足す。最後の段階で調査の文言を消す |
| `src/presentation/change/ChangeMemo.tsx` | presentation | 変更 | 置き方の減点理由も出す |
| `src/presentation/canvas/MethodChip.tsx` | presentation | 変更 | 調査の選択を消す。`current` が `null` の依頼に対応する |
| `src/presentation/stage/StagePanel.tsx` | presentation | 変更 | セッション中の点数と進捗は `changeSession.base` で数える。「元に戻す」「やり直し」はセッション中も有効 |
| `src/index.css` | presentation | 変更 | `.method-chip--investigated` を消す(最後の段階)。足すスタイルは最小限 |
| `src/infrastructure/stages/tutorialStages.ts` ほか3ファイル | infrastructure | 変更 | 全依頼に `partName` を足す |
| `src/infrastructure/stages/advancedStages.ts` | infrastructure | 変更 | 上級2の先頭に `req-add-paypay`(`kind: 'extend'`)を足す |
| `src/infrastructure/stages/stageCatalog.test.ts` | infrastructure | 変更 | コストのテストをルールの変更の依頼に絞る。`partName` のテスト |
| `src/infrastructure/stages/advancedStages.test.ts` | infrastructure | 変更 | `req-add-paypay` の置き方のテスト |
| `e2e/refactor.spec.ts` | — | 変更 | 調査のテストを実装のテストに書き換える。新規テスト |
| `docs/specs/change-request.md` | — | 変更(最後の段階) | 冒頭に「調査は implement-change-request.md で実装に置き換えた」と1行だけ足す |

`domain/change/` から `domain/blank/tray.ts` を import する。ドメイン内のモジュール間の参照で、層の向きは守られている。

## データ/型の変更

### 変更依頼(`src/domain/change/ChangeRequest.ts`)

```ts
/** 'modify' = 既存のルールの変更(その責務を持つ既存クラスを1つ直すのが正解)。'extend' = 機能の追加(既存クラスを直さずに足せるのが理想)。 */
export type ChangeKind = 'modify' | 'extend';

export type ChangeRequest = {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly responsibility: string;
  /** 変更箇所1つあたりに増える行数。実装で出す新規部品の行数にも使う。 */
  readonly linesPerSite: number;
  /** 省略時は 'modify'。quiz・blank の依頼は省略のまま。 */
  readonly kind?: ChangeKind;
  /** 実装で出す新規部品のメソッド名。省略時は 'addedLogic'。リファクタリングのステージでは必ず書く(stageCatalog.test.ts で確認)。 */
  readonly partName?: string;
};

export function changeKindOf(request: ChangeRequest): ChangeKind; // request.kind ?? 'modify'
```

`ChangeError` は変えない。`PlacementError = 'unplaced-part'` を `measurePlacement.ts` に置く。

### 新規部品と部品置き場(`src/domain/change/changePart.ts`)

```ts
/** 依頼の新規部品。public のメソッド1つで、処理(Fragment)を1つ持つ。 */
export function changePart(request: ChangeRequest): Method;
// { id: `method-part-${request.id}`, name: request.partName ?? 'addedLogic', visibility: 'public',
//   fragments: [{ id: `${request.id}:part`, label: request.title, lines: request.linesPerSite, responsibility: request.responsibility }] }

/** 今のコードの末尾に、部品を1つだけ入れた部品置き場のファイルを足す(元は変更しない)。 */
export function withChangePart(codebase: Codebase, request: ChangeRequest): Codebase;
// { files: [...codebase.files, ...trayCodebase([changePart(request)]).files] }

/** 部品が部品置き場の外に置かれているか。findUnplacedParts(trayCodebase([changePart(request)]), codebase) が空なら true。 */
export function isChangePartPlaced(codebase: Codebase, request: ChangeRequest): boolean;
```

部品のFragment IDは `applyChangeRequest` の `<requestId>:<methodId>` と同じ形にそろえる。部品を削除したクラスごと消した場合も、`findUnplacedParts` と同じく未配置になる。

### 置き方の計測(`src/domain/change/measurePlacement.ts`)

```ts
export type PlacementError = 'unplaced-part';

/** 部品が新しいクラスに置かれたとき、既存のコードとどうつながっているか。 */
export type Attachment =
  | 'existing-class' // 既存クラスに置いた(つながりは既存クラスのまま。減点なし)
  | 'abstract'       // 新クラスが、既存コードから呼ばれている抽象(インターフェース役)を継承・実装している
  | 'concrete'       // 新クラスが呼ばれている先祖につながっているが、一番近い既存の先祖が中身のある具象クラス
  | 'none';          // 新クラスがどこからも呼ばれない(呼ばれている既存の先祖がない)

export type Placement = {
  /** 部品を置いたクラスのID。 */
  readonly partClassId: string;
  /** 表示用。新しいクラスは挑戦前のコードにないので、名前をここに残す。 */
  readonly partClassName: string;
  /** 挑戦前からあったクラスのうち、実装後に中身が変わった・消えたクラスのID(挑戦前のコードでの並び順)。 */
  readonly modifiedClassIds: readonly string[];
  /** 置いた先のクラスが持つ、依頼の責務でも 'call' でもない責務の種類数。 */
  readonly otherResponsibilities: number;
  /** 依頼の責務を持つクラスの数が、実装で何個増えたか(0未満にはしない)。 */
  readonly addedResponsibilityClasses: number;
  readonly attachment: Attachment;
  /** attachment が 'abstract' / 'concrete' のとき、一番近い既存の先祖のID。 */
  readonly attachedClassId?: string;
};

/**
 * base = 挑戦前のコード(部品置き場なし)。implemented = プレイヤーが部品を置いたあとのコード(部品置き場を含んでよい)。
 * 部品が部品置き場に残っている・消えているなら err('unplaced-part')。
 */
export function measurePlacement(base: Codebase, implemented: Codebase, request: ChangeRequest): Result<Placement, PlacementError>;
```

計測の定義(すべて `design = withoutTray(implemented)` で見る):

1. **置いた先**: 部品のFragment ID(`${request.id}:part`)を持つメソッドのクラス。見つからなければ `err('unplaced-part')`。
2. **触った既存クラス** `modifiedClassIds`: `allClasses(base)` の各クラスについて、同じIDのクラスが `design` にない、または「クラスの中身」が違うもの。
   クラスの中身 = 名前・`superclassId`・`superclassId` があるときの種類(`superclassKind ?? 'extends'`)・メソッドの集合(各メソッドのID・名前・可視性・FragmentのIDの並び)。
   **メソッドの並び順は見ない**(部品を移してから戻すと末尾に付くため)。クラスが別のファイルへ移っただけなら中身は変わっていない扱い。
3. **置いた先の無関係な責務** `otherResponsibilities`: 置いた先のクラスの全Fragmentの責務から `request.responsibility` と `'call'` を除いた種類数。
   (`'call'` の扱いは `responsibilities.ts` / `measureChange.ts` と同じ)
4. **責務の分散** `addedResponsibilityClasses`: `max(0, 依頼の責務を持つクラス数(design) − 同(base))`。
5. **つながり方** `attachment`:
   - 置いた先が `base` にあるクラス → `'existing-class'`
   - 新しいクラスなら、`design` で `superclassId` を親へたどった先祖の列を作る(近い順。訪問済みで止め、輪になっていても無限ループしない)。
     そのうち `base` にあるクラスだけを残す(新しいクラスを間に挟んでもよい)。
   - 残った先祖のどれも「呼ばれている」でなければ `'none'`。呼ばれている = `classDependencies(base)` のどれかの `to` がそのクラス。
   - 呼ばれている先祖があるなら、残った先祖の**先頭**(一番近い既存の先祖)がインターフェース役なら `'abstract'`、そうでなければ `'concrete'`。
     インターフェース役 = `design` でのそのクラスのメソッドが1つ以上あり、すべて `fragments.length === 0`(上級2・上級3の `PaymentGateway` / `DiscountStrategy` と同じ決まり)。
     `attachedClassId` にその先祖のIDを入れる。

- 既存クラスに置いたときは、そのクラス自体が呼ばれているかを見ない(`'existing-class'`)。入口のクラス(`OrderService` など)はもともと誰からも呼ばれないため。
  `// ponytail: 既存クラスは呼ばれている前提にする。呼ばれていない既存クラスに置く抜け道が問題になったら、入口クラスの印をステージ定義に足す` を残す。
- 部品自体は `uses` を持たないので、実装で依存が増えることはない。「具象への依存」は、新しいクラスを誰がどう呼ぶか(つながり方)で測る。

### 置き方の採点(`src/domain/change/scorePlacement.ts`)

```ts
export type PlacementRule = 'open-closed' | 'mixed-responsibility' | 'scattered' | 'unwired' | 'concrete-base';
export type PlacementDeduction = { readonly rule: PlacementRule; readonly count: number; readonly points: number };
export type PlacementScore = { readonly total: number; readonly deductions: readonly PlacementDeduction[] };
/** 変更依頼1件の実装の、置き方と点数。 */
export type PlacementAssessment = { readonly placement: Placement; readonly score: PlacementScore };

export function scorePlacement(placement: Placement, kind: ChangeKind): PlacementScore;
```

100点から引く(下限0)。`deductions` は常に下の表の順で5つ返す(`scoreChange` と同じ形)。

| ルール | 観点 | 数えるもの | 1件あたり |
| --- | --- | --- | --- |
| `open-closed` | 拡張しやすさ | `max(0, modifiedClassIds.length − 許容数)`。許容数は `'modify'` = 1、`'extend'` = 0 | -10 |
| `mixed-responsibility` | 責務の自然さ | `otherResponsibilities` | -5 |
| `scattered` | 責務の自然さ | `'modify'` のときだけ `addedResponsibilityClasses`。`'extend'` は常に0(新しい種類を別クラスに分けるのが正解のため) | -10 |
| `unwired` | 依存の適切さ | `attachment === 'none'` なら1。実際には呼び出し元の既存クラスを書き換え、新しい具象クラスを名指しで呼ぶことになる(既存の修正と具象への依存の両方) | -20 |
| `concrete-base` | 依存の適切さ | `attachment === 'concrete'` なら1(中身のある具象クラスを継承して足した) | -10 |

点数は仮の値。`scoreChange` の重み(散らばり10・巻き込み5)に合わせた。

#### 期待される点数(実装時に `measurePlacement` → `scorePlacement` で実測してこの表を更新する)

チュートリアル2「軽減税率の対象を増やして」(`modify`、`tax`):

| 置き方 | 初期状態 | 模範解答のあと |
| --- | --- | --- |
| `OrderService` に置く | 80(混在4) | 70(混在4・分散1) |
| `TaxCalculator` に置く | 90(分散1。税の処理が `placeOrder` に残っているため) | **100** |
| 余白へ(新クラス、継承なし) | 70(未接続・分散1) | 70 |
| 新クラスが `TaxCalculator` を継承 | 70(`TaxCalculator` はまだ誰にも呼ばれていない = 未接続・分散1) | 80(具象の継承・分散1) |

上級2「PayPayでも払えるようにして」(`extend`、`gateway-integration`):

| 置き方 | 初期状態・模範解答のあと |
| --- | --- |
| 新クラスが `PaymentGateway` を実装(implements) | **100**(`PaymentService` から呼ばれているインターフェース役) |
| `StripeGateway` に置く | 80(既存の修正1・混在2) |
| `PaymentService` に置く | 80(既存の修正1・混在2) |
| 余白へ(新クラス、継承なし) | 80(未接続) |
| 新クラスが `StripeGateway` を継承 | 初期状態 80(未接続)/ 模範解答のあと 90(具象の継承。`StripeGateway` が `PaymentGateway` を実装しているのでつながる) |
| `PaymentGateway` に置く | 90(既存の修正1)※未決事項を参照 |

### アプリケーション層(`src/application/ChangeRequestUseCases.ts`)

```ts
export type ChangeOutcome = {
  readonly request: ChangeRequest;
  /** プレイヤーの実装(置き方)の採点。 */
  readonly placement: PlacementAssessment;
  /** 挑戦前のコードに依頼を当てたときの変更コスト。'extend' の依頼では null(追加で済むかは placement で測るため)。 */
  readonly current: ChangeAssessment | null;
  /** 初期状態のコードでの変更コスト(比較用)。'extend' では null。 */
  readonly initial: ChangeAssessment | null;
};

export type ImplementationError = ChangeError | PlacementError;

/** 「実装を終える」操作。base は挑戦前のコード、implemented は部品を置いたあとのコード。 */
export function evaluateImplementationUseCase(
  stage: Pick<Stage, 'limits' | 'codebase'>,
  base: Codebase,
  implemented: Codebase,
  request: ChangeRequest,
): Result<ChangeOutcome, ImplementationError>;
```

- `'modify'`: 今の `evaluateChangeRequestUseCase` と同じく `measureChange(base, …)` と `measureChange(stage.codebase, …)` を当て、`scoreChange(impact)`(調査の減点なし)。失敗したら `no-sites`。
- `'extend'`: `measureChange` は呼ばない(`current` / `initial` は `null`)。依頼の責務がコードになくてもエラーにしない。
- 両方: `measurePlacement(base, implemented, request)` が失敗したら `unplaced-part`。成功したら `scorePlacement(placement, changeKindOf(request))`。
- ID採番はない(部品のIDは依頼IDから決まる)。部品を新しいクラスへ出すときのID採番は、既存の `moveMethodToNewClassUseCase` がストア経由で行う。

### ストア(`src/presentation/store/useGameStore.ts`)

```ts
export type ChangeSession = {
  readonly index: number;
  /** カーソルを合わせたメソッド(置き場所を決めるために中身を見る。今のまま残す)。 */
  readonly inspected: string | null;
  readonly outcomes: readonly ChangeOutcome[];
  /** 挑戦前のコード。挑戦を終えたらここへ戻す。 */
  readonly base: Codebase;
  /** 挑戦前の取り消し履歴。挑戦を終えたら戻す。 */
  readonly baseHistory: History;
};
```

- `startChangeRequests`: `base = codebase`、`baseHistory = history` を退避し、`codebase = withChangePart(base, 1件目)`、`history = emptyHistory()`。
  依頼が0件のステージは今は存在しない(stageCatalog のテストが2件以上を保証している)ので、0件の分岐は作らない。
- 名前を `finishInvestigation` → `finishImplementation` に変える。`evaluateImplementationUseCase(stage, session.base, codebase, request)` を呼ぶ。
  - 成功: 結果を積んで次へ。次の依頼があれば `codebase = withChangePart(base, 次)`・`history = emptyHistory()`。なければ `codebase = base`(結果画面ではキャンバスを挑戦前に戻す)。
  - `unplaced-part`: 「部品がまだ部品置き場にあります。置き場所へドラッグしてください」。`no-sites`: 今の文言のまま。
- `endChangeRequests`: `codebase = session.base`・`history = session.baseHistory` に戻し、今までどおり `lastChangeReport = { outcomes, codebase: base }`。
- 実装中も編集を許す: `commit` と `applyResult` から `changeSession !== null` で弾く分岐を消す。`travelTo` の同じ分岐も消す(実装中に Ctrl+Z できる。履歴は依頼ごとに空なので、挑戦前の手までは戻らない)。
- `resetStage` はセッション中は何もしない(部品置き場ごと消えてしまうため。ボタンも今までどおり無効)。
- `toggleInvestigated` と `ChangeSession.selected` を消す。`inspectMethod` は残す。
- `selectStage` はそのまま(セッション中にステージを変えたら、今と同じく挑戦を捨てる)。

白紙設計のストアは同じ `createGameStore` で作るが、変更依頼を始めないので影響しない。

## 画面の操作フロー(presentation)

1. 「変更依頼に挑戦」(`change-request-start`)を押す。キャンバスに**部品置き場**のファイルが増え、クラス「部品置き場」(`class-部品置き場`)の中に部品 `partName()`(`method-<partName>`)が1つある。
2. サイドパネル(`change-panel`)
   - 「依頼 i / n」、種類(`modify` = 「ルールの変更」、`extend` = 「機能の追加」、`data-testid="change-request-kind"`)、title(`change-request-title`)、description
   - 案内: 「部品置き場の `<partName>()` を、実装する場所へドラッグしてください。既存のクラスへ落とすとそのクラスに足し、余白へ落とすと新しいクラスができます。
     新しいクラスは右クリックで継承元・実装するインターフェースを設定できます。Ctrl+Z で戻せます」
   - 部品の状態(`data-testid="change-part-status"`、`aria-live="polite"`): 未配置なら「部品はまだ部品置き場にあります」、置いたら「<クラス名> に置きました」。
     判定は `isChangePartPlaced`、クラス名は部品のメソッドIDで `findClassOfMethod` から引く
   - カーソルを合わせたメソッドの中身(今の `InspectedMethods` から「選んだメソッド」を除いたもの。`change-inspect`)
   - メッセージ、「実装を終える」(`change-request-finish`。未配置なら `disabled`)、「やめる」
3. プレイヤーは部品をドラッグし、必要なら右クリックで継承・実装を設定し、名前を変える。Ctrl+Z・「元に戻す」「やり直し」が使える。「最初に戻す」・AI講評・ヒント・図のプレビューは今までどおり無効。
4. 「実装を終える」で次の依頼へ。キャンバスは**前の依頼までの実装を積み重ねたコード** + 新しい部品になる(依頼は独立ではなく連続。依頼1の置き方が依頼2の土台になる)。挑戦を終える・やめると、挑戦前のコードに戻す(積み重ねは持ち越さない)。
5. 全件終わったら結果。キャンバスは挑戦前のコード。
   - 変更容易性スコア(`change-readiness`・`-current`・`-initial`): 今までどおり。**`current` が `null` でない依頼だけ**の平均
   - 実装スコア(`data-testid="change-placement-score"`): 全依頼の置き方の点数の平均(`averageScore` をそのまま使う。`PlacementScore` は `total` を持つので渡せる)
   - 依頼ごとのカード(`change-outcome-<id>`)
     - `'modify'`: 今の「今のコード / 初期状態 / 前回」(`outcome-current` など)と「変更が必要: …」の行
     - `'extend'`: この2行を出さず、「機能の追加なので、置き方だけで採点します」
     - 置き方(`data-testid="outcome-placement"`): 「置き方 X点(置いた先: <partClassName>)」
     - 減点理由: `describeDeductions`(コスト。`current` があるときだけ)に続けて `describePlacement`
   - 「リファクタリングに戻る」(`change-request-close`)でキャンバスと取り消し履歴が挑戦前に戻る
6. 編集パネルの `ChangeMemo` には、コストの理由に加えて置き方の理由も出す。変更箇所のバッジ(`change-site-badge`)は `current` があるときの `sites` だけで数える。

### 置き方の減点理由(`describeChange.ts` に追加)

```ts
export const PLACEMENT_RULE_LABEL: Record<PlacementRule, string>;
// 'open-closed': '既存クラスの修正', 'mixed-responsibility': '責務の混在', scattered: '責務の分散', unwired: '未接続', 'concrete-base': '具象クラスの継承'
export function describePlacement(outcome: ChangeOutcome, codebase: Codebase): string[]; // codebase は挑戦前のコード(lastChangeReport.codebase / ストアの base)
```

文の例(クラス名は `modifiedClassIds` / `attachedClassId` を `codebase` から引く。置いた先は `partClassName`):

- `open-closed`(extend): 「機能の追加なのに、既存のクラス(StripeGateway)を書き換えた。追加のたびに既存のコードを触ると、壊すおそれとテストの手間が増える」
- `open-closed`(modify): 「ルールの変更に必要な1クラスより多く、既存のクラス(…)を書き換えた」
- `mixed-responsibility`: 「置いた先の OrderService に、依頼と関係ない責務が4種類同居している」
- `scattered`: 「同じ種類の処理がすでにあるクラスとは別の場所に置いたので、その責務を持つクラスが1つ増えて散らばった」
- `unwired`: 「新しいクラスがどこからも呼ばれない。実際には呼び出し元の既存クラスを書き換えて、新しいクラスを名指しで呼ぶことになる」
- `concrete-base`: 「中身のある StripeGateway を継承して足した。親の実装が変わると巻き込まれる。中身のないインターフェースを実装する形なら避けられる」

## ステージ定義(infrastructure)

### 全依頼に `partName` を足す

既存クラスのメソッド名と重ならない、動詞で始まるcamelCaseにする。

| ステージ | 依頼ID | `partName` |
| --- | --- | --- |
| チュートリアル1 | `req-report-yoy` / `req-report-share` | `compareWithLastYear` / `buildShareColumn` |
| チュートリアル2 | `req-reduced-tax` / `req-mail-text` / `req-stock-rule` | `addReducedTaxItems` / `addContactGuide` / `validateQuantityLimit` |
| 初級1 | `req-mail-footer` / `req-soft-delete` | `appendUnsubscribeGuide` / `markUserDeleted` |
| 初級2 | `req-pdf-layout` / `req-rounding` | `adjustPdfLayout` / `roundHalfUp` |
| 中級1 | `req-price-rule` / `req-member-discount` | `applySaleDiscount` / `reviseRankDiscountRate` |
| 中級2 | `req-shipping-rule` / `req-points-rule` | `addRemoteIslandFee` / `extendPointExpiry` |
| 中級3 | `req-sms` / `req-log-format` | `sendSms` / `formatDeliveryLog` |
| 中級4 | `req-reduced-tax-items` / `req-tax-rounding` | `addNewspaperReducedTax` / `roundTaxPerInvoice` |
| 中級5 | `req-column-order` / `req-pdf-output` | `reorderColumnsForKeyAccount` / `renderPdfReport` |
| 上級1 | `req-notification-format` / `req-notification-log` | `insertInquiryNumber` / `logResendFlag` |
| 上級2 | `req-payment-logging` / `req-gateway-integration` | `logRetryCount` / `applyGatewayTimeout` |
| 上級3 | `req-premium-discount` / `req-vip-discount` | `revisePremiumRate` / `raiseVipPointRate` |
| 上級4 | `req-report-building` / `req-report-delivery` | `addExportedAtToTitle` / `retryReportDelivery` |
| 上級5 | `req-tab-delimiter` / `req-fiscal-year` | `switchToTabDelimiter` / `filterByFiscalYear` |

既存の依頼の `kind` は書かない(= `modify`)。コストの数値(stageCatalog・volatilityStages・payment-gateway-true-dip の各テスト)は変わらない。

### 上級2に「機能の追加」を1件足す

`advanced-payment-gateway-interface` の `changeRequests` の**先頭**に足す(E2Eで最初に出すため。クイズは上級2を使っていない):

```ts
{ id: 'req-add-paypay', title: 'PayPayでも払えるようにして', description: '決済手段にPayPayを追加したい。Stripe・PayPalの決済はこれまでどおり使う。',
  responsibility: 'gateway-integration', linesPerSite: 30, kind: 'extend', partName: 'chargeWithPaypay' },
```

`'extend'` の依頼を足すのは、呼ばれているインターフェース役が最初からある上級2だけにする。
上級3の `DiscountStrategy` は `DiscountService` から呼ばれていない(模範解答も具象クラスを直接呼ぶ)ので、新クラスで実装しても「未接続」になる。
上級1の `NotifierBase` も呼ばれていない。この2つに「機能の追加」を足すのは、ステージ側で呼び出しを抽象に向け直すときにする(未決事項)。

### テスト

- `stageCatalog.test.ts`
  - 全ステージの全依頼に、空でない `partName` がある
  - 全ステージの全依頼の `partName` が、そのステージの初期コードのメソッド名と重ならない
  - `changeReadiness` / `classesTouchedPerRequest` / `allRequestsHaveSites` は、`changeKindOf(request) === 'modify'` の依頼だけを対象にする。「2件以上ある」の件数も modify の件数で数える
- `advancedStages.test.ts`(`describe('advanced-payment-gateway-interface')` に追加)
  - `req-add-paypay` は `kind: 'extend'`
  - 初期コードと模範解答のあとの両方で、`withChangePart` → `moveMethodToNewClass` → 新クラスに `setSuperclass(…, 'PaymentGateway', 'implements')` → `measurePlacement` → `scorePlacement` が100点
  - 同じく `StripeGateway` へ `moveMethod` すると100点未満で、`open-closed` の count が1

## TDD対象の純粋関数

すべてVitest、`// Arrange` `// Act` `// Assert` のAAAで先に書く。フィクスチャはテストファイル内で作る(`testFixtures.ts` の `sampleCodebase` も使ってよい)。

### `changePart.ts`(`changePart.test.ts`)

- `changePart`: メソッドID・名前・可視性 public、Fragment 1つ(ID `<requestId>:part`・label = title・lines = linesPerSite・responsibility)
- `changePart`: `partName` がなければ名前は `addedLogic`
- `withChangePart`: 元のファイルがそのまま先に並び、末尾に `TRAY_FILE_ID` のファイルが1つ増え、その中に部品だけがある
- `withChangePart`: 元の Codebase を変更しない
- `isChangePartPlaced`: 直後は false、部品を既存クラスへ `moveMethod` すると true、そのクラスを `deleteClass` すると false
- `changeKindOf`: 省略時は `'modify'`、`'extend'` はそのまま

### `measurePlacement.ts`(`measurePlacement.test.ts`)

フィクスチャA(ルールの変更): `sampleCodebase()`(`OrderService.placeOrder` = validation・tax・persistence、空の `TaxCalculator`)と `tax` の依頼。

- 異常系: 部品が部品置き場に残っていると `err('unplaced-part')`
- 部品を `OrderService` へ: `partClassId` は `class-order`、`modifiedClassIds` は `['class-order']`、`otherResponsibilities` は2、`addedResponsibilityClasses` は0、`attachment` は `'existing-class'`
- 部品を `TaxCalculator` へ: `modifiedClassIds` は `['class-tax']`、`otherResponsibilities` は0、`addedResponsibilityClasses` は1
- 部品を余白へ(`moveMethodToNewClass`、継承なし): `modifiedClassIds` は空、`attachment` は `'none'`、`partClassName` は `NewClass`
- 部品を `OrderService` へ移してから `TaxCalculator` へ移し直すと、`OrderService` は触っていない扱い(並び順を見ない)
- 部品とは別に既存クラスの継承元を設定する・既存クラスを削除すると、そのクラスも `modifiedClassIds` に入る
- `'call'` の責務は `otherResponsibilities` に数えない
- 元の Codebase(base・implemented)を変更しない

フィクスチャB(機能の追加): `Service.run`(`uses: ['method-gateway-charge']`)、インターフェース役 `Gateway`(`charge`、`fragments: []`)、
`Gateway` を実装した具象 `StripeGateway`、誰からも呼ばれないインターフェース役 `UnusedPort`。

- 新クラスが `Gateway` を implements: `'abstract'`、`attachedClassId` は `Gateway`
- 新クラスが `StripeGateway` を extends: `'concrete'`、`attachedClassId` は `StripeGateway`
- `StripeGateway` の継承を外した状態で、新クラスが `StripeGateway` を extends: `'none'`
- 新クラスが `UnusedPort` を implements: `'none'`
- 新クラス → 別の新クラス → `Gateway` の順に継承: `'abstract'`(間の新しいクラスは飛ばす)
- `superclassId` が輪になった壊れたデータでも止まる(`'none'` を返す)

### `scorePlacement.ts`(`scorePlacement.test.ts`)

- 減点なしなら100点で、内訳は5ルールを常に表の順で返す
- `'modify'` で既存クラスを1つ触っても `open-closed` は0、2つなら count 1(-10)
- `'extend'` で既存クラスを1つ触ると `open-closed` は count 1(-10)
- `otherResponsibilities` 3 で `mixed-responsibility` は -15
- `addedResponsibilityClasses` 1 は `'modify'` なら -10、`'extend'` なら0
- `'none'` は -20、`'concrete'` は -10、`'abstract'` と `'existing-class'` は0
- 0点より下にはしない

### `ChangeRequestUseCases.ts`(`ChangeRequestUseCases.test.ts`)

- `'modify'`: `current` と `initial` にコストが入り(`current` は base で測る)、`placement` は base と implemented の比較になる
- `'extend'`: `current` と `initial` は `null`。依頼の責務がコードになくても `ok`
- 部品が未配置なら `err('unplaced-part')`
- `'modify'` で責務がコードにないなら `err('no-sites')`

## E2E(`e2e/refactor.spec.ts`)

ヘルパー `investigateRequests` を `implementRequests(page, targets)` に置き換える。`targets` は依頼ごとの置き先のクラス名、または `'new'`(余白へ)。
依頼ごとに `method-<partName>` を既存の `dragMethodToClass` / `dragToEmptyCanvas` で動かし、`change-request-finish` を押す(`partName` は依頼の順に引数で渡すか、ヘルパー内に表を持つ)。

書き換え・削除:

- 「変更が必要なメソッドを選んで調査を終えると…」→ 「挑戦すると部品置き場に新しい部品が出て、置くまで『実装を終える』は押せない。OrderService へ置いて終えると、コストと置き方の点数・理由が出る」。
  `class-部品置き場` の中に `method-addReducedTaxItems` がある / finish が disabled / 置いたあと enabled / 3件とも OrderService に置く /
  `req-reduced-tax` のカードで `outcome-current` が「70点」・`outcome-placement` が「80点」・「巻き込み」と「責務の混在」を含む
- 「調査で選び漏らすと修正漏れ」→ **削除**
- 「責務を分けたあとで同じ依頼を受けると…」→ 税を TaxCalculator へ移したあと `['TaxCalculator', 'OrderService', 'OrderService']` で実装。`outcome-current` は「95点」、`outcome-placement` は「100点」、変更容易性スコアは初期状態より高い
- 「結果画面から戻ると…」→ 戻ったあと `class-部品置き場` と `method-addReducedTaxItems` が0件で、`placeOrder` の行数が挑戦前と同じ
- 「調査中にカーソルを合わせると中身が見える」→ `data-investigated` の確認だけ消して残す
- 「調査で複数のメソッドを選ぶと…」→ **削除**
- 「結果はリファクタリングに戻っても手がかりとして残り…」「調査中は前回の変更箇所の印を出さない」→ `implementRequests` に置き換える(期待値は今のまま)

追加:

- 「実装中に Ctrl+Z で部品が部品置き場に戻る。挑戦を終えると、挑戦前の手を Ctrl+Z で戻せる」
  (挑戦前に `calculateTax` を抽出 → 挑戦 → 部品を置く → Ctrl+Z で部品置き場に戻る → やめる → Ctrl+Z で `method-calculateTax` が消える)
- 「上級2: PayPay の追加は、新しいクラスで PaymentGateway を実装すると100点になり、コストの行は出ない」
  (1件目: 余白へドラッグ → `class-header-NewClass` を右クリック →「実装するインターフェースを設定」→ `PaymentGateway`。
  2件目: 余白へドラッグだけ。3件目: `StripeGateway` へ。結果で `change-outcome-req-add-paypay` の `outcome-placement` が「100点」、その中に `outcome-current` がない。
  `change-outcome-req-payment-logging` が「未接続」を含む)

`e2e/blank.spec.ts` / `quiz.spec.ts` / `preview.spec.ts` / `critique.spec.ts` は変更なしで通ること。

## 実装の分割順序

どの段階も終わった時点で `npm run check` が通るようにする。

1. **型と部品**: `ChangeRequest` に `kind?` / `partName?` / `changeKindOf`、`changePart.ts`(テスト先行)。全ステージの依頼に `partName` を書き、stageCatalog の `partName` のテスト2つを足す。
2. **置き方の計測**: `measurePlacement.ts`(テスト先行)。
3. **置き方の採点**: `scorePlacement.ts`(テスト先行)。
4. **ユースケース**: `evaluateImplementationUseCase` と新しい `ChangeOutcome` をテスト先行で**別名として**足す(古い `evaluateChangeRequestUseCase` はまだ残す。型名がぶつかるなら新しい方を一時的に `ImplementationOutcome` にし、5で `ChangeOutcome` にまとめる)。
5. **画面の切り替え**: ストア・`ChangeRequestPanel`・`describeChange`(置き方の文言)・`ChangeMemo`・`MethodChip`・`StagePanel` を実装の流れに切り替え、E2Eの書き換えと Ctrl+Z のテストを足す。
6. **機能の追加の依頼**: 上級2に `req-add-paypay`、stageCatalog のコストのテストを modify に絞る、`advancedStages.test.ts`、上級2のE2E。
7. **調査の後片付け**: `checkInvestigation.ts` / `.test.ts`・古いユースケース・`scoreChange` の第2引数と `missed` / `extra`・`CHANGE_RULE_LABEL` と `describeDeductions` の該当分・`.method-chip--investigated` を消す。
   `scoreChange.test.ts` の内訳の期待値を4ルールにする。`docs/specs/change-request.md` の冒頭に置き換えの1行を足す。
   quiz・blank のテストとE2Eが**変更なしで**通ることを確かめる(減点0のルールが内訳から消えるだけで、表示は `points > 0` で絞っているため変わらない)。

## 受け入れ基準

1. `changePart` / `measurePlacement` / `scorePlacement` / `evaluateImplementationUseCase` に、上の「TDD対象」のケースを持つAAAのユニットテストがあり、通る。`vite.config.ts` のカバレッジ閾値を下回らない。
2. `measurePlacement` / `withChangePart` は元の Codebase を変更しない(テストで確認)。
3. 「期待される点数」の2つの表を、実装時に実測値で確かめる(ずれたら、ずれた理由と実測値を表に書き直す。`blank-design-mode.md` と同じやり方)。
4. `stageCatalog.test.ts` / `advancedStages.test.ts` / `volatilityStages.test.ts` が通り、既存の modify の依頼のコストの数値は変わらない。
5. E2E: 上の「書き換え・追加」がすべて通る。ほかのE2E(blank・quiz・preview・critique と refactor の残り)は変更なしで通る。
6. 挑戦を終えると、キャンバスと取り消し履歴が挑戦前と同じになる。部品置き場・部品・実装中に作ったクラスは残らない(E2Eで確認)。
7. 実装中に部品置き場の点数や動かした結果が、進捗(localStorage)に記録されない(`StagePanel` は `changeSession.base` で数える。コードレビューで確認)。
8. `checkInvestigation` と `toggleInvestigated` への参照が残っていない。`npm run check` と `npm run test:e2e` が通る。
9. lint: `as`・`!`・`enum` を使わない。関数60行・循環的複雑度12・引数4つまで(`evaluateImplementationUseCase` はちょうど4つ)。`measurePlacement` は定義の1〜5ごとに小さな関数へ分ける。

## スコープ外(いつ足すか)

- **初期状態で一番良い置き方をしたら何点か(置き方の「初期状態との比較」)**: 置き先の候補(既存クラスそれぞれ・継承なしの新クラス・既存クラスそれぞれを継承する新クラス)を全部試して最大値を取れば出せる。
  「設計を直すと、追加の仕方も良くできる」を数字で見せたくなったら足す。今は modify の依頼のコストの比較で足りる。
- **既存メソッドの中に処理を1つ足す操作・メソッド単位の採点**: 背景・目的を参照。
- **部品に `uses`(新しい処理が何を呼ぶか)を持たせること**: 「依存の向き」は、新しいクラスの呼ばれ方(つながり方)だけで測る。部品が何かを呼ぶ依頼が必要になったら `ChangeRequest` に `partUses?` を足す。
- **上級2以外への `'extend'` の依頼の追加・既存の依頼の `kind` の見直し**(中級3「SMSにも」、中級5「PDFでも」など): 呼ばれているインターフェース役がないステージでは、どう置いても理想にならない。ステージ側に抽象を用意するときに一緒に行う。
- **実装中の編集の制限**: 実装中は部品以外も動かせる。動かした既存クラスは `open-closed` で数えるので、制限はしない。
- **部品のドラッグのキーボード操作**: キャンバスのドラッグ操作は、リファクタリング・白紙設計と同じ水準のまま(別タスクで全モードまとめて直す)。
- **部品置き場のファイルに出る減点の印(⚠️)を消すこと**: 白紙設計と同じ扱い。
- **AI講評に置き方の結果を渡すこと**。
- **白紙設計の答え合わせ・設計くらべへの置き方の採点の導入**。

## 未決事項

実装は上の既定どおりに進めてよい。以下は遊んでもらってから見直す点。

- **調査フェーズは廃止する(推奨)**: 実装の中で「どこに置くか」を考えるので、影響箇所を選ぶ手順と役割が重なる。1依頼2ステップになりパネルも重くなる。
  残したい場合は、調査 → 実装の2段にして `missed` / `extra` を残す案になる(分割順序の7を行わない)。
- **インターフェース役に中身を入れる抜け道**: 部品を `PaymentGateway` に直接置くと90点で、「新クラスが具象を継承」と同じ点数になる。
  実際はインターフェースが具象になり、すべての実装に影響するので悪い置き方。プレイで気になったら、`attachment` に `'into-abstract'` を足して -10 する。
- **既存クラスは呼ばれている前提**: 誰にも呼ばれていない既存クラス(初期状態の空の `TaxCalculator`)に置いても「未接続」にならない。modify の依頼では `scattered` で減点されるが、extend の依頼では減点されない。
- **点数の重み**: `unwired` を -20(既存の修正と具象への依存の2つ分)にした。重すぎる・軽すぎると感じたら調整する。
- **変更容易性スコアと実装スコアを1つにまとめるか**: 今は別々に出す(コストは設計の性質、置き方はプレイヤーの判断で、初期状態との比較はコストにしかないため)。
- **部品の名前・ラベル**: 上級2の部品は `chargeWithPaypay` にした(`charge` にするとインターフェースと名前が揃って教科書どおりになるが、`StripeGateway` へ置こうとすると名前の重複で止まる)。
  部品のラベルは依頼の title を流用している。不自然なら `ChangeRequest` に `partLabel?` を足す。
- **部品置き場のモジュールの場所**: `domain/change` が `domain/blank/tray.ts` を参照する。気になるなら `tray.ts` を `domain/codebase/` へ移す(中身は変えない)。

## 追補: 依頼の積み重ね(連続改修)

依頼1の実装結果を依頼2の土台にする(全ステージの全依頼)。`ChangeSession.carried` に「今の依頼を始める前のコード」を持つ。
- 開始時 `carried = base`。「実装を終える」で `carried = withoutTray(実装後のコード)` にし、次の依頼は `withChangePart(carried, 次)` で始める。
- 置き方・変更コストの `base` には `carried` を渡す(依頼2の `current` は依頼1の実装後のコードで測る。`initial` は従来どおり `stage.codebase`)。
  前の依頼で作ったクラスを触ると、依頼2の `open-closed` の「触った既存クラス」に数える(OCPの体験としてそのままでよい)。
- 進捗記録・点数表示は従来どおり `base`。結果の理由文の名前引きには、前の依頼で作ったクラスも引けるよう `carried` を使う(`ChangeReport.codebase`)。
- 取り消し履歴は依頼ごとに空から(前の依頼までは戻れない)。
