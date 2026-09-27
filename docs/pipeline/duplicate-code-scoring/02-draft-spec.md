# 仕様草案: 重複コード(コピペ)が残っていることを採点で減点する

- slug: `duplicate-code-scoring`
- 元: `docs/pipeline/duplicate-code-scoring/01-discovered.md`

## 1. 背景・目的

- `Fragment.duplicateGroup`(隠しタグ)と Merge Methods(`mergeMethods`)はあるが、`scoreCodebase` の13ルールに
  重複を数えるものが無い。`docs/specs/merge-duplicate-methods.md` の「スコープ外」で先送りしていた。
- そのため、上級1(`advanced-notifier-hierarchy`)で「ログ記録の2メソッドを統合せずに `NotifierBase` へ移す」だけでも
  採点が満点になりうる(下の3.4で試算。今の採点ではこの手順を止めるルールが無い)。上級4・上級7も同じで、重複を統合させる力は
  行数の上限や変更依頼の結果頼みになっている。
- 採点の内訳(`describeScore.ts` の `RULE_LABEL`)に「重複コード」が出れば、プレイヤーはどこが悪いかを直接知れる。
  ルール1つを足すだけで、ゲームの基本ルール「採点はルールベース」をそのまま延長する。

### 調査で分かったこと

- **統合だけが `duplicateGroup` を消す。** `mergeMethods.ts` の `mergeFragment` は `duplicateGroup` を引き継がない。
  `extractMethod`(元の Fragment をそのまま新メソッドへ移す)と `moveMethod` はタグを残す。削除系の操作(`deleteMethod` は空実装だけ・
  `deleteFile` は空のファイルだけ)でタグ付きの処理を消す手段は無い。つまり「タグ付きの処理が2つ以上残っている = まだ統合していない」と
  そのまま読める。**判定は `duplicateGroup` の値だけを見て、`sameShape` などの統合の条件には依存しない。**
- タグを使っているのは上級1・上級4・上級7だけ(`advancedStages.ts`)。どれも各グループちょうど2つ(上級7は `valueObjectStage.test.ts` で固定済み)。
  3つ以上のコピーを持つステージは今は無い。
- 模範解答(`sampleAnswer.ts`)は上級1・4・7とも全グループを `merge` している → 模範解答後はタグ付きの処理が0個 → **全ステージの模範解答は100点のまま**。
- 他の採点経路への影響:
  - `fileDeductions`(`fileScores.ts`)は「全ファイルの合計 = `scoreCodebase` の減点の合計」を約束している(`fileScores.test.ts`)。新ルールもここに数える必要がある。
    ファイルごとの減点はキャンバスの `FileNode` の印と、AI講評の `deductionPoints`(`critiqueRequest.ts`)に使われる。
  - 設計くらべクイズ(`judgeComparison.ts`)は `scoreChange` を使うので影響しない。行き詰まりヒント(`HintPanel.tsx`)は模範解答の手順を
    出すだけなので影響しない。白紙設計(`reviewBlankDesign.ts`)は `scoreCodebase` を呼ぶが、部品に `duplicateGroup` が無いので影響しない。
  - AI講評ワーカー(`workers/critique/src/index.ts`)は `rule` を `string` で素通しするので変更不要。

### 本当に新しい仕組みが要るか(ponytail)

- 新しいタグや型は要らない。既存の `duplicateGroup` を数えるだけで足りる。
- 「重複に見える処理」を `responsibility`/`label` から推測する判定は作らない(`merge-duplicate-methods.md` で誤爆を理由に退けた方式)。
- 同じクラスの中の重複を統合できるようにする `mergeMethods` の拡張は作らない(未決事項3)。

## 2. 変更対象ファイル一覧

