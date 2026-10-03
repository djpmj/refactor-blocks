# public/private アクセス制御の採点

## 背景・目的

`CLAUDE.md` は「難しいステージでは public / private、継承、依存関係が加わり」と方針を書いている。依存関係(結合度・循環依存)は `docs/specs/dependency-scoring.md` で採点済み。

ドメインモデルには既に `Method.visibility: 'public' | 'private' | 'protected'` があり、`extractMethod` は抽出したメソッドを常に `private` にし、`inlineMethod` は `private` メソッドしか対象にしない(`src/domain/codebase/extractMethod.ts` / `inlineMethod.ts`)。つまり「`private` はこのクラスの内部実装であり、他クラスから直接呼ばれるべきでない」という前提はすでにコードにある。欠けているのは、それを `scoreCodebase` の採点に反映することだけ。

ねらいは、Move Method で private メソッドを別クラスへ移すと、元の呼び出し元から見て「他クラスの private メソッドを呼ぶ」形になり自然に減点される、という相互作用を作ること。これにより「このメソッドは本当にこのクラスにあるべきか」をプレイヤーに意識させる。継承・interface・protected の採点、public/private を手動で切り替えるUIは今回のスコープ外(継承が入るまで意味を持たない、または今回の要求に含まれないため)。

## ponytailチェック

- YAGNI: 新しいドラッグ操作やUIは作らない。既存の Extract/Move Method が生む `visibility` と `uses` を読むだけの純粋関数を1つ足す。
- 既存の再利用: `dependencies.ts` の「メソッドID→所属クラスID」マップを構築するロジックをそのまま流用する(重複させない)。`ScoreDeduction` 型・`scoreCodebase` の「ルールごとに10点減点」の型も再利用する。
- 標準機能: `Set` で重複排除するだけで足りる。新しい依存(npmパッケージ)は不要。

## 変更対象ファイル一覧

### 新規

| パス | 層 | 役割 |
| --- | --- | --- |
| `src/domain/scoring/visibility.ts` | domain | `findVisibilityViolations`: private メソッドが自クラス以外から呼ばれている箇所を列挙する純粋関数 |
| `src/domain/scoring/visibility.test.ts` | domain(test) | 上記のAAAユニットテスト |

### 変更

| パス | 層 | 変更内容 |
| --- | --- | --- |
| `src/domain/codebase/dependencies.ts` | domain | `classDependencies` 内でしか使っていない「メソッドID→所属クラスID」マップ生成を `methodOwnerMap(codebase)` として export し、`classDependencies` はそれを呼ぶだけにする |
| `src/domain/codebase/dependencies.test.ts` | domain(test) | `methodOwnerMap` の直接テストを追加(既存の `classDependencies` のテストは変更不要) |
| `src/domain/stage/Stage.ts` | domain | `Stage` に `visibilityEnforced?: boolean` を追加(省略時 `false` 相当) |
| `src/domain/scoring/score.ts` | domain | `ScoreRule` に `'visibility'` を追加。`scoreCodebase` が `stage.visibilityEnforced` のときだけ `findVisibilityViolations` の件数を減点対象にする |
| `src/domain/scoring/score.test.ts` | domain(test) | 「違反がなければ100点」テストに5件目の `{ rule: 'visibility', count: 0, points: 0 }` を追加(既存の期待値を更新)。`visibilityEnforced` の on/off、Move Method との組み合わせのテストを追加 |
| `src/infrastructure/stages/intermediateStages.ts` | infrastructure | 新ステージ `intermediate-misplaced-private`(中級3)を追加。既存2ステージ(`cyclicDependencyStage` / `godFileStage`)は変更しない |
| `src/infrastructure/stages/stageCatalog.test.ts` | infrastructure(test) | `solutions` に新ステージの模範解答を追加(既存6ステージのエントリは変更しない) |
| `src/presentation/stage/StagePanel.tsx` | presentation | `RULE_LABEL` に `visibility: 'アクセス制御'` を追加(表示文言。実装者の裁量で「可視性」等に変えてよい) |

