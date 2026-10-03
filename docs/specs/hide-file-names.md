# ファイル名(パス)を画面に表示せず、入力も求めない

## 背景・目的

ファイルは「クラスをまとめる枠」として学ぶ対象で、ファイル名(`CodeFile.path`)は採点に使われていない
(行数・責務の混在・結合度・循環依存はファイルの枠とクラスの中身だけを見る)。それなのに今は

- ファイルの枠のヘッダーに `src/report/ReportService.ts` のようなパスが表示され、ダブルクリックで直せる
- 右クリックの「ファイルを追加」で `src/foo/Foo.ts` 形式のパス入力を求められ、空・重複でエラーになる
- 「ファイルの名前を変更」メニューがある
- 右クリックメニューの先頭、「別のファイルへ移動」の候補、設計くらべ・変更前の図などにもパスが出る

プレイヤーが操作や判断の途中でファイル名を考えさせられ、学習の本筋(分け方)から外れる。
ユーザーの判断で、**ファイル名は画面に表示せず、入力も求めない。ファイルは枠と、その中のクラスで見分ける**。
`path` はデータ上の内部的な識別子として残す(テスト用ID・ステージ定義・新規ファイルの採番に使う。下記「スコープ外」)。

## 変更対象ファイル一覧

### 追加・自動命名(入力なしでファイルを追加)

| パス | 層 | 新規/変更 | 役割 |
| --- | --- | --- | --- |
| `src/domain/codebase/naming.ts` | domain | 変更 | `moveToNewHome.ts` の非公開関数 `uniqueName` を公開して移す。他に命名ルールを散らさない |
| `src/domain/codebase/moveToNewHome.ts` | domain | 変更 | `uniqueName` の import 元を `naming.ts` にする(挙動は変えない) |
| `src/domain/codebase/addNewFile.ts` + `.test.ts` | domain | 新規 | `addNewFile(codebase, newFileId): Codebase`。空のファイルを内部パス `src/NewFile.ts`(使用済みなら `NewFile2.ts`, `NewFile3.ts`…)で末尾に追加する。失敗しない純粋関数(TDD) |
| `src/application/RefactorUseCases.ts` + `.test.ts` | application | 変更 | `addFileUseCase(codebase, path, generateId)` を `addNewFileUseCase(codebase, generateId)` に置き換える(`Result` を返す他のユースケースに合わせ `ok(...)` で包む)。パス入力用の `ADD_FILE_ERROR_MESSAGES` / `describeAddFileError` は削除 |
| `src/presentation/store/useGameStore.ts` | presentation | 変更 | `addFile` を引数なし(`addFile: () => void`)にして `addNewFileUseCase` を呼ぶ |
| `src/presentation/canvas/CanvasContextMenu.tsx` | presentation | 変更 | 「ファイルを追加」を、入力欄を開く `form` から、押したら即実行して閉じる `action` に変える。`Mode` 型から `'file'` と `'renameFile'`、対応する `FormConfig` の分岐、「ファイルの名前を変更」の項目を削除する |

`addFile`(パス指定のドメイン関数)は、`moveToNewHome.ts`・`sampleAnswer.ts`・ステージ/白紙設計のデータ作成から使われるので**変更しない**。

### ファイル名の表示をやめる

| パス | 層 | 新規/変更 | 役割 |
| --- | --- | --- | --- |
| `src/presentation/canvas/FileNode.tsx` | presentation | 変更 | ヘッダーからパスの `InlineEditableLabel`(ダブルクリックで改名)と `renameFile` の購読を削除する。ヘッダーは 📄 アイコン・警告マーク・行数バッジだけにする(`data-testid={`file-${file.path}`}` は変えない) |
| `src/presentation/preview/PreviewFileNode.tsx` | presentation | 変更 | ヘッダーの `file-node__path` 表示を削除する(`data-testid` は変えない)。「設計くらべ」・「変更前の図」・「解答例の図」に効く |
| `src/presentation/canvas/CanvasContextMenu.tsx` | presentation | 変更 | メニュー先頭の `context-menu__caption`(ファイルのパス)を削除する。「別のファイルへ移動」の候補は、パスの代わりに**そのファイルの中のクラス名を「・」でつないだ文字列**(例: `DiscountService・Helper`)で表示し、クラスが無い空ファイルは `空のファイル` と表示する。同じ表示になる候補は、表示順に `(2)` `(3)` を付けて見分けられるようにする |
| `src/presentation/stage/describeSolutionStep.ts` ほか | presentation | 変更 | 「ファイル `path` の名前を変えよう」の説明(`describeRenameFile`)を削除する。`addFile` ステップの説明文にパスが出ていれば、パスを出さない文言(例:「新しいファイルを追加しよう」)にする |
| `src/infrastructure/stages/intermediateStages.ts` | infrastructure | 変更 | 中級2のタイトル・説明文に出る `services.ts` を、ファイル名を出さない言い回し(例:「何でも入った1つのファイル」「1つのファイルに同居している」)に直す。他のステージの `title`/`description`/`goal` にファイル名が無いかも `grep` で全部確認し、あれば同様に直す |
| `src/domain/critique/critiqueRequest.ts` ほか | domain | 変更 | AI講評に渡すデータから `path` を外す(講評文にファイル名が出ないようにする)。型 `CritiqueFile` と呼び出し・テストの期待値を更新する |