| 種別 | パス | 層 | 役割 |
|---|---|---|---|
| 新規 | `src/domain/scoring/duplicates.ts` | domain | `findDuplicateCopies`(下記4.1) |
| 新規 | `src/domain/scoring/duplicates.test.ts` | domain(test) | 4.1のAAAテスト |
| 変更 | `src/domain/scoring/score.ts` | domain | `ScoreRule` に `'duplicate-code'` を**末尾に**追加、`counts` と並び順の配列にも末尾に追加、JSDocの列挙に「重複コード」を追加 |
| 変更 | `src/domain/scoring/score.test.ts` | domain(test) | 「13ルールとも減点0件」を14ルールに更新(末尾に `{ rule: 'duplicate-code', count: 0, points: 0 }`)、4.2のケースを追加 |
| 変更 | `src/domain/scoring/fileScores.ts` | domain | `violatingTargetIds` に `...findDuplicateCopies(codebase)` を追加、JSDocに帰属先を追記 |
| 変更 | `src/domain/scoring/fileScores.test.ts` | domain(test) | 4.3のケースを追加 |
| 変更 | `src/presentation/stage/describeScore.ts` | presentation | `RULE_LABEL` に `'duplicate-code': '重複コード(コピペ)'`(`Record<ScoreRule, string>` なので足さないと型エラーになる) |
| 変更 | `src/infrastructure/stages/valueObjectStage.test.ts` | infrastructure(test) | 初期状態の期待値を 40点 → 10点 に更新し、`duplicate-code` が3件であることを追加(3.3) |
| 変更 | `src/infrastructure/stages/stageCatalog.test.ts` | infrastructure(test) | 上級1・上級4の近道を追加(未決事項4) |
| 変更 | `e2e/refactor.spec.ts` | (E2E) | 既存の「上級1ステージ: 重複した送信ログ記録処理を…統合すると、メソッドが1つになる」に、スコア表示の確認を足す(未決事項5) |

`advancedStages.ts`・`sampleAnswer.ts`・`mergeMethods.ts`・`Codebase.ts` は**変更しない**。

## 3. データ/型の変更

### 3.1 型

型・永続化スキーマへのフィールド追加は無い。`ScoreRule` のユニオンに1つ足すだけ。

```ts
// src/domain/scoring/score.ts
export type ScoreRule =
  | 'line-limit'
  // …既存の13個はそのままの順…
  | 'cohesion'
  | 'duplicate-code';
```

- 末尾に足す理由: `score.test.ts` が `score.deductions[7]`(lone-superclass)のように**位置**で取り出しているため、途中に挟むと既存テストが崩れる。

### 3.2 何を1件と数えるか(推奨案 = 未決事項1のA)

「同じ `duplicateGroup` を持つ処理のうち、コードベースの走査順(ファイル → クラス → メソッド → 処理)で**2つ目以降**のもの」1つにつき1件。
戻り値は、その処理を持つメソッドのID(`fileDeductions` がファイルへの帰属に使える形。`findUnusedPrivateMethods` などと同じ `string[]`)。

- 2つのコピー → 1件(-10点)。今の全ステージでは「グループの数」と同じになる。
- タグが1つしか残っていないグループ(3つのコピーのうち2つを統合した後の残り1つ)は数えない。
  `// ponytail: 3つ以上のコピーは、2つを統合すると残り1つは統合済みのメソッドと形が合わず統合できないので数えない。3つ以上のコピーを持つステージを作るときに mergeMethods と合わせて見直す` を残す。
- どこにあっても数える: public メソッドに埋まったまま(抽出前)でも、同じクラス・同じメソッドの中に並んでいても数える(未決事項2・3)。

### 3.3 既存ステージの点数への影響(試算)

| ステージ | 初期状態 | 模範解答後 |
|---|---|---|
| 上級1 `advanced-notifier-hierarchy` | `duplicate-code` 1件分下がる(-10) | 0件(`merge` で解消)→ 100点のまま |
| 上級4 `advanced-report-factory` | 1件分下がる(-10) | 0件 → 100点のまま |
| 上級7 `advanced-value-object` | 40点 → **10点**(`money-validate`・`money-sum`・`money-format` の3件、-30) | 0件 → 100点のまま |
| それ以外の全ステージ | 変化なし(タグが無い) | 変化なし |

