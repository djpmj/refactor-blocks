# 01 機能探索: 題材データの参照切れ検査(uses・継承・implements)

- slug: `stage-reference-integrity`

## 出どころ

新規探索(`docs/pipeline/USER_FIXES.md` のキュー一覧は「まだ項目はありません」で、未完了項目 `### [ ]` が無かった)。

## 背景・目的

ステージ・設計くらべクイズ・白紙設計の題材は、`src/infrastructure/` 配下に手書きのTypeScriptオブジェクトとして
定義されている。その中で、別の要素をIDの文字列で参照している項目がある。

| 参照元 | 参照先 | 今のテストでの検査 |
| --- | --- | --- |
| `Fragment.reads` / `Fragment.writes` | フィールドID | あり(`stageCatalog.test.ts` の `danglingFieldRefs`、ステージのみ) |
| `Fragment.uses` | メソッドID | **なし** |
| `CodeClass.superclassId` | クラスID | **なし** |
| `CodeClass.interfaceIds` | クラスID | **なし** |

ドメイン側はこれらの参照切れを**黙って無視する**作りになっている。

- `domain/codebase/dependencies.ts` の `classDependencies` は「存在しないIDは無視する」(コメントに明記)
- `Codebase.ts` の `findSuperclass`・`findInterfaces`・`calledAccessorMethods` も、見つからないIDを捨てる

プレイ中は Delete Method・Delete Class で参照先が消えることがあるので、この「黙って無視」は正しい。
ただし**初期データ**でIDを打ち間違えても、依存の矢印・循環依存・依存数の上限・可視性の越境・Feature Envy などの採点から
その辺が静かに消えるだけで、どのテストも落ちない。「模範解答で100点」「初期状態では減点がある」のテストは、
打ち間違いで減点が減っても通ってしまうことがある(減点が0にならない限り気づけない)。

今は `template-method-stage`・`inline-method-stage`・`utils-class-split-stage` がステージを、
`data-placement-quizzes`・`blank-design-second-problem` がクイズ・白紙設計の問題を追加する予定で、手書きの題材データがまとめて増える。
さらに `method-call-references`(メソッドエディタで呼び出し関係を表示する)と `class-dependency-focus`(依存の矢印を強調する)は、
`uses` が正しいことを前提にプレイヤーへ見せる機能になる。題材の追加が続く前に、参照切れをCIで確実に落とす安全網を張っておく価値がある。

プレイヤーから見える機能ではないが、CLAUDE.mdの「手を抜かないもの: 信頼境界での入力検証(ステージ定義の読み込み…)」、
`src/infrastructure/README.md` の「ステージJSONの検証ロジックなど純粋な部分はテストを書く」の方針に沿う。

## 関連する既存コード

- `src/infrastructure/stages/stageCatalog.test.ts` — 全ステージ共通の検査。`danglingFieldRefs`(485行目付近)が手本になる。
  ID重複の検査(`allIds`)もここにある
- `src/infrastructure/quizzes/comparisonQuizzes.test.ts` — クイズの検査。設計A・Bの `codebase` に対する参照の検査は無い
- `src/infrastructure/blankDesigns/blankDesignProblems.test.ts` — 白紙設計の検査。参照の検査は無い
  (部品置き場の `codebase` には `uses` を持つ処理がある: `blankDesignProblems.ts` に `uses:` が2か所)
- `src/domain/codebase/Codebase.ts` — `allClasses`・`fieldsOf`・`touchedFieldIds`・`parentIds`(継承元+実装先のIDを並べる。
  「存在しないIDもそのまま返す」ので、参照切れの検出にそのまま使える)
- `src/domain/codebase/dependencies.ts` — `classDependencies`(参照切れを無視する側。変更はしない想定)
- 題材データ: `src/infrastructure/stages/{tutorial,beginner,intermediate,advanced}Stages.ts`(`uses:` は中級15か所・上級9か所)、
  `src/infrastructure/quizzes/comparisonQuizzes.ts`、`src/infrastructure/blankDesigns/blankDesignProblems.ts`
- 仕様書: 過去に同じ種類の検査を足したのは `docs/specs/fields-and-feature-envy.md`(`reads`/`writes` の参照先検査)

## スコープの見立て

小さい。テストコードの追加だけで済む見込み(domain/applicationのロジック変更、UI変更は無い想定)。

- 検査する参照: `uses` → メソッドID、`superclassId`・`interfaceIds` → クラスID(既存のフィールド参照検査と同じ粒度)
- 検査する対象: 全ステージ、クイズの設計A・B、白紙設計の部品置き場。模範解答を適用した後のコードベースは対象外
  (プレイ中の操作で参照切れが起きるのは仕様どおりのため)
- 既存データに本当に参照切れがあった場合は、その題材データを直す(1〜数か所の想定。多ければ仕様設計で扱いを決める)

仕様設計者に委ねる論点(ここでは決めない):

- 検査関数をテストファイルの中に置くか、共通のテスト用ヘルパーにして3つのテストから使うか
  (`domain` に純粋関数として置くのは、今のところ使う本番コードが無いのでYAGNIの可能性が高い)
- 既存の `danglingFieldRefs` を新しい検査にまとめるかどうか
- `extend` の変更依頼の `responsibility` が題材に存在するかなど、ID以外の参照もついでに見るか(広げすぎない)
- 自己参照(`superclassId` が自分自身)や継承の輪を検査に含めるか

### 既存パイプラインとの衝突の可能性

- **`stageCatalog.test.ts` は `inline-method-stage`(共通テスト1件+近道)・`template-method-stage`(近道)・
  `duplicate-code-scoring`(近道)が変更する予定**。このテーマでは同ファイルに手を入れず、新しいテストファイル
  (例: `src/infrastructure/stages/` か `src/infrastructure/` 直下に参照検査専用のテストを1つ)に置くことで衝突を避けるのを推奨する。
  既存の `danglingFieldRefs` を移す・まとめる案を採ると `stageCatalog.test.ts` に差分が出るので、その場合は衝突の可能性が高い
- `comparisonQuizzes.test.ts`(`data-placement-quizzes` が触る可能性あり)・`blankDesignProblems.test.ts`
  (`blank-design-second-problem` が変更予定)も、同じ理由で直接編集せず、新しいテストファイルから
  `comparisonQuizzes`・`blankDesignProblems` をimportして検査するのが安全
- 題材データ(`*Stages.ts` など)は、既存データに参照切れが見つかった場合のみ数行を直す。ステージを追加する各パイプラインと
  同じファイルだが、触る行は既存ステージの定義内なので衝突しても小さい
- 逆に、このテーマが先にマージされると、後からマージされる題材追加のパイプラインのCIで参照切れが検出されるようになる
  (意図どおりの効果。参照切れが無ければ影響は無い)
- `score.ts`・`fileScores.ts`・`sampleAnswer.ts`・`CanvasContextMenu.tsx`・`MethodEditor.tsx`・`CodebaseCanvas.tsx`・
  `useGameStore.ts` には触らない
