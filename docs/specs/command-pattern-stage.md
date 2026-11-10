# command-pattern-stage: 上級10「ボタンの処理を Command に切り出す」を足す

- 重複の確認: 既存の実装・仕様書に Command パターンのステージは無い(`src/`・`docs/specs/` を `command`/`Command` で検索して0件)。
  `docs/feature-ideas/IDEAS.md` の「3. Commandパターンのステージ」が未仕様化のまま残っており、本仕様がそれにあたる。
- 下敷き: 上級9(`docs/specs/state-pattern-stage.md`)と同じ作り(呼び出し側がインターフェース経由で呼ぶ形を前任者が先に作ってあり、
  プレイヤーは「抽出 → 移動 → 実装の設定」を操作ごとに繰り返す)。採点・操作・型には手を入れない。

## 背景・目的

上級では Strategy・Factory・ISP・Value Object・Template Method・State を練習できるが、「画面のボタンのハンドラに直書きされた処理を、
**実行内容を表すクラス(Command)に切り出し、ボタン(呼び出し側)から分ける**」Command パターンのステージが無い。

- 対象プレイヤー(新卒〜4年目)は、ボタンの `onClick` に保存・削除の本体を直書きしがち。新しいボタンのたびに画面のクラスが膨らみ、
  「元に戻す」「後でまとめて実行」のような後続の要求で全ハンドラを読み直すことになる。
- 操作をオブジェクトにすると、ボタンの部品は「Command を実行する」だけになり、新しい操作はクラスを足すだけで済む。
  さらに、操作が自分の状態を覚えておけるので Undo に、オブジェクトとして並べておけるのでキュー処理につながる。
  これを変更依頼(新しいボタンの追加/保存ルールの変更/削除の取り消し)と理解度チェックで体験させる。

上級の末尾(上級9の次)に1ステージ足す。

## 変更対象ファイル一覧

| 種別 | パス | 層 | 役割 |
| --- | --- | --- | --- |
| 変更 | `src/infrastructure/stages/advancedStages.ts` | infrastructure | 新ステージ `editorCommandStage`(id `advanced-editor-command`)を定義し、`advancedStages` 配列の**末尾**(`orderStateStage` の次)に足す。**衝突注意**(下記) |
| 新規 | `src/infrastructure/stages/runtime/advanced-editor-command.ts` | infrastructure | C# 実行用の `advancedEditorCommandRuntime`(全ステージに runtime が必須。`stageCode.test.ts`) |
| 変更 | `src/domain/stage/sampleAnswer.ts` | domain(データ) | `sampleAnswerSteps['advanced-editor-command']`(15手)を足す。**衝突注意** |
| 変更 | `src/infrastructure/stages/solutionPhaseTable.ts` | infrastructure | 8手以上なので方針の表 `'advanced-editor-command'` を足す。**衝突注意** |
| 変更 | `src/infrastructure/story/storyChapters.ts` | infrastructure | 新ステージの章を末尾に足し、上級9の章から「最後の章」の文言を外す(「全ステージに章がある」「並びが stages と同じ」テストのため)。**衝突注意** |
| 新規 | `src/infrastructure/stages/editorCommandStage.test.ts` | infrastructure(テスト) | 新ステージ固有のテスト(`orderStateStage.test.ts` と同じ形) |
| 変更 | `src/infrastructure/stages/stageCatalog.test.ts` | infrastructure(テスト) | 初期違反の種類の表に1行、近道(`shortcuts`)に2件。**衝突注意** |
| 変更 | `src/infrastructure/stages/templateMethodStage.test.ts` | infrastructure(テスト) | `stages.filter(advanced).at(-2)` が「上級8は上級9の直前」を末尾からの位置で見ているため、末尾に足すと壊れる。「上級8の次が `advanced-order-state`」を位置に依らず確かめる形に直す(テスト名も「上級9の直前にあり、…」のまま意味が通る) |
| 変更 | `src/infrastructure/stages/stageCode.test.ts` | infrastructure(テスト) | 「bindings で選んだ実装の実行」の `it.each` に1行足す(下記) |
| 変更 | `docs/stages/report.md` | — | `npm run stage-report` で再生成する(`stageReport.test.ts` のファイルスナップショット) |

