# 01 機能探索: データの持ち主を継承元(extends)にするだけで Feature Envy・カプセル化の破れが消え、中級6が処理を移さずに100点になる抜け道を塞ぐ

- slug: `extends-field-access-loophole`

## 出どころ

新規探索(`docs/pipeline/USER_FIXES.md` のキュー一覧は「まだ項目はありません」で、未完了項目 `### [ ]` が無かった)。

直前の `delete-class-code-guard`・`extends-interface-loophole` と同じく「模範解答以外の手順で満点・高得点になる経路」を探す方針で、
domain の操作(`setSuperclass`・`moveField`・`moveMethod`・`extractMethod`・`changeVisibility`・`mergeMethods`・`deleteMethod`・`inlineMethod`)と
採点(`fieldAccess.ts`・`cohesion.ts`・`loneSuperclass.ts`・`visibility.ts`・`interfaceContracts.ts`・`leftovers.ts`・`responsibilities.ts`・`lineLimits.ts`・
`dependencies.ts`)を突き合わせて見つけた。進行中33件の01が**変更しない** `src/domain/scoring/fieldAccess.ts` の「自分側」の扱いが中心。

### 既存テーマとの重複確認

- `docs/pipeline/*/01-discovered.md`・`02-draft-spec.md` を `fieldAccess|findFeatureEnvy|findEncapsulationViolations|extendsChainIds|継承.*フィールド` でgrepした。
  **`fieldAccess.ts` を変更する予定の件は0件**。言及は次だけ:
  - `score-deduction-locations`: `FeatureEnvy.methodId`・`EncapsulationViolation.accessorClassId`・`findOpenSetters` の戻り値を**読むだけ**
  - `law-of-demeter-stage`: 「`fieldAccess.ts` は変更しない」と明記。新ステージに継承は無い
  - `codebase-code-view`: `extendsChainIds` を**読むだけ**(コード表示のため)
  - `stage-reference-integrity`: `extendsChainIds` が輪で止まることに触れるだけ
- `extends-interface-loophole`(直前の件)は **インターフェース役を extends したときの `contract`(実装漏れ)** の話で、本件は
  **フィールドを持つデータクラスを extends したときの `feature-envy`・`encapsulation`** の話。触る採点関数も別(あちらは `interfaceContracts.ts`)
- `docs/specs/` 24件: `fields-and-feature-envy.md` 60・84〜85行目が「自分側 = 自クラス + extends の先祖。継承元のフィールドは可視性を問わず違反にしない」と定め、
  **`// ponytail: 子クラスから親の private フィールドを触っても違反にしない。継承とフィールドを組み合わせたステージを作るときに見直す` を残す**としているが、
  このコメントは**コードに残っていない**(`fieldAccess.ts`・`Codebase.ts` をgrepして0件。`/ponytail-review debt` にも出ない)。
  同仕様の近道(504行目「追加した近道5件」)にも `lone-superclass-scoring.md` にも、「データの持ち主を継承元にする」近道は検討されていない
- `cohesion-value-object-anemic.md` 235行目は中級3で「`NotificationService extends TemplateEngine` にすると越境は消えるが、子が1つの継承 -10・結合度 -10 が付く」と、
  **extends で減点を逃れる経路を `lone-superclass` の -10 で相殺する**考え方を取っている。本件はその相殺が効かない(効いても割に合う)経路
- `stageCatalog.test.ts` の近道(中級6: 5件、中級7: 6件、中級8: 4件)に `setSuperclass` を使うものは1件も無い(`setSuperclass` の近道は上級5の4件だけ)
- 呼び出し元が列挙した33件のslugのいずれとも主題が重ならない

### 検討して見送った候補

- **呼ばれている空実装を `deleteMethod` で消すと `uses` が宙に浮く**: 空実装(`stub: true`)を直接 `uses` で呼ぶ処理はどのステージにも無い
  (上級6の呼び出しはインターフェース役の契約メソッドIDを指す)。実害なし
