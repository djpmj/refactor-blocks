import type { GlossaryTerm } from '../../domain/glossary/Glossary';

function term(id: string, name: string, aliases: readonly string[], [definition, example]: readonly [string, string]): GlossaryTerm {
  return { id, name, aliases, definition, example };
}

/** クリア条件・ステージ一覧のタグ・減点の内訳に実際に出る語だけ。解き方は書かず、意味だけを書く(困りごとは ruleWhy の領分)。 */
export const glossaryTerms: readonly GlossaryTerm[] = [
  term('coupling', '結合度', [], ['クラスどうしがどれだけ強く・多く依存しているか。低いほど、1か所の変更がほかへ響きにくい。', '`OrderService` が5つのクラスを呼んでいれば、依存先は5クラス。']),
  term('dependency', '依存', ['依存先'], ['あるクラスが、別のクラスのメソッドを呼んだりデータを使ったりしていること。呼ばれる側を依存先という。', '`A` が `B.save()` を呼ぶなら、A は B に依存している。']),
  term('cycle', '循環依存', [], ['依存をたどると元のクラスに戻ってくる輪になっていること。', '`A` → `B` → `A`。']),
  term('responsibility', '責務', [], ['そのクラス・メソッドが受け持つ仕事。「変わる理由」が同じものを1つの責務とみなす。', '「注文の計算」と「メール送信」は別の責務。']),
  term('cohesion', '凝集度', [], ['1つのクラスの中のデータと処理が、どれだけ同じ目的でまとまっているか。高いほどよい。', '住所と在庫数を同じクラスで持っていると凝集度が低い。']),
  term('empty', '空のクラス・ファイル', [], ['中にメソッドもデータも無いクラス、クラスの無いファイル。', '処理をすべて移したあとに残った `Helper` クラス。']),
  term('encapsulation', 'カプセル化', [], ['データを持ち主のクラスの中に閉じ込め、外からは決めたメソッド経由でしか変えさせないこと。', '残高を直接書き換えさせず `withdraw()` だけを公開する。']),
  term('visibility', 'private / public', ['private', 'public', 'アクセス制御'], ['メソッドやデータを外から呼べるか(public)、自分のクラスの中だけか(private)の区別。', '`private calcTax()` は他のクラスから呼べない。']),
  term('inheritance', '継承', [], ['親クラスの性質を子クラスが引き継ぎ、違う部分だけを書き換える仕組み。', '`CreditPayment extends Payment`。']),
  term('interface', 'インターフェース', ['implements'], ['メソッドの名前と形だけを決めた約束。クラスは `implements` でその約束を守ると宣言する。', '`class SmtpSender implements Sender`。']),
  term('extract-method', 'Extract Method', [], ['メソッドの一部の処理を、名前を付けた新しいメソッドとして切り出すリファクタリング。', '長い `placeOrder()` から `calcTotal()` を切り出す。']),
  term('move-method', 'Move Method', [], ['メソッドを、それが使うデータを持つ別のクラスへ移すリファクタリング。', '`Order` の送料計算を `Shipping` へ移す。']),
  term('extract-class', 'Extract Class', [], ['1つのクラスの一部の責務を、新しいクラスとして切り出すリファクタリング。', '`User` から住所まわりを `Address` に分ける。']),
  term('inline', 'Inline Method / Inline Class', ['Inline Method', 'Inline Class'], ['役に立っていないメソッドやクラスを、呼び出し元へ戻して消すリファクタリング。', '横流しするだけの `Manager` を消して直接呼ぶ。']),
  term('merge-methods', 'Merge Methods', [], ['同じ処理をしている複数のメソッドを1つにまとめる操作(このゲームの操作名)。', '2クラスにある同じ `formatPrice()` を1つにする。']),
  term('feature-envy', 'Feature Envy', [], ['自分のデータより、他のクラスのデータばかり使っているメソッドのこと(コードの臭いの1つ)。', '`Invoice` のメソッドが `Customer` の項目ばかり読む。']),
  term('anemic', '貧血ドメインモデル', [], ['データとgetter/setterだけを持ち、そのデータを使う処理が別のクラスにある状態。', '`Account` は残高を持つだけで、引き出しの判定は `AccountService` にある。']),
  term('middle-man', 'Middle Man', ['横流しするだけのクラス'], ['受け取った呼び出しを、ほぼそのまま別のクラスへ渡すだけのクラス。', '`Manager.save()` が `Repository.save()` を呼ぶだけ。']),
  term('collapse-hierarchy', 'Collapse Hierarchy', [], ['親と子の違いがほとんど無い継承を、1つのクラスにたたむリファクタリング。', '子が1つしかない `BaseReport` を畳む。']),
  term('isp', 'ISP', ['インターフェース分離の原則'], ['インターフェース分離の原則。使わないメソッドまで実装させる大きなインターフェースを、役割ごとに分けるという考え方。', '印刷しかしない機械に `fax()` を実装させない。']),
  term('value-object', 'Value Object', [], ['金額や住所のような「値」を表す小さなクラス。中身を変えず、値が同じなら同じものとして扱う。', '`Money(100, \'JPY\')`。']),
  term('strategy', 'Strategy', [], ['切り替えたい処理をインターフェースの裏に置き、実行時に差し替えられるようにする設計パターン。', '割引の計算方法を会員ランクごとのクラスに分ける。']),
  term('factory', 'Factory', [], ['どのクラスのインスタンスを作るかの判断を、1か所に集める設計パターン。', '種類に応じて `CsvReport` か `PdfReport` を作る。']),
  term('template-method', 'Template Method', [], ['処理の流れを親クラスに書き、違う手順だけを子クラスで書き換える設計パターン。', '出力の流れは共通、見出しの書き方だけ子が決める。']),
  term('state', 'State', [], ['状態ごとの振る舞いをクラスに分け、状態が変わると使うクラスを差し替える設計パターン。', '注文の「受付中」「発送済み」を別々のクラスにする。']),
  term('layer', 'レイヤー(層)', ['層'], ['役割ごとにクラスを段に分け、依存を上の段から下の段への一方通行にする構成。', 'Controller → Service → Repository。']),
];
