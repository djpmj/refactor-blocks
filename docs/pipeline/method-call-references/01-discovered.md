# 機能探索: メソッドエディタに「呼ぶメソッド」と「呼び出し元」を表示する

- slug: `method-call-references`

## 出どころ

新規探索(`docs/pipeline/USER_FIXES.md` に未完了項目 `### [ ]` が無かったため)。

## 背景・目的

このゲームでは、クラス間の依存(キャンバスの矢印・結合度・循環依存の採点)は、すべて処理(Fragment)の
`uses`(呼ぶメソッドのID)とフィールドの読み書きから計算している(`src/domain/codebase/dependencies.ts`)。
ところが、**どのメソッドがどのメソッドを呼んでいるかは、画面のどこにも出ていない**。

- メソッドエディタ(`src/presentation/editor/MethodEditor.tsx`)は、処理ごとに行数と、読む・書くフィールド
  (`FragmentFieldRefs`: 「読む: Account.balance」「getter 経由で読む: …」)は出す。しかし `uses` は出さない
- キャンバスの矢印はクラス単位なので、「Order → Customer」の矢印があっても、どのメソッドのどの処理が原因かは分からない
- 呼ばれている側から見た「このメソッドを誰が呼んでいるか」(呼び出し元)も分からない

これがプレイヤーの判断材料の穴になっている具体例:

1. **中級1「循環依存を断ち切る」**: ゴールは「メソッドが本来いるべきクラスはどこ?」だが、`Order.checkout` の
   「合計金額を求める」が `Customer.calculateOrderTotal` を呼び、それが `Order.getLines` を呼ぶ、というつながりは
   処理のラベル(自然文)から推測するしかない。IDEなら「定義へ移動」「参照を検索」で一瞬で分かる情報である
2. **可視性の選択欄**: メソッドエディタには「public は他のクラスから、protected は子クラスから呼ばれているときだけ
   選べます」と出るが、**その呼び出し元をプレイヤーが確かめる手段が無い**。選択肢が `disabled` になっている理由を推理するしかない
3. **Move Method 後の呼び出し**: Extract Method が残す呼び出し行のラベルは `${name}() を呼び出す` で固定
   (`extractMethod.ts`)。そのメソッドを別クラスへ移したあとも、ラベルからは移し先のクラスが分からない
4. **未使用の private・アクセス制御の違反**: 「誰からも呼ばれていない」「別クラスから private を呼んでいる」を
   自分で確かめる手段が無く、点数の内訳から逆算するしかない

対象プレイヤー(新卒〜4年目)にとって「呼び出し関係を追ってから、置き場所を決める」はリファクタリングの基本動作で、
実務のIDEの「参照を検索」の習慣にもつながる。フィールドの読み書きはすでに見せている(`docs/specs/fields-and-feature-envy.md` で
Feature Envy の手がかりとして導入済み)ので、同じ粒度でメソッド呼び出しも見せるのは既存方針の延長にあたる。

これまでのサイクルはステージ追加・採点ルール・クイズ・右クリックメニュー・永続化・AI講評・採点の内訳に偏っていた。
今回は呼び出し元が挙げた「presentation層での表現」「ヒント(自分で気づくための手がかり)」の切り口から選んだ。
採点ロジック(`score.ts`・`RULE_LABEL`・`fileScores.ts`)とステージ定義・`sampleAnswer.ts` には触れない。

### 既存テーマとの重複確認

- `docs/specs/` に、メソッド呼び出し(`uses`)をUIに出す仕様は無い(grepで確認。`uses` は採点・依存計算・ステージデータの表記にだけ出てくる)
- `docs/specs/fields-and-feature-envy.md`: フィールドの読み書きの表示のみ。メソッド呼び出しは扱っていない → 重複しない(同じ流儀の延長)
- `docs/specs/cyclic-dependency-class-highlight.md`: 循環しているクラスのノードに印を付けるだけ。メソッド単位のつながりは出さない → 重複しない
- `docs/specs/stuck-player-hints.md`(`HintPanel.tsx`): 模範解答の手順を見せるヒント。今のコードの呼び出し関係は出さない → 別物
- `score-deduction-locations`(02作成中): 減点ごとに原因のクラス・メソッド名を採点表示の下に出す。本件は減点の有無に関係なく、
  選んだメソッドの呼び出し関係をメソッドエディタに出す。表示場所も元データも別で、主題は重ならない
