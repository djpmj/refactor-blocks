# 機能探索: 具象クラスを extends して契約の実装を「借りる」抜け道を塞ぐ

- slug: `concrete-superclass-loophole`

## 出どころ

新規探索(`docs/pipeline/USER_FIXES.md` に未完了項目 `### [ ]` が無かったため)。

既存の確定仕様で「別件として次の機能探索に回す」と明記されていたもの:

- `docs/specs/extends-interface-loophole.md` 1章「同じ上級6で、本件の直し方では塞がらない別の抜け道(手計算、今回はスコープ外)」
  > 空実装5つを消し(`deleteMethod` ×5)、Slack・Teams・Backlog の継承元を **ChatworkClient**(中身のある具象クラス)にする
  > (`setSuperclass` ×3、implements はそのまま)。(中略)→ **8手で100点**の見込み。(中略)別件として次の機能探索に回す。
  > 将来この件を扱うときは、この再現手順を出発点にする。
- 同6章「スコープ外」: 「具象クラス(ChatworkClient など)を extends して契約の実装を借りる抜け道(1章の「別の抜け道」)。別件として次の機能探索に回す」

## 背景・目的

- 上級6「太ったインターフェースを役割ごとに分ける」(`advanced-interface-segregation`)で、インターフェースを一切分けずに
  「空実装を消す → 全部入りの具象クラス ChatworkClient を継承元にする」だけで満点になる見込み。実際のコードとしては
  「Slack が Chatwork のタスク登録を継承する」誤った is-a で、ISP の狙いも果たしていない。
- 対象プレイヤー(新卒〜4年目)に「実装が足りなければ、たまたま全部持っている具象クラスを継承すればよい」という
  現場でもよく見る悪い癖(実装継承の乱用、Refused Bequest)を、採点が満点で肯定してしまう。ゲームの学習効果を直接損なう穴。
- 直前の `extends-interface-loophole`(インターフェース役を extends する穴)は採点で塞ぐと決まった。こちらは仕組みが別
  (先祖がインターフェース役ではなく中身のある具象クラス)なので、同じ直し方では塞がらない。

## 関連する既存コード

- `src/domain/scoring/interfaceContracts.ts` — `findMissingImplementations`(28〜41行目)が `extendsChainMethodNames` で
  extends の先祖のメソッドも「持っている」に数えるため、具象の親から契約を借りられる。`interfaceContracts.test.ts` 89〜112行目は
  「extends の先祖が持っていれば実装漏れに数えない」を正当な使い方として固定している(壊してはいけない側)
- `src/domain/scoring/loneSuperclass.ts` — 継承に関する既存の採点(子が1つだけの基底クラス)。新ルールを足すか既存ルールを広げるかの比較対象
- `src/domain/codebase/Codebase.ts` — `isInterfaceLike`(115行目)・`isAbstractLike`(187行目)・`extendsChainIds`(149行目)
- `src/domain/codebase/overrides.ts` — 子が親のメソッドを上書きしているかの判定(「親のメソッドを使わない・上書きしてばかりの継承」を見るなら参考になる)
- `src/infrastructure/stages/advancedStages.ts` 489〜731行目 — 上級6のステージデータ。`advancedStages.test.ts` の
  `describe('advanced-interface-segregation')` が回帰テストの置き場
- 上級1(`advanced-notifier-hierarchy`、模範解答で EmailNotifier・SmsNotifier → NotifierBase)・上級5(CsvExporter → BaseExporter)・
  上級8(Template Method)— **正当な具象/抽象クラスの継承**を使う既存ステージ。新しい判定がこれらの模範解答を減点しないことが必須条件
- `docs/specs/extends-interface-loophole.md` — 再現手順(1章)と、他ステージ・既存テストへの影響の洗い出し方の前例
- `docs/specs/lone-superclass-scoring.md` — 継承の採点ルールを1つ足した前例

## スコープの見立て

- 採点ロジック(`src/domain/scoring/`)の変更 + 上級6の回帰テスト程度で、1回のPRで完結する規模と見ている。操作・画面・E2E は触らない見込み。
- **依存関係:** `extends-interface-loophole` は最終仕様まで済んでいるが未実装。同じ `interfaceContracts.ts` を触る可能性が高いので、
  仕様設計者はあちらのマージ後の形を前提にするか、どちらが先でも動く書き方にするかを決めること。
- 仕様設計者に決めてほしい論点(ここでは決めない):
  - 何を「借りている」とみなすか。例: (a) implements した契約を自分では持たず、**インターフェース役でも抽象役でもない**先祖から借りている、
    (b) 具象の親に、子が is-a として要らないメソッドがある(Refused Bequest)、など。上級1・5・8 の模範解答を減点しない線引きが要る
  - 既存の `contract` ルールを広げるか、新しいルール名を足すか(講評・内訳表示への影響も含めて)
  - 上級6以外のステージ(特に上級2・3の決済/割引)で同じ手が通るかの洗い出し
- 大きくなりそうなら次のように割る:
  1. 今回: 上級6の再現手順(8手で100点)が満点にならない最小の判定だけ足す
  2. 後回し: Refused Bequest 一般(親のメソッドを使わない継承)の採点や、操作側のガード・ヒント表示
