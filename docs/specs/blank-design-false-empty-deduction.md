# blank-design-false-empty-deduction: 白紙設計で部品置き場が空になると、ありもしない「空のクラス・ファイル」の減点が通知される

小さな不具合修正用の短い型。

## 症状

実機で再現した手順は次のとおり。

1. 「白紙設計」に切り替え、白紙1〜3のどれかを開く
2. 7つの部品をすべて1つのクラスへ置く(1つ目を余白へドラッグしてクラスを作り、残りをそのクラスへドラッグする)
3. 最後の1つを置いて部品置き場が空になった瞬間、キャンバス上部に赤いトースト(`OperationResult`)が出る。
   中身は `「空のクラス・ファイル」の減点が1件増えました(-10)` で、答え合わせを開いたあともしばらく残る
4. 答え合わせの結果は「90点(責務の混在 -10)」で、空のクラス・ファイルの減点はない

部品置き場は採点の対象外(答え合わせは `withoutTray` で取り除いてから採点する)なのに、操作の通知では採点されている。

関連する仕様:

- `blank-design-mode.md` — `withoutTray` は「空になった部品置き場を『空の入れ物』で減点しないため」に、採点の前に使うと決めている。今回はその決まりが操作の通知で守られていなかった
- `blank-design-tray-display.md` — 部品置き場をキャンバス上で採点対象のように見せない(バッジ・矢印)。今回は通知の側で同じことをする
- `operation-result-feedback.md` — 操作の前後の採点の差分をトーストにする仕組みそのもの。仕組みは変えない

## 原因

`src/presentation/store/useGameStore.ts` の `scoredOperation` が、操作の前後のコードベースを**部品置き場ごと** `scoreCodebase` している。

```ts
const before = scoreCodebase(state.codebase, state.stage);
const after = scoreCodebase(codebase, state.stage);
```

最後の部品を出すと、部品置き場のクラス(`TRAY_CLASS_ID`)はメソッドもフィールドも0になり、`findEmptyContainers`(`src/domain/scoring/leftovers.ts`)が空のクラスとして数える。
`empty` の件数が 0→1 になり、`describeOperationResult`(`src/presentation/stage/describeOperationResult.ts`)が差分を「増えました」の文にする。

- 差分を作る `describeOperationResult` / `describeRuleChanges` は `Score` しか受け取らず、部品置き場を知らない。正しく働いており、直す場所ではない
- 白紙設計の通知の採点は `scoredOperation` の2行だけで行われている(`describeOperationResult(` の本番の呼び出し元は `scoredOperation` と `operationTimeline.ts` のみ。`operationTimeline` は `OperationHistoryPopover` 経由で `StagePanel` にしか出ず、白紙設計の画面 `BlankDesignView` には出ない)
- 部品置き場の他の減点(部品置き場に責務が混ざっている、など)も同じ理由で、部品を出していく途中に「消えました」と通知されうる。同じ修正で消える
- `findEmptyContainers` 側で部品置き場を除く案は採らない。採点ルールは部品置き場を知らない(`withoutTray` してから渡す)という今の分担を崩すため

## 修正

`src/presentation/store/useGameStore.ts`(presentation)の `scoredOperation` で、前後とも `withoutTray` してから採点する。`withoutTray` はすでに同じファイルで import 済み。

```ts
const before = scoreCodebase(withoutTray(state.codebase), state.stage);
const after = scoreCodebase(withoutTray(codebase), state.stage);
```

- リファクタリングのステージには部品置き場のファイルがないので、`withoutTray` は何も取り除かず、採点結果は変わらない
- 同じ `before` / `after` は `celebrationFor`(演出・クリア画面)にも渡るが、演出とクリア画面は `StagePanel` にしか出ず白紙設計の画面には出ないので、見た目は変わらない。分けて採点し直す(採点を4回にする)ことはしない
- `describeNoEffect` は白紙設計では今もnullを返すので触らない
- 新しい関数・ファイルは作らない。domain / application / infrastructure は変更しない

## テスト

先に書いて、失敗することを確かめてから直す。

- `src/presentation/store/useGameStore.test.ts`(Vitest、AAA)に `describe('白紙設計の操作の通知')` を追加する
  - 正常系: `createGameStore(blankDesignProblems, false, false)` で白紙1を開き、部品置き場のクラスにある部品(初期 `codebase` の部品置き場のメソッドを並び順に取る)の1つ目を `moveMethodToNewClass` で新しいクラスへ出し、残りを `moveMethod` で同じクラスへ移す。最後の `moveMethod` のあとの `operationResult` が `null` であるか、その `lines` のどれも `空のクラス・ファイル` を含まないこと(修正前は `「空のクラス・ファイル」の減点が1件増えました(-10)` を含んで失敗する)
  - 正常系: 同じ配置で、最後の `moveMethod` の直前と直後の `operationResult` を集めて、どの `lines` にも `部品置き場` の減点の変化に由来する `空のクラス・ファイル` が出ないこと(上のケースに含めてよい。1ケースにまとめるなら1件でよい)
  - 回帰: 既存の「`「行数」の減点が1件増えました(-10)`」「`「責務の混ざったメソッド」の減点が1件増えました(-10)`」のテスト(リファクタリングのステージ)が変更なしで通ること
- `describeOperationResult.test.ts` にはケースを足さない(差分の関数は `Score` だけを見ており、原因はその手前の採点にあるため)
- E2E: `e2e/blank.spec.ts` に1件追加する
  - `placeAllParts(page, view)` で7部品を1クラスへ置いたあと、`view.getByTestId('operation-result-line')` に `空のクラス・ファイル` を含む行が無いこと(`toHaveCount(0)` を `filter({ hasText: '空のクラス・ファイル' })` に対して)
  - 続けて「答え合わせ」を押し、結果が開いている間も同じく無いこと

## 受け入れ基準

1. 白紙1〜3のどれかで7部品をすべて1つのクラスへ置いても、`「空のクラス・ファイル」の減点が1件増えました(-10)` のトーストが出ない
2. 答え合わせの点数・減点の内訳は修正前と同じ(例: 1クラスに全部置くと「90点(責務の混在 -10)」)
3. リファクタリングのステージの操作の通知(増えました・消えました・効いていません)は修正前と同じ
4. 上のVitestとE2Eが追加されている
5. `npm run check` と `npm run test:e2e` が通る

## スコープ外

- 答え合わせを開いたあとも操作のトーストが残ること(トーストの消え方は `operation-result-feedback.md` / `toast-clears-when-stale.md` の範囲。今回は誤った文が出ないようにするだけ)
- `findEmptyContainers` など採点ルール側で部品置き場を除くこと(採点は `withoutTray` 後のコードベースに対して行う、という今の分担を保つ)
- 白紙設計の操作で演出(点数の上昇アニメーション)・クリア画面を出すこと
- 操作の履歴ポップオーバー(`operationTimeline`)の採点。白紙設計の画面には出ないので触らない。白紙設計に履歴を出すことになったら同じく `withoutTray` する
- 変更依頼モードの部品置き場(`changeSession` 中は `scoredOperation` が通知を出さないので対象外)