**衝突注意**: 他の「新しいステージを足す」仕様と同時に進めると、上の印の箇所(配列・オブジェクトの末尾、ストーリーの「最後の章」、
`stageCatalog.test.ts` の表、`templateMethodStage.test.ts` の位置の検査)が必ずぶつかる。後からマージする側が、
タイトルの番号(上級10/11)・ストーリーの「最後の章」と最終章の outro の受け渡し・末尾の並びを合わせ直すこと。

- domain の採点・操作(`scoring/`・`codebase/`・`change/`)、application、presentation は変更しない。既存の操作
  (Add File・Add Class・Extract Method・Move Method・実装するインターフェースの設定)だけで100点になる。
- 新しい依存は足さない。E2E は足さない(設計判断8)。

## データ・型の変更

型(`Stage`・`Codebase`・`ChangeRequest`・`StageRuntime`)の変更はなし。ステージデータを1件足す。

### ステージの基本項目

| 項目 | 値 |
| --- | --- |
| id | `advanced-editor-command` |
| level | `'advanced'` |
| runtime | `advancedEditorCommandRuntime` |
| title | `上級10: ボタンの処理を Command に切り出す` |
| problem | `画面のボタンのハンドラに、保存・公開・削除の処理が直書きされている` |
| outcome | `ボタンが実行する処理を、Command のクラスに切り出せる` |
| learns | `['Command', '操作のオブジェクト化']` |
| principles | `['srp', 'ocp']` |
| limits | `{ method: 11, class: 36, file: 38 }` |
| dependencyLimit | `3`(コメントで理由を書く。設計判断2) |
| conditionNotes | `{ coupling: 'このゲームでは呼び出し先を書き換えられないため、EditorScreen が3つの Command のクラスを呼ぶ形を答えとして認めるため' }` |
| responsibilityLimit | `2` |
| visibilityEnforced | 省略(移動したメソッドは自動で public になる) |

- description: `社内Wikiのページ編集画面。EditorScreen の onSaveClick(保存)・onPublishClick(公開)・onDeleteClick(削除)が、ページを保存・公開・削除する本体の処理と、結果を画面に知らせる処理を、それぞれ1つのハンドラに直書きしている。ボタンを足すたびに EditorScreen が膨らみ、保存の決まりを確かめるにも画面のコードを読むことになる。ボタンの部品 ToolbarButton は、前任者が Command(インターフェース)経由で操作を実行する形に先に書き換えたが、Command を実装したクラスはまだ無い。`
- goal: `ボタンが押されたときの本体(保存・公開・削除)を、操作ごとの新しいクラス(SaveDocumentCommand/PublishDocumentCommand/DeleteDocumentCommand)に切り出そう。Extract Methodで本体を execute として取り出し、Move Methodで操作のクラスへ移す。画面への反映は EditorScreen に残す。最後に3クラスとも Command を実装(implements)しよう。上級9(State)は状態をクラスにしたが、Command は「ボタンが押されたときの操作」そのものをクラスにする。メソッドは11行・クラスは36行・ファイルは38行以内、1クラスの責務は2種類まで、依存先は3クラスまで`
- why: `ボタンのハンドラに操作の本体が直書きされていると、操作の決まりを変えるたびに画面のコードを読み、ボタンを足すたびに画面のクラスが膨らみます。操作を Command のクラスに分けると、操作ごとに読む場所が絞れ、新しい操作はクラスを足すだけで済みます。`
- responsibilityNames: `'command-dispatch': '操作の実行'`、`'screen-feedback': '画面への反映'`、`'document-save': 'ページの保存'`、`'document-publish': 'ページの公開'`、`'document-delete': 'ページの削除'`、`'document-duplicate': 'ページの複製'`
- classNames(自動命名。初期のクラス名 EditorScreen・ToolbarButton・Command と重ねない): `'command-dispatch': 'CommandInvoker'`、`'screen-feedback': 'EditorFeedback'`、`'document-save': 'SaveDocumentCommand'`、`'document-publish': 'PublishDocumentCommand'`、`'document-delete': 'DeleteDocumentCommand'`、`'document-duplicate': 'DuplicateDocumentCommand'`(変更依頼1で新しいクラスに置いたときの自動名)
- methodNames: `'command-dispatch': 'runCommand'`、`'screen-feedback': 'showFeedback'`、`'document-save': 'savePage'`、`'document-publish': 'publishPage'`、`'document-delete': 'deletePage'`

