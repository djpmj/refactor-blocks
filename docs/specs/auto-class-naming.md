# 新しく作ったクラスに、中身の役割から名前を自動で付ける

## 背景・目的

余白へのドロップや「クラスを追加」で新しいクラスを作ると、名前は `NewClass`・`NewClass2` …になる
(`src/domain/codebase/moveToNewHome.ts`・`addClass.ts`)。リネーム操作はあるが、プレイヤーが自分で名前を考える必要がある。

初級2「クラスを自分で作る」で、`NewClass`(通知と送信履歴)・`NewClass2`(描画と保存)のまま100点になり、
図を見ても何のクラスか分からない、という報告があった。採点上は正しい100点だが、クラスの役割が名前から読み取れない。
一方、プレイヤーにクラス名を考えさせることはしたくない(ユーザー決定)。

メソッドの抽出で「処理を選ぶと名前を自動で考えます」(`Fragment.suggestedName`)としているのと同じく、
**新しく作ったクラスには、入っている処理の役割から名前を自動で付ける**。採点は変えない。

## 振る舞い

- 新しく作ったクラス(余白へのドロップ・空のファイル枠へのドロップ・「クラスを追加」・右クリックメニューからの新しいクラスへの移動など、
  プレイヤーの操作で作られたクラス)は「自動で名付けるクラス」になる
- 自動で名付けるクラスは、**中身が変わるたびに**(メソッドが入る・出る・処理が抽出されるなど)名前を付け直す
  - 中身の処理(`call` を除く)の責務が1種類 → ステージの表でその責務に対応するクラス名
  - 複数の責務が混ざっている → 行数(`fragmentLines`)の合計がいちばん多い責務の名前。同じなら、クラスの中で最初に出てくる処理の責務
  - 表に無い責務だけ・中身が空・`call` だけ → `NewClass`(今の既定名)
  - 名前がほかのクラスと重なるときは、今の `uniqueName` と同じく末尾に `2`・`3` …を付ける
- プレイヤーがリネームしたクラスは、自動で名付けるクラスではなくなり、以後は名前を変えない
- ステージの初期状態からあるクラス・模範解答の手順(`addClass` で名前を指定して作るもの)のクラスは、自動で名付けない
- ファイルのパス(`newFilePath`)は今どおり作った時点の名前のまま(ファイル名は画面に出していないため変えない)
- 元に戻す・やり直しでは、名前も操作前・操作後の状態に戻る(Codebase の一部として履歴に乗る)

例(初級2のスクリーンショットの形):

| クラス | 中身の責務 | 付く名前 |
| --- | --- | --- |
| `NewClass` | 通知(`mailInvoice` 6行)・保存(送信履歴 3行) | 通知の名前(例: `InvoiceMailer`) |
| `NewClass2` | 描画(`renderPdf`)・保存(`storePdf`) 同じ行数 | 先に出てくる処理の責務の名前 |

## 変更対象ファイル一覧

### 新規

- `src/domain/codebase/autoNameClasses.ts`(domain): `autoNameClasses(codebase, classNames)` — 自動で名付けるクラスの名前を、上の規則で付け直した新しい Codebase を返す純粋関数
- `src/domain/codebase/autoNameClasses.test.ts`(domain・TDD対象)

### 変更

- `src/domain/codebase/Codebase.ts`(domain): `CodeClass` に `autoNamed?: true` を足す(プレイヤーの操作で作られ、まだリネームされていないクラスの印。省略は「自動で名付けない」)
- `src/domain/codebase/isCodebase.ts`(domain): 読み込み時の型ガードで `autoNamed` を検証する(省略か `true` だけを許す)
- `src/domain/codebase/moveToNewHome.ts`・`addClass.ts` など、プレイヤーの操作で新しいクラスを作る関数(domain): 作ったクラスに `autoNamed: true` を付ける
  (模範解答の `addClass` 手順など、名前を指定して作る経路では付けない。引数で区別する)
- `src/domain/codebase/renameClass.ts`(domain): リネームしたら `autoNamed` を外す
- `src/domain/stage/Stage.ts`(domain): `Stage` に `classNames: Readonly<Record<string, string>>`(責務 → 自動で付けるクラス名)を足す
- `src/infrastructure/stages/*.ts`(infrastructure): **全ステージ**に `classNames` を書く。そのステージの Fragment に出てくる責務(`call` を除く)をすべて覆う。
  名前は、模範解答の `addClass` にある名前があればそれを使い(例: 初級2の `rendering` → `InvoicePdfRenderer`、`storage` → `InvoiceStorage`、
  `notification` → `InvoiceMailer`)、無ければ責務が伝わる英語のクラス名を付ける。初期状態にある同名のクラスとは重ならないようにする
