# 減点の内訳にマウスを乗せると原因を一瞬光らせる

## 背景・目的

減点の内訳(`ScoreBreakdown.tsx`)の「アクセス制御 ×1」などのボタンを**クリック**すると、原因のクラス・メソッド・ファイルが強調され、キャンバスがそこへ寄る(`score-jump-to-violations`。`focusRule` → `--flagged` と `FitViewForRule` の `fitView`)。

ただしクリックするとキャンバスの視点が動き、強調も固定されるので、「どれが原因か、ちょっと見たいだけ」のときには重い。複数のルールを見比べるには、押して・戻してを繰り返す必要がある。

そこで、**ボタンにマウスを乗せている間(キーボードでフォーカスしている間)だけ、原因のブロックを一瞬光らせて強調する**。キャンバスの視点は動かさない。クリックしたときは今までどおり強調を固定してそこへ寄る。

### 設計判断(対話で確定済み)

- 差分のうち「ホバーで一瞬光らせる」だけを入れる。ヘッダーの「70点(行数 -10 / …)」の文字を押せるようにする案と、矢印も連動して光らせる案は今回やらない。

## ponytailチェック

1. YAGNI: 新しい強調の見た目は作らず、既存の `--flagged` を使う。ホバー中にキャンバスを寄せる処理は作らない。
2. 既存の再利用: 光らせる対象は `violationTargets` をそのまま使う。`MethodChip`/`ClassNode`/`FileNode` の `flagged` の判定の中で、`focusedRule` の代わりに「固定中のルール、なければホバー中のルール」を見るだけにする。
3. 標準機能: 「一瞬光る」は CSS の `@keyframes` で、強調が付いた瞬間に1回だけ明るくする。新しい依存は足さない。

## 変更対象ファイル一覧

| パス | 層 | 新規/変更 | 役割 |
| --- | --- | --- | --- |
| `src/presentation/store/useGameStore.ts` | presentation | 変更 | ホバー中のルール `previewRule: ScoreRule \| null` と `previewRuleFor(rule)` を足す。`focusedRule` を `null` にしている箇所(ステージ切り替え・リセットなど)では `previewRule` も `null` にする |
| `src/presentation/stage/ScoreBreakdown.tsx` | presentation | 変更 | ルールのボタンの `onMouseEnter`/`onFocus` で `previewRuleFor(rule)`、`onMouseLeave`/`onBlur` で `previewRuleFor(null)` |
| `src/presentation/canvas/MethodChip.tsx` / `ClassNode.tsx` / `FileNode.tsx` | presentation | 変更 | `flagged` の判定に使うルールを `state.focusedRule ?? state.previewRule` にする |
| `src/index.css` | presentation | 変更 | `--flagged` が付いた瞬間に1回だけ明るく光る `@keyframes`(`prefers-reduced-motion` のときは光らせず、今の静止した強調だけ) |
| `e2e/score-hover-preview.spec.ts` | e2e | 新規 | 下記受け入れ基準のE2E |

`#107`(`hint-highlight`)も `flagged` の判定に `hintTarget` を足す。後から実装するほうが、先にマージされたほうに合わせる(判定は「固定中のルール → ヒントの対象 → ホバー中のルール」のように、固定されている強調を優先する)。

`domain`/`application` 層は変更しない。

## 仕様

- 減点の内訳のルールのボタンにマウスを乗せる、またはキーボードでフォーカスすると、そのルールの原因(`violationTargets(codebase, stage)[rule]`)のブロックに `--flagged` を付ける。マウスが離れる・フォーカスが外れると外す。
- ホバー中はキャンバスの視点を動かさない(`FitViewForRule` は `focusedRule` だけを見たまま)。
- クリックしたときの挙動(強調の固定・キャンバスを寄せる・もう一度押して解除)は変えない。
- すでにクリックで固定しているルールがあるときは、固定中の強調を優先し、ホバーでは切り替えない(見ている途中で強調が入れ替わらないように)。
- 強調が付いた瞬間に、0.4秒前後で1回だけ明るく光る(「ピカッ」)。そのあとは今の `--flagged` の見た目のまま。クリックで固定したときも同じ光り方でよい。
- `prefers-reduced-motion: reduce` のときは光らせず、静止した強調だけにする。
- 変更依頼の実装中など、ボタンが押せない(`disabled`)ときはホバーでも光らせない。
- 減点の内訳を閉じた(`<details>` を閉じた)ときに、ホバー中の強調が残らないようにする(閉じた時点で `previewRuleFor(null)`)。

## TDD対象の純粋関数

なし(表示のみの変更。強調の対象は既存の `violationTargets` で、テスト済み)。

## 受け入れ基準

1. `npm run check` が通る。
2. 中級3で「減点の内訳」を開き、「アクセス制御」のボタンにマウスを乗せると、原因のメソッド・クラスが強調され、一瞬光る。キャンバスの視点は動かない。
3. マウスを離すと強調が消える。
4. ボタンをクリックすると、今までどおり強調が固定され、キャンバスがそこへ寄る。固定中に別のルールにマウスを乗せても、固定中の強調のまま。
5. キーボードの Tab でボタンにフォーカスすると2と同じく強調され、フォーカスが外れると消える。
6. `prefers-reduced-motion: reduce` のときは光らず、強調だけが付く。
7. E2E(`e2e/score-hover-preview.spec.ts`): 2〜5を確認する。既存の `score-jump` 系のE2Eが無変更で通る。
8. `npm run test:e2e` が通る。

## スコープ外

- ヘッダーの「70点(行数 -10 / …)」の文字を、ルールごとに押せるボタンにすること。
- 原因の矢印(依存・循環依存・越境)も連動して光らせること(`visibility-violation-edge.md` の警告表示とは別。必要なら別仕様)。
- ホバー中にキャンバスを寄せること。
- #103 のクリア条件の一覧からのホバー強調(必要になったら、同じ `previewRuleFor` を呼ぶだけで足せる)。

## 未決事項

なし。