### 初期コードベース

ID は他ステージと重ねない。`lines` はコードの行数と一致させる(`stageCode.test.ts`)。1行に文は1つ。行頭が `return` の行は書かない。

| ファイル(id) | クラス(id) | メソッド(id・可視性・引数) | Fragment(id / label / lines / responsibility / その他) |
| --- | --- | --- | --- |
| `src/editor/EditorScreen.ts`(`file-editor-screen`) | EditorScreen(`class-editor-screen`) | `onSaveClick`(`method-on-save-click`・public・`PageData page`) | `frag-save-page` / ページの入力を確かめて保存する / 4 / `document-save` / suggestedName `execute`<br>`frag-save-feedback` / 保存したことを画面に知らせ、ボタンを戻す / 2 / `screen-feedback` |
| 〃 | 〃 | `onPublishClick`(`method-on-publish-click`・public・`PageData page`) | `frag-publish-page` / 下書きのページを公開し、検索に載せる / 4 / `document-publish` / suggestedName `execute`<br>`frag-publish-feedback` / 公開したことを画面に知らせ、ボタンを戻す / 2 / `screen-feedback` |
| 〃 | 〃 | `onDeleteClick`(`method-on-delete-click`・public・`PageData page`) | `frag-delete-page` / ページを検索から外して削除する / 4 / `document-delete` / suggestedName `execute`<br>`frag-delete-feedback` / 削除したことを画面に知らせ、ボタンを押せなくする / 2 / `screen-feedback` |
| `src/editor/ToolbarButton.ts`(`file-toolbar-button`) | ToolbarButton(`class-toolbar-button`) | `click`(`method-toolbar-click`・public・`string label, PageData page`) | `frag-run-command` / Command(インターフェース)経由で、ボタンに割り当てた操作を実行する / 2 / `command-dispatch` / uses `method-command-execute` |
| `src/editor/Command.ts`(`file-command`) | Command(`class-command`) | `execute`(`method-command-execute`・public・`PageData page`・`fragments: []`) | なし(インターフェース役) |

各 Fragment の C# コード(`code.csharp`。行数 = 上の lines。補助コードの名前は runtime に合わせて変えてよいが、行数は変えない)と `variables`:

```csharp
// frag-save-page            variables: { uses: ['page'] }
if (string.IsNullOrWhiteSpace(page.Title)) throw new ValidationException("タイトルが必要です");
page.UpdatedAt = DateTime.UtcNow;
FakePageRepository.Save(page);
Log.Info($"ページ {page.Id} を保存しました");
// frag-save-feedback        variables: { uses: ['page'] }
FakeToast.Show($"「{page.Title}」を保存しました");
FakeToolbar.Enable("save");
// frag-publish-page         variables: { uses: ['page'] }
if (page.Status != PageStatus.Draft) throw new InvalidOperationException("下書きのページだけ公開できます");
page.Status = PageStatus.Published;
FakePageRepository.Save(page);
FakeSearchIndex.Add(page.Id, page.Title);
// frag-publish-feedback     variables: { uses: ['page'] }
FakeToast.Show($"「{page.Title}」を公開しました");
FakeToolbar.Enable("publish");
// frag-delete-page          variables: { uses: ['page'] }
if (page.Status == PageStatus.Published) FakeSearchIndex.Remove(page.Id);
FakePageRepository.Delete(page.Id);
page.Status = PageStatus.Deleted;
Log.Info($"ページ {page.Id} を削除しました");
// frag-delete-feedback      variables: { uses: ['page'] }
FakeToast.Show($"「{page.Title}」を削除しました");
FakeToolbar.Disable("delete");
// frag-run-command          variables: { uses: ['label', 'page'] }
Log.Info($"ボタン「{label}」が押されました");
execute(page);
```