- `inline-method-stage`: 「呼び出し元へ戻す」(Inline Method)を使うステージと減点ルールの追加。呼び出し元の表示はしない。
  本件が入ると「どこへ戻るのか」が事前に分かるようになり、相性がよい
- 呼び出し元が列挙した11件のslugのいずれとも主題が重ならない

### 検討して見送った候補

- クラスにホバー/フォーカスしたとき、そのクラスの依存の矢印だけを強調し他を薄くする(`layoutCodebase.ts` の `dependencyEdges` と
  `CodebaseCanvas.tsx`): 他パイプラインとの衝突が無く小さいが、クラス単位の矢印はすでに見えている。「どのメソッドが原因か」という
  本件の穴の方が判断に直結するため、今回は見送り。本件の次の候補になる
- React Flow の `MiniMap`: 標準部品で数行だが、最大のステージでもファイル数は一望できる規模で、学習上の困りごとが無い(YAGNI)
- VSCode風ファイルツリー: 過去の探索と同じ理由(新しいペイン・dnd-kitのドロップ先・E2Eが要り1回のPRには大きい)で見送り
- メソッド名のその場編集をキーボードだけで始める手段(`docs/specs/inline-edit-and-hover-submenu.md` のスコープ外に明記):
  右クリックメニュー(`CanvasContextMenu.tsx`)に項目を足すのが自然だが、`move-class-via-context-menu` が同じファイルの
  `menuItemsFor` を書き換える予定で、衝突が大きい。そちらのマージ後の候補にする
- 「100点で次のステージへ」ボタンなどステージ選択のUX: 過去の探索と同じく、学習の中身が増えないため見送り

## 関連する既存コード

- `src/presentation/editor/MethodEditor.tsx`
  - `FragmentFieldRefs` / `fieldRefText` — 処理ごとに「読む: クラス名.フィールド名」を並べる既存の表示。**呼ぶメソッドの表示はこれに倣える**
  - `MethodEditorBody` — 見出し(`クラス名.メソッド名()`)・処理の一覧・抽出・統合・可視性の各欄。呼び出し元の一覧を置く先の候補
  - `VisibilitySelect` — 「…呼ばれているときだけ選べます」の説明文。呼び出し元の表示と並ぶと意味が通る
- `src/domain/codebase/Codebase.ts` — `Fragment.uses`、`findMethod`・`findClassOfMethod`・`allClasses`(IDから表示名を引く)
- `src/domain/codebase/dependencies.ts` — `methodOwnerMap`(メソッドID→持ち主クラスID)
- `src/domain/codebase/changeVisibility.ts` — 非公開の `callerClassIdsOf`(メソッドを `uses` で呼ぶクラスを持ち主以外で集める)。
  「呼び出し元を求める」処理がすでに1つある。再利用・共通化するか、別に小さな関数を作るかは仕様設計で決める
- `src/domain/codebase/inlineMethod.ts` — `findCallerOf`(Extract Method が残した呼び出し行 `<id>:call` を持つメソッドを探す。
  `uses` 全体ではなく呼び出し行だけを見る別物)
- `src/domain/codebase/extractMethod.ts` — `callFragmentId`・呼び出し行のラベル `${name}() を呼び出す`(表示が二重にならないかの論点に関係)
- `src/presentation/store/useGameStore.ts` — `selectMethod(methodId)`(呼び出し元の名前を押してそのメソッドへ移る、を入れる場合に使える。
  ストアの変更は不要な見込み)
- `src/presentation/blank/BlankDesignView.tsx` — 白紙設計でも同じ `MethodEditor` を使う(部品を配置したあとの呼び出し関係も出ることになる)
- `e2e/refactor.spec.ts` — メソッドをクリックしてメソッドエディタの内容を確かめる既存テストがある。追加先になる

## スコープの見立て

1回のPRに収まる小さな規模と見る。

