# 01 機能探索: クラス・ファイルの削除で本物の処理が消えてしまう(削除して100点になる抜け道・切り出したメソッドの取りこぼし)を塞ぐ

- slug: `delete-class-code-guard`

## 出どころ

新規探索(`docs/pipeline/USER_FIXES.md` のキュー一覧は「まだ項目はありません」で、未完了項目 `### [ ]` が無かった)。

CLAUDE.md の「手を抜かないもの: … **データ消失を防ぐエラー処理**」と、採点の前提「リファクタリングは振る舞い(処理)を保ったまま形を変える」に
当たる穴として、進行中31件の01が**触っていない** domain の操作(`deleteClass.ts`・`deleteFile.ts`)を読んで見つけた。

### 既存テーマとの重複確認

- `docs/pipeline/*/01-discovered.md`・`02-draft-spec.md` を `deleteClass|deleteFile|inlineExtractedMethods|describeDelete|クラスを削除|ファイルを削除` でgrepした。
  **`deleteClass.ts`・`deleteFile.ts` を変更する予定の件は0件**。言及は次だけで、どれも「空になったファイルを消す」使い方:
  - `operation-guide` の02: 操作一覧に「クラス・ファイルを削除する」の行があるだけ
  - `utils-class-split-stage`・`law-of-demeter-stage` の02: 模範解答・近道で、**中身を移し終えた**ファイルを `deleteFile` する
  - `duplicate-code-scoring` の02(20行目): 「`deleteFile` は空のファイルだけ」でタグ付きの処理を消す手段は無い、と**前提にしている**。
    実際は中身のあるファイルも消せるので、この前提は今は成り立っていない(本件で成り立つようになる。下の「意味上の依存」)
- `docs/specs/` 24件では、`fields-and-feature-envy.md` 180行目が「フィールドを持つクラスを削除させると採点から外れる抜け道になる(データを消させない)」として
  `has-fields` を足した前例、`interface-segregation-stage.md` 229・503行目が「Delete Method を空実装以外に広げると行数・責務の減点を逃れる抜け道になる」
  として `deleteMethod` を空実装に限った前例。**メソッド(処理)を持つクラス・ファイルの削除**は、どちらの仕様でも手付かずのまま
- 呼び出し元が列挙した31件のslugのいずれとも主題が重ならない(採点ルールを足す件ではなく、操作の前提条件を足す件)

### 検討して見送った候補

- **子が継承している親クラスを削除したときに子の `superclassId`・`interfaceIds` が残る**: `docs/specs/inheritance.md` 111行目が意図して後回しにしており、
  `findSuperclass`・`findInterfaces` が「見つからないIDは飛ばす」で吸収している。本件で「中身のあるクラスは消せない」にすると、親として使われている
  クラス(上級の基底クラス・インターフェース役)の多くはそもそも消せなくなるので、先にこちらを直せば困りごとがさらに小さくなる
- **`setSuperclass` の `promoteCalledPrivateMethods` が直接の親しか見ない(祖父母の private を子が呼ぶ場合)**: 3段の継承を持つステージが無く実害が無い(YAGNI)
- **白紙設計で部品置き場のクラス・ファイル自体を消すと部品が消える**: 本件の「処理を持つクラスは消せない」に含まれて一緒に塞がる(別件にしない)
- **新ステージ・採点ルール・画面の改善**: 前回までの探索と同じ理由(ステージ定義・`sampleAnswer.ts`・`stageCatalog.test.ts`・`score.ts`・`useGameStore.ts`・
  `StagePanel.tsx`・`CodebaseCanvas.tsx` が5件以上から触られる)。本件は domain の2ファイルと、他の件が触らないテストに閉じる

## 背景・目的

`src/domain/codebase/deleteClass.ts` の `deleteClass` は、フィールドを持つクラスだけを `has-fields` で拒み、それ以外は
「Extract Method で切り出したメソッドを呼び出し元へ戻す(`inlineExtractedMethods`)」だけをしてから**クラスごと消す**。
`deleteFile.ts` も同じ処理を中の全クラスに当ててから消す。元の目的は auto-dev のタスク(`docs/auto-dev/TASKS.md` 71〜91行目)にある
「**間違えて作った・結局使わなかった**クラスやファイルを消す」ことだったが、次の2つのずれがある。

