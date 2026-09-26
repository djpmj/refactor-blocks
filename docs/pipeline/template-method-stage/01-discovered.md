# 機能探索: 上級ステージ「重複した手順を Template Method にまとめる」

- slug: `template-method-stage`

## 出どころ

新規探索(`docs/pipeline/USER_FIXES.md` に未完了項目 `### [ ]` が無かったため)。

複数の既存仕様書で「将来の題材」として先送りされていたもの:

- `docs/specs/inheritance.md`: 「デザインパターン(Strategy / Template Method)への組み替え支援・採点: 継承の『表現』ができてから考える」
  → Strategy は上級3(`advanced-discount-strategy`)で実現済み。Template Method だけが残っている
- `docs/specs/advanced-report-factory.md`: 「Observer・Decorator・Template Methodなど他のデザインパターンは扱わない(今回は1ステージのみ追加)」
- `docs/specs/cohesion-value-object-anemic.md` と `src/domain/scoring/visibility.ts` の ponytail コメント:
  > 親が子の protected フックを呼ぶ Template Method は違反に数える。フックを題材にするステージを作るとき、親の抽象宣言を表す項目と一緒に見直す

## 背景・目的

- 現在のステージは チュートリアル2・初級2・中級8・上級7。上級では継承(上級1・上級5)、DIP(上級2)、Strategy(上級3)、
  Factory(上級4)、ISP(上級6)、値オブジェクト(上級7)を扱っているが、**「処理の骨組みは同じで、一部の手順だけが違う」**
  という、新卒〜4年目が現場で最もよく出会う重複(CSV/JSONの取り込み、メール/SMSの送信手順など)を
  Template Method で解消する題材が無い。
- 上級1は「共通処理を基底クラスへ集める」、上級5は逆に「子が1つの継承を畳む」なので、
  「基底クラスが手順を持ち、子は差分(フック)だけを書く」という継承の**正しい使い方**を体験するステージが加わると、
  継承まわりの学習が「集める → 手順と差分を分ける → 要らない継承は畳む」とつながる。
- 採点側には、上の ponytail コメントのとおり「親が子の protected フックを呼ぶと違反」という既知の手抜きが残っている。
  Template Method を題材にするなら、親が**自分自身の抽象フック宣言**(既存の `fragments: []` の契約メソッド表現。
  上級2の `PaymentGateway.charge`、上級3の `DiscountStrategy.calculate` で使用済み)を呼ぶ形で素直に書けるか、
  それとも visibility の採点の見直しが要るかを、ここで決着させられる。
- 新機能課題(change request)で「3つ目の形式を足して」を出せば、Template Method 化した後は子クラス1つを足すだけで済み、
  「触るブロック数が減る」をプレイヤーが実感できる。ゲームの中心的な学習サイクルにそのまま乗る。

## 関連する既存コード

- `src/infrastructure/stages/advancedStages.ts` — 上級1(`advanced-notifier-hierarchy`)・上級3(Strategy)・上級5(`advanced-collapse-hierarchy`、
  `escapeValue` → `quoteChar` の Template Method 形)がステージデータの前例
- `src/infrastructure/stages/advancedStages.test.ts` — ステージの模範解答で点が上がることを確かめる既存テストの形
- `src/domain/scoring/visibility.ts` — protected 越境の判定と、上記 ponytail コメント
- `src/domain/codebase/Codebase.ts` — `fragments: []` の契約メソッド表現、`extendsChainIds`
- `src/domain/change/measurePlacement.ts` — 新機能課題で「抽象に新クラスをぶら下げたか」を判定する既存ロジック(`attachment: 'abstract'`)
- `docs/specs/merge-duplicate-methods.md` — 重複実装の統合操作と「抽象メソッドの宣言は新操作として作らない」判断
- `docs/specs/advanced-discount-strategy.md` / `docs/specs/advanced-report-factory.md` — デザインパターンの上級ステージを1件ずつ足した前例
- `docs/specs/lone-superclass-scoring.md` / `docs/specs/visibility-scoring.md` — 継承・可視性の採点

## スコープの見立て

- 上級ステージ1件の追加(ステージデータ + ステージの模範解答テスト)が中心で、1回のPRで完結する規模と見ている。
  既存の上級3・上級4の追加と同程度。
- 仕様設計者に決めてほしい論点(ここでは決めない):
  - 親が子のフックを呼ぶ形を、既存の `fragments: []` の抽象宣言を親に置くだけで表現できるか。
    できなければ visibility 採点(ponytail コメント箇所)の見直しを今回のスコープに含めるか
  - 題材(例: CSV/JSON の取り込み、帳票出力など)と、上級1・上級5と題材が被らないようにすること
  - 新機能課題(3つ目の形式の追加)の中身
- 大きくなりそうなら次のように割る:
  1. 今回: ステージデータの追加のみ(既存の表現・採点で模範解答が満点になるように書けるなら、採点は触らない)
  2. 後回し: visibility 採点の「親の抽象フック宣言」対応(必要と分かった場合のみ)