1. **今回やる**:
   - domain: 「あるメソッドを `uses` で呼んでいるメソッド(と持ち主クラス)」を返す純粋関数(TDD)。
     処理ごとの「呼ぶ」は `fragment.uses` と既存の `findMethod`・`findClassOfMethod` で出せるので、新しい関数は要らない見込み
   - presentation: メソッドエディタの処理ごとに「呼ぶ: クラス名.メソッド名()」を、フィールドの「読む:」と同じ場所・同じ書式で出す。
     メソッド単位で「呼び出し元: クラス名.メソッド名()」(無ければ「どこからも呼ばれていない」等)を出す
   - E2E: チュートリアル/中級1で、メソッドを選ぶと呼ぶ先・呼び出し元が名前で出ること、Move Method のあとクラス名が追従することを確認する
2. **後回し**:
   - 呼び出し元・呼ぶ先の名前を押してそのメソッドを選び直す(ナビゲーション)。仕様が膨らむなら次のPRへ
   - キャンバス上で、選んだメソッドの呼ぶ先・呼び出し元のチップを強調する(React Flowの表現。`MethodChip.tsx` を触る)
   - クラスにホバーしたときの依存の矢印の強調(上の「見送った候補」)
   - 設計くらべクイズ(`PreviewClassNode.tsx`)・変更依頼の調査パネル(`ChangeRequestPanel.tsx`)への同じ表示

仕様設計者に決めてほしい論点(ここでは決めない):

- 同じクラスの中の呼び出し(Extract Method の呼び出し行 `xxx() を呼び出す` など)も「呼ぶ:」に出すか。出すとラベルと重複するが、
  Move Method でクラスが変わったことは分かる。別クラスへの呼び出しだけ出す、自クラスは `this.` 表記にする、なども考えられる
- 呼び出し元を「メソッド単位」で出すか「処理単位」まで出すか。同じメソッドの複数の処理から呼ばれるときの重複の除き方
- 答えが見えすぎないか: 中級1などで呼び出し関係が一目で分かると、推理の余地が減る。IDEで普通に得られる情報なので出してよい、
  という立場を取るか。フィールドの読み書きはすでに出しているので、それと揃えるのが自然という見立て
- 継承・インターフェース越しの呼び出し(上級2の `PaymentGateway.charge` のような契約メソッド)を、呼び出し元の一覧でどう見せるか
  (実装クラスのメソッドには「呼び出し元なし」と出てしまう。`docs/specs/payment-gateway-true-dip.md` の表現に関係)
- getter/setter 経由の読み書き(`accessorFieldAccess`)の既存表示と、「呼ぶ: Account.getBalance()」が並んだときの重複の扱い
- 変更依頼の実装中の部品置き場(`changeSession`)の扱い。部品は `uses` を持たないので、実害は小さい見込み
- 呼び出し元の一覧の見出し・`aria` の付け方(スクリーンリーダーで処理の一覧と区別できるか)

### 既存パイプラインとの衝突可能性

- **`src/presentation/editor/MethodEditor.tsx`**: 列挙された11件のうち、このファイルを変更する予定のものは無い
  (`blank-design-second-problem`・`stage-draft-persistence` は「サイドパネルが `MethodEditor` に戻る」「`message` が `role="alert"` に出る」と
  言及しているだけで、ファイルは変えない)。衝突はほぼ無い
- **`src/domain/codebase/Codebase.ts`**: `template-method-stage` が `isAbstractLike` を足す予定。本件で呼び出し元を求める関数を
  `Codebase.ts` に置くとテキスト上の競合が起きうるので、**別ファイル(例: `domain/codebase/` の新しい小さなファイル)か
  `dependencies.ts` に置く**ことを推奨する(置き場所は仕様設計で決める)
- **`src/domain/codebase/changeVisibility.ts`**: 非公開の `callerClassIdsOf` を共通化する場合に触る。進行中の他パイプラインは
  このファイルを触る予定が無い(`inline-method-stage` は `inlineMethod.ts` 等を「変更しない」と明記)。共通化はしてもしなくてもよく、
  しない場合は触らない
- **`src/domain/codebase/dependencies.ts`**: `score-deduction-locations` は「参照するだけ」で変更予定なし。関数を足す場合も追記だけで済む
- **採点(`score.ts`・`RULE_LABEL`・`fileScores.ts`)・ステージ定義(`src/infrastructure/stages/*.ts`)・`sampleAnswer.ts`**: 触らない。
  点数・模範解答・ステージの内容は一切変わらない
- **`e2e/refactor.spec.ts`**: 他の多くのパイプラインも追記する。追記位置の競合はあり得る(小さい)
