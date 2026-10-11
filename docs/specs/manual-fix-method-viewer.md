# 「実際に直してみる」中に、クリックしたメソッドの処理一覧を右側に読み取り専用で出す

> **前提**: `missed-fix-experience`(手で直すシミュレーション)と `preview-method-panel`(PR #145 の `PreviewMethodPanel`)のマージ後に実装する。

## 背景・目的

「実際に直してみる」(`manualFix`)の最中は、`MethodChip` をクリックしても「直した」印が付く・外れるだけで、
右サイドバーのメソッド選択(`selectMethod`)は行わない(`missed-fix-experience` の仕様)。そのため右サイドバーには
シミュレーションを始める前に選んでいたメソッドが残ったままで、**いま印を付けたメソッドが何をしているのか分からない**。
プレイヤーは処理の名前(「消費税を計算する」など)から直す場所を探すので、処理の一覧が見えないと当てずっぽうになる。

そこで、`manualFix` 中にメソッドをクリックしたら、右サイドバーにそのメソッドの処理一覧を**読み取り専用**で出す。
シミュレーション中にうっかり抽出などの編集をしないよう、通常のメソッドエディタではなく PR #145 の `PreviewMethodPanel` を使い回す。

印の付け外し・リリース後の結果表示・採点は変えない。

## 変更対象ファイル一覧

| パス | 層 | 新規/変更 | 役割 |
| --- | --- | --- | --- |
| `src/presentation/store/useGameStore.ts` | presentation | 変更 | `ManualFix` に `viewedMethodId` を足す。`toggleFixed` がそれを更新する(下記) |
| `src/presentation/store/useGameStore.test.ts` | presentation | 変更 | `toggleFixed` と `viewedMethodId` のテスト(TDD、下記) |
| `src/presentation/stage/ManualFixMethodViewer.tsx` | presentation | 新規 | `manualFix` 中の右サイドバー。見ているメソッドの `PreviewMethodPanel` か案内文を出す(下記) |
| `src/presentation/App.tsx` | presentation | 変更 | 右サイドバーの出し分けに `manualFix !== null` のときの `ManualFixMethodViewer` を足す |
| `src/index.css` | presentation | 変更 | 右サイドバーの中では `PreviewMethodPanel` の幅を固定(360px)せず、サイドバーの幅に合わせる |
| `e2e/manual-fix.spec.ts` | E2E | 変更 | クリックしたメソッドの処理一覧が右側に出る、編集用の操作が出ない(下記) |

`domain`・`application` 層の変更は無い(表示する状態を1つ足すだけで、ドメインのルールは変わらない)。
`PreviewMethodPanel` は中身を変えずに使う(幅だけ親側の CSS で上書きする)。

## 見た目・内容の仕様

### クリックしたときの動き(`MethodChip` → `toggleFixed`)

- `manualFix` 中に `MethodChip` をクリック(または Enter/Space)すると、今までどおり「直した」印が付く・外れる。**あわせて**
  そのメソッドを「見ているメソッド」(`viewedMethodId`)にする。印を外すクリックでも、見ているメソッドはそのメソッドになる
- リリース後(`released === true`)は、今までどおり印は切り替わらないが、`viewedMethodId` は更新する
  (直し忘れと言われたメソッドの中身を確かめられるようにする)
- `selectMethod` は今までどおり呼ばない。`selectedMethodId` は変わらず、キャンバスのメソッドの選択の見た目(`.method-chip--selected`)も付かない
- ドラッグ操作は変えない

### 右サイドバー(`ManualFixMethodViewer`)

`App.tsx` の右サイドバーは、上から次の順で出し分ける。

1. 変更依頼の調査・実装中(`investigating`) → 今までどおり `ChangeRequestPanel`
2. `manualFix !== null` → `ManualFixMethodViewer`
3. それ以外 → 今までどおり `MethodEditor`

`ManualFixMethodViewer`:

- `viewedMethodId` のメソッドが今のコードベース(`codebase`)にあるとき: `<PreviewMethodPanel codebase={codebase} methodId={viewedMethodId} />`
  (`key={viewedMethodId}` を付け、メソッドが変わったら「編集」タブに戻す)。`クラス名.メソッド名()` と行数、処理の一覧
  (ラベル・行数・フィールド参照)、「コード」タブが出る。チェックボックス・抽出ボタン・名前の入力など、編集用の操作は出ない
- `viewedMethodId` が `null`、またはそのメソッドが今のコードベースに無い(`manualFix` 中の undo などで消えた)とき:
  案内文「メソッドをクリックすると、ここにそのメソッドの処理の一覧が出ます」を出す
- 変更箇所のヒント(どの処理を直せばよいか)は出さない(`missed-fix-experience` のスコープ外を守る)
- `aria-label="手で直す中のメソッドの内容"` の領域にする

### 状態のリセット

- `startManualFix` / `restartManualFix`(「もう一度やる」)で `viewedMethodId` は `null` に戻る(`NEW_MANUAL_FIX` に含める)
- `endManualFix`(「閉じる」「やめる」)・ステージ切り替え・「最初に戻す」で `manualFix` が `null` になると、右サイドバーは `MethodEditor` に戻り、
  シミュレーション前に選んでいたメソッド(`selectedMethodId`)がそのまま出る

### 幅(`index.css`)

- `.codebase-preview__panel` は 360px 固定・左の境界線付きなので、`ManualFixMethodViewer` の中では幅を `auto`、左の境界線を無しにして、
  右サイドバー(`sidebar-resizable`)の幅に合わせる。サンプル解答の再生ダイアログでの見た目は変えない

## データ・型の変更

`src/presentation/store/useGameStore.ts`:

```ts
type ManualFix = {
  readonly fixedIds: readonly string[];
  readonly released: boolean;
  /** 右サイドバーに処理の一覧を出しているメソッド。最後にクリックしたメソッド。 */
  readonly viewedMethodId: string | null;
};

const NEW_MANUAL_FIX: ManualFix = { fixedIds: [], released: false, viewedMethodId: null };
```

アクションの追加は無い。`toggleFixed(methodId)` が、`released` にかかわらず `viewedMethodId: methodId` を設定し、
`released === false` のときだけ `fixedIds` を切り替える。`manualFix === null` のときは今までどおり何もしない。

## TDD対象の純粋関数

`domain` の純粋関数の追加は無い。ストアの振る舞いを `useGameStore.test.ts` で先に書く(AAA)。

1. `startManualFix` 直後は `viewedMethodId` が `null`
2. `toggleFixed(id)` で印が付き、`viewedMethodId` が `id` になる
3. 同じ `id` でもう一度 `toggleFixed` すると、印は外れ、`viewedMethodId` は `id` のまま
4. 別の `id2` で `toggleFixed` すると、`viewedMethodId` が `id2` になる
5. `releaseManualFix` の後に `toggleFixed(id3)` すると、`fixedIds` は変わらず、`viewedMethodId` は `id3` になる
6. `restartManualFix` で `viewedMethodId` が `null` に戻る
7. `manualFix === null` のときの `toggleFixed` は何もしない(`manualFix` は `null` のまま)
8. `toggleFixed` は `selectedMethodId` を変えない

## 受け入れ基準

- `npm run check` が通る
- `npm run test:e2e` が通る(`manual-fix.spec.ts` の既存の検証、`MethodChip` のクリック・ドラッグの既存E2Eが壊れない)
- 「実際に直してみる」を押した直後の右サイドバーには、案内文「メソッドをクリックすると、ここにそのメソッドの処理の一覧が出ます」が出る
  (シミュレーション前に選んでいたメソッドのエディタは出ない)
- メソッドをクリックすると、印が付くとともに、右サイドバーに `クラス名.メソッド名()` と、そのメソッドの処理のラベルの一覧が出る。
  別のメソッドをクリックすると、そのメソッドの一覧に切り替わる。キーボード(Enter/Space)で印を付けたときも同じ
- 右サイドバーに、処理を選ぶチェックボックスや「選んだ処理をメソッドとして抽出」ボタンが出ない
- 「コード」タブに切り替えると、そのメソッドのクラスのコードが出る
- リリース後にメソッドをクリックすると、印は変わらないが、右サイドバーはそのメソッドの一覧になる
- 「もう一度やる」で案内文に戻る。「閉じる」「やめる」で通常のメソッドエディタに戻り、シミュレーション前の選択が出る
- キャンバスのメソッドの選択の見た目(`.method-chip--selected`)は、シミュレーション中に付かない(既存の検証のまま)
- サンプル解答の再生ダイアログの `PreviewMethodPanel` の見た目・幅が変わらない

E2E(`e2e/manual-fix.spec.ts` に追記): 中級9で「実際に直してみる」→ 案内文が出る → `method-confirm` をクリック →
右サイドバーの「手で直す中のメソッドの内容」に `OrderService.confirm()` と「消費税を計算する」のラベルが出て、抽出ボタンが無い →
`method-issue` をクリック → `InvoiceService.issue()` に切り替わる。

## スコープ外

- 右サイドバーでの「直した」印の付け外し(印はキャンバスのクリックだけで付ける)
- 変更箇所のヒント表示(直すべき処理の強調など)
- ホバーで処理一覧を出すなど、クリック以外の表示方法
- 見ているメソッドのキャンバス上での強調
- `manualFix` 中の編集(抽出・移動など)の可否の変更(今までどおり許す。右サイドバーから編集できなくなるだけ)
- 変更依頼の調査・実装中(`ChangeRequestPanel`)の右サイドバーの変更