### runtime(`src/infrastructure/stages/runtime/advanced-editor-command.ts`)

`advanced-order-state.ts` と同じ形で書く。

- `entryMethodId: 'method-on-save-click'`、`entryArguments: ['SampleData.Page']`(初期は Command の実装が無く ToolbarButton を動かせないため、上級9と同じく画面側を入口にする)
- `bindings: { Command: 'SaveDocumentCommand' }`
- `bindingDemos: { Command: 'BindingDemo.Run("execute", {0}, () => {0}.execute(SampleData.NewPage()));' }`
- `support`: `logFile`・`bindingDemoFile` と、`PageData.cs`(`PageStatus { Draft, Published, Deleted }`、`PageData { int Id; string Title; PageStatus Status; DateTime UpdatedAt }`、
  `ValidationException`、何をしたかを1行出す偽物 `FakePageRepository`(Save/Delete)・`FakeSearchIndex`(Add/Remove)・`FakeToast`(Show)・`FakeToolbar`(Enable/Disable)、
  `SampleData`(`Page` と `NewPage()`。Status は Draft))
- `expectedBuildFailures` は付けない(移動で public になるので、途中の手でもビルドできる。上級9と同じ)

### 変更依頼(changeRequests。この順に並べる)

| # | id | kind | title | description | responsibility | linesPerSite | partName | rumor |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `req-add-duplicate` | `extend` | ページの「複製」ボタンを足して | ページを丸ごとコピーして、下書きとして開く「複製」ボタンを足したい。保存・公開・削除のボタンはこれまでどおり使う。 | `document-duplicate` | 4 | `execute` | なし(最初に全文を見せる extend) |
| 2 | `req-save-quota` | (modify) | 保存する前に、保存先の空き容量を確かめて | 保存先の空き容量が足りないときは、保存せずにエラーにしたい。 | `document-save` | 2 | `checkStorageQuota` | なし(最初に全文を見せる modify) |
| 3 | `req-delete-undo` | (modify) | 削除したページを、元に戻せるようにして | 削除する前のページの中身を覚えておき、「元に戻す」で復元できるようにしたい。 | `document-delete` | 2 | `rememberDeletedPage` | `{ from: '営業の佐藤さん', text: '間違えて消したページを戻せないかという問い合わせが、お客さんから増えているらしいです。' }` |

- 1は「新しい操作は Command を実装したクラスを足すだけ(既存クラスの修正0)」を見せる。partName を契約名 `execute` にする(上級8の `parse` と同じ。
  `stageCatalog.test.ts` の「extend の部品名は契約名と同じか、どのメソッド名とも重ならない」を満たす)。
- 3は Undo の入口(操作のオブジェクトが自分の状態を覚えておく)を、削除の Command だけを直す形で見せる。
- ボス(`boss: true`)は付けない(ボスのあるステージを固定で列挙しているテストを変えないため)。

### 理解度チェック(checks。正解は最長の選択肢にしない・正解の位置を2問で変える)

- `check-1`(answer: 1)「ボタンが実行する処理を Command のクラスに切り出すと、何が良くなる?」
  - 0: `ボタンのハンドラを全部読まないと、どのボタンが何をするのか分からなくなる` / 解説: `それは切り出す前の困りごとです。切り出したあとは、操作のクラスを1つ読めば済みます。`
  - 1: `新しい操作は、Command を実装したクラスを足すだけで追加できる` / 解説: `ボタンの部品は Command 経由で実行するだけなので、操作の中身を知らずに済みます。`
  - 2: `画面のクラスが無くなり、ボタンの処理をどこにも書かずに済むようになる` / 解説: `画面への反映は EditorScreen に残ります。切り出すのは、操作の本体だけです。`
