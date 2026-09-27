# 01 機能探索: インターフェース役を implements ではなく extends にすると「実装漏れ」の採点をすり抜け、上級6が分けずに100点になる抜け道を塞ぐ

- slug: `extends-interface-loophole`

## 出どころ

新規探索(`docs/pipeline/USER_FIXES.md` のキュー一覧は「まだ項目はありません」で、未完了項目 `### [ ]` が無かった)。

前回の `delete-class-code-guard` と同じく「採点の抜け道・操作の不整合」を探す方針で、進行中32件の01が**変更しない** domain の
採点関数(`src/domain/scoring/interfaceContracts.ts`)と継承の操作(`src/domain/codebase/setSuperclass.ts`)を読み合わせて見つけた。

### 既存テーマとの重複確認

- `docs/pipeline/*/01-discovered.md`・`02-draft-spec.md` を `interfaceContracts|findContractViolations|findMissingImplementations|実装漏れ|setSuperclass`
  でgrepした。**`interfaceContracts.ts` を変更する予定の件は0件**。言及は次だけ:
  - `score-deduction-locations`: `findContractViolations` の戻り値(クラスID/メソッドID)を**読むだけ**。02の6章で「`find*` 関数の戻り値の変更」はスコープ外と明記
  - `template-method-stage` の02(166行目): 「抽象メソッド(**protected** かつ `fragments: []`、`isAbstractLike`)の実装漏れの採点」をスコープ外として先送り。
    本件は **public の契約メソッドだけを持つインターフェース役(`isInterfaceLike`)** を extends した場合に限る話で、あちらの `OrderImporter`
    (protected の `parse`)は `isInterfaceLike` ではないので対象にならない(下の「意味上の依存」)
  - `stage-reference-integrity` の02(151行目): 「`superclassId` がインターフェース役を指していないか」を**ステージ定義の検査**としてスコープ外にしている。
    本件は**プレイ中の操作で作れる状態**の採点の話で、あちらの検査対象(固定のステージデータ)とは別
- `docs/specs/` 24件: `interface-segregation-stage.md` 231・242〜248行目が `contract` の3種類(実装漏れ・インターフェースの外の契約メソッド・宣言漏れ)を定め、
  435〜442行目で近道6件を塞いでいるが、**「implements を外して extends に付け替える」近道は検討されていない**。
  `inheritance.md`・`lone-superclass-scoring.md` にも、インターフェース役を extends する場合の記述は無い
- 呼び出し元が列挙した32件のslugのいずれとも主題が重ならない(新ステージ・UI・削除操作ではなく、既存の `contract` ルールの判定の穴)

### 検討して見送った候補

- **`changeVisibility` がインターフェースの契約を実装しているメソッドを private/protected へ狭められる**(実際の TypeScript ではコンパイルエラー):
  狭めると `unused`(使われていない private)で -10 になるだけで点は上がらない。抜け道ではなく表現の不整合なので後回し(本件の論点に添える)
- **`changeVisibility` が protected で足りる相手(子孫だけから呼ばれる)でも public まで広げられる**: 採点に影響しない。YAGNI
- **`mergeMethods` の統合結果が private のまま、B側の呼び出し元(別クラス)から届かなくなる**: `visibilityEnforced` のステージでは `visibility` で減点され、
  プレイヤーが移動・可視性変更で直す想定どおりの挙動(`merge-duplicate-methods.md`)。抜け道ではない
- **`extractMethod` の名前の重複チェックが自クラスだけで、親クラスと同名にすると意図しないオーバーライドになる**: どのステージでも点に影響しない。YAGNI
- **`moveMethod` で private メソッドを呼び出し元から引き離しても、`visibilityEnforced` でないステージでは減点されない**: `visibility.ts` 43〜50行目のユーザー決定どおり
- **新ステージ・画面の改善**: 前回までの探索と同じ理由(ステージ定義・`sampleAnswer.ts`・`stageCatalog.test.ts`・`score.ts`・`useGameStore.ts`・
  `StagePanel.tsx`・`CodebaseCanvas.tsx`・`CanvasContextMenu.tsx` が5件以上から触られる)

## 背景・目的