### 名前の変更機能の削除(使われなくなるもの)

「追加より削除」(`CLAUDE.md` のponytail方針)に従い、呼び出し元が無くなる次のコードは削除する。

- `src/domain/codebase/renameFile.ts` と `renameFile.test.ts`
- `RefactorUseCases.ts` の `renameFileUseCase`(と `describeRenameFileError` などの関連)、`useGameStore.ts` の `renameFile`
- `src/domain/stage/sampleAnswer.ts` の `renameFile` ステップ型・処理、およびその `SolutionStep` を使う解答例
  (`'advanced-interface-segregation'` の `{ renameFile: ... }` 1行。同ステージで `addFile`/`addClass` が指すファイルパスは `NewFile` 系ではなく解答例の中で
  完結しているので、`path` で探す処理は維持する)
- `stageCatalog.test.ts` など、`renameFile` ステップを書いているテストの該当行
- `useInlineEdit.ts` / `InlineEditableLabel.tsx` は、クラス名・メソッド名の改名でまだ使うので**残す**(ファイル用の呼び出しだけ消える)

## データ・型の変更

- `Codebase`・`CodeFile` の型は変更しない(`path` は内部の識別子として残す)
- `SolutionStep`(`sampleAnswer.ts`)から `{ renameFile: ... }` のバリアントを削除する
- `CritiqueFile`(`critiqueRequest.ts`)から `path` を削除する

## TDD対象の純粋関数

`addNewFile(codebase, newFileId)`。テスト(AAA):

1. ファイルが空のコードベース → `src/NewFile.ts` で1件追加され、`classes` は空、ID は渡した `newFileId`
2. すでに `src/NewFile.ts` がある → `src/NewFile2.ts` で追加される。`NewFile2.ts` もあれば `NewFile3.ts`
3. 既存ファイルの並びは変わらず、新しいファイルは末尾に追加される
4. 元の Codebase を変更せず新しい Codebase を返す(不変性)
5. 他のファイルのクラス・メソッドは一切変わらない

「別のファイルへ移動」の候補ラベル(クラス名の連結・空ファイル・重複時の連番)は、`CanvasContextMenu.tsx` の中に書かず
`presentation/canvas/` に小さな純粋関数(例: `fileLabels(codebase)`)として切り出して Vitest でテストする
(クラス1つ → クラス名、複数 → 「・」連結、空 → `空のファイル`、同じ表示が2件 → `(2)` が付く、の4ケース)。

`addNewFileUseCase` のテスト: `generateId` が返したIDのファイルが追加された `ok(Codebase)` を返す。
`critiqueRequest` のテスト: 生成したデータに `path` が含まれない。

## 受け入れ基準

- `npm run check`(lint + typecheck + test)が通る
- `npm run test:e2e` が通る
- キャンバスのファイルの枠に、パス(`src/…ts`)が表示されない。ヘッダーは 📄・警告マーク・行数バッジだけで、ダブルクリックしても入力欄は出ない
- 余白を右クリックして「ファイルを追加」を選ぶと、入力欄は出ず、メニューが閉じて空のファイルの枠がキャンバスに現れる。続けて追加しても重複エラーは出ない
- 右クリックメニューに「ファイルの名前を変更」が無く、メニュー先頭にファイルのパスが出ない
- 「別のファイルへ移動」の候補が、クラス名の連結(空ファイルは `空のファイル`)で表示され、候補を選ぶと従来どおり移動できる
- 「設計くらべ」・「変更前の図を見る」・「解答例の図を見る」でも、ファイルのパスが表示されない
- どのステージの課題・説明・ヒント・解答例の説明文にも、ファイル名(`〜.ts`)が出ない(`grep` で確認)
- AI講評に渡すデータにファイル名が含まれない
- 追加したファイルへメソッド・クラスをドラッグして入れられ、Ctrl+Z で追加を取り消せる(従来どおり)
- クラス名・メソッド名のその場編集とクラス追加の名前入力は、これまでどおり動く
- 既存E2Eのうち、ファイルのパスの入力・改名・表示を前提にしているもの(`e2e/refactor.spec.ts` の
  「追加するファイルのパス」「新しいファイルのパス」「ファイルのパス」を使う箇所)は、新しい操作に更新または削除する。
  `data-testid="file-<path>"` を使う既存の探し方は変えない(そのまま通る)

## スコープ外

- `CodeFile.path` をデータモデル・ステージ定義・`data-testid` から無くすこと(大量のステージ定義とE2Eに影響するため。
  ponytail: `path` はテスト用ID・採番・解答例の検索にだけ使う内部識別子として残す。ステージを大きく作り直すときに `id` だけに寄せる)
- クラス名・メソッド名の入力の自動化(設計の意図を表す名前なので、入力させる)
- 新しいファイルの中身に合わせた賢い自動命名(`NewFile.ts` 固定。内部識別子なので表示されない)
- 枠外ドロップで自動作成するファイルの命名(`moveToNewHome.ts`。`uniqueName` を共通化するだけで挙動は変えない)
- ファイルの枠に名前の代わりのラベル(「ファイル1」など)を出すこと。枠とその中のクラス名で見分ける