- `check-2`(answer: 2)「Command パターンが、Undo(元に戻す)やキュー処理に強いのはなぜ?」
  - 0: `Command のクラスを使うと処理が速くなり、待たせずに実行できるから` / 解説: `速さは変わりません。強さの理由は、操作をオブジェクトとして持てることです。`
  - 1: `ボタンの部品が、保存や削除の中身をすべて知っていて、自分で戻せるから` / 解説: `その逆です。ボタンの部品は Command 経由で実行するだけで、中身を知りません。`
  - 2: `操作をオブジェクトとして取っておけるから` / 解説: `実行した Command を履歴に積めば元に戻せ、列に並べれば後でまとめて実行できます。`

### 模範解答(`sampleAnswerSteps['advanced-editor-command']`、15手)

どの操作も同じ名前 `execute` で抽出するので、上級9と同じく「抽出 → 移動」を1組ずつ行う(同じクラスに同名メソッドがあると抽出が失敗するため)。

```ts
'advanced-editor-command': ([['Save', 'save'], ['Publish', 'publish'], ['Delete', 'delete']] as const).flatMap(([operation, suffix]): SolutionStep[] => {
  const toClass = `${operation}DocumentCommand`;
  const file = `src/editor/${toClass}.ts`;
  return [
    { addFile: file },
    { addClass: { name: toClass, file } },
    { extract: { from: `on${operation}Click`, fragmentIds: [`frag-${suffix}-page`], name: 'execute' } },
    { move: { method: 'execute', fromClass: 'EditorScreen', toClass } },
    { addInterface: { class: toClass, interface: 'Command' } },
  ];
}),
```

方針の表(`solutionPhaseTable['advanced-editor-command']`):

- `{ from: 0, title: '「保存」の本体を、SaveDocumentCommand に切り出す', why: 'ボタンが押されたときの本体を1つのクラスにすれば、保存の決まりを変えるときに画面のコードを読まずに済むため' }`
- `{ from: 5, title: '「公開」も同じ形で PublishDocumentCommand に切り出す', why: '同じ手順で作れば、どの操作も Command として同じように実行できるため' }`
- `{ from: 10, title: '「削除」も DeleteDocumentCommand に切り出す', why: '最後の操作も分ければ、画面のクラスには画面への反映だけが残るため' }`

### 机上の検算(`stageCatalog.test.ts` の保証に通ること)

行数は `lineCount.ts` のとおり「コード行数+1」、メソッドは +3 と Fragment 間の空行、クラスは +3 とメソッド間の空行で数える。
抽出で残る呼び出し行は 1+1 = 2行。変更依頼で足す処理はコードを持たないので `linesPerSite` 行+空行1。

| 対象 | 初期 | 模範解答後 | 上限 |
| --- | --- | --- | --- |
| `onSaveClick` / `onPublishClick` / `onDeleteClick` | 各12(3件違反) | 各9(呼び出し+画面への反映) | メソッド11 |
| `ToolbarButton.click` | 6 | 6 | メソッド11 |
| 各 Command の `execute` | — | 8 | メソッド11 |
| `EditorScreen` クラス・`EditorScreen.ts` | 41 / 41(各1件違反) | 32 / 32 | クラス36 / ファイル38 |
| 各 Command のクラス / ToolbarButton / Command | — / 9 / 6 | 11 / 9 / 6 | クラス36 |
| 責務の種類 | EditorScreen 4種(1件違反)・ToolbarButton 1種 | EditorScreen 1種・各 Command 1種・ToolbarButton 1種 | 2 |
| 依存 | ToolbarButton → Command | ToolbarButton → Command、EditorScreen → 3つの Command のクラス | 3 |

- 初期: line-limit 5件+responsibility 1件 = **40点**(上級9と同じ内訳)。減点の種類は `['line-limit', 'responsibility']`。
  Command は実装されていないインターフェース役で、`execute` と同名の public メソッドを持つクラスも無いので contract・empty の減点は出ない。