アプリケーション層は変更しない。`scoreCodebase` は既存の依存関係採点と同じく `StagePanel` から直接呼ばれており(`src/presentation/store` にも薄いユースケースは無い)、新しく `src/application` にユースケースを足す理由がない(YAGNI)。

## データ/型の変更

```ts
// src/domain/stage/Stage.ts
export type Stage = {
  // ...既存のフィールドはそのまま
  /** private メソッドが自クラス以外から呼ばれていないかを採点するかどうか。省略時は false。
   *  既存ステージの模範解答(Move Method で private メソッドを移す手順)を壊さないため、
   *  この採点を有効にするステージだけが明示的に true を書く。 */
  readonly visibilityEnforced?: boolean;
};
```

```ts
// src/domain/scoring/visibility.ts
export type VisibilityViolation = {
  readonly methodId: string;      // 呼ばれている private メソッドのID
  readonly callerClassId: string; // 越境して呼んでいる側のクラスID
};

export function findVisibilityViolations(codebase: Codebase): VisibilityViolation[];
```

```ts
// src/domain/codebase/dependencies.ts(新規export、既存ロジックの切り出し)
export function methodOwnerMap(codebase: Codebase): ReadonlyMap<string, string>;
```

```ts
// src/domain/scoring/score.ts
export type ScoreRule = 'line-limit' | 'coupling' | 'cycle' | 'responsibility' | 'visibility';
// scoreCodebase の第2引数の型に 'visibilityEnforced' を追加
// Pick<Stage, 'limits' | 'dependencyLimit' | 'responsibilityLimit' | 'visibilityEnforced'>
```

`deductions` は常に `line-limit / coupling / cycle / responsibility / visibility` の5ルールをこの順で返す(`visibilityEnforced` が false/未指定でも `{ rule: 'visibility', count: 0, points: 0 }` を返す。既存の依存関係採点が「0件でも常に4ルールを返す」のを踏襲する)。

## `findVisibilityViolations` の仕様

- 各クラス `C` の各メソッドの各 Fragment の `uses` を走査する。`uses` に含まれるメソッドID `m` について:
  - `methodOwnerMap` で `m` の所属クラス `owner` を引く。`owner` が存在せず(=存在しないID)、または `owner === C.id`(自クラス内)なら無視する。
  - `owner !== C.id` のとき、`m` の `Method.visibility` が `'private'` のときだけ違反として数える。`'public'` / `'protected'` は違反にしない(`protected` は継承機能が無い今回はスコープ外。誰から呼んでもよい扱いにする)。
- 同じ `(methodId, callerClassId)` の組は1件にまとめる(`classDependencies` が同じ `(from, to)` を1本にまとめるのと同じ考え方)。同じ `methodId` でも `callerClassId` が異なれば別の違反として数える。
- 戻り値の順序はクラスの出現順→メソッドの出現順→Fragmentの出現順のうち最初に見つかった順(`classDependencies` と同様、順序をテストで固定する)。

## TDD対象の純粋関数

### `methodOwnerMap`(`src/domain/codebase/dependencies.ts`)

- 正常系: 複数クラス・複数メソッドのコードベースで、各メソッドIDに正しい所属クラスIDが引ける。
- 異常系: 存在しないメソッドIDでは `undefined`(Mapにキーが無い)。

### `findVisibilityViolations`(`src/domain/scoring/visibility.ts`)

1. 正常系: private メソッドを別クラスの Fragment が `uses` で呼んでいる → 1件、`{ methodId, callerClassId }` が正しい。
2. 異常系(除外): 同じクラス内で private メソッドを呼ぶ(`extractMethod` が作る呼び出しと同じ形)→ 0件。
3. 異常系(除外): public メソッドを別クラスから呼ぶ → 0件。
4. 異常系(除外): protected メソッドを別クラスから呼ぶ → 0件(今回はスコープ外の扱い)。
5. 異常系(除外): 存在しないメソッドIDへの `uses` → 無視して例外を投げない。
6. 重複: 同じ外部クラスの複数の Fragment が同じ private メソッドを呼んでいても1件にまとめる。
7. 複数クラス: 異なる2つの外部クラスが同じ private メソッドを呼んでいる → 2件(`callerClassId`違い)。

