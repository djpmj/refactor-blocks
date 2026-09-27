# 仕様草案: メソッドエディタに「呼ぶメソッド」と「呼び出し元」を表示する

- slug: `method-call-references`
- 元になった探索: `docs/pipeline/method-call-references/01-discovered.md`

## 1. 背景・目的

- クラス間の依存の矢印・結合度・循環依存・アクセス制御・未使用の private は、処理(Fragment)の `uses`(呼ぶメソッドのID)から計算している。
  しかし **どのメソッドがどのメソッドを呼んでいるかは画面のどこにも出ていない**。プレイヤーはラベルの自然文から推測するしかない。
  - 中級1: `Order.checkout` →「合計金額を求める」→ `Customer.calculateOrderTotal` → `Order.getLines` のつながりが見えない
  - 可視性の選択欄の「public は他のクラスから…呼ばれているときだけ選べます」の**呼び出し元を確かめる手段が無い**
  - Extract Method が残す呼び出し行のラベル `xxx() を呼び出す` は、Move Method 後も名前変更後も書き換わらず、移し先のクラスも今の名前も分からない
- フィールドの読み書きはすでに処理ごとに「読む: Account.balance」の形で出している(`docs/specs/fields-and-feature-envy.md`)。
  同じ粒度・同じ書式でメソッド呼び出しを出すのは既存方針の延長で、IDEの「定義へ移動」「参照を検索」に当たる情報を渡すことになる。

**本当に新しい仕組みが要るか**:
- 処理ごとの「呼ぶ:」は要らない。`fragment.uses` と既存の `findMethod`・`findClassOfMethod` で、`fieldRefText` と同じ形の表示関数を1つ書けば出せる
- メソッドごとの「呼び出し元」は、`uses` を逆に引く関数が要る。同じことを `changeVisibility.ts` の非公開関数 `callerClassIdsOf` が
  クラス単位でやっているので、**メソッド単位の小さな関数を1つ作り、`callerClassIdsOf` もそれを使うように寄せる**(下の設計判断2)。
  これで「画面に出る呼び出し元」と「可視性の選択肢が disabled になる根拠」が同じ定義になる
- ストア・application 層・ステージ定義・採点は変更しない

### Move Method 等のあとの追従

表示は毎回、今の `codebase` から ID で引き直すだけにする(名前やクラスをデータとして持たない)。
`uses` はメソッドIDを指し、`moveMethod`・`renameMethod`・`moveClass` はメソッドIDを変えないので、**移動・名前変更のあとも表示は自動で追従する**。
`extractMethod`(呼び出し行 `uses: [新ID]` を足す)・`inlineMethod`(処理を戻す)・`mergeMethods`(`rewireCallers` で `uses` を付け替え)も、
`uses` を正しく保つので追加の対応は要らない。これをドメインのテストとE2Eで守る(4章・5章)。

## 2. 変更対象ファイル一覧

| 種別 | パス | 層 | 役割 |
| --- | --- | --- | --- |
| 新規 | `src/domain/codebase/methodCallers.ts` | domain | `methodCallers(codebase, methodId)`: そのメソッドを `uses` で呼んでいるメソッドと持ち主クラスの一覧 |
| 新規 | `src/domain/codebase/methodCallers.test.ts` | domain | 上記のテスト(先に書く) |
| 変更 | `src/domain/codebase/changeVisibility.ts` | domain | 非公開の `callerClassIdsOf` の中身を `methodCallers` を使う形に置き換える(振る舞いは変えない) |
| 変更 | `src/presentation/editor/MethodEditor.tsx` | presentation | 処理ごとの「呼ぶ: クラス名.メソッド名()」と、メソッドごとの「呼び出し元」欄 |
| 変更 | `src/index.css` | presentation | 呼び出し元欄の余白・見出しの大きさ(既存の `method-editor__merge-title` 相当。数行) |
| 変更 | `e2e/refactor.spec.ts` | (E2E) | 呼ぶ先・呼び出し元の表示と、Move Method 後の追従を守るテスト |

変更しないもの:
- `src/domain/codebase/Codebase.ts`(`template-method-stage` が `isAbstractLike` を足す予定のため、新しい関数は置かない)
- `src/domain/codebase/dependencies.ts`(`template-method-stage` が `dependencyTargets` を変更する予定のため、追記も避けて別ファイルにする)
- `src/domain/codebase/inlineMethod.ts` の `findCallerOf`(呼び出し行 `<id>:call` だけを探す別物。統合しない)
- `src/domain/scoring/`(`leftovers.ts` の `findUnusedPrivateMethods` なども含め採点は一切触らない)、ステージ定義、`sampleAnswer.ts`
- `src/application/`、`src/presentation/store/useGameStore.ts`(既存の `findMergeCandidates` と同じく、presentation から domain の問い合わせ関数を直接呼ぶ)

