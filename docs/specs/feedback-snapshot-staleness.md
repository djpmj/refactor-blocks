# feedback-snapshot-staleness: 講評がいつの時点のものか分からず、コードを変えても古い内容のまま残る

小さな不具合修正用の短い型。

## 症状

2026-11-03 の実機確認で、チュートリアル2で次の問題を見つけた。

1. ヘッダーの「AIの講評をもらう」を押す。ローカルではAI APIに届かないため、赤字で「AI講評を取得できませんでした…」と、「簡易講評(AI講評ではありません)」が出る。
2. そのあと処理を抽出して「メソッドの行数」を満たすと、左のクリア条件は 6/7 になる。
3. ところが簡易講評は「クリア条件: 5/6 達成」「メソッドの行数: 1つ22行以内(今: 最大28行)」のまま残り、今の画面と食い違う。

講評がいつの時点のものかの表示がなく、古くなったことも分からない。AI講評が取れた場合(`critique.text`)も同じで、取得後にコードを変えても講評文はそのまま残る。

## 原因

- `src/presentation/store/useGameStore.ts` の `critiqueActions().requestCritique` は、押した時点の `codebase` と `score` から講評(AIの `text`、または `describeFallbackCritique` の `fallback`)を作り、文字列だけを `CritiqueState` に入れている。どのコードの講評なのかを持っていない。
- `src/presentation/critique/CritiquePanel.tsx` の `CritiqueResult` は `critique` の文字列を出すだけで、今のコードと比べていない。
- この手抜きは `requestCritique` の `// ponytail: 講評取得後にコードベースを編集しても、講評は自動では消えない。古い講評だと分かるよう再度ボタンを押してもらう前提` で意図したものだが、「古いと分かる」表示が実装されていなかった。
- 講評を表示しているのは `CritiqueResult`(`StagePanel.tsx` から1か所だけ使用)、講評を作るのは `requestCritique`(1か所)だけなので、直す場所はこの2つで済む。

## 修正

方針: 講評を取得した時点のコードベース(参照)・点数・手数を講評と一緒に持ち、表示時に今のコードベースと比べる。古くなっても**自動で消さない**。古いと明示して、もう一度もらうボタンを出す。AI講評(`text`)と簡易講評(`fallback`)の両方に同じ扱いをする。

### 1. 純粋関数(新規): `src/presentation/critique/describeCritiqueTiming.ts`(presentation層)

講評の文言を作る `describeFallbackCritique` と同じ置き場・同じ流儀(presentation層の純粋関数+Vitest)にする。「古いか」は表示のための判定で、ドメインの知識ではないため domain には置かない。

```ts
import type { Codebase } from '../../domain/codebase/Codebase';

/** 講評を取得した時点の記録。codebase は参照で比べる(リファクタリング操作は必ず新しいCodebaseを返すため)。 */
export type CritiqueSnapshot = {
  readonly codebase: Codebase;
  readonly total: number;
  /** 初期コードからの手数。下書きから再開したなど数えられないときは undefined(movesSince と同じ)。 */
  readonly moves: number | undefined;
};

/** 講評がいつの時点のものかの1行と、今のコードと食い違っているか。 */
export function describeCritiqueTiming(snapshot: CritiqueSnapshot, current: Codebase): { readonly stale: boolean; readonly text: string };
```

- `stale` は `snapshot.codebase !== current`(参照の比較)。
- 時点の表記 `at` は、`moves` があれば `{total}点・{moves}手`、`undefined` なら `{total}点`。
- `stale === false` のとき `text` は `{at}の時点の講評です`。
- `stale === true` のとき `text` は `この講評は古くなりました({at}の時点)。今のコードとは違います`。

参照の比較にするのは、元に戻す/やり直すで同じスナップショットに戻れば「古くない」に戻り、`movesSince`(`domain/codebase/history.ts`)と同じ考え方で済むため。内容が同じでも別の操作でたどり着いたコード(移して戻した等)は「古い」と出るが、もう一度もらえば済むので許容する。`// ponytail: 参照で比べるため、同じ内容に別の操作で戻しても古いと出る。困ったら codebase の内容比較に替える` を残す。

### 2. ストア(変更): `src/presentation/store/useGameStore.ts`(presentation層)

- `CritiqueState` に `readonly snapshot: CritiqueSnapshot | null` を足し、`EMPTY_CRITIQUE` は `snapshot: null`。ステージ切替で `EMPTY_CRITIQUE` に戻る今の動きはそのまま(別ステージの講評は残さない)。
- `requestCritique` で、押した時点の `codebase`・`score.total`・`movesSince(history, codebase, stage.codebase)` から `snapshot` を作る。成功時は `{ ...EMPTY_CRITIQUE, text, snapshot }`、失敗時は `{ ...EMPTY_CRITIQUE, error, fallback, snapshot }`。取得中にコードを変えた場合も、押した時点の `snapshot` を使う(届いた時点で古いと出るのが正しい)。
- 上記の `// ponytail:` コメントは「古い講評は消さず、`describeCritiqueTiming` で古いと出してもう一度もらってもらう」という内容に書き換える。

### 3. 表示(変更): `src/presentation/critique/CritiquePanel.tsx`(presentation層)