1. **本物の処理を持つクラス・ファイルを消せてしまい、消すだけで点が上がる(ステージによっては100点になる)**
   - 例: 中級1「循環依存を断ち切る」(`intermediateStages.ts` 8〜113行目)で `src/order/Order.ts` を右クリック →「ファイルを削除」。
     Order の3メソッド(checkout 80行など)が消え、Customer の `uses` は存在しないメソッドIDを指すだけになる。`classDependencies`(`dependencies.ts` 51〜59行目)は
     存在しないIDを無視するので循環依存も結合度も0件になり、残る Customer(48行・責務2種類)と Inventory には減点が無い。**コードを読む限り100点**で、
     `updateProgress` が自己ベスト100点を記録する(ステージがクリア扱いになる)
   - 上級5「継承をたたむ」でも、`BaseExporter.ts` をメソッドを移さずに消すと、子の `superclassId` が宙に浮き `lone-superclass` の減点ごと消える見込み
   - `deleteMethod` は同じ抜け道を塞ぐために空実装だけに限っている(`deleteMethod.ts` 6〜9行目)のに、クラス・ファイル単位では素通りになっている
2. **切り出したメソッドを public にしてから元のクラスを消すと、処理が黙って消える(データ消失)**
   - `inlineExtractedMethods` は `inlineMethod` を呼ぶが、`inlineMethod` は private しか戻さない(`inlineMethod.ts` 22行目 `not-private`)。
     失敗すると `inlined.ok ? inlined.value : current` で**何もせずに進み**、そのままクラスごと消す(`deleteClass.ts` 17〜18行目)
   - 例: チュートリアル2で `calculateTax` を抽出 → TaxCalculator へドラッグ → 別クラスから呼ばれる private なのでメソッドエディタで public に変える →
     TaxCalculator を削除。消費税の24行が消え、placeOrder には「calculateTax() を呼び出す」行だけが残って、存在しないメソッドを指す
   - 変更依頼(新機能の追加)・白紙設計でも、部品を置いたクラスを消すと部品がコードベースから消える(`changePart.test.ts` 64〜78行目、
     `measurePlacement.test.ts` 76〜86行目がこの挙動をそのまま固定している)。部品置き場にも戻らないので、Ctrl+Z 以外で置き直せない

対象プレイヤー(新卒〜4年目)にとって、「リファクタリングは処理を消さずに形を変えること」はこのゲームの一番の前提である。
**消せば点が上がる**抜け道が1クリックで見つかる状態は、採点の信頼を損ね、誤った癖(困ったら消す)を教えかねない。確認ダイアログが無い
(`CanvasContextMenu.tsx` 97行目「誤って消しても Ctrl+Z で戻せる」)ぶん、気づかないまま処理を失うこともある。

ponytail の階段では「このリポジトリにもうあるか?」で止まる見込み: `has-fields` と同じ形で、**消すと処理が失われるクラス・ファイルの削除を
操作の前提条件で拒む**(`Result` の `err`)。エラーの文言は既存の `DELETE_CLASS_ERROR_MESSAGES`・`DELETE_FILE_ERROR_MESSAGES` に1件ずつ足し、
画面は既存の `apply(result, describe…Error)` でそのまま失敗メッセージが出る。新しい依存・新しいUIは要らない。

## 関連する既存コード

- `src/domain/codebase/deleteClass.ts` — **変更の中心**。`has-fields` の判定(26行目)と `inlineExtractedMethods`(11〜20行目。失敗を黙って飛ばす箇所)
- `src/domain/codebase/deleteFile.ts` — **変更**。`has-fields` の判定(12行目)と `inlineExtractedMethods` の呼び出し(13行目)
- `src/domain/codebase/deleteClass.test.ts`・`deleteFile.test.ts` — **変更**(拒むケース・消せるケースのテストを先に書く)
- `src/domain/codebase/inlineMethod.ts` — `findCallerOf`・`inlineMethod`(private だけ戻す)。**読むだけ**の見込み(public の切り出しメソッドを戻せるようにするかは論点)
- `src/domain/codebase/deleteMethod.ts` — 空実装だけ消せる前例(`isStubMethod`)。**読むだけ**
- `src/domain/codebase/Codebase.ts` — `isStubMethod`・`isInterfaceLike`・`fieldsOf`。**読むだけ**
- `src/application/RefactorUseCases.ts` 285〜294行目 — 削除のエラー文言の `Record`。**1〜2行ずつ追記**
- `src/application/RefactorUseCases.test.ts` 442〜443行目付近 — 文言の網羅テスト。**追記**
- `src/domain/change/changePart.test.ts` 64〜78行目・`src/domain/change/measurePlacement.test.ts` 76〜86・169〜182行目 — 処理を持つクラスを
  `deleteClass` している既存テスト。**挙動を変えるなら書き換える**(下の論点)