## 3. データ/型の変更

ドメインモデル・永続化スキーマの変更は無し。新しい関数の戻り値の型だけ足す。

```ts
// src/domain/codebase/methodCallers.ts
import { allClasses, type CodeClass, type Codebase, type Method } from './Codebase';

/** あるメソッドを呼んでいるメソッドと、その持ち主のクラス。 */
export type MethodCaller = {
  readonly ownerClass: CodeClass;
  readonly method: Method;
};

/**
 * methodId のメソッドを、処理の uses で呼んでいるメソッドを返す。
 * 並びは allClasses の順 → クラス内のメソッドの宣言順。同じメソッドの複数の処理から呼んでいても1件。
 * 自分自身からの呼び出し(再帰)は含めない(findUnusedPrivateMethods の「自分以外から呼ばれていない」と揃える)。
 */
export function methodCallers(codebase: Codebase, methodId: string): MethodCaller[];
```

- 継承・インターフェース越しの呼び出しはたどらない(`uses` が指すIDそのものだけを見る。未決事項3)
- メソッドIDの存在確認はしない(呼び出し側は存在するメソッドにだけ使う)。`uses` に同じIDが無ければ `[]`

`changeVisibility.ts` の `callerClassIdsOf` は次の意味のまま中身だけ置き換える:

```ts
/** メソッドを uses で呼んでいるクラスのIDを、持ち主を除いて重複なく返す。 */
function callerClassIdsOf(codebase: Codebase, methodId: string, ownerClassId: string): string[] {
  const classIds = methodCallers(codebase, methodId).map((caller) => caller.ownerClass.id).filter((id) => id !== ownerClassId);
  return [...new Set(classIds)];
}
```

(元の実装も持ち主クラスを除くので、再帰を除くことによる違いは出ない。既存の `changeVisibility.test.ts` が変更なしで通ることで確かめる)

### 画面(`MethodEditor.tsx`)

#### 処理ごとの「呼ぶ:」

- `FragmentFieldRefs` に1行足す。並びは「読む → 書く → **呼ぶ** → getter 経由で読む → setter 経由で書く」
  (getter/setter 経由の行は呼び出しから導いたものなので、呼ぶの後ろに置く)
- 書式: `呼ぶ: Customer.calculateOrderTotal(), Inventory.reserve()`。`fieldRefText` と同じ形の `methodRefText(codebase, methodIds)` を
  同じファイルに書く(`findClassOfMethod` と `findMethod` で引き、どちらかが見つからないIDは飛ばす。重複除去はしない)
- **同じクラスのメソッドも、別クラスと同じ「クラス名.メソッド名()」で出す**(未決事項1の推奨案)。`this.` 表記や絞り込みはしない
- getter/setter(`isAccessorMethod`)の呼び出しも「呼ぶ:」に出す。「getter 経由で読む:」の行は今のまま残す(未決事項2の推奨案)
- 全部の行が空なら今どおり何も出さない。コンポーネント名は `FragmentRefs` に変えてよい(`className="fragment-list__field-refs"` はそのまま)

#### メソッドごとの「呼び出し元」欄

- 置き場所: 見出し(`クラス名.メソッド名() n行`)の**直下**、処理の一覧の上。IDEの「n references」と同じ位置づけで、中身のない契約メソッド
  (処理が0件)でも出す
- 構造:
  ```tsx
  <div className="method-editor__callers">
    <h3 className="method-editor__callers-title">呼び出し元</h3>
    {/* 1件以上 */}
    <ul aria-label="呼び出し元">
      <li>Order.checkout()</li>
    </ul>
    {/* 0件 */}
    <p>直接の呼び出し元はありません</p>
  </div>
  ```
  - 0件の文言は「直接の」を付ける。インターフェース越しに呼ばれる実装クラスのメソッド(上級2の `StripeGateway.charge` など)に
    「どこからも呼ばれていない」と言い切らないため(未決事項3)
  - 表示は文字だけ(ボタンにしない。未決事項4の推奨案)
- `methodCallers` は `useMemo(() => methodCallers(codebase, method.id), [codebase, method.id])` で求める。
  **Zustand のセレクタの中で呼ばない**(毎回新しい配列を返すと購読が無限ループする。既存の `mergeCandidates` のコメントと同じ理由)
- 1件1行 `${ownerClass.name}.${method.name}()`。関数60行・循環的複雑度12の制限に収まるよう、欄は小さなコンポーネント(`MethodCallers` など)に分ける

白紙設計(`BlankDesignView`)も同じ `MethodEditor` を使うので、同じ表示が出る(部品は `uses` を持たないので、たいてい「直接の呼び出し元はありません」)。
変更依頼の調査パネル(`ChangeRequestPanel`)・設計くらべ(`PreviewClassNode`)には出さない(スコープ外)。