- `src/presentation/store/useGameStore.ts`(presentation): コードベースを変える操作のあと(履歴に積む前)に、`autoNameClasses(codebase, stage.classNames)` を通す。
  1か所で通すようにし、操作ごとに書き足さない
- 白紙設計モード(`blank-design-mode`)でクラスを作る経路があれば、同じく通す。白紙設計の問題に `classNames` が無ければ `NewClass` のまま(今どおり)でよい
- `e2e/`: 下の受け入れ基準のうち、操作に関わるものを追加する(新しいファイル `e2e/auto-class-naming.spec.ts`)。
  既存のE2Eで `NewClass` という名前を前提にしているものは、新しい名前に合わせて直す

## データ・型の変更

```ts
export type CodeClass = {
  // …既存のフィールド
  /** プレイヤーの操作で作られ、まだリネームされていないクラス。中身の役割から名前を自動で付け直す。省略時は自動で名付けない。 */
  readonly autoNamed?: true;
};

export type Stage = {
  // …既存のフィールド
  /** 新しく作ったクラスに自動で付ける名前(Fragment の responsibility → クラス名)。call を除く、このステージの全責務を覆う。 */
  readonly classNames: Readonly<Record<string, string>>;
};
```

自動保存の下書きは `CodeClass` を含むが、省略可能なフィールドの追加なので、既存の下書きはそのまま読める(既存の `NewClass` は自動で名付けないクラスとして扱われる)。

## TDD対象の純粋関数

`autoNameClasses(codebase, classNames)`(`autoNameClasses.test.ts`):

- 自動で名付けるクラスに `rendering` の処理だけ → 表の `rendering` の名前になる
- `notification` 6行と `storage` 3行が混ざる → `notification` の名前
- 2つの責務が同じ行数 → クラスの中で最初に出てくる処理の責務の名前
- `call` だけ・中身が空・表に無い責務だけ → `NewClass`
- 付けたい名前がほかのクラスにすでにある → 末尾に `2` が付く。2つの自動で名付けるクラスが同じ名前になる場合も重ならない
- 自動で名付けないクラス(`autoNamed` 無し)は、中身に関係なく名前を変えない
- 中身が変わって役割が変わる(描画を出して保存だけになる) → 名前も付け直される
- 元の Codebase を変更しない(新しい Codebase を返す)

あわせて、既存のテストに追加する:

- `moveToNewHome.test.ts`・`addClass.test.ts`: プレイヤーの操作で作ったクラスに `autoNamed: true` が付く。名前を指定する経路では付かない
- `renameClass.test.ts`: リネームすると `autoNamed` が外れる
- ステージのカタログのテスト(`stageCatalog.test.ts` など): 全ステージの `classNames` が、そのステージの全責務(`call` を除く)を覆っている
- 模範解答のテスト: 全ステージの模範解答の点数・クラス名が変わらない

## 受け入れ基準

- `npm run check` と `npm run test:e2e` がすべて通る
- 初級2で、`renderPdf` を余白へドロップして新しいクラスを作ると、そのクラスの名前が `NewClass` ではなく `InvoicePdfRenderer` になる
- 同じクラスにメソッドを足したり出したりすると、上の規則で名前が付け直される
- クラスをリネームしたあとは、中身を変えても名前が変わらない
- 元に戻す・やり直しで、名前も一緒に戻る・進む
- 採点(点数・減点の内訳)は、名前が変わる前と同じ。模範解答の手順は今どおり100点になる
- 図・メソッドパネルの見出し(`NewClass.sendInvoice()` の部分)・コードタブ(`public class …`)・AI講評に渡すクラス名に、自動で付いた名前が一貫して出る

## スコープ外

- クラス名の良し悪しの採点(既定名のままを減点する、曖昧な名前を減点する、など)
- ファイルのパス・ファイル名の自動変更
- メソッド名の自動付け直し(抽出時の `suggestedName` は今どおり)
- 名前の候補を複数出してプレイヤーに選ばせるUI
