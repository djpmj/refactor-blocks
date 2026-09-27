# 01 機能探索: 変更依頼の結果で「初期状態のコードなら、どこを何か所触る必要があったか」を今のコードと並べて見せる

- slug: `change-outcome-initial-comparison`

## 出どころ

新規探索(`docs/pipeline/USER_FIXES.md` のキュー一覧は「まだ項目はありません」で、未完了項目 `### [ ]` が無かった)。

元をたどると、**最初の変更依頼の仕様 `docs/specs/change-request.md` に書かれていたのに、今の画面には入っていない表示**である。

> 結果: 依頼ごとに点数と内訳(変更ファイル数・追加行数・波及クラス・巻き込み・上限超過・調査の漏れ)を表に出す。
> 「初期状態」列と「現在」列を並べ、コストがどう変わったかを見せる。
> (`docs/specs/change-request.md` 122〜123行目)

後の `docs/specs/implement-change-request.md`(調査フェーズを部品の配置に置き換えた仕様)は、結果カードを
「今のコード / 初期状態 / 前回」の**点数**と、今のコードの「変更が必要: …」の行だけにした(311行目)。
初期状態の内訳を出さないと決めた記述は見当たらない(同仕様のスコープ外に挙がっているのは、置き方の「初期状態で一番良い置き方の点数」だけで、本件とは別物)。

## 背景・目的

CLAUDE.md のゲームの核は「リファクタリング後に新機能の追加課題を出し、**何個のブロックを触る必要があったか**で設計の良し悪しを実感させる」ことである。
ところが変更依頼の結果カード(`src/presentation/change/ChangeRequestPanel.tsx` の `CostRows`)は、次のように**今のコードの側しか中身を見せていない**。

| 表示 | 今のコード | 初期状態 |
| --- | --- | --- |
| 点数 | `outcome-current`(例: 95点) | `outcome-initial`(例: 70点) |
| 変更が必要なメソッド名・クラス数・ファイル数・追加行数 | 出る(`siteNames(current, …)`) | **出ない** |
| 減点の理由(散らばり・波及・巻き込み・上限超え) | 出る(`describeDeductions(current, …)`) | **出ない** |

そのためプレイヤーには「70点 → 95点」という数字の差しか見えず、**なぜ上がったのか(初期状態では何個のブロックを触る必要があったのか)**を
自分で思い出して比べるしかない。たとえばチュートリアル2の軽減税率の依頼なら、初期状態では 80行超の `placeOrder` を触る必要があり
「巻き込み: 無関係な責務が4種類同居」「上限超え」が付き、`TaxCalculator` へ分けたあとはそれが消える、という**差そのもの**が学びの中身である。

- 必要なデータはすでに揃っている: `ChangeOutcome.initial`(`src/application/ChangeRequestUseCases.ts`)は `ChangeAssessment`
  (`impact.sites`・`classesTouched`・`filesTouched`・`linesAdded`・`rippleClasses` と減点の内訳)をまるごと持っているが、画面は `initial.score.total` しか使っていない
- 文の組み立ても既存の `siteNames` / `describeDeductions`(`src/presentation/change/describeChange.ts`)をそのまま初期状態にも当てられる。
  名前を引くコードベースだけ、初期状態側は `stage.codebase` にする必要がある(`impact.sites` のIDは初期のコードのもの。
  プレイヤーが名前を変えたり移したりしていても、初期状態の名前で出すのが正しい)
- ponytail の階段では「このリポジトリにもうあるか?」で止まる: domain・application の変更は要らない見込み。新しい計算・状態・依存も要らない

### 既存テーマとの重複確認

- `quiz-change-site-marks`(02作成済み): 設計くらべ**クイズ**の答え合わせで、変更が必要なメソッドに**図の上の印**を付ける。
  クイズは既に設計A・Bの両方の「変更が必要: …」を文で並べている。本件はクイズではなく**変更依頼の結果カード**で、初期状態側の文そのものが今は無い、という別の穴。
  同 01 は `ChangeRequestPanel.tsx` を「触らない想定」と明記している
- `score-deduction-locations`: リファクタリング画面の**採点**(`score.ts`)の減点原因を名前で出す。変更依頼のコスト(`scoreChange`)は対象外 → 重複しない
- `stage-rules-summary`: ステージの採点の閾値の一覧。変更依頼は扱わない → 重複しない
- `inline-method-stage`・`utils-class-split-stage`・`law-of-demeter-stage`・`template-method-stage`: ステージの追加。「模範解答で変更コストが下がる」ことはテストで守るが、画面の表示は扱わない。
  本件が入ると、これらの新ステージでも自動で「初期状態ならここを触る必要があった」が見える(補い合う関係)