- **`mergeMethods` の統合結果の `reads`/`writes` が和集合になり、別クラスのフィールドを触る扱いになる**: 点が下がる方向で、抜け道ではない
- **凝集度(`cohesion.ts`)の塊を、自クラス内の呼び出しでつないでごまかす**: プレイヤーが呼び出しを足せるのは Extract Method(同じメソッドの中の処理)と
  Merge(`duplicateGroup` が要る)だけで、別の塊どうしをつなぐ手段が無い
- **`changeVisibility` で全部 public にして `visibility` を逃れる**: 広げるのは「広げないと届かない呼び出し元がある」ときだけ(`widening-not-needed`)で、既に塞がっている
- **`findCouplingViolations` が依存元側だけを数える**: 設計どおり(`dependency-scoring.md`)。抜け道ではない
- **新ステージ・画面の改善**: 前回までの探索と同じ理由(ステージ定義・`sampleAnswer.ts`・`stageCatalog.test.ts`・`score.ts`・`useGameStore.ts`・
  `StagePanel.tsx`・`CodebaseCanvas.tsx`・`CanvasContextMenu.tsx` が5件以上から触られる)

## 背景・目的

`fieldAccess.ts` の Feature Envy(`findEnviedClass` 39〜54行目)とカプセル化の破れ(`isWriteViolation`・`isReadViolation` 69〜80行目)は、
「自分側」を `extendsChainIds`(自クラス + **extends の先祖すべて**)で決め、先祖のフィールドは**可視性を問わず**自分のデータとして扱う。
`setSuperclass`(`setSuperclass.ts` 49〜68行目)は、フィールドだけを持つデータクラスを継承元に選ぶことを拒まない(右クリックの「継承元を設定」でそのまま作れる)。

そのため、**データを触っている側のクラスに「データの持ち主を extends させる」だけで、Feature Envy とカプセル化の破れが全部消える**。
ステージが教えたい Tell, Don't Ask(処理をデータの持ち主へ移す)を一切せずに点が上がり、`lone-superclass`(-10)は子を2つにすれば外せる。

### 中級6「他人のデータばかり触るメソッド」(コードを読んだ手計算。初期40点は `featureEnvyStage.test.ts` で固定済み)

1. **1手で 40 → 70点**: BillingService の「継承元を設定」で Subscription を選ぶ。Feature Envy 2件・カプセル化の破れ2件(status・canceledAt の書き換え)が消え、
   `lone-superclass` -10 が付くだけ(残りは行数 -10・責務 -10)
2. **7手で100点**(処理は1つも Subscription へ「頼む」形にならない):
   1. BillingService extends Subscription
   2. cancelSubscription を新しいクラス(NewClass)へ移す(ファイルの枠外へドラッグ = `moveMethodToNewClass`)
   3. NewClass extends Subscription(Subscription の子が2つになり `lone-superclass` が消える)
   4. mailer を Subscription へ Move Field(NewClass の解約メールが「自分側」の private フィールドを読む扱いになる)
   5. renewSubscription から chargeCard を Extract Method
   6. renewSubscription から sendInvoiceMail を Extract Method
   7. sendInvoiceMail を Subscription へ Move Method
   - 結果: BillingService(trial・pricing・payment の3種類、renew 42行・クラス72行、依存は Subscription だけ)、NewClass(cancellation・notification、依存は Subscription だけ)、
     Subscription(sendInvoiceMail だけ、塊1つ)。Feature Envy・カプセル化・凝集度・循環・結合度・空の入れ物・未使用 private・`lone-superclass` すべて0件の見込み。
     BillingService → Subscription の private 呼び出しは、中級6が `visibilityEnforced` でないので数えない

実際のコードで考えると、`BillingService extends Subscription` は「請求サービスは契約の一種である」という誤った is-a で、Subscription の private な `mailer` を
子クラス(NewClass)から読むのは TypeScript ではコンパイルエラーになる。**今の採点は「データを持つクラスを継承すれば Tell, Don't Ask をしなくてよい」と教えてしまう**。
対象プレイヤー(新卒〜4年目)がちょうど陥りやすい「コードを共有したいから継承する」誤りを、満点で後押ししてしまうのは有害で、採点の信頼も損なう。