- 模範解答後: **100点**。循環なし/空の入れ物なし/未使用 private なし(移動で public)/約束違反なし(3クラスとも `execute` を持ち Command を実装。
  EditorScreen・ToolbarButton の public メソッド名は契約名と重ならない)/横流しなし(ハンドラは画面への反映も持つ)/混在した抽出メソッドなし/
  フィールドを持たないので Feature Envy・カプセル化・凝集度は対象外/役割タグは使わない。
- 変更依頼(modify の変更コスト `scoreChange`):
  - `req-save-quota`: 初期は `onSaveClick`(追加後15行・クラス44・ファイル44で上限超え3 = -30、メソッド内の巻き込み1 = -5、
    クラス内の巻き込み3 = -15)で **50点** → 模範解答後は `SaveDocumentCommand.execute`(追加後11行で上限内)、波及1(EditorScreen が呼ぶ。-5)で **95点**。
  - `req-delete-undo`: 同じく 50点 → 95点。
  - 「はっきり楽になる」(1件目の modify): 読む行数 12 → 8(0.75倍の9以下)、クラスの行数 41 → 11。変更が必要なクラス数は1→1で増えない。
- 解答例の置き方(`sampleImplementation`)はすべて100点:
  - extend `req-add-duplicate`: Command を実装する新しいクラスに置く。既存クラスの修正0、Command は ToolbarButton から呼ばれているので `'abstract'`。
  - modify 2件: SaveDocumentCommand / DeleteDocumentCommand に置く(他の責務なし・散らばりなし)。
  - よって `knownChangeRequestExceptions` に足すものはない。
- 機能の追加の痛み(`measureExtendPain`): 初期は Command がまだ誰にも実装されていないので入口にならず、既存クラスを1つ以上書き換える。
  模範解答後は書き換え0・置き先は `{ kind: 'new-class', implementing: 'Command' }`。
- うわさ: `rumoredRequests` は1件目の extend と1件目の modify を除くので、3件目だけがうわさを持つ。話し手は既存の章の話し手、1文、
  タイトル・partName・自動命名のクラス名/メソッド名を含まず、「らしい」を含む。
- 振る舞いのテスト: 入口は `onSaveClick`・`onPublishClick`・`onDeleteClick`・`click`。抽出・移動・実装の設定は実行される処理の集合を変えないので、どの手の後も緑。
- 自動命名: 抽出は単独の Fragment なので `suggestedName`(`execute`)がそのまま候補になり、空いた場所へドラッグして作るクラスは
  `classNames` から `SaveDocumentCommand` などと自動で付く(プレイヤーに命名させない)。

数値が1つでも実測と合わない場合は、テストの期待値を実測に合わせるのではなく、Fragment の `lines`(とコード)を調整して上の表の関係
(初期は3ハンドラ・クラス・ファイルが超過、解答後と変更依頼の追加後は上限内)を保つこと。

### ストーリー(`storyChapters.ts`)

- 上級9の章: title を `注文の状態` に、outro を `3月の終わり。返品の受け付けについて、相談が届きました。` にする(結びは上級9の1件目の依頼 `req-add-returned-state` へつなぐ)。
- 新しい章を末尾に足す: `{ stageId: 'advanced-editor-command', title: '最後の章、ボタンの処理', speaker: TANAKA, intro: 'ページ編集画面のボタンに、保存や削除の処理がそのまま書かれている。ボタンを足すたびに画面のクラスが膨らんでいくんだ。ボタンが押されたときの処理を、ひとまとまりのオブジェクトとして扱える形にしてみてほしい。', outro: '3月31日の夕方。最後の依頼が届きました。このコードが整っていたからこそ、慌てずに済みそうです。' }`

## 動きの仕様

- ステージ一覧の上級の末尾(上級9の次)に「上級10: ボタンの処理を Command に切り出す」が出る。
- 初期画面: ToolbarButton → Command の依存矢印が1本。EditorScreen には矢印が無く、3つのハンドラが行数超過で赤い。
- プレイヤーの操作は既存のものだけ: メソッドエディタでハンドラの本体を選んで抽出(名前の候補は `execute`)→ 空いた場所へドラッグして
  新しいクラス(自動で `SaveDocumentCommand` などと命名)を作る → クラスの右クリックから Command を実装。