`src/domain/scoring/interfaceContracts.ts` の `findMissingImplementations`(28〜41行目)は、**`interfaceIds`(implements)に書かれた**インターフェース役
だけを見て「契約メソッドと同名のメソッドを自分か extends の先祖が持っているか」を調べる。一方 `findUndeclaredImplementations`(76〜89行目)は、
`parentIds`(extends + implements)をたどってインターフェース役に届けば「宣言済み」とみなす。つまり**インターフェース役を extends すると、
「実装を宣言した」扱いにはなるのに「実装漏れ」は一切調べられない**。

`setSuperclass`(`setSuperclass.ts` 49〜68行目)・`availableParents`(106〜108行目)はインターフェース役を継承元に選ぶことを拒まないので、
右クリックメニューの「継承元を設定」からそのまま作れる。

### 上級6「太ったインターフェースを役割ごとに分ける」が、分けずに100点になる(コードを読んだ手計算)

初期状態の減点は空実装5件(`stub` -50)だけで50点(`interface-segregation-stage.md` 446行目)。次の11手で、インターフェースを一切分けずに
100点になる見込み。

1. SlackClient・TeamsClient・BacklogClient の「実装するインターフェースを設定」で `CollaborationTool` を外す(`removeInterface` ×3)
2. 3クラスの「継承元を設定」で `CollaborationTool` を選ぶ(`setSuperclass` ×3。implements を外した後なので `already-related` にならない)
3. Slack・Teams の `createTask`・`completeTask`、Backlog の `postMessage` の空実装を「空実装のメソッドを削除」で消す(`deleteMethod` ×5)

このときの各ルール:

- `stub`: 0件(全部消した)
- `contract` の実装漏れ: 3クラスとも `interfaceIds` が空になったので**見られない**。Chatwork は3つとも持っている
- `contract` の宣言漏れ: 3クラスとも `parentIds` で `CollaborationTool` に届くので数えない
- `contract` のインターフェースの外の契約メソッド: `CollaborationTool` はインターフェース役のまま
- `lone-superclass`: `CollaborationTool` を extends する子が3つなので数えない
- 依存(AlertNotifier → CollaborationTool、IncidentService → CollaborationTool)は初期状態と同じ1本ずつで `dependencyLimit: 1` 以内

`stageCatalog.test.ts` 97〜162行目の近道(「分けずに空実装だけ消す」→実装漏れ、「implements を外して空実装を消す」→宣言漏れ)は塞がっているのに、
その2つの間の「implements を extends に付け替えて空実装を消す」だけが素通りになっている。

実際のコードで考えると、`CollaborationTool` を interface として読めば `class SlackClient extends CollaborationTool` はそもそも書けず、
抽象クラス(全メソッドが abstract)として読めば `createTask`・`completeTask` を実装しない限りコンパイルが通らない。どちらに読んでも、
**今の採点は「実装しなくてよい」と教えてしまう**。ISP のステージで「困ったら extends に変えて空実装を消せば満点」という誤った癖が付くのは、
対象プレイヤー(新卒〜4年目)にとって有害で、採点の信頼も損なう。上級2(`PaymentGateway`)・上級3(`DiscountStrategy`)でも、
extends にしておけば契約メソッドを持たない実装クラスが減点されない(今は模範解答・初期状態がそういう形にならないので実害は上級6が中心)。

ponytail の階段では「このリポジトリにもうあるか?」で止まる見込み: 既存の `findMissingImplementations` が見る親を `interfaceIds` から
`parentIds`(extends も含む)へ広げるか、`setSuperclass` の前提条件に1つ `err` を足すかのどちらか。新しい依存・新しいUI・新しいルール名は要らない。

## 関連する既存コード

- `src/domain/scoring/interfaceContracts.ts` — **変更の中心(採点で直す場合)**。`extendsChainMethodNames`(12〜22行目。先祖の**契約メソッド自身の名前**も
  「持っている」に数えてしまうので、extends したインターフェース役の名前をどう扱うかが要点)、`findMissingImplementations`(28〜41行目)、
  `findUndeclaredImplementations`(76〜89行目。extends を「宣言」とみなしている箇所)
- `src/domain/scoring/interfaceContracts.test.ts` — **変更**(テストを先に書く。既存の「extendsの先祖が持っていれば数えない」89〜112行目がそのまま通ること)
- `src/domain/codebase/setSuperclass.ts` — `setSuperclass`・`availableParents`。**操作で直す場合のみ変更**(下の論点)
- `src/domain/codebase/setSuperclass.test.ts` — 同上
- `src/domain/codebase/Codebase.ts` — `isInterfaceLike`(115〜117行目)・`parentIds`(104〜106行目)。**読むだけ**
- `src/domain/change/measurePlacement.ts` 107行目 — 一番近い先祖が `isInterfaceLike` なら `'abstract'`(= extends でも implements でも「抽象にぶら下げた」扱い)。
  「インターフェース役を extends してよい」前提の既存コード。**読むだけ**(操作で拒む案にするなら、ここの扱いとの整合を論点に書く)