### 中級7・中級8でも同じ1手が効く(手計算。初期点は各ステージのテストで固定済み)

- 中級7「getter/setter だけの口座クラス」(初期40点): AccountService extends Account で、getter/setter 越しの Feature Envy 2件・カプセル化の破れ2件が消え、
  setter も「他クラスから呼ばれている」ので `findOpenSetters` に数えない → **1手で 40 → 70点**(行数・凝集度・`lone-superclass` が残る)
- 中級8「給与と住所を抱えた社員クラス」: 新しいクラス Address に住所の private フィールド3つを Move Field し、Employee extends Address にすると、
  Employee のメソッドは住所のメソッドを1つも移さずに「自分側」のフィールドを触る扱いになり、凝集度の減点も消える(`cohesion.ts` は自クラスのフィールドだけ見る)。
  Address の private フィールドを子が触るのはコンパイルエラーになる形

ponytail の階段では「このリポジトリにもうあるか?」で止まる見込み: `extendsChainIds`・`Field.visibility`・`isReadViolation` の形はそろっており、
「自分側」の決め方を直すか、`setSuperclass` の前提条件に `err` を1つ足すかのどちらか。新しい依存・新しいUI・新しいルール名は要らない見込み。

## 関連する既存コード

- `src/domain/scoring/fieldAccess.ts` — **変更の中心(採点で直す場合)**。`findEnviedClass`(41行目 `selfIds`)、`isWriteViolation`・`isReadViolation`(69〜80行目)、
  `collectClassViolations`(89行目 `selfIds`。アクセサ越しの書き換えも同じ `selfIds` で判定)
- `src/domain/scoring/fieldAccess.test.ts` — **変更**(テストを先に書く)。115行目「親クラス(extends)のフィールドを2つ触る子クラスのメソッド → 空」、
  **275行目「親クラス(extends)の private フィールドの書き換え → 空」は今の挙動をそのまま固定しているので、直し方によっては期待値を変える**
- `src/domain/codebase/Codebase.ts` — `extendsChainIds`(148〜157行目)・`accessorFieldAccess`・`Field.visibility`。**読むだけ**の見込み
  (`visibility.ts`・`changeVisibility.ts`・`interfaceContracts.ts` と共有しているので、`extendsChainIds` 自体は変えない)
- `src/domain/codebase/setSuperclass.ts` — `setSuperclass`・`promoteCalledPrivateMethods`(メソッドは自動で protected に広げるが、フィールドは広げない)。
  **操作で直す場合のみ変更**
- `src/domain/scoring/loneSuperclass.ts` — 子が1つの継承 -10。子を2つにすると外れる。**読むだけ**
- `src/domain/scoring/cohesion.ts` — 自クラスのフィールドだけで塊を見る(継承元のフィールドは見ない)。**読むだけ**
- `src/infrastructure/stages/intermediateStages.ts` 408〜531行目(中級6)・538〜703行目(中級7)・710行目〜(中級8) — **読むだけ**
- `src/infrastructure/stages/featureEnvyStage.test.ts`・`anemicDomainModelStage.test.ts`・`extractClassStage.test.ts` — ステージ固有のテスト。**回帰テストの追記先の候補**
- `src/infrastructure/stages/stageCatalog.test.ts` 163〜316行目 — 中級6〜8の近道。**読むだけ**(回帰テストの置き場所は論点)
- `src/domain/stage/sampleAnswer.ts` 270〜271・328〜355行目 — 模範解答。上級1の `setSuperclass` 2手(NotifierBase。フィールドなし)以外に継承を使う手は無い。**読むだけ**
- `docs/specs/fields-and-feature-envy.md` 55〜89行目(Feature Envy・カプセル化の定義と ponytail)・180行目(`has-fields` で抜け道を塞いだ前例)
- `docs/specs/cohesion-value-object-anemic.md` 36・121・235行目 — `promoteCalledPrivateMethods` と「extends の抜け道を `lone-superclass` で相殺」する前例

## スコープの見立て

