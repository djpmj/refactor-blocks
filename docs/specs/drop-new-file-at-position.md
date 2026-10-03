# 何もない所へドロップしたとき、ドロップした位置に新しいファイルとクラスを作る

## 背景・目的

メソッドを、ファイルの枠もクラスもない余白へドラッグ&ドロップすると、新しいファイル(`NewClass.ts`)と新しいクラス(`NewClass`)が自動で作られて、
そこへメソッドが移る(`moveMethodToNewClass`)。ところが新しいファイルは、手を離した位置ではなく、**自動レイアウトが決めた場所**
(`layoutCodebase` の層・並び順)に現れる。プレイヤーは「ここに置いた」つもりでも、まったく別の場所に枠が出るため、
どれが新しくできたものか探す必要があり、狙った位置に整理して並べることもできない。

メソッド(と、同じ「枠外へのドロップ」であるクラス)を余白にドロップしたら、**手を離した位置に新しいファイルの枠が現れる**ようにする。
ファイルの箱はもともとドラッグで動かせる(`CodebaseCanvas.tsx` の `useFlowOverrides` が動かした位置を覚えている)ので、その仕組みに乗せて、
新しいファイルの初期位置をドロップ位置として登録する。

## 変更対象ファイル一覧

| パス | 層 | 新規/変更 | 役割 |
| --- | --- | --- | --- |
| `src/application/RefactorUseCases.ts` + `.test.ts` | application | 変更 | `moveMethodToNewClassUseCase` と `moveClassToNewFileUseCase` が、作った新しいファイルのIDも返す(`Result<{ codebase: Codebase; fileId: string }, …>`。`inlineMethodUseCase` が `callerId` も返すのと同じ形)。ID採番は今までどおり注入された `generateId` を使う |
| `src/presentation/store/useGameStore.ts` | presentation | 変更 | `moveMethodToNewClass` / `moveClassToNewFile` が、成功したときは新しいファイルのID(`string`)、失敗・何もしなかったときは `null` を返す。型は `(…) => string \| null` |
| `src/presentation/canvas/dropPosition.ts` + `.test.ts` | presentation | 新規 | ドロップ位置(React Flow 座標)と新しいファイルの大きさから、ファイルの左上座標を決める純粋関数(下記、TDD) |
| `src/presentation/canvas/CodebaseCanvas.tsx` | presentation | 変更 | `useDropHandler` の「`event.over === null`」の分岐で、ドロップ時のポインタ位置を `screenToFlowPosition`(`useReactFlow`)で React Flow 座標に変換し、上の関数でファイルの位置を決めて、store から返った新しいファイルのIDに対する位置として `useFlowOverrides` に登録する(`positions[fileId] = …`)。登録の関数(`setPosition(fileId, position)`)を `useFlowOverrides` が返す |
| `e2e/refactor.spec.ts` | E2E | 追加 | メソッドを余白の指定位置へドロップして、その位置に新しいファイルが現れることを確認する |

`moveToNewHome.ts`(ドメインの `moveMethodToNewClass` / `moveClassToNewFile`)は変更しない。位置はプレゼンテーション層の見た目の情報(`useFlowOverrides`)で、
ドメインのモデル(`Codebase`)には持たせない。

## ドロップ位置の決め方

- ポインタの最終位置: `DragEndEvent.activatorEvent`(開始時の `PointerEvent` の `clientX`/`clientY`)に `event.delta` を足した画面座標。
  これを `screenToFlowPosition` で React Flow 座標にする(ズーム・パンを反映する)
- 新しいファイルの箱は、そのポインタ位置が**箱の上端の中央あたり**に来るように置く(左上座標 = ポインタ位置 − (箱の幅 / 2, 箱のヘッダー高さの半分程度))。
  箱の大きさは新規ファイル(クラス1つ・メソッド0または1つ)のレイアウト上の大きさ(`layoutCodebase.ts` の `measureFile` と同じ定数。
  React Flow が計測済みの大きさがまだ無い作成直後は、計算値を使う)
