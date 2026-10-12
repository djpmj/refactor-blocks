# change-impact-review: 答え合わせ画面(組み替える前と今を並べ、どの組み替えが効いたかを結びつける)

## 背景・目的

`post-perfect-flow`(#160)で、同じ変更を「冒頭(組み替える前)」と「仕上げ(100点のあと)」の2回、手で直させるようにした。
しかし、仕上げで正解したときに出るのは数字の比較1行だけで、次の2つが体験として結びつかない。

- **何が楽になったか**: 冒頭で光った(直した・直し忘れた)ブロックと、今回光ったブロックの違い
- **なぜ楽になったか**: プレイヤー自身のどの組み替え(抽出・移動・統合)が、その違いを生んだか

設計の納得感は、「この設計にしておいたおかげで、後から来た変更を一撃で入れられた」という**因果**がつながったときに生まれる。
そこで、仕上げの手直しに正解した直後に**答え合わせ画面**を開く。左に組み替える前、右に今の図を並べ、変更が必要なメソッドを光らせる。
その下に「あなたが『○○』を A から B に切り出したので、読む量が 54行 → 19行 になった」と、判断と結果を結びつける文章を出す。

この仕様は #160(`post-perfect-flow`)の実装を前提にする(`stageStep`・冒頭の手直しの結果・仕上げの手直しの正解)。

## 変更対象ファイル一覧

| 種別 | パス | 層 | 役割 |
| --- | --- | --- | --- |
| 新規 | `src/domain/change/changeImpact.ts` | domain | 組み替える前と今のコードから、変更箇所の前後と、変更に関わる処理の移り先を求める純粋関数 |
| 新規 | `src/domain/change/changeImpact.test.ts` | domain | 上のテスト |
| 新規 | `src/presentation/change/describeImpact.ts` | presentation | `ChangeImpact` から因果の文章を組み立てる純粋関数 |
| 新規 | `src/presentation/change/describeImpact.test.ts` | presentation | 上のテスト |
| 新規 | `src/presentation/change/ChangeImpactDialog.tsx` | presentation | 答え合わせ画面(ネイティブの `dialog`。左右に図、下に数字と文章) |
| 変更 | `src/presentation/preview/CodebasePreviewContext.ts` | presentation | メソッドを光らせる指定(`highlights`)を足す |
| 変更 | `src/presentation/preview/CodebasePreviewCanvas.tsx` | presentation | `highlights` を受け取って Context に渡す |
| 変更 | `src/presentation/preview/PreviewClassNode.tsx` | presentation | 光らせる指定のあるメソッドにクラスを付ける |
| 変更 | `src/presentation/store/useGameStore.ts` | presentation | 冒頭の手直しの結果に印を付けたメソッドのIDを持たせる。答え合わせ画面の開閉の状態を持つ |
| 変更 | `src/presentation/stage/ManualFixPanel.tsx` | presentation | 仕上げで正解したら答え合わせ画面を開く。「答え合わせを見る」ボタン |
| 変更 | `src/presentation/stage/ChangePainCard.tsx` | presentation | 段階が `'change-request'` のとき「答え合わせを見る」ボタンを出す |
| 変更 | `src/index.css` | presentation | 答え合わせ画面と、光らせるメソッドのスタイル |
| 新規 | `e2e/change-impact-review.spec.ts` | E2E | 答え合わせ画面が開き、前後の図と文章が出ることを確かめる |

`application` / `infrastructure` は変更しない。

## データ・型の変更

### domain

```ts
// src/domain/change/changeImpact.ts

/** 変更が必要なメソッド1つ分(表示用の名前と行数つき)。 */
export type ImpactSite = {
  readonly methodId: string;
  readonly className: string;
  readonly methodName: string;
  /** methodLines(method, codebase) */
  readonly lines: number;
};

export type ImpactSide = {
  /** findChangeSites の順。 */
  readonly sites: readonly ImpactSite[];
  /** sites の lines の合計(PainSummary.readLines と同じ数え方)。 */
  readonly readLines: number;
};

/**
 * 変更に関わる処理(依頼の責務を持つ Fragment)が、組み替える前のどのメソッドから、今のどのメソッドへ移ったか。
 * - 'gathered': 組み替える前は2つ以上のメソッドにあった処理が、今は1つのメソッドにまとまっている
 * - 'extracted': 組み替える前は1つのメソッドにあり、今は別のメソッド(新しく作ったもの・別のメソッド)にある
 * - 'moved': 同じメソッドのまま、別のクラスへ移った
 */
export type ImpactMove = {
  readonly kind: 'gathered' | 'extracted' | 'moved';
  /** 移った処理の Fragment の label(今のコードでの出現順、重複なし)。 */
  readonly fragmentLabels: readonly string[];
  /** 組み替える前にあったメソッド(出現順、重複なし)。 */
  readonly from: readonly ImpactSite[];
  /** 今あるメソッド。 */
  readonly to: ImpactSite;
};

export type ChangeImpact = {
  readonly before: ImpactSide;
  readonly after: ImpactSide;
  readonly moves: readonly ImpactMove[];
  /** 'better' = 直す場所が減った、または同じ数で読む量が減った。'same' = どちらも変わらない。'worse' = それ以外。 */
  readonly verdict: 'better' | 'same' | 'worse';
};

/** initial = ステージの初期コード(stage.codebase)、current = 今のコード。依頼の責務を持つメソッドが前後どちらかに無ければ undefined。 */
export function explainChangeImpact(initial: Codebase, current: Codebase, request: ChangeRequest): ChangeImpact | undefined;
```

`moves` の求め方:

1. 組み替える前のコードで、Fragment の `id` から、それを含むメソッドの `id` を引ける表を作る
2. 今のコードの変更箇所(`findChangeSites(current, request)`)のメソッド M ごとに、M の中の依頼の責務を持つ Fragment を集める
3. それぞれの Fragment について、1の表で組み替える前のメソッドを引く。見つからない Fragment(統合などで新しくできたもの)は無視する
4. 引けた組み替える前のメソッドの集合を `from` とし、
   - 2つ以上 → `'gathered'`
   - 1つで、M と違うメソッド → `'extracted'`
   - 1つで M と同じメソッドだが、持ち主のクラスが組み替える前と違う → `'moved'`
   - 1つで M と同じメソッド・同じクラス → `moves` に入れない(動かしていない)
   - 0(全部見つからない) → `moves` に入れない
5. `moves` は今のコードの変更箇所の順に並べる

`// ponytail: Fragment の id が組み替えの前後で保たれる前提。統合(merge)で id が変わる処理は追えず、数字の比較だけになる。追えないケースが目立ったら、統合時に元の id を記録する` を残す。

### presentation(ストア)

- #160 の `OpeningFix` に、冒頭で印を付けたメソッドのIDを足す

  ```ts
  type OpeningFix = { readonly missed: number; readonly extra: number; readonly sites: number; readonly fixedIds: readonly string[] };
  ```

  直し忘れたメソッドは、表示のときに `checkManualFix(stage.codebase, request, fixedIds).missed` で求め直す(IDを二重に持たない)。
- `GameState` に `impactReviewOpen: boolean` を足す。仕上げの手直しで正解したとき `true`、ダイアログを閉じたら `false`、ステージを切り替えたら `false`
- `openImpactReview: () => void` / `closeImpactReview: () => void` を足す

### presentation(プレビュー)

```ts
// CodebasePreviewContext.ts
export type MethodHighlight = 'site' | 'missed';
export type CodebasePreviewValue = {
  // 既存のものに加えて
  readonly highlights?: ReadonlyMap<string, MethodHighlight>;
};
```

## 見た目・動きの仕様

### 開き方

- 仕上げの手直しで正解した直後に、答え合わせ画面が自動で開く(`showModal()`)
- 閉じたあとは、手で直すパネル(正解の表示)とカード(段階 `'change-request'`)にある「答え合わせを見る」ボタン(`data-testid="impact-review-open"`)で開き直せる
- `explainChangeImpact` が `undefined` のときは、自動で開かず、ボタンも出さない

### 答え合わせ画面(`ChangeImpactDialog`)

- ネイティブの `dialog`(`data-testid="impact-review"`、`aria-labelledby` で見出しを指す)。Esc と閉じるボタンで閉じる。`CodebasePreviewDialog` と同じ作り(`WindowControls` の閉じる・最大化)にする
- 見出し: `答え合わせ: 「<依頼の title>」`
- 本文の上半分: 左右に2つの `CodebasePreviewCanvas`(読み取り専用、ホイールでズームしない)
  - 左: 見出し「組み替える前」、図は `stage.codebase`
    - 組み替える前の変更箇所のメソッドを `'site'` で光らせる
    - 冒頭で直し忘れたメソッドは `'missed'`(赤)で光らせる(冒頭の結果が無いときは `'site'` だけ)
    - 図の下に `直す場所 A か所・読む量 B 行`。冒頭の結果があれば `(冒頭のあなた: 直し忘れ C か所)`
  - 右: 見出し「今」、図は今のコード
    - 今の変更箇所のメソッドを `'site'` で光らせる
    - 図の下に `直す場所 D か所・読む量 E 行`
  - 幅が 900px 未満のときは上下に並べる
- 本文の下半分: 因果の文章(`describeImpact` の結果)を `data-testid="impact-explanation"` の中に箇条書きで出す
- 光らせ方
  - `'site'`: `var(--accent)` の太い枠線と薄い背景、左上に小さな「直す」ラベル
  - `'missed'`: `var(--danger)` の枠線と薄い赤の背景、ラベルは「直し忘れ」
  - 色だけに頼らず、ラベルの文字でも区別する

### 因果の文章(`describeImpact`)

`describeImpact(impact: ChangeImpact, openingMissed: number | null): readonly string[]` を作る。1要素が1行。

1. `moves` ごとに1行(`labels` は `fragmentLabels` を `「」` でくくって `・` でつないだもの。`to` は `クラス名.メソッド名()`)
   - `'gathered'`: `<from の数> か所に散らばっていた <labels> を、あなたが <to> にまとめた`
   - `'extracted'`: `あなたが <labels> を <from[0]> から <to> に切り出した`
   - `'moved'`: `あなたが <to のメソッド名>() を <to のクラス名> に移した`
2. 結果の1行
   - `verdict === 'better'`: `だから、この変更で直す場所は A か所 → D か所、読む量は B 行 → E 行 になった`(変わらない方の数は `A か所のまま` のように書く)
   - `verdict === 'same'`: `この変更については、組み替えの前後で直す場所も読む量も変わらなかった。変わりそうな場所で分けられているか、見直してみよう`
   - `verdict === 'worse'`: `この変更については、組み替える前より直す場所か読む量が増えた。変わりそうな処理が散らばっていないか、見直してみよう`
3. 冒頭の結果があり、`openingMissed > 0` のとき、最後に1行: `冒頭では C か所を直し忘れて本番バグになったが、今回は直し忘れなし`

`moves` が空で `verdict === 'better'` のとき(処理の移り先を追えなかった)は、2の行だけを出す。

## TDD対象の純粋関数

### `explainChangeImpact`(`domain/change/changeImpact.ts`)

- 抽出: 組み替える前は `printMonthlyReport` だけが集計の処理を持ち、今は `aggregateSales` に切り出してある →
  `before.sites` が `printMonthlyReport` の1件、`after.sites` が `aggregateSales` の1件、`moves` が `'extracted'` 1件(`from` = `printMonthlyReport`、`to` = `aggregateSales`)、`verdict: 'better'`(読む量が減った)
- 統合: 組み替える前は2つのメソッドに税の処理があり、今は `TaxCalculator.calculate` 1つにまとまっている(Fragment の id は片方が残る) →
  `before.sites` 2件、`after.sites` 1件、`moves` が `'gathered'`、`verdict: 'better'`
- 移動: 同じメソッドを別のクラスへ移しただけ → `moves` が `'moved'` 1件
- 動かしていない: 組み替える前と今で、変更箇所のメソッドもクラスも同じ → `moves` は空、`verdict: 'same'`
- 悪化: 今のほうが変更箇所が多い → `verdict: 'worse'`
- 追えない Fragment: 今の変更箇所の Fragment の id が組み替える前に無い → その Fragment は `moves` に入らない
- 依頼の責務を持つメソッドが今のコードに無い → `undefined`

### `describeImpact`(`presentation/change/describeImpact.ts`)

- `'extracted'` 1件・`better`・冒頭の直し忘れ 0 → 切り出しの行と結果の行の2行
- `'gathered'` 1件・`better`・冒頭の直し忘れ 2 → まとめの行・結果の行・直し忘れの行の3行
- `'moved'` → `あなたが calculate() を TaxCalculator に移した`
- 直す場所の数が同じで読む量だけ減った → 結果の行が `直す場所は 1 か所のまま、読む量は 54 行 → 19 行 になった`
- `same` / `worse` → それぞれの見直しを促す文
- 冒頭の結果なし(`null`) → 直し忘れの行を出さない

## 受け入れ基準

1. チュートリアル1で、冒頭の手直し → 組み替えて100点 → 仕上げの手直しに正解すると、答え合わせ画面(`impact-review`)が自動で開く
2. 左の図(組み替える前)では `printMonthlyReport` が「直す」として光り、右の図(今)では切り出した集計のメソッドが「直す」として光る
3. 冒頭で直し忘れていた場合、左の図でそのメソッドが「直し忘れ」として赤く光り、図の下に冒頭の直し忘れの数が出る
4. `impact-explanation` に、プレイヤーが切り出したメソッド名を含む因果の文と、`読む量は B 行 → E 行` の結果の文(B は初期コードの `printMonthlyReport` の行数、E は今の集計のメソッドの行数)が出る
5. 閉じたあと、「答え合わせを見る」で同じ内容をもう一度開ける。ステージを切り替えると閉じていて、自動では開かない
6. 下書きから再開して冒頭の結果が無いときも、答え合わせ画面は開き、左の図は「直す」だけが光り、直し忘れの行は出ない
7. 幅 800px で開くと、2つの図が上下に並び、横スクロールが出ない
8. `npm run check` と `npm run test:e2e` が通る

## スコープ外

- AI 講評による因果の説明(ルールで作る文だけにする)
- extend(新しい種類を足す)依頼の答え合わせ
- 変更依頼に挑戦した結果(部品を置いた先)の答え合わせへの組み込み
- 統合で id が変わった Fragment を追うための、統合の記録の追加
- 答え合わせ画面の図で、プレイヤーがキャンバスで置いた位置を再現すること(自動配置で描く)
- 答え合わせの結果の保存
