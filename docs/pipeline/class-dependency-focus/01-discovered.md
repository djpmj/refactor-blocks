# 機能探索: 注目したクラスの依存の矢印だけを強調する(他の矢印を薄くする)

- slug: `class-dependency-focus`

## 出どころ

新規探索(`docs/pipeline/USER_FIXES.md` に未完了項目 `### [ ]` が無かったため)。

`docs/pipeline/method-call-references/01-discovered.md` の「検討して見送った候補」に、
「クラスにホバー/フォーカスしたとき、そのクラスの依存の矢印だけを強調し他を薄くする … 本件の次の候補になる」と
明記されていたものを拾い上げた。

## 背景・目的

キャンバスには、クラス間の依存(`classDependencies`)と継承・実装(`parentIds`)がすべて矢印で描かれている
(`src/presentation/canvas/layoutCodebase.ts` の `dependencyEdges` / `inheritanceEdges`)。ところが、
**特定のクラスに出入りする矢印だけを見分ける手段が無い**。

- 中級・上級ステージでは、ファイル・クラスが増えて矢印が交差・並走する。レーン分け(`assignTopLanes`)や
  層分け(`assignFileLayers`)で重なりは減らしているが、「このクラスはどこに依存していて、どこから依存されているか」を
  1本ずつ目で追うしかない
- 採点の「結合度」は依存元クラスごとの依存先の数で減点している。プレイヤーが減点を解消するには、
  あるクラスから出ている矢印の本数(ファンアウト)と、入ってくる矢印の本数(ファンイン、= 変更したときの波及先。
  変更依頼の採点 `measureChange.ts` の `rippleClasses` もこれで数えている)を数えられる必要がある
- 上級2「決済ゲートウェイをインターフェース越しに呼ぶ」のような依存性逆転(DIP)の題材では、「矢印の向きが
  インターフェースに集まる」ことが学びの核だが、全矢印が同じ濃さなので向きの変化が伝わりにくい
- 循環依存(赤い矢印・🔁)は `cyclic-dependency-class-highlight` で強調済みだが、循環していない依存には手がかりが無い

対象プレイヤー(新卒〜4年目)にとって「このクラスに依存しているのは誰か」を確かめてから Move Method する、は
IDEの依存グラフ・「参照を検索」の感覚に近い基本動作である。`method-call-references`(メソッドエディタでの
メソッド単位の呼び出し関係)がメソッドの粒度を担うのに対し、本件はキャンバス上の**クラス単位**の見え方を担う。

これまでのサイクルはステージ追加・採点ルール・クイズ・右クリックメニュー・永続化・AI講評・採点の内訳・
メソッドエディタに偏っていた。今回は呼び出し元が挙げた「キャンバスの見やすさ(ミニマップ・検索など)」の切り口のうち、
学習に直結するものとして選んだ。**採点ロジック・ステージ定義・`sampleAnswer.ts`・右クリックメニューには触れない。**

### 既存テーマとの重複確認

- `docs/specs/cyclic-dependency-class-highlight.md`: 循環しているクラスに 🔁 と赤枠を付けるだけ。矢印の描画は「スコープ外(変更しない)」と明記。
  注目クラスによる強調は扱っていない → 重複しない
- `docs/specs/dependency-scoring.md`・`docs/specs/payment-gateway-true-dip.md`・`docs/specs/advanced-payment-gateway-interface.md`:
  依存の採点と題材のステージ。矢印の見え方は扱っていない
- `docs/auto-dev/TASKS.md` の「依存の矢印が途切れたり逆向きに回り込んだりするのを直す」(完了済み): 矢印の経路・ハンドル・zIndex の修正。
  強調・薄くする表現は扱っていない
- `method-call-references`(02作成中): メソッドエディタにメソッド単位の「呼ぶ」「呼び出し元」を文字で出す。キャンバスの矢印は触らない
  (同文書の「後回し」に「キャンバス上で、選んだメソッドの呼ぶ先・呼び出し元のチップを強調する(`MethodChip.tsx`)」があるが、
  それはメソッドチップの強調で、本件はクラスとクラス間の矢印の強調。重ならない)