### `scoreCodebase`(`src/domain/scoring/score.ts`、既存関数の拡張)

1. `visibilityEnforced` が未指定/false のとき、private メソッドへの越境呼び出しがあっても `{ rule: 'visibility', count: 0, points: 0 }`(減点しない)。
2. `visibilityEnforced: true` のとき、越境呼び出し1件につき10点減点する(既存の `POINTS_PER_VIOLATION` を再利用)。
3. 統合的なケース: `extractMethod` で private メソッドを作り、`moveMethod` で別クラスへ移した結果の Codebase を `findVisibilityViolations` / `scoreCodebase`(`visibilityEnforced: true`)に渡すと、新たに1件の違反として検出される。「Move Method が越境呼び出しを作る」という相互作用そのものを確認するテスト。

## 既存ステージへの影響(重要)

`src/infrastructure/stages/intermediateStages.ts` の `godFileStage`(中級2)は、模範解答で `calculateShippingFee` / `addPoints` という private メソッドを Move Method で別クラスへ移す(`stageCatalog.test.ts` の `solutions['intermediate-god-file']`)。この2メソッドは移動後も元のクラス(`CartService`)の Fragment から `uses` で呼ばれ続けるため、もし `visibilityEnforced` を有効にすると模範解答が100点にならなくなる。

そのため **既存5ステージ(チュートリアル2 + 初級2 + 中級2)は `visibilityEnforced` を指定しない(=false 扱いのまま)**。既存ステージ定義ファイルは一切変更しない。この採点ルールを有効にするのは、下記の新ステージだけ。

## 新ステージ: 中級3「越境する private メソッド」

`src/infrastructure/stages/intermediateStages.ts` に追加し、`intermediateStages` 配列の3番目に加える。

- `id: 'intermediate-misplaced-private'`
- `level: 'intermediate'`
- `title: '中級3: 越境する private メソッド'`
- `description`: 「配送完了を知らせる NotificationService。通知メールの文面を組み立てる処理の中で、実は TemplateEngine クラスに private として置かれた renderTemplate() を直接呼んでいる。TemplateEngine 側は自分の中でしか使わないつもりで private にしたはずなのに、外から呼ばれてしまっている。」
- `goal`: 「メソッドは50行以内に。private なメソッドを他クラスから呼んでいる箇所(アクセス制御の違反)をなくそう。呼んでいる側と同じクラスへ Move Method で移動しよう」
- `limits: { method: 50, class: 200, file: 300 }`、`dependencyLimit: 2`、`responsibilityLimit: 4`、`visibilityEnforced: true`
- `codebase`(目安。実装時に `stageCatalog.test.ts` で100点になることを確認し、行数はずれてもよい):
  - ファイル `src/notification/NotificationService.ts` / クラス `NotificationService`
    - メソッド `notifyShipment`(public)、Fragment:
      - 「通知に必要な情報を集める」26行, responsibility: `notification`
      - 「テンプレートを描画する」6行, responsibility: `notification`, `uses: ['method-render-template']`(← TemplateEngine の private メソッド)
      - 「メールを送信する」30行, responsibility: `delivery`
      - 「送信ログを記録する」20行, responsibility: `logging`
  - ファイル `src/notification/TemplateEngine.ts` / クラス `TemplateEngine`
    - メソッド `renderTemplate`(**private**)、Fragment: 「本文のテンプレートを埋め込む」46行, responsibility: `rendering`
