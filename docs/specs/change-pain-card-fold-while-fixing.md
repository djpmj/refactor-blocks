# change-pain-card-fold-while-fixing: 手で直している間、「もし、この変更が来たら?」と「手で直してみる」が同じ内容を二重に出さない

小さな不具合修正用の短い型。

## 症状

「もし、この変更が来たら?」のステージ(例: チュートリアル1)で「実際に直してみる」を押すと、左のサイドバーに次の2つのカードが縦に並ぶ。

- 「もし、この変更が来たら?」(`ChangePainCard`): 依頼のタイトル「前年同月比も出して」と説明「経営会議用に、…」、案内「組み替える前に、まずこのコードのままで変更を入れてみよう。直す必要があるメソッドに印を付けてリリースします。」
- 「手で直してみる」(`ManualFixPanel`): 同じタイトル・説明と、案内「直す必要がありそうなメソッドをクリックして『直した』印を付けてください。付け終えたらリリースします」

依頼文と「印を付けてリリースする」という案内が2回出て、同じカードが2つあるように見える(画面の縦も無駄に使う)。
初回ツアー3/6の画面でも同じ重複が見える。

## 原因

`src/presentation/stage/StagePanel.tsx` が `ChangePainCard` と `ManualFixPanel` を続けて描く。
手で直している間(`manualFix !== null`)も、`ChangePainCard` は `opening-fix` / `closing-fix` の段で `details` を開いたまま、
`CardBody` の `requestDescription` と `beforeInstruction` で依頼文と案内を出し続ける。`ManualFixPanel` 側にも同じ依頼文があるため重複する。
重複を出しているのはこの2コンポーネントだけ(依頼文は `request.title` / `request.description` を使う箇所を grep して確かめる)。

## 修正

- 手で直している間(`manualFix !== null`)は、`ChangePainCard` を「見出し+1行の要約」だけにし、本文(依頼文・案内)を出さない。`ManualFixPanel` が依頼文と操作を持つ
  - `src/presentation/stage/ChangePainCard.tsx` の `details` の `open` を、手で直している間は `false` にするのが最小の案
  - ただし、この案を試したところ `e2e/manual-fix.spec.ts`・`e2e/change-pain.spec.ts` の複数ケースが落ちた(元のコードでは通る)。原因は未調査なので、実装者は `open` の制御だけでよいか、
    本文を条件で描かない形にするかを、落ちたケースを見て決める(`manualFix` の判定を `canFixByHand` と共有していること、`summary` のクリックで開く既存の流れを壊さないことに注意)
- 手で直し終えてパネルを閉じたら(`manualFix === null`)、今までどおりカードが開く
- 初回ツアーの `manual-fix-started` を待つ段(`tourNeedsManualFix`)の挙動は変えない
- 層は presentation のみ。`domain` / `application` / `infrastructure` は触らない

## テスト

- 先に書く失敗する E2E(`e2e/manual-fix.spec.ts`): 「実際に直してみる」を押したあと、依頼のタイトル(例: 中級9の `軽減税率8%に対応して`)を含む可視テキストが画面に1か所だけで、`.change-pain` の本文が閉じている。パネルを閉じる(やめる)とカードの本文が戻る
- 既存の `e2e/manual-fix.spec.ts`・`e2e/change-pain.spec.ts`・`e2e/first-visit-tour.spec.ts`・`e2e/sidebar-flow-visibility.spec.ts`・`e2e/manual-fix-clarity.spec.ts` が通る

## 受け入れ基準

1. チュートリアル1で「実際に直してみる」を押すと、依頼のタイトル・説明と「印を付けてリリースします」の案内が、サイドバーに1か所ずつだけ出る(「手で直してみる」側)
2. 「やめる」またはリリース後に閉じると、「もし、この変更が来たら?」のカードが今までどおり開いた状態に戻る
3. 初回ツアーの 3/6 → 4/6 の流れが変わらない
4. `npm run check` と `npm run test:e2e` が通る

## スコープ外

- 「手で直してみる」パネルの文面・見た目の変更
- 組み替え後(`closing-fix`)の2回目の手直しで出す文面の見直し(同じ仕組みで重複が直ること以外は触らない)
- カードの見出し・要約の文言の変更
