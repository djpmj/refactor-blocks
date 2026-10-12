# file-mark-reasons: ファイルの禁止・警告アイコンにマウスを乗せると減点の理由を出す

## 背景・目的

キャンバスのファイルの箱(`FileNode`)には、減点があると `⚠️`(修正が必要)・`⛔`(危険、30点以上)のアイコン(`FileMark`)が出る。
今はブラウザ標準の `title` に「修正が必要: -5点」と点数が出るだけで、**なぜ減点されたのかが分からない**。
たとえば中身の無い `UserRepository` に `⚠️` が出ていても、「空のクラス」が理由だと気づけない。

ファイルの減点は `fileDeductions`(`domain/scoring/fileScores.ts`)で違反ごとに数えているが、
ファイルごとの合計だけを返していて、何のルールで引かれたかの内訳を捨てている。

そこで、内訳を返すドメイン関数を足し、アイコンにマウスを乗せたとき(またはキーボードでフォーカスしたとき)に、
減点の理由と「なぜ困るのか」を吹き出しで出す。

## 変更対象ファイル一覧

| 種別 | パス | 層 | 役割 |
| --- | --- | --- | --- |
| 変更 | `src/domain/scoring/fileScores.ts` | domain | `fileDeductionReasons` を足し、`fileDeductions` はその合計から出すように書き換える |
| 変更 | `src/domain/scoring/fileScores.test.ts` | domain | `fileDeductionReasons` のテストを足す。既存の `fileDeductions` のテストは変えずに通す |
| 新規 | `src/presentation/canvas/FileMarkPopover.tsx` | presentation | アイコンの吹き出し。`createPortal` で `document.body` に出す |
| 変更 | `src/presentation/canvas/FileNode.tsx` | presentation | `FileMark` をフォーカスできるようにし、マウスを乗せた・フォーカスしたときに吹き出しを出す |
| 変更 | `src/index.css` | presentation | 吹き出しのスタイル |
| 新規 | `e2e/file-mark-reasons.spec.ts` | E2E | マウスを乗せる・フォーカスすると理由が出ることを確かめる |

`application` / `infrastructure` は変更しない。

## データ・型の変更

```ts
// src/domain/scoring/fileScores.ts
import type { ScoreRule } from './score';

/** ファイルの減点1件分。 */
export type FileDeductionReason = {
  /** 何のルールでの減点か。 */
  readonly rule: ScoreRule;
  /** 違反しているブロック(メソッド・クラス・ファイル)のID。表示側で名前を引く。 */
  readonly targetId: string;
  /** この1件の減点(POINTS_PER_VIOLATION)。 */
  readonly points: number;
};

/** ファイルごとの減点の内訳。すべてのファイルのキーを持ち、減点の無いファイルは空配列。 */
export function fileDeductionReasons(
  codebase: Codebase,
  stage: Pick<Stage, 'limits' | 'dependencyLimit' | 'responsibilityLimit' | 'visibilityEnforced'>,
): Map<string, readonly FileDeductionReason[]>;
```

- 今の `fileDeductions` の `violatingTargetIds` に並んでいる各違反に、次のルールを対応させる(数え方・持ち主のファイルの決め方は今のまま)
  - `findLineLimitViolations` → `'line-limit'`
  - `findResponsibilityViolations` → `'responsibility'`
  - `findCouplingViolations` → `'coupling'`
  - 循環している依存の `from` → `'cycle'`
  - `findEmptyContainers` → `'empty'`
  - `findUnusedPrivateMethods` → `'unused'`
  - `findLoneSuperclasses` → `'lone-superclass'`
  - `findStubMethods` → `'stub'`
  - `findContractViolations` → `'contract'`
  - `findFeatureEnvy` → `'feature-envy'`
  - `findEncapsulationViolations`(呼んでいる側のクラス)・`findOpenSetters` → `'encapsulation'`
  - `countedVisibilityViolations`(呼んでいる側のクラス) → `'visibility'`
  - `findLowCohesionClasses` → `'cohesion'`
  - `findTrivialMethods` → `'trivial-method'`
  - `findThinClasses` → `'thin-class'`
  - `findMiddleManClasses` → `'middle-man'`
- `fileDeductions` は `fileDeductionReasons` の各ファイルの `points` の合計として出す(関数の型・戻り値は変えない)。
  違反の列挙を2か所に持たないこと
- 並び順は上のルールの順、同じルールの中では違反が見つかった順

## 見た目・動きの仕様

### アイコン(`FileMark`)