- `src/domain/blank/tray.ts` — `findUnplacedParts` の「クラスごと削除した」ケースのコメント(22行目付近)。**読むだけ**(注記を直すかは論点)
- `src/presentation/canvas/CanvasContextMenu.tsx` 97〜121行目・`src/presentation/store/useGameStore.ts` 318〜332行目 — 削除の呼び出し元。**読むだけ**(変えない見込み)
- `src/domain/stage/sampleAnswer.ts` 249・326行目 — 模範解答の `deleteFile` は、どちらも中身を移し終えた(空の)ファイル。**変えずに100点のまま**を確かめる
- `src/infrastructure/stages/stageCatalog.test.ts` 153〜162・196〜210行目 — 近道で `deleteFile` する2件(空実装だけのクラスのファイル、フィールドを移し終えた空のクラスのファイル)。
  **変えずにそのまま通る**ようにする(空実装だけのクラスを消せるようにしておけば通る。下の論点)
- `docs/specs/fields-and-feature-envy.md` 180・256・478・499行目 — `has-fields` を足したときの設計・テスト・E2Eの書き方(本件の手本)
- `docs/specs/interface-segregation-stage.md` 229・503行目 — Delete Method を空実装に限った理由
- `docs/auto-dev/TASKS.md` 71〜91行目・`docs/auto-dev/IMPLEMENTATION_LOG.md` 36〜48行目 — 削除操作の元の目的と実装
- `e2e/refactor.spec.ts` 639〜701・1113〜1123・1354〜1370行目 — 既存の削除のE2E(空のクラス・空のファイル・切り出しメソッドを private のまま戻す・フィールド持ちは拒む)。
  **変えずにそのまま通る**ことを確かめる

## スコープの見立て

小さい。1回のPRに十分収まる。domain の2ファイルの前提条件と、そのユニットテスト、application のエラー文言、新しいE2Eの spec ファイル1本。

1. **今回やる**:
   - 消すと本物の処理(行数を持つ Fragment)が失われるクラス・ファイルの削除を `err` で拒み、何を先にすればよいかが分かる文言を出す
   - 切り出したメソッドを呼び出し元へ戻せなかった(今は黙って飛ばしている)場合に、処理を失ったまま成功にしない
   - 空のクラス・空のファイル・中身を移し終えたファイルは今までどおり消せる(模範解答・既存の近道テスト・既存のE2Eがそのまま通る)
   - E2E(新しい spec ファイル。例 `e2e/delete-guard.spec.ts`): 中級1で `Order.ts` を「ファイルを削除」してもファイルが残り、失敗メッセージが出て点数が変わらない/
     チュートリアル2で切り出して移して public にした `calculateTax` を持つ TaxCalculator を消そうとしても処理が失われない、程度
2. **後回し**:
   - 親クラス・インターフェース役を消したときに子の `superclassId`・`interfaceIds` を片付ける(`inheritance.md` の後回しのまま)
   - 右クリックメニューで「消せないクラス・ファイル」の「削除」項目を無効表示(`aria-disabled`)にする。`move-via-context-menu`・`move-class-via-context-menu`・
     `method-rename-keyboard` が `CanvasContextMenu.tsx` を触るので、それらのマージ後
   - 白紙設計・変更依頼で、消したクラスの部品を部品置き場へ**戻す**(拒むだけで足りるなら作らない。YAGNI)

仕様設計者に決めてほしい論点(ここでは決めない):

- **「消せるクラス」の線引き**: 次のどれを消せるものとするか
  - メソッドが0個(空のクラス)… 当然消せる
  - 空実装(`isStubMethod`)だけ … `deleteMethod` で1つずつ消せるものなので、まとめて消せても新しい抜け道にならない。
    `stageCatalog.test.ts` の近道「Trash.ts を消す」(`contract` の減点で100点未満)を**書き換えずに**通すには、ここを許す必要がある
  - 契約メソッド(`fragments: []`)だけのインターフェース役 … 行数は失われないが、実装クラスの `interfaceIds` が宙に浮き、`contract` の減点が消えうる
  - 切り出したメソッド(呼び出し元が削除対象の外にある)… 今までどおり戻してから消す。**public の場合**は、`inlineMethod` 側で戻せるようにするか、
    戻せないので拒むか
  - 呼び出し元も同じクラスにある切り出しメソッド(`deleteClass.test.ts` 69〜85行目)… 今は「そのまま消える」。
    呼び出し元ごと本物の処理なので、上の規則で自然に拒まれるはず(このテストの期待値を変えることになる)
- **エラーの種類**: `has-fields` と並べて1つ足すか(例: `has-methods`)、「戻せない切り出しメソッドがある」を別のエラーに分けるか。文言で「先に別のクラスへ移す」
  「呼び出し元へ戻す」のどちらを案内するか
- **変更依頼・白紙設計での扱い**: 部品を置いたクラスを消せなくするか(部品置き場へドラッグで戻すのが正しい手順になる)、モードごとに変えるか。
  変えるなら `changePart.test.ts`・`measurePlacement.test.ts`・`tray.ts` のコメントの期待値をどう直すか
  (`measurePlacement.test.ts` 169〜182行目「既存クラスを消すと触った扱い」は、処理を持つ `class-order` を消しているので書き換えが要る)