- `score-deduction-locations`(02作成中): 採点表示の下に原因のクラス・メソッド名を出す。キャンバスは触らない(`FileNode.tsx`・`ClassNode.tsx` は変更しないと明記)
- 呼び出し元が列挙した12件のslugのいずれとも主題が重ならない

### 検討して見送った候補

- React Flow の `MiniMap`: 標準部品で数行だが、過去の探索(`method-call-references`)と同じく、最大のステージでもファイル数は一望できる規模で学習上の困りごとが無い(YAGNI)
- キャンバスのクラス・メソッド名検索: ステージ規模では一望できるので同上(YAGNI)
- 変更依頼(change request)の多様化: 全ステージの `changeRequests` を書き換えることになり、`template-method-stage`・`utils-class-split-stage`・
  `inline-method-stage` が触るステージ定義ファイルと衝突が大きい
- エラーバウンダリ: ドメインの操作は `Result` で失敗を返し、例外で画面が落ちる具体的な経路が見当たらない(YAGNI)。
  データ消失の観点は `stage-draft-persistence` が途中経過を保存するので、その後に要否を見直す
- モバイル・タブレット対応、多言語対応: dnd-kit の TouchSensor と React Flow のパンの競合調整、全文言の辞書化が要り、1回のPRには大きい
- 「100点で次のステージへ」ボタン: 過去の探索と同じく、学習の中身が増えないため見送り

## 関連する既存コード

- `src/presentation/canvas/layoutCodebase.ts`
  - `dependencyEdges` — 依存の矢印を作る。`className`(`edge--cyclic`)・`markerEnd` の色をここで決めている。強調/薄くする印を付ける先の候補
  - `inheritanceEdges` — 継承・実装の矢印(`edge--inheritance`)。強調の対象に含めるかは論点
- `src/presentation/canvas/layoutCodebase.test.ts` — `dependencyEdges` / `inheritanceEdges` の既存テスト(presentation層だが純粋関数としてテストされている)。
  強調の判定を純粋関数にするならここに足せる
- `src/presentation/canvas/CodebaseCanvas.tsx` — `edges` を `useMemo` で組み立てて `ReactFlow` に渡している。
  注目中のクラスIDに応じてエッジの `className` を差し替える場所の候補。React Flow 標準の `onNodeMouseEnter` / `onNodeMouseLeave` が使える
- `src/presentation/canvas/ClassNode.tsx` — クラスのヘッダーは dnd-kit の `attributes`(`tabIndex=0`)でキーボードフォーカスを受けられる。
  キーボード操作で注目させる(アクセシビリティ)場合の起点になる。`classNodeClassName` で `class-node--cyclic` などのクラス名を組み立てる既存パターンがある
- `src/presentation/store/useGameStore.ts` — `selectedMethodId` / `selectMethod`。「メソッドを選んだら、その持ち主クラスの矢印を強調する」を
  入れる場合の手がかり(ストアに新しい状態を足すかどうかは仕様設計で決める)
- `src/domain/codebase/dependencies.ts` — `classDependencies`(`from`/`to`/`cyclic`)。強調の判定はこの結果の `from`/`to` だけで足りる見込み
- `src/presentation/preview/CodebasePreviewCanvas.tsx` — 「変更前の図」「解答例の図」・設計くらべクイズでも `dependencyEdges` を使っている。
  関数のシグネチャを変える場合は呼び出し元がここにもある
- `src/index.css` — `.react-flow__edge.edge--cyclic` / `.edge--inheritance` のスタイル(166〜167行目付近)。薄くする・強調するスタイルの追加先
- `e2e/refactor.spec.ts` — 依存の矢印が Move Method でつなぎ変わる既存のE2Eがある。追加先の候補

## スコープの見立て

1回のPRに収まる小さな規模と見る。domain層の変更は不要な見込み(`classDependencies` の結果を使うだけ)。

1. **今回やる**:
   - presentation: キャンバスでクラスに注目したとき(ホバー、およびキーボードフォーカス)、そのクラスが依存元・依存先になっている矢印を強調し、
     それ以外の矢印を薄くする。注目を外すと元に戻る
   - 判定(注目クラスIDとエッジ一覧から、強調・薄くするを決める)は純粋関数にして Vitest でテストを書く
   - 色だけに頼らない表現(線の太さ・不透明度の差など)にする。循環依存の赤は薄くしても赤と分かる程度に残すかは仕様設計で決める
   - E2E: 中級または上級ステージで、クラスにホバーするとそのクラスの矢印だけが強調され、離すと戻ることを確認する