- `src/infrastructure/stages/advancedStages.ts` 480〜731行目 — 上級6のステージ定義。**読むだけ**
- `src/infrastructure/stages/advancedStages.test.ts` — 上級6の `describe('advanced-interface-segregation')`。**回帰テストの追記先の候補**(進行中の件で変更予定なし)
- `src/infrastructure/stages/stageCatalog.test.ts` 97〜162行目 — 上級6の近道6件。**読むだけ**(回帰テストの置き場所は論点)
- `src/application/RefactorUseCases.ts` 264行目 `SET_SUPERCLASS_ERROR_MESSAGES` — **操作で直す場合のみ1行追記**
- `docs/specs/interface-segregation-stage.md` 231・242〜260・435〜442行目 — `contract` の3種類と近道の設計(本件の手本)
- `docs/pipeline/template-method-stage/02-draft-spec.md` 131〜138・166行目 — `isAbstractLike` と「抽象メソッドの実装漏れ」の先送り

## スコープの見立て

小さい。1回のPRに十分収まる。採点で直すなら domain の1ファイルとそのユニットテスト、上級6の回帰テスト数件。

1. **今回やる**:
   - インターフェース役を extends したクラスが契約メソッドを持たないとき、implements と同じく `contract`(実装漏れ)で減点される
     (または、インターフェース役を継承元に選べない。どちらかは論点)
   - 上級6で上の11手を踏むと100点未満になることをテストで固定する(まず今の実装で「100点になる」ことをテストで実測してから仕様に書く)
   - 既存ステージの初期点・模範解答100点・近道テストが変わらない(どのステージの初期状態・模範解答にもインターフェース役の extends は無い。
     `superclassId` を持つのは上級5の `CsvExporter → BaseExporter` だけで、`BaseExporter` はインターフェース役ではない)
2. **後回し**:
   - `changeVisibility` で、インターフェースの契約を実装しているメソッドを狭められないようにする(点は上がらないので抜け道ではない)
   - protected の抽象宣言(`isAbstractLike`)を extends した子の実装漏れ(`template-method-stage` の先送りのまま。あちらのマージ後に同じ関数へ足せる)
   - 右クリックメニューの「継承元を設定」の候補からインターフェース役を除く/無効表示にする(`CanvasContextMenu.tsx` は `move-via-context-menu`・
     `move-class-via-context-menu`・`method-rename-keyboard` が触るので、それらのマージ後)

仕様設計者に決めてほしい論点(ここでは決めない):

- **採点で直すか、操作で直すか**
  - 採点(`findMissingImplementations` が extends のインターフェース役も見る): インターフェース役を「全メソッドが abstract の抽象クラス」とも読める今のモデル
    (`measurePlacement` の `'abstract'`)と矛盾しない。操作・画面・E2E・`RefactorUseCases.ts` を触らずに済む。
    `extendsChainMethodNames` が先祖の契約メソッド(`fragments: []`)自身の名前も「持っている」に数えるので、そのまま親の範囲を広げるだけでは
    漏れを見つけられない点に注意(中身のない契約メソッドを「持っている」から外す、など)
  - 操作(`setSuperclass` がインターフェース役を継承元に選ぶのを `err` で拒む): `codebase-code-view` がインターフェース役を `export interface` と書く予定なので、
    `class X extends <interface>` という書けない状態をそもそも作らせない利点がある。ただしプレイヤーの操作が変わるので E2E が要り、
    `measurePlacement` の「extends でも抽象扱い」や、既にある `availableParents`(継承元・実装先で共有)との整合を決める必要がある
- **extends の中間クラスの扱い**: `C extends B extends I(インターフェース役)` で B が契約の一部を持たず C が持つとき、B を実装漏れに数えるか
  (今の implements 側の規則「自分と extends の先祖のどれかが持てばよい」を子孫方向にも当てるか)。今のステージには該当する形が無いので、
  最小の規則で足りるならそれでよい