- 3クラスとも Command を実装すると、Command から3本の実装の矢印が出て100点になる。
- 100点のあと、変更依頼は「複製」ボタン(新しいクラスで100点)→ 保存前の空き容量(SaveDocumentCommand だけ直す)→
  削除の取り消し(うわさ付き。DeleteDocumentCommand だけ直す)の順に出る。

### 設計判断(確定)

1. **操作は「保存・公開・削除」の3つにする。** 上級9と同じ 3×5 = 15手で、上級の長さの範囲に収まる。2つだと「同じ形で増やせる」実感が弱く、
   4つだと手数が20手になる。
2. **Command を呼ぶのは ToolbarButton(前任者が作った形)にし、EditorScreen のハンドラは Command のクラスを直接呼ぶ形を認める。**
   このゲームでは呼び出し先(`uses`)を書き換える操作が無く、抽出した呼び出し行は具体的な Command のクラスを指したままになる。
   ToolbarButton が最初から Command 経由で呼ぶ形にすれば、変更依頼1の新しいクラスが「呼ばれている抽象」につながり100点になる
   (上級9・中級10と同じ作り。EditorScreen は「どのボタンにどの操作を渡すか」を組み立てる側として残る)。結合度の上限は3にし、`conditionNotes` で理由を出す。
3. **画面への反映(トースト・ボタンの状態)は EditorScreen に残す。** Command は「操作の本体」だけを持ち、画面を知らない。
   これで解答後の EditorScreen の責務が1種類になり、「画面と操作を分ける」が採点と一致する。
4. **責務は「操作」単位にする(保存・公開・削除)。** Command のクラスの責務が1種類になる。Command にせず1つの DocumentService にまとめる
   誤答(近道2)は責務の混在で100点にならない。
5. **変更依頼1の partName は契約名 `execute` にする。** 新しい操作が Command の契約を実装する形がそのまま部品名に表れる(上級8の `parse` と同じ)。
6. **Undo は「削除の Command だけを直す modify」で表す。** 操作のオブジェクトが自分の状態を覚えておけることを、直す場所が1クラスに絞れる形で見せる。
   履歴やキュー(Invoker 側の仕組み)は、変更依頼ではなく理解度チェック2で扱う(Invoker は初期から1か所なので、依頼にしても初期と解答後の差が出ないため)。
7. **うわさのために3件目の modify を足す。** うわさは「最初に全文を見せる extend・modify 以外」にしか付けられないため。
8. **E2E は足さない。** 新しい操作・UIは無く、使う操作(抽出・移動・新しいクラス・実装の設定)は既存の E2E が守っている(上級3・上級9の仕様と同じ判断)。

## TDD対象

新しい純粋関数は無い。ステージデータが仕様どおりに採点されることを、先にテストを書いて確かめる(Red → Green)。AAA で書く。

### `editorCommandStage.test.ts`(infrastructure・新規)

- 模範解答は15手で、初期40点から100点になる
- 初期は減点の種類が line-limit と responsibility だけで、`method-on-save-click`・`method-on-publish-click`・`method-on-delete-click` がメソッドの行数上限を超える
- 模範解答後、SaveDocumentCommand・PublishDocumentCommand・DeleteDocumentCommand の3クラスが Command を `interfaceIds` に持ち、それぞれ `execute` だけを持ち、責務は1種類だけ
- 模範解答後、EditorScreen に残る責務は `screen-feedback` だけ(ほかは呼び出し行 `call`)
- 異常系: 模範解答から `addInterface` の3手を抜くと100点未満(約束違反)
- extend `req-add-duplicate`: 初期は書き換えるクラスが1以上、模範解答後は0で、置き先が `{ kind: 'new-class', implementing: 'Command' }`
- modify `req-save-quota`: 初期の変更コストは50点、模範解答後は95点。読む行数が 12 → 8
- 変更依頼の kind が `['extend', 'modify', 'modify']` で、3件目だけがうわさを持つ
- 理解度チェックは、どの問題でも正解の選択肢の文字数がいちばん長くない

