# 操作の失敗理由をキャンバス上のトーストで見せる

## 背景・目的

ドラッグ移動・抽出・継承設定などが拒否されたとき、失敗理由(`describe…Error` の日本語文)はストアの `message` に入る。
しかし表示は右サイドバー(`MethodEditor` の一番下、または `ChangeRequestPanel`)の**小さな赤字だけ**で、次の問題がある。

1. 操作したのはキャンバスなのに、理由は視線の外(右下)に出る。ドロップしても何も起きなかったように見え、プレイヤーが戸惑う。
2. サイドバーに長い内容(メソッドの処理一覧など)があると、メッセージが画面の下にはみ出して見えない。
3. 自分では消せず、次に操作が成功するかメソッドを選ぶまで残り続ける。

失敗理由を**キャンバスの上に重ねたトースト**として目立つ位置に出し、×ボタンで閉じられるようにする。
文言(`describe…Error`)と `message` の仕組み自体は変えない。

## 変更対象ファイル一覧

| パス | 層 | 新規/変更 | 役割 |
| --- | --- | --- | --- |
| `src/presentation/store/useGameStore.ts` | presentation | 変更 | `dismissMessage: () => void`(`message` を `null` にする)を追加 |
| `src/presentation/canvas/ErrorToast.tsx` | presentation | 新規 | `message` があるときだけ、キャンバス下部中央に表示するトースト(下記) |
| `src/presentation/App.tsx` | presentation | 変更 | `RefactorView` のキャンバスの `section` の中に `ErrorToast` を置く |
| `src/presentation/editor/MethodEditor.tsx` | presentation | 変更 | サイドバー下部の `message` 表示(`role="alert"` の `<p>`)を削除する(二重表示と `alert` の重複を避ける) |
| `src/presentation/change/ChangeRequestPanel.tsx` | presentation | 変更 | 同様に `message` 表示を削除する(トーストに一本化) |
| `src/index.css` | presentation | 変更 | `.error-toast` のスタイルを追加。不要になった `.method-editor__message` を、使われなくなったなら削除 |
| `e2e/delete-guard.spec.ts` ほか | E2E | 追加・更新 | トーストの表示・×で閉じる(下記)。既存の `getByRole('alert')` の検証がそのまま通ること |

`domain`/`application` 層の変更は無い(新しいロジックは無く、既存の `message` の表示場所を変えるだけ。表示のみのコンポーネントなのでユニットテストは不要)。

## 見た目・内容の仕様

`ErrorToast`(キャンバスの `section.app__canvas` を `position: relative` にし、その中で `position: absolute`)

- 位置: キャンバス領域の下部中央。幅は内容に合わせ、最大でキャンバス幅の 90%。React Flow のコントロール(左下)と重ならないよう、下端から余白を取る
- 見た目: 背景は `--surface`、左に `--danger` の太い縞(または枠線)、文字は通常の本文色(赤字だけに頼らず、アイコン「⚠」を先頭に付ける)
- 構造: `<div role="alert">` の中に、メッセージ文と「閉じる」ボタン(`aria-label="メッセージを閉じる"`、表示は `×`)
- `message` が `null` のときは何も描かない(`role="alert"` の要素ごと無し)。**画面内に `role="alert"` は常に高々1つ**にする(AI講評エラーの `CritiquePanel` は別の画面状態の想定。同時に出る場合は E2E の `getByRole('alert')` が曖昧にならないか確認し、必要ならそちらの検証を `.filter` で絞る)
- ×ボタンのクリック(キーボードの Enter/Space も)で `dismissMessage` を呼んで閉じる
- 自動で消えるタイマーは付けない(`ponytail: 閉じるのはプレイヤー操作と、次の成功操作・メソッド選択による既存の message クリアだけ。自動消去が要るほど長居する報告があれば追加`)
- ドラッグ&ドロップを邪魔しない: トーストは `pointer-events` を自分(ボタン含む)だけに限り、背後のキャンバスのドロップ先・パンを覆わない大きさに留める

## データ・型の変更

`GameState` に `dismissMessage: () => void` を足すだけ。`message: string | null` は既存のまま。

## TDD対象の純粋関数

なし(新しい純粋関数は作らない)。

## 受け入れ基準

- `npm run check` が通る
- `npm run test:e2e` が通る(`delete-guard.spec.ts` の `getByRole('alert')` の文言検証が、サイドバーではなくトースト経由で通る)
- クラス削除など拒否される操作をしたとき、理由がキャンバス上のトーストに出る
- 右サイドバーが開いていても閉じていても(サイドバーの内容が長くても)、トーストはキャンバスの下部に見える
- ×ボタンで閉じられ、閉じたあと、同じ拒否操作をもう一度すると再び出る
- 次に成功した操作・メソッド選択で、既存どおりトーストが消える
- 変更依頼(`ChangeRequestPanel`)の「挑戦前の部品が部品置き場に残っている」などのメッセージも、トーストに出る
- トーストが出ていても、メソッドのドラッグ移動などの既存のE2Eが壊れない
- 画面内に `role="alert"` が同時に2つ以上出ない

## スコープ外

- 成功時のトースト(「移動しました」など)
- 自動で消えるタイマー・複数メッセージの積み重ね表示
- 失敗理由の文言の見直し・追加(`describe…Error` はそのまま)
- 白紙設計モード・設計くらべクイズのメッセージ表示
- AI講評のエラー表示(`CritiquePanel`)の移動
- 失敗した操作に対して「どこへなら置けるか」を示すこと