- **回帰テストの置き場所**: 上級6の「extends に付け替えて空実装を消す」近道を `stageCatalog.test.ts` の `shortcuts` に足すか、`advancedStages.test.ts` の
  上級6の describe に足すか(`stageCatalog.test.ts` は `inline-method-stage`・`utils-class-split-stage`・`law-of-demeter-stage`・`template-method-stage` が触る)
- **上級2・上級3への影響の確認**: 途中経過で `StripeGateway extends PaymentGateway` のような形を作ったときの点数が変わるだけで、初期点・模範解答は変わらない見込み。
  実装時に実測して確かめる

### 既存パイプラインとの衝突可能性

| ファイル | 本件の変更 | 同じファイルを触る進行中の件 | 衝突の見立て |
|---|---|---|---|
| `src/domain/scoring/interfaceContracts.ts`・`.test.ts` | 実装漏れの判定の変更・テスト | **なし**(`score-deduction-locations` は `findContractViolations` の戻り値を読むだけ。戻り値の形は変えない) | なし |
| `src/infrastructure/stages/advancedStages.test.ts` ※ 回帰テストをここに置く場合 | 上級6の describe に1〜2件追記 | **なし**(`duplicate-code-scoring` の02は「変更不要」、`template-method-stage` は新規ファイル) | なし |
| `src/infrastructure/stages/stageCatalog.test.ts` ※ 近道に足す場合のみ | `shortcuts` に1件追記 | `inline-method-stage`・`utils-class-split-stage`・`law-of-demeter-stage`・`template-method-stage`(いずれも `shortcuts` への追記) | 小〜中。同じ配列への追記で隣接しうる。避けたいなら上の `advancedStages.test.ts` に置く |
| `src/domain/codebase/setSuperclass.ts`・`.test.ts` ※ 操作で直す場合のみ | 前提条件の追加 | なし(`stage-reference-integrity`・`implements-arrow-style` は読むだけ) | なし |
| `src/application/RefactorUseCases.ts`・`.test.ts` ※ 操作で直す場合のみ | `SET_SUPERCLASS_ERROR_MESSAGES` に1行 | `identifier-name-validation`・`delete-class-code-guard`(別の `Record` への追記) | 小。別の `Record` なので隣接行でなければ自動マージできる見込み |
| 新規 `e2e/<名前>.spec.ts` ※ 操作で直す場合のみ | E2E | なし | なし(`refactor.spec.ts` には追記しない) |

- **読むだけで変更しないファイル**: `Codebase.ts`・`measurePlacement.ts`・`advancedStages.ts`・`sampleAnswer.ts`・`score.ts`・`fileScores.ts`
- **触らないファイル**: ステージ定義(`src/infrastructure/stages/*.ts` の本体)・`CanvasContextMenu.tsx`・`useGameStore.ts`・`StagePanel.tsx`・`CodebaseCanvas.tsx`・
  `describeScore.ts`・`e2e/refactor.spec.ts`・`workers/critique/`
- **意味上の依存**(テキストの競合ではなく、中身が影響し合うもの):
  - `template-method-stage`: `isAbstractLike`(protected の空メソッド)を足し、「抽象メソッドの実装漏れ」は先送りしている。本件は `isInterfaceLike` だけを
    対象にするので、あちらの `OrderImporter`(初期・模範解答後とも `isInterfaceLike` ではない)の点数は変わらない。あちらが先にマージされても、
    後から同じ関数で protected 版を扱えるよう、判定を「親がインターフェース役か」で素直に分けておけばよい
  - `codebase-code-view`: インターフェース役を `export interface X` と書く案(02の未決事項4)。本件を採点で直す場合も、`class X extends <interface>` と
    表示される状態自体は残る(操作で直す案なら作れなくなる)。どちらが先でも動く
  - `implements-arrow-style`: extends と implements の矢印を描き分ける。本件は矢印を変えない。操作で直す案だと、インターフェース役への extends の矢印が
    描かれる場面が無くなるだけ
  - `score-deduction-locations`: `contract` の対象(実装漏れはクラスID)を内訳に出す。本件で増える実装漏れも同じクラスIDなので、そのまま一覧に出る
  - `delete-class-code-guard`: インターフェース役のクラスを消したときの `contract` の扱いを論点にしている。本件は削除を扱わない
  - `stage-reference-integrity`: 「`superclassId` がインターフェース役を指していないか」をステージ定義の検査としてスコープ外にしている。
    本件で採点・操作のどちらかが決まれば、将来その検査を足すときの基準になる