- `docs/specs/implement-change-request.md` のスコープ外「初期状態で一番良い置き方をしたら何点か」: **置き方**(`placement`)の比較で、置き先の候補を全部試す新しい計算が要るもの。
  本件は**変更コスト**(`current`/`initial`)の、すでに計算済みの内訳を見せるだけ → 重複しない
- `docs/specs/` 24件・`docs/pipeline/*/01-discovered.md` 22件を `outcome-initial|初期状態なら|初期状態の(変更|コード)|CostRows` でgrepし、該当なし
- 呼び出し元が列挙した22件のslugのいずれとも主題が重ならない

### 検討して見送った候補

- **変更依頼の実装中、メソッドの中身(`InspectedMethod`)がホバーでしか出ない(キーボードの穴)**: 過去の探索と同じく、起点が `MethodChip.tsx`
  (`method-rename-keyboard`・`color-contrast-a11y` が触る予定)
- **Facade・継承より委譲・Replace Conditional with Polymorphism などの新ステージ**: `law-of-demeter-stage` が新しいステージファイル+`sampleAnswer.ts` の1エントリという衝突の少ない形を見つけたが、
  ステージ追加がすでに4件並走しており、`sampleAnswer.ts`・`stageCatalog.ts` への同時追記がさらに増える。
  Facade は `utils-class-split-stage/01-discovered.md` で「`measureChange` では Facade を挟んでも触るブロック数が減らない」と見送られている。
  散らばり(Shotgun Surgery)を1クラスへ集める題材は、上級1・2・4・7 で既に扱っている
- **前回の変更依頼(`ChangeMemo.tsx`)にも初期状態との比較を出す**: 同じ部品で出せるが、編集パネルは手がかりとして短く保ちたい。本件の後回し候補にする
- **ステージURLでの直接リンク・進捗のリセット**: 学習の中身が増えず、`useGameStore.ts`(`stage-draft-persistence`・`critique-request-robustness`)に差分が出る

## 関連する既存コード

- `src/presentation/change/ChangeRequestPanel.tsx` — **主な変更先**。`CostRows`(15〜27行目)が `initial` を受け取りながら点数しか使っていない。
  `OutcomeCard`(48〜74行目)が減点理由の一覧を `current` だけから作る。`Results`(76〜108行目)の `codebase` は `changeSession.carried ?? codebase`
  (今のコード側の名前引き用)。初期状態側の名前引きには `useGameStore((state) => state.stage).codebase` を使う形になる見込み
- `src/presentation/change/describeChange.ts` — `siteNames`・`describeDeductions`。**変更不要の見込み**(引数の `codebase` を初期のものにすればそのまま使える)
- `src/application/ChangeRequestUseCases.ts` — `ChangeOutcome.initial` の出どころ(`measureChange(stage.codebase, …)`)。読むだけ
- `src/domain/change/measureChange.ts` / `scoreChange.ts` — `ChangeImpact` / `ChangeAssessment` の中身。読むだけ
- `src/presentation/quiz/ComparisonQuizView.tsx` — 設計A・Bの「変更が必要: …」と減点理由を2つ並べて出している前例(文言・並べ方の揃え先。**読むだけ**)
- `src/presentation/change/ChangeMemo.tsx` — 前回の変更依頼の要約。今回は触らない(後回し)
- `docs/specs/change-request.md` 117〜124行目 / `docs/specs/implement-change-request.md` 305〜316行目・519〜526行目(依頼の積み重ね) — 結果画面の仕様の経緯
- `e2e/refactor.spec.ts` 810〜857行目 — 変更依頼の結果カードのE2E(`implementRequests`・`openOrderStage`・`reachFullScoreOnOrderStage` などのヘルパーもこのファイル内にある)

## スコープの見立て

小さい。1回のPRに十分収まる。presentation 層の1ファイル(`ChangeRequestPanel.tsx`)が中心で、必要ならCSSを数行とE2Eを1本。
domain / application / infrastructure・ストア・ステージデータは変更しない見込み。表示のみの変更なのでユニットテストは原則不要だが、
文を組み立てる処理を純粋関数に切り出すなら Vitest で守る(`describeChange.ts` の関数を再利用するだけなら不要)。