- `stageCatalog.test.ts` の「初期状態では減点がある」「模範解答どおりに操作すると100点になる」はそのまま通る。
  「変更容易性が上がる」「変更が必要なクラス数が増えない」は `measureChange` を使っていて採点とは独立なので影響しない。
- 更新が必要な既存テストは `valueObjectStage.test.ts` の「初期状態は40点(…)」だけ。
  タイトルを「初期状態は10点(行数2・責務の混在1・Feature Envy 3・重複コード3)で、凝集度は0」にし、`expect(score.total).toBe(10)` と
  `expect(score.deductions.find((d) => d.rule === 'duplicate-code')?.count).toBe(3)` にする。0点の下限には届かない。
- 上級1・上級4の既存の `advancedStages.test.ts` は点数の値を固定していないので変更不要。E2E は上級1・4・7の点数を固定していない(`grep` で確認済み)。

### 3.4 上級8(`template-method-stage`)との関係(どちらが先にマージされても模範解答が満点になる)

`docs/pipeline/template-method-stage/02-draft-spec.md` は実装前(`src/` に `advanced-template-method`・`overrides.ts`・`isAbstractLike` は無い)。

- 上級8の初期データは `order-import-read`・`order-import-validate`・`order-import-save` の3グループ(各2つ)を持つ。
  模範解答は3つとも `merge` するので、模範解答後のタグ付き処理は0個 → 新ルールで減点されない。
- 上級8が足す `mergeMethods` の拡張(4.2、呼び出し行だけの骨組み同士の統合)は、`duplicateGroup` を持たない処理同士の統合で、
  `mergeFragment` は元々タグを引き継がない。新ルールは `duplicateGroup` の値だけを見て `sameShape` には依存しないので、拡張の中身と干渉しない。
- **この機能が先にマージされた場合:** 上級8の実装者から見ると、初期状態の減点に `duplicate-code` 3件が加わるだけ。
  上級8の「初期状態は100点未満」「模範解答で100点」「近道が100点未満」はどれも成り立つ。
- **上級8が先にマージされた場合:** この機能の実装者は `src/infrastructure/stages/templateMethodStage.test.ts` を必ず確認し、
  初期状態の点数や減点の内訳を**ちょうどの値で**固定しているテストがあれば、`duplicate-code` 3件(-30)を足した値に更新する
  (上級7と同じ扱い)。模範解答・近道のテストは変更不要のはず。
- どちらの順でも崩れないよう、この機能では「模範解答後は `duplicate-code` が0件」を**ステージを名指ししない形**でも守る:
  `stageCatalog.test.ts` の「模範解答どおりに操作すると100点になる」が全ステージに対して回っているので、それで足りる(新しいテストは足さない)。

## 4. TDD対象の純粋関数

### 4.1 `findDuplicateCopies(codebase: Codebase): string[]`(`src/domain/scoring/duplicates.ts`)

```ts
/**
 * まだ統合されていない重複コード(コピペ)。同じ duplicateGroup を持つ処理のうち、走査順で2つ目以降の処理を持つメソッドのIDを返す。
 * 統合(mergeMethods)すると duplicateGroup が外れるので数えなくなる。
 */
export function findDuplicateCopies(codebase: Codebase): string[];
```

実装の目安: `allClasses(codebase)` からメソッドを順に見て、見たグループを `Set` に入れ、2回目以降に出たらメソッドIDを積む(10行程度)。
同じメソッドに2つ目のコピーが2つあれば、そのメソッドIDは2回入る(件数を正しく数えるため。重複排除しない)。

テストケース(AAA、`loneSuperclass.test.ts` と同じく小さな `codebaseOf` ヘルパーで組む):