### `stageCatalog.test.ts`(infrastructure・変更)

- 「初期違反の種類」の表に `['advanced-editor-command', ['line-limit', 'responsibility']]` を足す
- 近道(`shortcuts`、どちらも100点未満):
  - `Command のクラスへ移すが Command を実装しない`: 模範解答から `addInterface` の手を除いたもの
  - `Command にせず、保存・公開・削除を1つの DocumentService へまとめる`: `src/editor/DocumentService.ts` と DocumentService を作り、
    3つの本体を `savePage`・`publishPage`・`deletePage` として抽出して DocumentService へ移す。責務3種類で混在の減点が出る(90点)
- その他の全ステージ共通の検査(模範解答で100点・解答例の依頼が100点・うわさ・自動命名・ID重複・方針の表・outcome など)は、コードの変更なしに新ステージにも効く

### `stageCode.test.ts`(infrastructure・変更)

- 「bindings で選んだ実装の実行」の表に `{ stageId: 'advanced-editor-command', contract: 'Command', other: 'PublishDocumentCommand', boundVariable: 'saveDocumentCommand', otherVariable: 'publishDocumentCommand' }` を足す
- 「上級9ステージが runtime を持ち、全ステージが C# で書き出せる」は、`withoutRuntime` が空であることで新ステージも守られるので id の列挙は変えない

### `templateMethodStage.test.ts`(infrastructure・変更)

- 「上級9の直前にあり」の検査を、`at(-2)` から「advanced の並びで上級8の次が `advanced-order-state`」に直す

## 受け入れ基準

1. ステージ一覧を開くと、上級の末尾(上級9の次)に「上級10: ボタンの処理を Command に切り出す」があり、学べることに「Command」「操作のオブジェクト化」が出る
2. 上級10を開くと初期点が40点で、EditorScreen の3つのハンドラが行数超過、EditorScreen が責務の混在で減点されている
3. onSaveClick の「ページの入力を確かめて保存する」を抽出すると名前の候補が `execute` になり、空いた場所へドラッグすると `SaveDocumentCommand` という名前のクラスが自動でできる
4. 模範解答の手順どおり(3つの操作を Command のクラスへ移し、3クラスとも Command を実装)に操作すると100点になる。解答例の再生でも最後に100点になる
5. 100点のあと、変更依頼「ページの「複製」ボタンを足して」で、Command を実装する新しいクラスに部品を置くと置き方が100点になる。「保存する前に、保存先の空き容量を確かめて」は SaveDocumentCommand に置くと100点になる。3件目の依頼にはうわさ(営業の佐藤さん)が先に出る
6. ストーリーをオンにすると、上級9のあとに「最後の章、ボタンの処理」が出て、上級9の章はもう「最後の章」と名乗らない
7. 「ソースをダウンロード(C#)」が上級10でも出て、`bash scripts/verify-csharp.sh` で初期・各手・完成形がビルド・実行できる
8. `docs/stages/report.md` が再生成され、上級10の行がある
9. `npm run check` と `npm run test:e2e` が通る

## スコープ外

- 呼び出し先の付け替え(EditorScreen の呼び出し行を「ToolbarButton に Command を渡す」形へ書き換える操作)。上級3・上級9と同じ既知の制約で、新しい操作は足さない
- Invoker 側の履歴・キュー(実行した Command を積む・後でまとめて実行する)を変更依頼として採点すること。理解度チェックで扱う(設計判断6)
- Command に `undo` メソッドを持たせる契約の拡張、マクロ(複数の Command をまとめる Composite)
- `presentation/stage/patternComparison.ts`(パターン比較表)・`comparisonQuizzes.ts`(設計くらべ)への Command の追加。要るとわかったら別仕様で足す
- 新しい採点ルール・新しい操作・型の変更・ボスの変更依頼
- 既存ステージのデータの変更。ストーリーの上級9の章の文言だけは、最後の章でなくなるので直す
- `docs/feature-ideas/IDEAS.md` の更新(仕様化した案の片付けは、仕様の確定後に呼び出し元が行う)