小さい。1回のPRに十分収まる。採点で直すなら domain の1ファイル(`fieldAccess.ts`)とそのユニットテスト、中級6〜8のステージ固有テストに回帰テスト数件。

- どのステージの**初期状態・模範解答にも「フィールドを持つクラスの extends」は無い**(`superclassId` を持つのは上級5の CsvExporter → BaseExporter だけで、
  どちらもフィールドなし。上級1の模範解答の NotifierBase もフィールドなし。クイズ・白紙設計にも無い)ので、既存の初期点・模範解答100点・近道テストは変わらない見込み

1. **今回やる**:
   - 中級6で上の「1手」と「7手」の点数を**まず今の実装でテストに書いて実測**し(手計算の確認)、直したあとに7手の経路が100点にならないことを固定する
   - 中級7・中級8の「データの持ち主を extends する」経路も、少なくとも今より点が上がらない(または100点にならない)ことを確かめる
   - 既存ステージの初期点・模範解答100点・既存の近道テストが変わらない
2. **後回し**:
   - 右クリックメニューの「継承元を設定」の候補からデータクラスを除く/無効表示にする(`CanvasContextMenu.tsx` は `move-via-context-menu`・
     `move-class-via-context-menu`・`method-rename-keyboard` が触るので、それらのマージ後)
   - フィールドの可視性を変える操作(protected にする)。今はフィールドの可視性を変える操作自体が無い(YAGNI)
   - 凝集度で継承元のフィールドを数える(`cohesion.ts` の ponytail のまま)

仕様設計者に決めてほしい論点(ここでは決めない):

- **どこで直すか**(組み合わせも可):
  - A. 採点(カプセル化): 継承元の **private** フィールドを子が読む・書くのは、他クラスと同じくカプセル化の破れに数える(TypeScript の意味どおり。
    `fields-and-feature-envy.md` の ponytail の「見直す」に当たる)。中級7・中級8(フィールドがすべて private)と、中級6の7手目の経路(NewClass が private の mailer を読む)に効く。
    **ただし中級6の Subscription のフィールドは public なので、1手目の 40 → 70点はこれだけでは残る**
  - B. 採点(Feature Envy): 「自分側」の先祖の数え方を変える(例: private フィールドは先祖でも自分側に数えない、など)。Lanza-Marinescu 流では先祖の属性は自分側なので、
    変えるなら理由を仕様に書く
  - C. 操作: `setSuperclass` の前提条件で「データの持ち主を継承元にする」形を拒む(例: 子が継承元のフィールドを触っていて、継承元のメソッドを1つも使わない/上書きしない)。
    判定が素朴なヒューリスティックになるので、入れるなら `// ponytail:` で上限を書く。プレイヤーの操作が変わるので E2E と `SET_SUPERCLASS_ERROR_MESSAGES` への1行が要る
  - D. `lone-superclass` の相殺に任せ、「子を2つ作る」経路だけを塞ぐ(A と組み合わせる前提)
- **getter/setter 越しのアクセス(中級7)**: 継承元の public な getter を子が呼ぶのは TypeScript では正しいコード。A を入れても中級7の1手目が塞がるかは、
  アクセサ越しのアクセスを「直接のアクセス」と同じ線引きにするかで決まる
- **`setSuperclass` の自動昇格との整合**: メソッドは `promoteCalledPrivateMethods` で子が呼ぶ private を protected に広げている。A を入れるなら、フィールドも自動で
  protected に広げるか(広げると抜け道が戻る)、広げずに減点のままにするか
- **回帰テストの置き場所**: `featureEnvyStage.test.ts` など各ステージのテストに置くか、`stageCatalog.test.ts` の `shortcuts` に足すか
  (`stageCatalog.test.ts` は `inline-method-stage`・`utils-class-split-stage`・`law-of-demeter-stage`・`template-method-stage`・`extends-interface-loophole` が触る)
- **「100点になる」の確認**: 上の点数はすべてコードを読んだ手計算。テストで実測してから仕様に書く(`moveMethodToNewClass` の代わりに `addFile`・`addClass`・`move` の
  `SolutionStep` で書ける)