2. **後回し**:
   - メソッドを選んだとき(`selectedMethodId`)に持ち主クラスの矢印を強調する連動(ストアの状態を読むだけなら小さいので、仕様設計で今回に含めてもよい)
   - クラスノードにファンイン・ファンアウトの数(「依存先 3 / 依存元 2」)を出す表示
   - 「変更前の図」「解答例の図」・設計くらべクイズ(`CodebasePreviewCanvas.tsx`)への同じ強調
   - 注目したクラスの矢印の先のクラスノード自体も強調する(矢印だけでなくノードも光らせる)

仕様設計者に決めてほしい論点(ここでは決めない):

- 注目のきっかけ: ホバーのみか、キーボードフォーカス・クリック(固定)・メソッド選択の連動まで含めるか。
  クラスのヘッダーは dnd-kit のドラッグ元でもあるので、ドラッグ中は強調を止めるか
- 継承・実装の矢印(`edge--inheritance`)も強調・薄くするの対象に含めるか
- 依存元へ向かう矢印(出ていく)と入ってくる矢印を区別して見せるか(同じ強調か、見た目を変えるか)
- 強調の判定を `dependencyEdges` の引数に足すか、`CodebaseCanvas.tsx` 側でエッジの `className` を後から差し替えるか
  (`CodebasePreviewCanvas.tsx` の呼び出しに影響するかどうかが変わる)
- 薄くする程度(不透明度)と、セマンティックズームで詳細を隠している倍率でも強調を効かせるか
- 注目中のクラスIDの置き場所(`CodebaseCanvas` のローカル state で足りるか、ストアに持つか)。ストアに持つなら
  `stage-draft-persistence`・`critique-request-robustness` との衝突に注意(下記)
- スクリーンリーダー向けに、注目したクラスの依存先・依存元を文字でも伝えるか(矢印は視覚情報なので、`aria-describedby` 等で補うか)

### 既存パイプラインとの衝突可能性

- **`src/presentation/canvas/layoutCodebase.ts`(と `layoutCodebase.test.ts`)**: 列挙された12件のうち、このファイルを変更する予定のものは無い。
  `template-method-stage` など上級ステージの追加で矢印が増えるが、ファイルの変更は無い。衝突はほぼ無い
- **`src/presentation/canvas/CodebaseCanvas.tsx`**: `move-class-via-context-menu` の 02-draft-spec は「変更しない」と明記。
  `blank-design-second-problem` も「変更しない(既存の仕組みを使う)」。衝突はほぼ無い。
  過去の `move-via-context-menu` は1行触ったが完了済み
- **`src/presentation/canvas/ClassNode.tsx`**: `move-class-via-context-menu`・`score-deduction-locations` とも「変更しない」と明記。
  `template-method-stage` が `Codebase.ts` に `isAbstractLike` を足すが、`ClassNode.tsx` に抽象クラスの表示を足すかは02で確認してほしい
  (足す場合は `classNodeClassName` 付近でテキスト上の競合があり得る。小さい)
- **`src/presentation/store/useGameStore.ts`**: `stage-draft-persistence`・`critique-request-robustness` が触る予定。
  本件は**ストアに状態を足さず `CodebaseCanvas` のローカル state で済ませる**のを推奨する(そうすれば触らない)
- **`src/index.css`**: 多くのパイプラインがスタイルを追記するので、追記位置の競合はあり得る(小さい)
- **`e2e/refactor.spec.ts`**: 他の多くのパイプラインも追記する。追記位置の競合はあり得る(小さい)
- **採点(`score.ts`・`RULE_LABEL`・`fileScores.ts`)・ステージ定義(`src/infrastructure/stages/*.ts`)・`sampleAnswer.ts`・
  右クリックメニュー(`CanvasContextMenu.tsx`・`useCanvasContextMenu.ts`)・`MethodEditor.tsx`**: 触らない