1. **今回やる**: `modify` の依頼の結果カードで、初期状態のコードに同じ依頼を当てたときの「変更が必要なメソッド名(Nクラス・Nファイル・+N行)」と減点の理由を、
   今のコードの行と並べて出す。`extend` の依頼(コストを出さない)は今のまま
2. **後回し**:
   - `ChangeMemo.tsx`(前回の変更依頼)への同じ比較
   - キャンバス・「変更前の図」(`CodebasePreviewDialog`)の上に、初期状態で変更が必要だったメソッドの印を出す(`quiz-change-site-marks` のマージ後に同じ部品で)
   - 依頼を積み重ねたとき(2件目以降)の「前の依頼の実装込みの初期状態」との比較(今の `initial` は常に `stage.codebase` で測っているのでそれに揃える)

仕様設計者に決めてほしい論点(ここでは決めない):

- **並べ方**: 表(「初期状態」列と「今のコード」列。元の `change-request.md` の案)か、2段の文(「初期状態: …」「今のコード: …」)か。サイドパネルの幅で表が読めるか
- **初期状態の減点理由を全部出すか**: 今のコードで消えた減点だけ強調する(「解消: 巻き込み」)か、両方の理由を素直に並べるか。長くなりすぎないか
- **名前引きのコードベース**: 初期状態側は `stage.codebase` で引く(プレイヤーが名前を変えても初期の名前で出す)ことでよいか。
  `ripple` のクラス名も同じ扱いでよいか
- **2件目以降の依頼**: `current` は前の依頼の実装を積み重ねたコード(`carried`)で測り、`initial` は `stage.codebase` で測っている。
  比較の見出しを「初期状態」のままにするか、補足の文を足すか
- **既存の `data-testid`**: `outcome-current` / `outcome-initial` の文言・位置を変えない(既存E2Eがそのまま通る)形にするか
- **E2Eの置き場所**: ヘルパーが `refactor.spec.ts` 内にあるので同じファイルの 857行目付近へ追記するか、ヘルパーごと新しいspecに切り出すか
  (切り出すと他の件と `refactor.spec.ts` で衝突しやすくなるので、追記を推奨する見立て)

### 既存パイプラインとの衝突可能性

- **`src/presentation/change/ChangeRequestPanel.tsx`**: 22件のどのパイプラインも変更予定なし。
  `quiz-change-site-marks` の01・02は「`CodebasePreviewDialog` の props を任意にするので**変更不要**」と明記、`method-call-references` の02・`operation-guide` の01は
  スコープ外・文言の参照先として名前を出しているだけ。テキスト上の競合は無い見込み。
  ただし `quiz-change-site-marks` の仕様設計で `CodebasePreviewDialog` の props を**必須**にする選択肢が採られた場合のみ、
  `SampleAnswer`(29〜45行目)に1行の差分が出うる。本件の差分は `CostRows`・`OutcomeCard` なので行は離れている
- **`src/presentation/change/describeChange.ts`**: 読むだけなら競合なし。`inline-method-stage` の02は「関係しない」、`data-placement-quizzes`・`quiz-change-site-marks` は参照のみ
- **`src/index.css`**: 多くのパイプラインが追記する。本件は `.change-outcome__*` の近くに数行足す程度で、競合は小さい
- **`e2e/refactor.spec.ts`**: 多くのパイプラインが追記する。変更依頼の結果のテスト(857行目付近)の直後に1本足すなら、他の件の追記位置
  (名前の変更・右クリックメニュー・移動など)とは離れる見込み。追記位置の競合はあり得る(小さい)
- **意味上の依存**: 新ステージ(`inline-method-stage`・`utils-class-split-stage`・`law-of-demeter-stage`・`template-method-stage`)や
  `duplicate-code-scoring` がどの順でマージされても、`ChangeOutcome` の形は変わらないので影響しない。E2Eはチュートリアル2(どの件も題材を変えない)で確かめれば順序に左右されない
- `src/domain/`・`src/application/`・`src/infrastructure/`(ステージ定義・`sampleAnswer.ts`・`stageCatalog.test.ts` を含む)・`useGameStore.ts`・`StagePanel.tsx`・
  `ChangeMemo.tsx`・`CodebaseCanvas.tsx`・`MethodChip.tsx`・`ClassNode.tsx`・`CanvasContextMenu.tsx`・`MethodEditor.tsx`・`ComparisonQuizView.tsx`・
  `CodebasePreviewDialog.tsx`・`workers/critique/` には触らない想定