- **回帰テストの置き場所**: 中級1の「Order.ts を消すと100点」の近道を、`stageCatalog.test.ts` の `shortcuts` に足すか、`deleteFile.test.ts` など
  本件のファイルの中で確かめるか(`stageCatalog.test.ts` は `inline-method-stage`・`utils-class-split-stage`・`law-of-demeter-stage`・`stage-reference-integrity` が触る)
- **「100点になる」の確認**: 上の中級1の見立てはコードを読んだ手計算。テストで実際に確かめてから仕様に書く

### 既存パイプラインとの衝突可能性

| ファイル | 本件の変更 | 同じファイルを触る進行中の件 | 衝突の見立て |
|---|---|---|---|
| `src/domain/codebase/deleteClass.ts`・`.test.ts` | 前提条件の追加・テスト | **なし** | なし |
| `src/domain/codebase/deleteFile.ts`・`.test.ts` | 前提条件の追加・テスト | **なし** | なし |
| `src/application/RefactorUseCases.ts` | `DELETE_CLASS_ERROR_MESSAGES`・`DELETE_FILE_ERROR_MESSAGES` に1〜2行 | `identifier-name-validation`(`RENAME_*`・`EXTRACT`・`MERGE`・`ADD_*` の各 `Record` に追記) | 小。別の `Record` への追記なので、隣接行でなければ自動マージできる見込み |
| `src/application/RefactorUseCases.test.ts` | 文言の網羅テストに1〜2行 | `identifier-name-validation`(同じ describe に追記) | 小〜中。同じ配列への追記で隣接しうる。後からマージする側が手で並べ直す程度 |
| `src/domain/change/changePart.test.ts`・`measurePlacement.test.ts` ※ 変更依頼での挙動を変える場合のみ | 既存テストの書き換え | なし | なし |
| `src/domain/codebase/inlineMethod.ts` ※ public の切り出しメソッドも戻せるようにする場合のみ | 条件の変更 | なし(`inline-method-stage`・`template-method-stage` の02は「変更しない」/`mergeMethods.ts` 側) | なし。ただし `inline-method-stage` が Inline の可否(private のみ)を採点の前提にしているので、変えるなら意味上の確認が要る |
| 新規 `e2e/<名前>.spec.ts` | E2E | なし | なし(`refactor.spec.ts` には追記しない) |

- **読むだけで変更しないファイル**: `CanvasContextMenu.tsx`・`useGameStore.ts`・`Codebase.ts`・`deleteMethod.ts`・`tray.ts`・`sampleAnswer.ts`・`stageCatalog.test.ts`
- **触らないファイル**: `score.ts`・`describeScore.ts`・`dependencies.ts`・ステージ定義(`src/infrastructure/stages/`)・`CodebaseCanvas.tsx`・`ClassNode.tsx`・`MethodChip.tsx`・
  `FileNode.tsx`・`layoutCodebase.ts`・`StagePanel.tsx`・`MethodEditor.tsx`・`index.css`・`e2e/refactor.spec.ts`・`workers/critique/`
- **意味上の依存**(テキストの競合ではなく、中身が影響し合うもの):
  - `duplicate-code-scoring`: 02が「`deleteFile` は空のファイルだけ、なのでタグ付きの処理を消す手段は無い」を前提にしている。今はこの前提が崩れていて、
    重複を含むファイルを消せば重複の減点も逃れられる。本件のマージで前提が成り立つ(どちらが先でも動くが、本件が先だと向こうの前提が正しくなる)
  - `utils-class-split-stage`・`law-of-demeter-stage`: 模範解答・近道の `deleteFile` は、中身を移し終えたファイル(空のクラスだけ・メソッドが0個)を消す形。
    本件の規則で拒まれないことを仕様設計で確かめる(両方の02の手順を見る限り、拒まれない見込み)
  - `operation-guide`: 操作一覧の「クラス・ファイルを削除する」に「中身が残っていると消せない」を添えるかは、あちらの文言の問題(どちらが先でも動く)
  - `move-via-context-menu`・`move-class-via-context-menu`・`method-rename-keyboard`: `CanvasContextMenu.tsx` を触るが、本件はメニューを変えない。
    「消せない項目の無効表示」は後回しにして、あちらのマージ後に見る
  - `stage-draft-persistence`・`undo-shortcut-scope`: 削除の成功・失敗は既存の `apply` の流れのままなので、保存・取り消しとは関係しない
  - `inline-method-stage`: `inlineMethod` の private 限定を前提に「分けすぎ」を数える。本件で `inlineMethod` を変えない選択なら影響なし