- `CritiqueResult` で、今のコードベースを `useGameStore((state) => state.changeSession?.base ?? state.codebase)` で取る(`StagePanelContent` がヘッダーの点数に使うのと同じ式。変更依頼の挑戦中に、部品置き場入りのコードと比べて「古い」と出ないようにする)。
- `critique.snapshot !== null` かつ(`text` か `fallback` がある)ときに、講評の `details` の上に時点の1行を出す。
  - `<p className="critique-panel__timing" data-testid="critique-timing">{text}</p>`
  - `stale` のときは同じ `p` に `critique-panel__timing--stale` を足し、その後ろに `<button type="button">もう一度もらう</button>` を出す。押すと `requestCritique` を呼ぶ。ヘッダーの `CritiqueButton` と同じく、変更依頼の挑戦中(`changeSession !== null`)と取得中は `disabled`。
  - 時点の行は `role="status"` を付けて、古くなったことを読み上げでも分かるようにする。
- `CritiqueResult` の分岐が増えて lint(循環的複雑度12以下・60行以内)にかかりそうなら、時点の1行とボタンを同じファイル内の小さなコンポーネント(例: `CritiqueTiming`)に分ける。新しいファイルは作らない。
- 講評文(`text`・`fallback`)の中身は変えない。古くなっても消さず、薄くもしない(読み返せるように残す)。

### 4. CSS(変更): `src/index.css`

- `.critique-panel__timing`(控えめな文字色・小さめ)と `.critique-panel__timing--stale`(既存の警告系の色変数を使い、色だけに頼らず文言で古いと分かる)を `.critique-panel__*` の並びに足す。新しい色変数は作らない。

## テスト

### Vitest(先に書く): `src/presentation/critique/describeCritiqueTiming.test.ts`

AAAパターンで、次のケースを先に失敗させてから実装する。

1. 正常系: 取得時と同じ参照のコードなら `stale: false`、`text` は `72点・2手の時点の講評です`。
2. 正常系: 手数が `undefined` なら `stale: false`、`text` は `72点の時点の講評です`。
3. 正常系: 手数が0(初期コードのまま取得)なら `72点・0手の時点の講評です`。
4. 古い: 別の参照のコードなら `stale: true`、`text` は `この講評は古くなりました(72点・2手の時点)。今のコードとは違います`。
5. 古い: 内容が同じでも別の参照なら `stale: true`(参照で比べる方針の確認)。
6. 古い+手数なし: `この講評は古くなりました(72点の時点)。今のコードとは違います`。

### E2E(追加): `e2e/critique.spec.ts` に追記

`e2e/move-count.spec.ts` と同じく、チュートリアル1(`selectStage(page, 'チュートリアル1: 長いメソッドを分ける')`)で `printMonthlyReport` から「今月の売上を集計する」「前月比を計算する」を抽出して100点にする手順を使う(クリア画面は `dismissClearScreen` で閉じる)。講評APIは既存テストと同じく `page.route(CRITIQUE_ENDPOINT, …)` でモックする。

1. 簡易講評(500を返す): 講評をもらうと `critique-timing` が `点・0手の時点の講評です` を含み、「もう一度もらう」ボタンはない。抽出すると `critique-timing` が `この講評は古くなりました(` で始まり `点・0手の時点)。今のコードとは違います` を含み、`critique-fallback-text` は消えずに残る。「もう一度もらう」を押すと `critique-timing` が `100点・1手の時点の講評です` になり、ボタンが消える。
2. AI講評(成功を返す): 講評をもらってから抽出すると、`critique-text` は残ったまま `critique-timing` が古いと出る。「元に戻す」を押すと(取得時と同じコードに戻るので)`点・0手の時点の講評です` に戻り、ボタンが消える。

既存の5件のE2E(講評文・取得中・失敗・400・409)は変えずに通ること。

## 受け入れ基準

1. チュートリアル2で「AIの講評をもらう」→ 簡易講評が出たあと抽出してクリア条件を変えると、講評パネルに「この講評は古くなりました(○点・○手の時点)。今のコードとは違います」と「もう一度もらう」が出る。簡易講評の本文は消えずに残る。
2. 「もう一度もらう」を押すと、今のコードで講評を取り直し、時点の行が今の点数・手数の「…の時点の講評です」になる。
3. 講評を取った直後(コードを変える前)は、時点の行に取得時の点数と手数が出て、ヘッダーの点数と一致する。
4. AI講評が取れた場合(`critique.text`)も、1〜3と同じ表示になる。
5. 元に戻す/やり直すで取得時と同じコードに戻ると、古い表示が消える。
6. 変更依頼に挑戦中は、部品置き場入りのコードと比べて古いと出ることはなく、「もう一度もらう」は押せない。
7. ステージを切り替えると、これまでどおり講評は消える。
8. `describeCritiqueTiming.test.ts` の6ケースと、`e2e/critique.spec.ts` の追加2件・既存5件が通る。
9. `npm run check` と `npm run test:e2e` が通る。

## スコープ外

- 古くなった講評を自動で消す・自動で取り直すこと(方針として「古いと明示して再取得を促す」に決めた。自動の取り直しはAI APIの呼び出しが増えるのでやらない)。
- コードベースの内容比較(深い比較)での古さ判定。参照比較で足りる(上記 `ponytail` コメント参照)。
- 講評の履歴(過去の講評を並べて残す)・取得時刻(時:分)の表示。点数と手数で「いつの講評か」は足りる。時刻は要望が出てから足す。
- 簡易講評・AI講評の本文の文言や中身の変更、講評APIの通信・エラーの扱い(`CritiqueUseCases.ts`・`critiqueClient.ts`)の変更。
- 変更依頼の挑戦中に講評をもらえるようにすること(今と同じく押せない)。