1. 正常系: `duplicateGroup` の付いた処理が無ければ `[]`
2. 正常系: 別クラスの2つのメソッドに同じグループが1つずつ → 走査順で2つ目のメソッドIDだけ `[id]`
3. 正常系: 抽出前の形(public メソッドの中に、タグ付きの処理とタグ無しの処理が混ざっている)でも数える
4. 正常系: 違うグループが2組(各2つ) → 2件(それぞれの2つ目のメソッドID、走査順)
5. 正常系: 同じメソッドの中に同じグループの処理が2つ → そのメソッドID 1件
6. 正常系: 同じグループが3つ → 2件
7. 除外: タグ付きの処理が1つだけのグループは数えない(`[]`)
8. 除外: 値の違うグループ同士は重複とみなさない(`'a'` と `'b'` が1つずつ → `[]`)
9. 統合で消える: 2つのprivateメソッドを `mergeMethods` で統合したあとのコードベースでは `[]`(`mergeMethods` を実際に呼ぶ。統合がタグを外す前提を守る回帰テスト)

### 4.2 `scoreCodebase`(`score.test.ts` に追加)

- 違反なしの既存テストを14ルールに更新(末尾に `duplicate-code` 0件)
- 重複コード1件につき10点減点する: 別クラスに同じグループの処理が1つずつ → `total: 90`、`deductions.find((d) => d.rule === 'duplicate-code')` が `{ rule: 'duplicate-code', count: 1, points: 10 }`

### 4.3 `fileDeductions`(`fileScores.test.ts` に追加)

- 別ファイルに同じグループの処理が1つずつあると、走査順で2つ目のほう(後ろのファイル)に10点、前のファイルは0点
- 全ファイルの合計が `scoreCodebase` の減点の合計と一致する(重複コードを含むコードベースで確かめる。既存の合計テストは `sampleCodebase` にタグが無いため)

### 4.4 ステージのテスト(infrastructure)

- `valueObjectStage.test.ts`: 3.3のとおり初期状態の期待値を更新
- `stageCatalog.test.ts` の `shortcuts` に追加(未決事項4のA):
  - `advanced-notifier-hierarchy`: 「送信ログ記録を統合せず、2つとも NotifierBase へ移して継承させる」
    (`logEmailNotification`・`logSmsNotification` を抽出 → 2つとも `NotifierBase` へ move → 2クラスの `setSuperclass`。`buildEmailBody`/`buildSmsBody` も模範解答と同じく抽出して残す)
  - `advanced-report-factory`: 「組み立て処理を統合せず、2つとも ReportFactory へ移す」
    (`buildWeeklyReport`・`buildMonthlyReport` を抽出 → 2つとも `ReportFactory` へ move)
  - 実装者は、この2つが**新ルールを入れる前は100点になり、入れた後は `duplicate-code` だけで100点未満になる**ことを一度手元で確かめ、
    PRの説明に書く(100点未満の理由が別ルールなら、近道として足す意味が薄いので報告する)。

## 5. 受け入れ基準

1. `findDuplicateCopies` に4.1のケースを含むAAAのユニットテストがあり、通る(`mergeMethods` で統合するとタグが外れて0件になるケースを含む)
2. `scoreCodebase` が `duplicate-code` を14番目(末尾)の減点として返し、1件10点で引く。既存ルールの並び順は変わらない
3. `fileDeductions` が重複コードを2つ目以降のコピーのあるファイルに数え、全ファイルの合計と `scoreCodebase` の減点の合計が一致する
4. 採点パネルの内訳に `重複コード(コピペ) -10` のように表示される(`RULE_LABEL`)
5. `stageCatalog.test.ts` の全ステージの「模範解答で100点」「初期状態では減点がある」がそのまま通る。上級1・上級4の近道(未決事項4)が100点未満になる
6. `valueObjectStage.test.ts` が新しい初期点数(10点・重複コード3件)で通る。それ以外の既存ステージのテストは変更なしで通る
   (上級8が先にマージされていた場合は3.4の手順で `templateMethodStage.test.ts` を確認・更新する)
7. E2E: 上級1で送信ログ記録を2つ抽出した時点で `score` に「重複コード」が含まれ、統合すると含まれなくなる(未決事項5のA)
8. `npm run check` と `npm run test:e2e` が通る。`domain` のカバレッジ閾値を割らない

## 6. スコープ外