## 4. TDD対象の純粋関数

Vitest・AAA(`// Arrange` `// Act` `// Assert`)で**先に**書く。フィクスチャは `changeVisibility.test.ts` のようにテスト内で小さな Codebase を組み立てる。

### `methodCallers(codebase, methodId)`(`src/domain/codebase/methodCallers.ts`)

正常系:
- 別クラスのメソッドの処理が `uses` で呼んでいる → そのメソッドと持ち主クラスが1件
- 同じクラスの別メソッドから呼ばれている → 含まれる(持ち主で除外しない)
- 1つのメソッドの2つの処理が同じメソッドを呼ぶ → 1件(重複しない)
- 複数のクラス・メソッドから呼ばれている → `allClasses` の順(ファイル順 → クラスの宣言順)→ メソッドの宣言順
- 1つの処理の `uses` に複数のIDがあり、その1つが対象 → 含まれる
- **Move Method のあと**: 呼び出し元のメソッドを `moveMethod` で別クラスへ移した Codebase で呼ぶと、`ownerClass` が移動先のクラスになる
- **Extract Method のあと**: `extractMethod` で切り出したメソッドIDで呼ぶと、元のメソッドが1件返る

異常系・境界:
- どこからも呼ばれていない → `[]`
- 自分自身を呼んでいる(再帰)だけ → `[]`
- 存在しないメソッドID → `[]`
- `uses` を持たない処理だけの Codebase(`sampleCodebase()`)→ `[]`
- 元の Codebase を変更しない

### `changeVisibility`(既存テストで守る)

- `callerClassIdsOf` を置き換えたあとも、`src/domain/codebase/changeVisibility.test.ts` が**変更なしで**すべて通る
- テストを1件足す: 同じ別クラスの2つのメソッドから呼ばれている private メソッドを public にできる(`methodCallers` がメソッド単位になっても、クラスIDの重複除去が効いていることの確認)

presentation の `methodRefText` と呼び出し元欄は表示のみなのでユニットテスト対象外(E2Eで守る)。

## 5. 受け入れ基準

- [ ] `methodCallers` のテストを先に書き(Red)、実装して通る(Green)
- [ ] `changeVisibility.test.ts` の既存ケースが変更なしで通る
- [ ] 中級1で `Order.checkout` を選ぶと、処理「合計金額を求める」の下に `呼ぶ: Customer.calculateOrderTotal()`、「在庫を引き当てる」の下に `呼ぶ: Inventory.reserve()` が出る
- [ ] 中級1で `Customer.calculateOrderTotal` を選ぶと、呼び出し元に `Order.checkout()` が出る。`Order.checkout` を選ぶと「直接の呼び出し元はありません」が出る
- [ ] `calculateOrderTotal` を `Order` へ Move Method したあと `checkout` を選ぶと `呼ぶ: Order.calculateOrderTotal()` に変わり、
      `calculateOrderTotal` の呼び出し元は `Order.checkout()` のまま
- [ ] チュートリアル2で処理を Extract Method すると、元のメソッドの呼び出し行に `呼ぶ: OrderService.<新しい名前>()` が出て、
      切り出したメソッドの呼び出し元に `OrderService.placeOrder()` が出る
- [ ] 中級6・中級7の既存の「読む:」「getter 経由で読む:」「setter 経由で書く:」の表示と、それを確かめる既存E2Eが変わらず通る
- [ ] 点数・ステージの内容・模範解答が変わらない(採点・ステージ定義・`sampleAnswer.ts` の差分が無い)
- [ ] E2E(`e2e/refactor.spec.ts`)に次を追加し通る。競合を減らすため、既存の「循環依存を断ち切ると、循環依存の減点とクラスの印が消える」の**直後**に置く
  1. 「中級1: メソッドを選ぶと呼ぶメソッドと呼び出し元が名前で出て、Move Method のあとクラス名が追従する」
     - `openCyclicStage` → `method-checkout` をクリック → `呼ぶ: Customer.calculateOrderTotal()` が見える、`直接の呼び出し元はありません` が見える
     - `method-calculateOrderTotal` をクリック → `getByRole('list', { name: '呼び出し元' })` に `Order.checkout()`
     - `dragMethodToClass(page, 'method-calculateOrderTotal', 'class-Order')` → `clickInCanvas(page, 'method-checkout')` → `呼ぶ: Order.calculateOrderTotal()` が見え、`呼ぶ: Customer.calculateOrderTotal()` は無い
  2. 「抽出したメソッドの呼び出し元に、元のメソッドが出る」
     - `openOrderStage` → `placeOrder` から1処理を抽出 → 切り出したメソッドをクリック → 呼び出し元の一覧に `OrderService.placeOrder()`
