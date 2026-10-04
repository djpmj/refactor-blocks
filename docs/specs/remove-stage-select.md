# ヘッダーのステージ選択コンボボックスをなくし、「ステージ一覧」に一本化する

## 背景・目的

ヘッダーには、ステージを選ぶドロップダウン(`StageSelect`、`aria-label="ステージ"`)と、
その右に「ステージ一覧」ボタン(`RoadmapButton`、ステージ一覧ダイアログを開く)が並んでいる。
ステージ一覧のダイアログは、レベルごとのカード・学べること・自己ベスト・状態・次のおすすめまで見せたうえで、
カードを選べばそのステージへ移れる(`stage-roadmap` 仕様。ドロップダウンの上位互換)。
同じ「ステージを選ぶ」操作が2つあるのは冗長で、ヘッダーの横幅も取る(狭い画面ではタイトルを押しのける)。

ドロップダウンを削除し、ステージの切り替えは「ステージ一覧」ボタンに一本化する。

## 変更対象ファイル一覧

### 変更

- `src/presentation/stage/StagePanel.tsx`(presentation)
  - `StageSelect` コンポーネントを削除し、`StageNavigation` から外す(`StageNavigation` は `RoadmapButton` と `StoryToggle` だけになる)
  - `StageSelect` だけが使っていた import・変数(`LEVEL_LABEL` のうち他で使われていないもの等)を整理する。
    `LEVEL_LABEL` を `StageRoadmapDialog` などが共有している場合はそのまま残す
  - 今のステージ名はヘッダーの `<h1>`(`stage.title`)がすでに出しているので、他の表示の追加は不要
- `src/index.css`: ドロップダウン専用の `.stage-panel__select { … }` を削除する(他で使っていないことを `grep` で確認)
- E2E(`e2e/*.spec.ts`)
  - 現在 `page.getByLabel('ステージ').selectOption({ label })` でステージを切り替えているテスト(`refactor.spec.ts`・`autosave.spec.ts`・
    `change-pain.spec.ts`・`class-code-preview.spec.ts`・`concept-check.spec.ts`・`delete-guard.spec.ts`・`layered-stage.spec.ts`・
    `manual-fix.spec.ts`・`quiz.spec.ts`・`blank.spec.ts`・`behavior-tests.spec.ts` ほか、`grep` で `getByLabel('ステージ')` を探してすべて)を、
    「ステージ一覧」を開いてカードを選ぶ操作に置き換える。同じ操作を何十か所も書かないよう、共通ヘルパー
    `e2e/selectStage.ts` の `selectStage(page, title)` を1つ作る:
    1. `roadmap-open` を押してダイアログ(`stage-roadmap`)を開く
    2. `[data-testid^="roadmap-stage-"]` のうち、ステージ名(`title`)を含むカードを押す(今いるステージのカードを押すと閉じるだけ)
    3. ダイアログが閉じる(`toHaveCount(0)`)のを待つ
  - ステージ名の取り方は `selectOption({ label })` と同じ(`チュートリアル1: 長いメソッドを分ける` など)。`中級1:` と `中級10:` の取り違えが
    起きないよう、`title` の完全一致(タイトルのテキストがカード内の見出しと一致すること)で絞る
  - `roadmap.spec.ts` の `await expect(page.getByLabel('ステージ')).toHaveValue('tutorial-order-service')` は、
    ヘッダーの `<h1>` が `STAGE_2` になっていること(同じ箇所で既に確認している)の確認だけにし、`getByLabel('ステージ')` の行は消す
  - `operation-guide.spec.ts` の `page.getByLabel('ステージ').focus()` は、フォーカスできる別のボタン(例: `roadmap-open`)に置き換える
  - `autosave.spec.ts` の `await expect(page.getByLabel('ステージ')).toBeVisible()` は、`roadmap-open` ボタンが見えることに置き換える
    (「画面が表示された」ことの確認として)

### 新規

- `e2e/selectStage.ts`: 上記のヘルパー(Playwright の `Page` を受け取る小さな関数。テストファイルではなくヘルパー)

## データ・型の変更

なし。`useGameStore` の `selectStage` はそのまま(ステージ一覧ダイアログも同じアクションを呼ぶ)。

## TDD対象の純粋関数

なし(UIの削除とE2Eの置き換えのみ)。

## 受け入れ基準

- `npm run check`(lint + typecheck + test)と `npm run test:e2e` が通る
- ヘッダーにステージ選択のコンボボックス(`role="combobox"` で名前が「ステージ」のもの)が出ない。
  ステージ名の見出し(`<h1>`)、「ステージ一覧」ボタン、「ストーリー」ボタンは今までどおり並ぶ
- 「ステージ一覧」ボタンからステージを切り替えられる。カードを選ぶとそのステージへ移り、ダイアログが閉じる
  (既存の `roadmap.spec.ts` の挙動のまま)
- ステージを切り替えても、下書きの復元・点数・ヒントの閉じ直し・サイドバーの開閉・キャンバスなど、
  今までの切り替え時の挙動が変わらない(同じ `selectStage` を呼ぶため)
- 変更依頼の調査・実装中は、「ステージ一覧」ボタンが `disabled` のままで、ステージを切り替えられない。
  従来のドロップダウンには `disabled` が無く、調査中も切り替えられた(作業中の依頼が消える)。これは意図した変更で、
  `stage-roadmap` 仕様と同じ扱いに揃う。調査中にステージを切り替えているE2Eがあれば、先に調査を終えてから切り替える
- 狭い画面でも、ヘッダーのステージ名が押しつぶされない(ドロップダウンの分、横幅が空く)
- 既存のE2Eが、ステージ切り替えの方法を除いて、期待値を変えずに通る

## スコープ外

- 「ステージ一覧」ダイアログの見た目・並び・おすすめ表示の変更
- 前へ/次へのステージ移動ボタンの追加、キーボードショートカットの追加
- 設計くらべ・白紙設計モードの問題選択の変更(白紙設計はこの `StageSelect` を使っていない)
- `selectStage` ストアアクションの変更・ステージ一覧のデータの変更