- 画面外にはみ出さないよう特別な補正はしない(React Flow のパン・ズームで見える。ponytail: ドロップ位置が他のファイルと重なっても動かさない。重なったらプレイヤーがドラッグで動かす)
- クラスを余白にドロップした場合(`moveClassToNewFile`)も同じ扱いにする(メソッドと同じ「枠外へのドロップ」のため)
- フィールドを余白にドロップした場合は、従来どおり何もしない(`moveFieldToNewClass` は未実装のまま)
- Ctrl+Z で元に戻した後に「やり直し」したとき、同じファイルIDが復活するので、登録した位置もそのまま使われる(特別な処理は不要)

## データ・型の変更

- `Codebase`・`Stage` などのドメイン型は変更しない
- application 層の2つのユースケースの戻り値の型が `Result<Codebase, E>` から `Result<{ codebase: Codebase; fileId: string }, E>` に変わる。呼び出し元(store・テスト)を `grep` で全部洗い出して揃える
- store の `moveMethodToNewClass` / `moveClassToNewFile` の戻り値が `void` から `string | null` に変わる

## TDD対象の純粋関数

`dropPosition.ts` の `fileTopLeftAtDrop(drop: XYPosition, size: { width: number; height: number }): XYPosition`(名前は実装者の裁量で可)。テスト(AAA):

1. ドロップ位置 (500, 300)・幅 240 → 左上 x が `500 - 120 = 380`(水平方向の中央がドロップ位置)
2. 上端は、ドロップ位置からヘッダー高さの半分だけ上(`y = 300 - headerHeight / 2` など、実装が決めた定数どおり)
3. ドロップ位置が負の座標(パンして左上に動いたキャンバス)でも、符号どおりに計算される
4. 幅・高さが 0 のとき、ドロップ位置そのものを返す

`moveMethodToNewClassUseCase` / `moveClassToNewFileUseCase` のテスト: 戻り値の `fileId` が、返された `codebase` の中に存在し、
そのファイルにメソッド(クラス)が入っている。メソッド(クラス)が見つからない場合は従来どおり `err`。

## 受け入れ基準

- `npm run check`(lint + typecheck + test)が通る
- `npm run test:e2e` が通る(`moveMethodToNewClass` / `moveClassToNewFile` の既存E2E=余白へのドロップで新しいファイルができる、が壊れていない。
  従来は位置を見ていないので、そのまま通るはず)
- メソッドを余白(ファイルの枠のない所)の任意の点へドロップすると、その点を中心に新しいファイルの枠と `NewClass` が現れる(自動レイアウトの場所へは飛ばない)
- ズーム・パンを変えた状態でも、ドロップした見た目の位置に枠が出る
- クラスの枠を余白へドロップした場合も、同じようにその位置に新しいファイルが現れる
- 新しくできたファイルは、その後ドラッグで動かせる(従来どおり)
- Ctrl+Z で新しいファイル・クラスが消え、「やり直し」で同じ位置に戻る
- ファイルの枠の中・クラスの枠の中にドロップした場合(既存のクラス/ファイルへの移動)の動作は変わらない
- 余白へのドロップ以外(ドロップ先がクラス・ファイル、フィールドを余白へ、など)に位置の登録をしない
- E2E(`e2e/refactor.spec.ts` に追加): 余白の既知の点(例: キャンバスの右下寄り)へメソッドをドロップし、新しくできた `NewClass` のファイルの中心がドロップ点の近く(±60px 以内)にある

## スコープ外

- ドロップ位置が他のファイルと重なるとき、自動で避ける(ずらす)こと
- フィールドを余白へドロップして新しいクラスを作る操作(`moveFieldToNewClass`。別タスク)
- ドロップ位置をドメイン(`Codebase`)やセーブデータに持たせること。位置は見た目の一時情報のまま
- 新しいファイル・クラスの名前(`NewClass` 系の自動命名)の変更
- 「ファイルの名前を変更」など、名前の扱いの変更(`hide-file-names` Issue #40 の担当)