### 既存パイプラインとの衝突可能性

| ファイル | 本件の変更 | 同じファイルを触る進行中の件 | 衝突の見立て |
|---|---|---|---|
| `src/domain/scoring/fieldAccess.ts`・`.test.ts` | 「自分側」の判定の変更・テスト | **なし**(`score-deduction-locations` は戻り値を読むだけ。戻り値の形は変えない) | なし |
| `src/infrastructure/stages/featureEnvyStage.test.ts`・`anemicDomainModelStage.test.ts`・`extractClassStage.test.ts` ※ 回帰テストをここに置く場合 | describe に数件追記 | **なし**(`law-of-demeter-stage`・`inline-method-stage`・`utils-class-split-stage` は「同じ形の新規ファイル」を作るだけ。`data-placement-quizzes` は固定済みの点数を**読むだけ**) | なし |
| `src/infrastructure/stages/stageCatalog.test.ts` ※ 近道に足す場合のみ | `shortcuts` に1〜3件 | `inline-method-stage`・`utils-class-split-stage`・`law-of-demeter-stage`・`template-method-stage`・`extends-interface-loophole` | 小〜中。同じ配列への追記で隣接しうる。避けたいなら上のステージ固有テストに置く |
| `src/domain/codebase/setSuperclass.ts`・`.test.ts` ※ C(操作で直す)の場合のみ | 前提条件の追加 | `extends-interface-loophole`(操作で直す案を選んだ場合に同じ関数へ前提条件を足す) | 中。両方が操作案を選ぶと同じ関数・同じエラー型に追記する。**どちらかのマージ後に進める**のが安全 |
| `src/application/RefactorUseCases.ts`・`.test.ts` ※ C の場合のみ | `SET_SUPERCLASS_ERROR_MESSAGES` に1行 | `extends-interface-loophole`(C 相当を選んだ場合)・`identifier-name-validation`・`delete-class-code-guard`(別の `Record`) | 小〜中。同じ `Record` になりうるのは `extends-interface-loophole` だけ |
| 新規 `e2e/<名前>.spec.ts` ※ C の場合のみ | E2E | なし | なし(`refactor.spec.ts` には追記しない) |

- **読むだけで変更しないファイル**: `Codebase.ts`(`extendsChainIds` は `visibility.ts`・`changeVisibility.ts` と共有)・`loneSuperclass.ts`・`cohesion.ts`・
  `intermediateStages.ts`・`sampleAnswer.ts`・`score.ts`
- **触らないファイル**: ステージ定義(`src/infrastructure/stages/*.ts` の本体)・`CanvasContextMenu.tsx`・`useGameStore.ts`・`StagePanel.tsx`・`CodebaseCanvas.tsx`・
  `describeScore.ts`・`e2e/refactor.spec.ts`・`workers/critique/`
- **意味上の依存**(テキストの競合ではなく、中身が影響し合うもの):
  - `extends-interface-loophole`: 同じ「extends で採点をすり抜ける」系統だが、採点関数が別(`interfaceContracts.ts`)。両方が C(`setSuperclass` の前提条件)を選ぶ場合だけ
    同じ関数に触る。採点で直すならどちらが先でも動く
  - `score-deduction-locations`: `feature-envy`・`encapsulation` の対象(メソッドID・クラスID)を内訳に出す。本件で増える違反も同じ形なので、そのまま一覧に出る
  - `codebase-code-view`: フィールドを可視性付きで表示する予定。本件で「子が親の private フィールドを触る」を違反にすれば、表示されるコード(コンパイルが通らない形)と採点がそろう
  - `data-placement-quizzes`: 中級6〜8の変更依頼の点数(固定済み)を使う。本件は初期状態・模範解答の点数を変えないので影響しない見込み
  - `template-method-stage`・`law-of-demeter-stage`: 新ステージにフィールドを持つクラスの継承は無い(02で確認)。影響しない見込み
  - `delete-class-code-guard`: 削除を扱う。本件は削除を扱わない