- 初期状態: `notifyShipment` が82行で `line-limit` 違反1件、`renderTemplate` への越境呼び出しで `visibility` 違反1件 → 100点未満(`stageCatalog.test.ts` の共通テストを満たす)。
- 模範解答(`stageCatalog.test.ts` の `solutions['intermediate-misplaced-private']`):
  1. `notifyShipment` から「メールを送信する」を `sendMail` として抽出(private)
  2. `notifyShipment` から「送信ログを記録する」を `logDelivery` として抽出(private)
  3. `renderTemplate` を `NotificationService` へ Move Method
  - 結果: `notifyShipment` は50行以下、`renderTemplate` は同じクラス内呼び出しになり `visibility` 違反が消える。`responsibilityLimit: 4` は `{notification, delivery, logging, rendering}` の4種でちょうど上限(超過なし)。
- `changeRequests`(2件、いずれも初期コードに変更箇所がある):
  - 「通知をSMSにも送れるようにして」`responsibility: 'delivery'`, `linesPerSite: 8`
  - 「送信ログのフォーマットを見直して」`responsibility: 'logging'`, `linesPerSite: 5`

新ステージを `intermediate` レベルに追加する理由: `StageLevel` に新しい値(`'advanced'` 等)を増やすと `StagePanel` の `LEVEL_LABEL` やステージ選択のグルーピングに変更が要り、今回の要求(採点ルール1つの追加)に対して影響範囲が大きすぎる(YAGNI)。継承が入るタイミングで難易度帯を見直すなら、そのときに改めて検討する。

## 画面(presentation)

- `StagePanel.tsx` の `RULE_LABEL`(`Record<ScoreRule, string>`)に `visibility: 'アクセス制御'` を追加する。`describeScore` は既存のまま(`points > 0` の内訳だけ表示)なので、`visibilityEnforced` が false のステージでは今まで通り何も表示されない。
- ラベルの文言(「アクセス制御」)は実装者・評価者の裁量で変更してよい(「可視性」等)。UIの見た目や `data-testid="score"` は変えない。

## 受け入れ基準

1. `findVisibilityViolations` / `methodOwnerMap` / `scoreCodebase` について、上記のケースを含むAAAパターンのユニットテストがある。
2. `dependencies.ts` の既存テスト(`classDependencies`)がリファクタ後も無変更で通る(`methodOwnerMap` への切り出しが外部から見た振る舞いを変えていないことの確認)。
3. `score.test.ts` の「違反がなければ100点」テストが5ルール分の期待値に更新されている。
4. `stageCatalog.test.ts` の `describe.each` 共通テスト(初期減点あり・模範解答で100点・変更依頼2件以上・変更容易性スコア向上・クラス数悪化なし、他)が、既存6ステージ・新ステージ `intermediate-misplaced-private` のいずれでも通る。特に **既存の `intermediate-god-file` の模範解答が今まで通り100点になること**を確認する。
5. E2E: 新ステージ(`中級3: 越境する private メソッド`)をステージ選択で開くと、初期スコア表示(`data-testid="score"`)に「アクセス制御」の内訳が出る。モデル解答どおりに操作すると100点表示になる。
6. `npm run check` と `npm run test:e2e` が通る。

## スコープ外

- 継承・interface、`protected` の採点(継承機能が無いと意味を持たない。継承を入れるときに合わせて設計する)。
- public/private を手動で切り替えるUI。既存の Extract Method(常にprivate)・Move Method(可視性は変えない)からプレイヤーの操作結果として自動的に決まる可視性だけを見る。
- 新しい `StageLevel`(`'advanced'` 等)の追加。今回は既存の `intermediate` に1ステージ足すだけにする。
- 同じ private メソッドを3つ以上の外部クラスが呼んでいるような複雑なケース向けの、まとめて直す導線。今回のモデルステージは呼び出し元が1クラストだけの単純な形にする。
- 「本来 public にすべきか」を判定するような高度なヒューリスティック。今回は「越境した呼び出しが何件あるか」を数えるだけ(`cycle` ルールと同じ粒度)。

## 未決事項

- StagePanel の表示文言(「アクセス制御」)は仮置き。実装・評価の過程で違和感があれば変えてよい(振る舞いに影響しないため、仕様変更は不要)。