- ステージの `goal`/`description` の文言の見直し(「重複が残ると減点」と書き足すなど)。01の分割案どおり後回し
- AI講評のプロンプトで重複コードを特別に言い回すこと(`rule` は文字列で素通しされるので、そのままでも講評の材料には入る)
- 同じクラスの中の重複を `mergeMethods` で統合できるようにすること(`same-class` エラーの緩和。未決事項3)
- 3つ以上のコピーを1回で統合する操作、統合済みメソッドと残りのコピーを統合できるようにする `sameShape` の拡張
- `responsibility`/`label` から重複を推測する判定(`merge-duplicate-methods.md` で誤爆を理由に退けた)
- 重複しているメソッドをキャンバス上で強調表示する・メソッド単位の印を出すこと(ファイルの減点の印は `fileDeductions` 経由で自動的に出る)
- 新しいステージの追加、既存ステージのデータ(`advancedStages.ts`)・模範解答(`sampleAnswer.ts`)の変更

## 未決事項

### 未決事項1: 重複コードを何件と数えるか

- 選択肢A(推奨): 同じグループの2つ目以降のコピー1つにつき1件(2つなら1件、3つなら2件)。今の全ステージでは「グループの数」と同じ結果。2つ目のコピーのあるファイルに減点を帰属でき、`fileDeductions` の合計の約束を素直に守れる
- 選択肢B: 2つ以上残っているグループ1つにつき1件。結果は今のステージではAと同じだが、ファイルへの帰属先(どのファイルに減点を付けるか)を別に決める必要がある
- 選択肢C: タグ付きの処理すべてを1件ずつ数える(2つなら2件)。重複の両側に印が付くが、上級7の初期状態が 40 - 60 で0点に張り付き、減点が重すぎる

### 未決事項2: Extract Method する前(public メソッドの中に埋まっている段階)から数えるか

- 選択肢A(推奨): 数える。初期状態から「重複がある」と内訳に出て、統合するまで消えない。抽出しても点が下がらない(抽出前後で件数が同じ)ので、操作のたびに点が上下しない
- 選択肢B: 抽出して独立したメソッドになってから数える。初期状態の点は今と同じになるが、抽出すると点が下がる(正しい一歩で減点が増える)ので、プレイヤーを混乱させる

### 未決事項3: 同じクラスに2つのコピーが集まった場合(例: 統合せず両方を NotifierBase へ移した)をどう扱うか

- 選択肢A(推奨): 減点する。`mergeMethods` は同じクラス同士を統合できない(`same-class`)ので、プレイヤーは片方を元のクラスへ戻してから統合する。ドメインの変更は不要。goal は既に「統合してから移そう」と書いてある
- 選択肢B: 減点する上に、`mergeMethods` の `same-class` を緩めて同じクラス内でも統合できるようにする。操作は楽になるが、ドメイン関数・既存テスト(`same-class` のケース)・「似た処理を持つメソッド」の候補の出し方まで変わり、1回のPRが大きくなる
- 選択肢C: 同じクラスにあるコピー同士は数えない。「移しただけ」の近道が再び満点になり、この機能の動機(上級1の抜け道)が残る

### 未決事項4: 「統合せずに移すだけ」の近道をテストで守るか

- 選択肢A(推奨): `stageCatalog.test.ts` の `shortcuts` に上級1・上級4の近道を1件ずつ足す(4.4)。上級7は既存の近道「統合せずに6つとも Money へ移す」がある
- 選択肢B: 足さない。`findDuplicateCopies` のユニットテストだけで守る(ステージのデータが変わったときに抜け道が戻っても気づけない)

### 未決事項5: E2E をどこまで足すか

- 選択肢A(推奨): 既存の「上級1ステージ: 重複した送信ログ記録処理を…統合すると、メソッドが1つになる」に、統合前は `score` に「重複コード」が含まれ、統合後は含まれないという確認を2行足す(新しいテストは作らない)
- 選択肢B: E2E は変えない(新しい操作・UIが無いので、ユニットテストだけで足りるとみなす)