- `tabIndex={0}` にしてキーボードでフォーカスできるようにする。クラス `nodrag nopan` を付け、マウスを乗せたりクリックしたりしてもキャンバスのドラッグ・パンに取られないようにする
- `title` 属性は消す(標準のツールチップと吹き出しが二重に出るため)。`aria-label` は今の「危険: -N点」「修正が必要: -N点」を残し、`aria-describedby` で吹き出しを指す
- 次のとき吹き出しを出す
  - マウスを乗せたとき(`pointerenter`)。外したら(`pointerleave`)閉じる
  - キーボードでフォーカスしたとき(`focus`)。フォーカスが外れたら(`blur`)閉じる。`Escape` でも閉じる
- メソッドなどをドラッグしている最中は出さない(ドラッグ中に吹き出しがドロップ先を隠さないように)

### 吹き出し(`FileMarkPopover`)

- `role="tooltip"`、`data-testid="file-mark-reasons"`。`createPortal` で `document.body` に出し、アイコンの `getBoundingClientRect()` の下に `position: fixed` で置く
  (ファイルの箱の中に置くと、React Flow の子ノード(クラス)や隣のファイルの箱の下に隠れるため)。画面の右端・下端からはみ出すときは内側に寄せる
- 中身
  - 見出し: `修正が必要: -N点` または `危険: -N点`(アイコンの `aria-label` と同じ文言)
  - 減点ごとに1項目: `<ルール名>: <対象の名前> -<点>点`
    - ルール名は `RULE_LABEL`(`presentation/stage/describeScore.ts`)を使う
    - 対象の名前: メソッドなら `クラス名.メソッド名()`、クラスならクラス名、ファイルならファイルのパス。見つからなければIDのまま
  - 吹き出しに出てくるルールごとに1回だけ、`RULE_WHY[rule].trouble`(`presentation/stage/ruleWhy.ts`)を小さめの文字で添える(同じルールの減点が複数あっても繰り返さない)
- 最大幅は 320px 程度。ライトテーマ・ダークテーマの両方で読める配色にする(既存のトークン `--surface` / `--border` / `--text` を使う)
- ズームで詳細を隠しているとき(`useShowDetails` が `false`)でもアイコンは出ているので、吹き出しも出す

## TDD対象の純粋関数

### `fileDeductionReasons`(`domain/scoring/fileScores.ts`)

- 正常系: 中身の無いクラスだけを持つファイル → そのファイルに `{ rule: 'empty', targetId: <クラスID>, points: POINTS_PER_VIOLATION }` が1件
- 正常系: 行数の上限を超えたメソッド2つを持つファイル → `'line-limit'` が2件で、それぞれ `targetId` がそのメソッドのID
- 正常系: 依存先が多すぎるクラス → 依存元のクラスがあるファイルに `'coupling'` が付き、依存先のファイルには付かない
- 正常系: 1つのファイルに別々のルールの違反がある → 上の「ルールの順」で並ぶ
- 境界: 違反の無いファイル → キーはあり、空配列
- 整合: 既存の `fileDeductions` のテストのコードベースそれぞれで、`fileDeductionReasons` の点数の合計が `fileDeductions` と一致する

表示(吹き出しの位置・文言)は E2E で確かめる。

## 受け入れ基準

1. 初級の `beginner-user-controller` の初期状態で、中身の無い `UserRepository` のファイルの `⚠️` にマウスを乗せると、`file-mark-reasons` が出て「空のクラス・ファイル: <クラス名> -5点」と、空のクラスがなぜ困るかの説明が書かれている
2. 同じステージの `⛔` のファイル(`UserController`)にマウスを乗せると、減点がすべて並び、その合計が見出しの点数と一致する
3. マウスを外すと吹き出しが消える。Tab でアイコンにフォーカスしても吹き出しが出て、`Escape` かフォーカスを外すと消える
4. 吹き出しは隣のファイルの箱・クラスの箱に隠れずに読める
5. アイコンにマウスを乗せたまま押しても、ファイルの箱が動かず、キャンバスもパンしない
6. メソッドをドラッグしている最中は、吹き出しが出ない
7. 既存の `fileDeductions` のテストが変更なしで通り、`npm run check` と `npm run test:e2e` が通る

## スコープ外

- クラス・メソッドの箱にある行数の赤字(`line-badge--over`)などへの理由表示
- 吹き出しの中から違反のブロックへジャンプ・強調する操作(既存の減点の内訳の「場所へ移動」機能で足りる)
- メソッドをドラッグして重ねたときに、ドロップ後の減点を先回りして出すこと
- `fileDeductions` が数えていないルール(`misplaced`・`layer`・`mixed-method`)をファイルの減点に入れること(点数の付き方が変わるため)