- [ ] 既存のE2Eがすべて通る(特に `getByRole('heading', { name: /OrderService\.placeOrder\(\)/ })` が、呼び出し元欄の見出し・項目と衝突しないこと。項目は見出しにしない)
- [ ] `npm run check`(lint + typecheck + test)と `npm run test:e2e` が通る。`as`・`!`・`enum` を使わない

## 6. スコープ外

- **呼び出し元・呼ぶ先の名前を押してそのメソッドを選び直す(ナビゲーション)**: 未決事項4でBを選んだ場合のみ今回入れる
- **キャンバス上で、選んだメソッドの呼ぶ先・呼び出し元のチップを強調すること**(`MethodChip.tsx`)
- **クラスにホバー/フォーカスしたときの依存の矢印の強調**(`layoutCodebase.ts`・`CodebaseCanvas.tsx`)
- **設計くらべ(`PreviewClassNode.tsx`)・変更依頼の調査パネル(`ChangeRequestPanel.tsx`)への同じ表示**
- **継承・インターフェース越しの呼び出しの推定**(実装クラスのメソッドに「PaymentGateway.charge() 経由で呼ばれうる」と出すなど。未決事項3でBを選んだ場合を除く)
- **Extract Method の呼び出し行のラベル `xxx() を呼び出す` を、Move Method・名前変更に合わせて書き換えること**(「呼ぶ:」の行で今の名前・クラスが分かるので不要)
- **フィールドの「読む/書く」の逆引き(このフィールドを誰が触っているか)**: 要望が出たら同じ形で足す
- **採点(`leftovers.ts` の `findUnusedPrivateMethods`・`visibility.ts` など)の呼び出し判定を `methodCallers` に寄せること**: 採点には触らない方針。やるなら別タスク
- **ステージごとに表示を隠すフラグ**(未決事項5でBを選んだ場合を除く)

## 未決事項

### 未決事項1: 同じクラスの中の呼び出し(Extract Method の呼び出し行など)も「呼ぶ:」に出すか

- 選択肢A(推奨): 全部出す。同じクラスでも別クラスでも `呼ぶ: OrderService.calculateTax()` と同じ書式にする。呼び出し行のラベル `calculateTax() を呼び出す` と内容が重なるが、Move Method・名前変更のあとに今のクラス・名前が分かる。コードも絞り込みが要らず一番短い
- 選択肢B: 別クラスへの呼び出しだけ出す。同じクラスの呼び出しは出さない(重複は減るが、移動前後で行が出たり消えたりする)
- 選択肢C: 全部出すが、同じクラスは `this.calculateTax()` と書く(実際のコードに近いが、書式が2通りになる)

### 未決事項2: getter/setter の呼び出しを「呼ぶ:」にも出すか(中級7の `getBalance()` など)

- 選択肢A(推奨): 出す。「呼ぶ: Account.getBalance(), Account.setBalance()」と「getter 経由で読む: Account.balance」を両方並べる。行は増えるが「getter を呼ぶ = そのフィールドを読むのと同じ」の対応が目で見える
- 選択肢B: getter/setter(`isAccessorMethod`)への呼び出しは「呼ぶ:」から除き、既存の「getter 経由で…」の行だけにする

### 未決事項3: インターフェース越しに呼ばれる実装クラスのメソッドの呼び出し元をどう見せるか(上級2の `StripeGateway.charge` など)

- 選択肢A(推奨): `uses` が指すメソッドだけを見る。実装クラスのメソッドは0件なので、文言を「直接の呼び出し元はありません」にして言い切らない。インターフェース側の `PaymentGateway.charge` を選べば `PaymentService.checkout()` が出る
- 選択肢B: Aに加え、親(extends の先祖・implements 先)に同名のメソッドがあるときは「PaymentGateway.charge() の実装として呼ばれます」を1行添える(`parentIds` を使う小さな関数とテストが増える)

### 未決事項4: 呼び出し元の名前を押してそのメソッドへ移れるようにするか

- 選択肢A(推奨): 今回は文字だけ。ナビゲーションは次のPRに回す(YAGNI。キャンバスのチップを押せば今でも選べる)
- 選択肢B: 呼び出し元の各項目を `<button type="button">` にし、押すと既存の `selectMethod(methodId)` を呼ぶ。キーボードでも移れる。E2Eを1件足す(ストアの変更は不要)

### 未決事項5: 呼び出し関係が見えることで、中級1などの推理の余地が減ることを許容するか

- 選択肢A(推奨): 許容し、全ステージで出す。IDEで普通に得られる情報で、フィールドの読み書きもすでに全ステージで出している。「呼び出し関係を追ってから置き場所を決める」習慣づけを優先する
- 選択肢B: ステージ定義にフラグ(例: `hideCallReferences?: boolean`)を足し、指定したステージでは出さない(`Stage` 型・ステージ定義・テストの変更が増える)
