# フィールドの上に作る3ステージ: 貧血ドメインモデル(中級7)・Extract Class(中級8)・Value Object(上級7)

## 背景・目的

`docs/specs/fields-and-feature-envy.md` で、クラスのフィールド・処理の `reads` / `writes`・Move Field・採点ルール Feature Envy / カプセル化の破れ・中級6が入った。
この仕組みの上に、実務でよく出会う次の3つのリファクタリングを練習するステージを足す。

| 題材 | 実務でよく見る形 | このゲームでの直し方 |
| --- | --- | --- |
| 貧血ドメインモデル | private フィールド + public な getter/setter だけの `Account`。業務ルールは全部 `AccountService` にある。「private にして getter/setter を付けたからカプセル化できている」という誤解 | ルールの処理を Extract Method して `Account` へ Move Method し、呼ばれる側を public に、setter を private にする |
| Extract Class(凝集度) | 1クラスに、互いに同じフィールドを使わないメソッドの塊が同居している(`Employee` が給与と住所を抱える) | 新しいクラスを作り、片方の塊のフィールドとメソッドを Move Field / Move Method で移す |
| Primitive Obsession → Value Object | 金額(`amount: number`)と通貨(`currency: string`)がプリミティブのまま使われ、検証・合計・表示の処理が各サービスにコピペされている | `Money` クラスを作り、コピペを Merge Methods で1つにして、`amount`・`currency` と一緒に `Money` へ移す |

あわせて、**メソッドの可視性(public / protected / private)を変える操作を全ステージに足す**。中級7で setter を private にするために要るが、どのステージでも使えるので、既存ステージに抜け道ができないよう塞ぐ(設計判断3)。

> **点数について**: この仕様書の点数・件数はすべて手計算。実装者は各段階でテストを書くときに実測し、食い違えば**仕様書の表を実測値に直す**(ルールの定義を点数に合わせて曲げない。定義どおりで学びが崩れる場合は実装を止めて相談する)。

### 調べて分かったこと(設計の前提)

1. **getter/setter 越しのアクセスは、今の採点では何も捕まらない。** Feature Envy・カプセル化の破れは `reads` / `writes` だけを見ており、
   メソッド呼び出し(`uses`)は数えない(`fieldAccess.ts`)
2. **フィールドを持つステージは、今は中級6だけ。** 白紙設計(`infrastructure/blankDesigns/`)・設計くらべ(`infrastructure/quizzes/`)・部品置き場(`trayCodebase`)・変更依頼の部品(`changePart`)もフィールドとフィールド参照を持たない。
   プレイヤーの操作でフィールドは増えない(Move Field は移すだけ)。なので、**フィールドを使うルールは、フィールドのないステージでは常に0件**になる
3. **凝集度(LCOM)をそのまま全ステージで有効にすると、中級6の模範解答が壊れる。** 模範解答のあとの `Subscription` は、
   `isInTrial`・`cancel`(`status` を共有)と `monthlyFee`(`seats`・`unitPrice` だけ)の2つの塊に分かれる
4. **重複(`duplicateGroup`)そのものを減点するルールはない。** 重複は変更依頼の散らばり(shotgun)と行数上限で表している(上級4と同じ)
5. **Merge Methods は3つ以上をまとめられない。** 統合後の処理は `duplicateGroup` を引き継がない(`mergeFragment`)。1つの重複グループは2か所までにする
6. **フィールドの型がない。** 「`Invoice` が `Money` 型のフィールドを持つ」は表せない
7. **可視性を変える操作を何の制限もなく全ステージで使えるようにすると、既存ステージに抜け道ができる。**
   - 中級3(`visibilityEnforced`)は「`TemplateEngine` の private メソッド `renderTemplate` を外から呼んでいる」を Move Method で直すステージだが、`renderTemplate` を public にするだけで違反が消えて100点になる
   - 使われていない private メソッド(`unused`)を public / protected にすれば減点を逃れられる(`findUnusedPrivateMethods` は private だけを数える)
   - 中身のないメソッド(`fragments: []`、インターフェースの契約)の可視性を変えると、インターフェース役の判定(`isInterfaceLike`: 全メソッドが public かつ中身なし)や約束違反の採点(`findContractMethodsOutsideInterfaces`: public かつ中身なし)から外れる。
     上級6の近道「契約メソッドを `IncidentService` へ移す」で、移した契約メソッドを private にすれば約束違反が消える
   - → 設計判断3で、操作の前提条件と中級3のデータで塞ぐ
8. **`visibility.ts` は、protected のメソッドを無関係なクラスから呼んでも違反にしない**(`visibility.test.ts` で明示的にそう決めている)。protected を選べるようにすると、「public の代わりに protected にする」が近道になる。→ 設計判断3で違反にする
9. **private を protected に広げる既存の挙動は `setSuperclass` にある**(`promoteCalledPrivateMethods`。子クラスが呼んでいる親の private を protected にする)。**Move Method は可視性を変えない**。
   そのため上級1で「先に継承を結んでから `logNotification` を親へ移す」順だと private のまま残る(上級1は `visibilityEnforced` がないので点は変わらない)
10. **Inline Method と Merge Methods は private のメソッドにしか使えない**(`inlineMethod.ts`・`mergeMethods.ts`)。Inline Method は Extract Method が残した呼び出し行(`<id>:call`)がないと使えないので、
    ステージのデータにもともとある public メソッドを private にしても、新しく Inline できるようにはならない
11. **`visibilityEnforced` を立てているのは中級3だけ。** 上級1・5など継承を使うステージは立てていないので、アクセス制御(`visibility`)の採点は0件のまま
12. **メソッドエディタ(`MethodEditor.tsx`)は白紙設計の画面(`BlankDesignView.tsx`)でも同じストアで使っている。** 設計くらべの画面には出ない
13. **Ctrl+Z は選択欄(`select`)にフォーカスがあると効かない**(`useUndoRedoShortcut.ts`: 入力欄・選択欄ではブラウザ標準を優先)

---

## 設計判断

### 1. 貧血ドメインモデル: getter/setter の呼び出しを「フィールドに触った」とみなす(決定済み)

処理に隠しタグ `accessor?: boolean` を足す。**全部の処理が `accessor` のメソッド**(getter/setter)を呼ぶ処理は、そのメソッドが読む・書くフィールドを読む・書いたものとして数える。

- **読み取り(getter 越し)**: Feature Envy の「触ったフィールド」に数える。カプセル化の破れ(public でないフィールドの読み取り)には**数えない**(getter は公開された読み取りの窓口のため)。
  表示のために getter を1つ呼ぶだけの処理は、Feature Envy の下限2に届かないので減点されない(getter そのものが悪いのではない)
- **書き込み(setter 越し)**: Feature Envy に数え、**カプセル化の破れ(他クラスのフィールドの書き換え)にも数える**。直接の `writes` と同じ扱い。setter の可視性は問わない
- 自分側(自クラス + extends の先祖)のアクセサを呼ぶのは違反にしない。たどるのは1段だけ
- アクセサでない普通のメソッドの呼び出し(`subscription.isInTrial()`)は今までどおり数えない(Tell なので)
- クラス間の依存(`dependencies.ts`)は変えない(`uses` ですでに依存に入っている)
- アクセサの判定をメソッド名(`get`/`set` 始まり)でしないのは、`getRank`(中級1、判定の処理)のような普通のメソッドを誤ってアクセサ扱いしないため。`stub` と同じく、ステージ作者がタグで明示する

「フィールドしかない / getter・setter しかないクラス」の減点(データクラスのルール)は足さない。中級6の初期の `Subscription` も数えてしまい、減点がサービス側でなくデータ側に付くため。

### 2. 公開された setter の減点(決定済み)

可視性を変える操作を作っても、public な setter を残したまま減点がなければ、中級7で setter を private にする理由が採点に表れない。そこで次を**カプセル化の破れ**に数える。

- **他クラスから呼ばれていない、private でない setter**(`isAccessorMethod` で、処理が `writes` を持つメソッド)1つにつき1件 -10(「外から書き換えられる窓口が開いたまま」)
  - 「他クラス」は持ち主以外のすべてのクラス(子クラスも含む)。子クラスから呼ばれている protected / public の setter は数えない(子クラスからの書き換えは自分側なので、判断1の書き換えにも数えない。正当な使い方)
- 他クラスから呼ばれている setter は、すでに「setter 越しの書き換え」(判断1)で呼んでいる側に数えるので、ここでは数えない(同じ setter で二重に減点しない)
- getter は数えない(読み取りの窓口は公開してよい)
- public フィールドは数えない(中級6の完成形は public フィールドのまま100点。public フィールドは読み取りにも使うので、書き換えの窓口かどうかを区別できない。setter は書き換え専用なので区別できる)
- `accessor` タグのない既存ステージは常に0件
- **「公開しすぎ」の減点はこれだけ。** 一般の「クラスの外から呼ばれていない public メソッド」は採点しない(設計判断3の「採らなかった案」)。なので setter の減点と二重になるルールはない。
  使われていない private の setter は今までどおり `unused` で数え、private でない setter は `unused` に入らないので、こちらとも重ならない

### 3. メソッドの可視性を変える操作(全ステージ。決定済み + 抜け道の塞ぎ方は推奨)

**決定済み**: 操作は全ステージで使える(`visibilityEditable` のようなフラグは作らない)。public / protected / private の3つを選べる。protected の違反を採点に足す。

#### 3-1. 操作 `changeVisibility`

- ドメイン操作 `changeVisibility(codebase, methodId, visibility)`。選べるのは `Visibility` の3つ
- **中身のないメソッド(`fragments: []`)は変えられない**(`err('contract-method')`)。インターフェース役のクラスの契約メソッドと、そこから Move Method で持ち出された契約メソッドの両方を1つの条件で守る(前提7の3つ目)。
  インターフェース役のクラスのメソッドはすべて中身がないので、`isInterfaceLike` を別に見る必要はない
- **広げる(private → protected → public の向き)ときは、広げた可視性でないと届かない呼び出し元が1つ以上あること**(`err('widening-not-needed')`)
  - public にする: 持ち主以外のクラスの処理が、このメソッドを `uses` で呼んでいる
  - protected にする(private から): 持ち主の**子孫クラス**(extends をたどると持ち主に届くクラス)の処理が、このメソッドを呼んでいる
  - 狭める(public → protected / private、protected → private)ときは呼び出し元を検査しない。狭めた結果の越境呼び出しは採点(`visibility`、有効なステージのみ)や `unused` で気づかせる
- 呼び出し元は処理の `uses` からたどる(`dependencies.ts` の `methodOwnerMap` と同じ情報)。プレイヤーが `uses` を足す操作はなく、呼び出しの処理が消える操作もない(Inline・Merge は呼び出しを付け替えるだけ)ので、**一度広げたメソッドが「誰からも呼ばれない public」に戻ることはない**

#### 3-2. 抜け道の塞ぎ方(推奨)

| 抜け道(前提7) | 塞ぎ方 | 結果 |
| --- | --- | --- |
| 使われていない private を public / protected にして `unused` を逃れる | 広げるときの前提条件(3-1) | 呼び出し元がないので広げられない |
| 契約メソッドを private にしてインターフェース役・約束違反の判定から外れる | 中身のないメソッドは変えられない(3-1) | 上級2・3・6の契約メソッドは変えられない |
| 中級3で `renderTemplate` を public にするだけで100点 | **中級3の `dependencyLimit` を 2 → 0 にする**(データの修正) | public にしても `NotificationService → TemplateEngine` の依存が残り、結合度 -10。Move Method して `TemplateEngine` を片付けて初めて依存が0になる |
| 無関係なクラスから呼ばれる private を protected にして越境を逃れる | protected の違反(3-3)+ 前提条件(子孫クラスの呼び出し元が要る) | そもそも protected を選べない。継承を結んで自動で protected になっても、無関係なクラスからの呼び出しは違反のまま |

中級3の塞ぎ方の比較:

| 案 | 内容 | 評価 |
| --- | --- | --- |
| **1. `dependencyLimit: 0`(推奨)** | goal に「NotificationService だけで通知を組み立てられるようにしよう(依存先は0クラス)」を足す | データだけの変更で新しい概念が要らない。「自分の中でしか使わないつもりの処理は、使う側へ移す」という中級3の主題を、依存の本数でも見せられる。初期点が 80 → 70 に下がる(E2E の期待値を直す) |
| 2. メソッドの隠しタグ(`internal: true` なら広げられない) | `renderTemplate` にだけタグを付ける | メソッド単位のフラグで、ユーザーが却下した「フラグで絞る」とほぼ同じ。中級3のためだけの概念が増える |
| 3. 抜け道を残す | public にするのも実務では正解の1つ、と説明文で認める | 中級3の学び(Move Method)が採点に表れなくなる |

#### 3-3. protected の違反(`visibility.ts`)

- **メソッド**: protected のメソッドを、持ち主でも持ち主の子孫でもないクラスの処理が呼ぶと、アクセス制御の違反1件(private の越境と同じ `VisibilityViolation`、同じ重複の除き方)。
  「子孫」の判定は、呼ぶ側のクラスの extends の先祖(自分を含む)に持ち主が入っているか。`implements` は実装を継承しないので子孫に数えない
- **親が子の protected を呼ぶ**(上級5の `escapeValue` → `quoteChar` のような Template Method のフック)も違反になる。このゲームには「親に抽象メソッドとして宣言する」表現がないため。
  **protected の越境は全ステージで数える(ユーザー決定)ので、上級5の初期点が1件分(-10)下がる**。模範解答で継承を畳むと `quoteChar` は `escapeValue` と同じクラスになり違反は消えるので、模範解答は100点のまま(実装時に実測)。`// ponytail: 親が子の protected フックを呼ぶ Template Method は違反に数える。フックを題材にするステージを作るとき、親の抽象宣言を表す項目と一緒に見直す`
- **数えるステージ(ユーザー決定)**: protected の越境は**全ステージ**、private の越境は今までどおり `visibilityEnforced: true` のステージだけ。どちらもルール `visibility` に含める(ルールは増やさない)。`visibility.ts` の違反に `kind: 'private' | 'protected'` を持たせ、`score.ts`・`fileScores.ts` は「enforced なら全件、そうでなければ protected だけ」を数える
- 「protected を private に狭めて、enforced でないステージで越境を消す」抜け道は、`changeVisibility` の前提条件「狭めると届かなくなる呼び出し元があるなら狭められない」(`narrowing-breaks-callers`)で塞ぐ。実際のコンパイラでも、外から呼ばれているメソッドを private にするとエラーになるのと同じ
- **フィールド**: 何も変えない。カプセル化の破れ(`isReadViolation`)が、すでに「自分側(自クラス + extends の先祖)でないクラスが、public でないフィールドを読む」を全ステージで数えている。
  protected のフィールドを子クラスが読むのは自分側なので違反にならず、無関係なクラスが読むと違反になる。メソッドと同じ線引きがすでに入っている(メソッドは `visibilityEnforced` のステージだけ、フィールドは全ステージ、という違いは既存のまま)。フィールドの可視性を変える操作は今回作らない(スコープ外)
- 継承元・子孫をたどる処理は、`fieldAccess.ts` の `selfClassIds` を `Codebase.ts` へ移して `extendsChainIds` として共有する(`changeVisibility` の前提条件でも使うため。`domain/codebase` から `domain/scoring` を参照しない向きにする)

#### 3-4. `setSuperclass` の自動昇格との整合

- `setSuperclass` は、子クラスが呼んでいる親の private を protected に広げる(前提9)。3-3 のルールでは子クラスからの呼び出しは違反にならないので、**昇格した結果が採点と食い違わない**
- これまでは、昇格で protected になったメソッドを**無関係なクラス**も呼んでいると、private の越境が消えて見逃されていた。3-3 のあとは protected の越境として数え続けるので、この見逃しも消える(`visibilityEnforced` のステージのみ)
- Move Method は今までどおり可視性を変えない。「継承を結んでから private を親へ移す」順では private のまま残るが、今回からプレイヤーが自分で protected を選べる(子クラスが呼んでいるので前提条件を満たす)。Move Method でも自動で広げるのはスコープ外

#### 3-5. 採らなかった案: 「クラスの外から呼ばれていない public メソッド」を公開しすぎとして減点する

| 案 | 既存ステージへの影響 | 評価 |
| --- | --- | --- |
| A. 他クラスから呼ばれていない public メソッドを減点 | エントリポイント(`registerUser`・`placeOrder`・`checkout`・`downloadSalesCsv` など全ステージで約25個、白紙設計の部品、変更依頼の部品、インターフェースの実装メソッド)に隠しタグ `entryPoint` が要る。タグを付けても、**中級1の模範解答が70点になる**(`getLines`・`countOrdersOf`・`calculateOrderTotal` が移動後は自クラスからしか呼ばれない)。中級2の `ShippingService`・`PointService` の誰も呼ばない public メソッドもタグが要る | 全ステージのデータと模範解答を直すことになり、中級1〜上級6の学びに「可視性を絞る」が混ざる |
| B. 誰からも呼ばれていない public メソッドを `unused` に含める | A と同じくエントリポイントのタグが全ステージで要る | `unused` の抜け道だけなら、操作の前提条件で同じ効果が出せる |
| **C. 操作の前提条件(採用)** | 既存ステージの点数は、中級3の `dependencyLimit` 以外変わらない。エントリポイントのタグは不要 | 公開しすぎの一般的な採点はしない。中級7で見せたい「setter を閉じる」は設計判断2の setter の減点で表れる |

**エントリポイントの扱い**: C を採るので隠しタグは作らない。エントリポイントは最初から public で、広げる必要がない。狭めると(private にすると)誰からも呼ばれていない private として `unused` -10 になるが、これはプレイヤーが自分で下げた点で、元に戻せば(Ctrl+Z でも可視性の再変更でも)戻る。
インターフェースの契約メソッドは中身がないので変えられない。実装クラスの `charge` などを private にすると `unused` になる(実装メソッドは直接は呼ばれないため)。これも下がるだけで抜け道にはならない。

#### 既存の可視性ルールとのつながり(中級7、`visibilityEnforced: true`)

| プレイヤーの操作 | 採点・操作に出ること |
| --- | --- |
| ルールを Extract Method → `Account` へ Move Method | 抽出したメソッドは private のまま `AccountService` から呼ばれるので、**アクセス制御の違反**(`visibility`)。「移したら、呼ばれる側を public にする」必要が見える |
| 移したメソッドを public にする | アクセス制御の違反が消える |
| 抽出したメソッドを `AccountService` に残したまま public にしようとする | **選べない**(他クラスから呼ばれていない) |
| 移したメソッドや setter を protected にしようとする | **選べない**(子クラスがない) |
| setter を private にする(`AccountService` から呼ばなくなったあと) | 公開された setter の減点(判断2)が消える |
| まだ `AccountService` が呼んでいる setter を private にする | **操作が拒否される**(`narrowing-breaks-callers`: 外から呼ばれているメソッドは private にできない)。先にルールを `Account` へ移す必要があることが操作で分かる |
| setter を private にしたが、`Account` の中からも使われない | 使われていない private メソッド(`unused`)。中級7の setter は `debit`・`credit` から呼ばれるので起きない |

### 4. Extract Class: 凝集度ルール `cohesion` を全ステージで有効にする(決定済み)

定義(LCOM4 の素朴な版。Hitz & Montazeri):

- クラス C のメソッドを点とし、次のどちらかを満たすメソッド同士を線で結ぶ
  - C 自身が宣言したフィールドを、両方が触っている(`reads ∪ writes`)
  - 片方の処理が、もう片方を呼んでいる(`uses` が C 内のメソッドを指す。向きは問わない)
- 連結成分のうち、**C 自身のフィールドを1つ以上触るメソッドを含む成分**だけを数える。これが2つ以上ならクラスごとに1件 -10
- 呼び出しでもつなぐのは、**Extract Method / Inline Method で凝集度が変わらないようにするため**(抽出元は抽出したメソッドを呼ぶので同じ成分に残る)
- 次のものは特別扱いしない(定義から自然に決まる)
  - フィールドを持たないクラス → 0件(数える成分がない)
  - インターフェース役の契約メソッド(`fragments: []`)・空実装(stub)→ フィールドを触らないので、ほかのメソッドを呼んでいなければどの成分にも効かない
  - getter/setter → 普通のメソッドとして数える(フィールドを触るので点になる)。業務ルールのメソッドがアクセサを呼べばつながる。
    **getter/setter しかないクラスは、フィールドの数だけ塊に分かれる**(中級7の初期の `Account`。「データの寄せ集めで、つなぐ振る舞いがない」がそのまま減点に表れる)
  - 継承元のフィールド・getter 越しのアクセス・どのメソッドも触らないフィールドは見ない
  - 可視性は見ない(可視性の操作で凝集度は変わらない)
- `// ponytail: 自クラスのフィールドと自クラス内の呼び出しだけで見る LCOM4 の素朴版。継承元のフィールドや未使用フィールドを採点したくなったら足す`

#### 中級6・上級7で塊が分かれる問題: ステージのデータを直す(決定済み)

- 中級6の「請求額を計算する」処理に `status` の読み取りを足す(「解約済み・支払い停止中の契約は請求額を0にし、それ以外は席数と単価から今月の請求額を計算する」)。上級7の `Expense.submit` に `category` の読み取りを入れる
- 定義は LCOM4 の素朴版のまま保つ。「フィールドか呼び出しでつながらないメソッドの塊は分けられる」とプレイヤーに一言で説明できる
- 実務でも、`seats × unitPrice` の計算が契約の状態とまったく関係ないなら `Plan`(料金プラン)への Extract Class を検討する場面で、LCOM の指摘は誤りではない。中級6の主題はそこではないので、データを主題に合う形(請求額は契約の状態を見る)に直す

#### 責務の混在(`responsibility`)との二重減点(決定済み)

- 2つのルールは違うものを見ている(責務タグ = 仕事の種類、凝集度 = 触るデータ)ので、コードでは除外しない
- Extract Class を主題にする中級8では、主題の分割(給与と住所)が責務の混在でも減点されないよう `responsibilityLimit: 4` にする。中級7は `responsibilityLimit: 5`
- 全ステージ化で既存ステージに二重減点が出ないことは下の「既存ステージへの影響」で確認した(凝集度が出るのは新しい3ステージと、近道の途中の状態だけ)

### 5. Value Object: 新しいルール・操作は足さない。表現できる範囲と割り切り(決定済み)

| 値オブジェクトらしさ | このゲームで表せるか | どう表す / 割り切り |
| --- | --- | --- |
| 値の扱い(検証・計算・表示)が1か所に集まる | 表せる | コピペされた処理に `duplicateGroup` を付け、Merge Methods で1つにする。集めないと変更依頼が2クラスに散らばる。統合せずに `Money` へ並べると `Money` が行数上限を超える(上級4と同じ仕組み) |
| 自分で検証する(値と検証が同じクラス) | 表せる | 検証の処理は `amount`・`currency` を読むので、フィールドと別のクラスに置くと Feature Envy |
| 値と振る舞いが同じクラス | 表せる | `amount`・`currency` を Move Field で `Money` へ移さないと、`Money` のメソッドが全部 Feature Envy |
| 別の概念(経費そのもの)と混ぜない | 表せる | `Expense` へ直接入れると、責務の混在・行数上限・凝集度(経費の塊と金額の塊)で減点される |
| 不変(作ったあとに書き換えない) | **採点しない** | 処理が読むか書くかはデータで固定で、プレイヤーには直しようがない。**データに `amount`・`currency` への `writes` を置かない**ことで表し、説明文・ラベルで伝える |
| `Invoice.total: Money` のような値オブジェクト型のフィールド | **表せない** | フィールドに型がない。「`Expense` が `Money` を持つ」は図に出ない。型の項目(`typeClassId`)は、複数のクラスが同じ値オブジェクトを持つ題材を作るときに足す |
| 複数のクラスがそれぞれ金額を持つ | **表せない** | 同じ名前のフィールドは1つのクラスに2つ置けない。値の出どころは `Expense` の1か所に絞る |

### 6. 並び(学習順。決定済み)

| 位置 | ステージ | 前提 |
| --- | --- | --- |
| **中級7** | 貧血ドメインモデル | 中級6(Feature Envy・Move Field)、中級3(アクセス制御) |
| **中級8** | Extract Class | 中級6(Move Field)、初級2(クラスを自分で作る) |
| **上級7** | Value Object | 中級8(Extract Class)、上級4(Merge Methods) |

### 7. 段階の分け方

**どの段階も終えた時点で `npm run check` が通ること。プレイヤーの操作・画面に関わる段階(B・C・D・E・F)では `npm run test:e2e` も通すこと**(G も既存の E2E は通す)。

| 段階 | 内容 | 画面の変化 |
| --- | --- | --- |
| **A. アクセサの採点(domain)** | `Fragment.accessor`、`isAccessorMethod`・`accessorFieldAccess`、Feature Envy・カプセル化の破れへの算入、公開された setter(`findOpenSetters`) | なし(既存ステージの点数は変わらない) |
| **B. 可視性の採点と操作(domain・データ)** | `extendsChainIds` の移設、protected の越境(`visibility.ts`)、`changeVisibility`・ユースケース・模範解答の手、**中級3の `dependencyLimit: 0`**(E2E の期待値の更新・近道の追加) | 中級3の初期点が 80 → 70(「結合度 -10」が増える) |
| **C. 可視性の操作の画面** | ストア・メソッドエディタの「可視性」(全ステージ・白紙設計)・ヒント文、E2E | すべてのステージのメソッドエディタに「可視性」が出る |
| **D. 中級7 貧血ドメインモデル** | ステージ・模範解答・近道・ステージのテスト、メソッドエディタの「getter/setter 経由」の表示、E2E | 中級7が増える |
| **E. 凝集度ルール(全ステージ)** | `findLowCohesionClasses`・`'cohesion'`・ファイルの減点・表示名、**中級6のデータの修正** | なし(中級6の点数・見た目は変わらない) |
| **F. 中級8 Extract Class** | ステージ・模範解答・近道・ステージのテスト、E2E | 中級8が増える |
| **G. 上級7 Value Object** | ステージ・模範解答・近道・ステージのテスト | 上級7が増える |

D は E より前なので、D の時点の中級7の点数表には凝集度が入らない。**E を終えた時点で、中級7の表(下の「E 適用後」の列)に更新された点数になる**ことを E のテストで確かめる。

---

## 既存ステージへの影響(全ステージ化・新しい採点・可視性の操作)

凡例: 初期点 / 模範解答100点 / 近道100点未満 / 変更依頼の置き方・⚠。「変わらない」は理由つき。点数は手計算(実装時に実測して直す)。

共通の理由(表では「共通」と書く):

- **凝集度**: フィールドのないステージは常に0件(前提2)
- **アクセサ・公開 setter**: `accessor` タグがないので0件
- **protected の越境**: 全ステージで数える(ユーザー決定)。protected のメソッドを持つのは継承を使うステージだけで、影響があるのは上級5(下の表)
- **可視性の操作**: 広げられるのは「広げないと届かない呼び出し元がある」メソッドだけ。広げて消える減点は `visibility`(enforced のステージのみ)だけなので、enforced でないステージでは広げても点は変わらない。
  狭めて消える減点は public を条件にするルール(約束違反)だけで、その対象の中身のないメソッドは変えられない。狭めて増えうるのは `unused` だけ(下がるだけ)。届かなくなる呼び出し元があれば狭められないので、狭めて `visibility` が増えることはない。
  Merge Methods・Inline Method は private にしか使えないので、広げるとプレイヤーが自分で使えなくする(下がる方向。前提10)

| 対象 | 凝集度 | アクセサ・公開 setter | protected の越境 | 可視性の操作 | 結論 |
| --- | --- | --- | --- | --- | --- |
| チュートリアル1・2 | 共通 | 共通 | 共通 | エントリポイント(`printMonthlyReport`・`placeOrder`)を private にすると `unused` -10。チュートリアル2で `TaxCalculator` へ移した `calculateTax` は public にできるが点は変わらない | すべて変わらない |
| 初級1・2 | 共通 | 共通 | 共通 | 移した `saveUser`・`renderPdf` などは public にできるが点は変わらない | すべて変わらない |
| 中級1 | 共通 | 共通 | 共通 | `getLines`・`countOrdersOf` など public のメソッドを private にしても enforced でないので点は変わらない(呼ばれているので `unused` にもならない) | すべて変わらない(3-5 の案 A を採らないので、模範解答のあとに自クラスからしか呼ばれない public が残っても減点しない) |
| 中級2 | 共通 | 共通 | 共通 | 移した `calculateShippingFee`・`addPoints` を public にできるが点は変わらない | すべて変わらない |
| **中級3** | 共通 | 共通 | protected のメソッドがなく0件。`NotificationService extends TemplateEngine` にすると `renderTemplate` が自動で protected になり越境は消えるが、子が1つの継承 -10・結合度 -10 が付く | `renderTemplate` は `NotificationService` から呼ばれているので public にできる → **`dependencyLimit: 0` で結合度 -10 が残る**。protected は選べない(子孫クラスがない) | **初期 80 → 70点**(行数・アクセス制御・結合度)。模範解答100点(移したあと `NotificationService` の依存は0)。E2E の期待値 80 → 70。近道「public にして抽出だけ」を足す(80点) |
| 中級4・5 | 共通 | 共通 | 共通 | 抽出して移した税・整形のメソッドは public にできるが点は変わらない | すべて変わらない |
| **中級6** | 初期: `BillingService` 1塊、`Subscription` はメソッドなし → 0件。**模範解答のあと: 直す前は `Subscription` が2塊で90点 → データ修正で1塊** | 共通 | 共通 | フィールドの可視性は変えられない。移した `isInTrial` などは public にできるが点は変わらない | 初期40点・模範解答100点・近道5件とも100点未満は変わらない。下の「中級6のデータ修正」を参照 |
| 上級1(継承) | 共通 | 共通 | enforced でないので0件。模範解答で `logNotification` は `setSuperclass` により protected になり、子クラスからの呼び出しなので仮に enforced でも違反にならない | 継承を結んだあとなら `logNotification` を protected / public にできる(子クラスが呼んでいる)。Merge の前に public にすると Merge できなくなる(下がる方向) | すべて変わらない(`advancedStages.test.ts` の「protected になる」も変わらない) |
| 上級2・3(インターフェース) | 共通 | 共通 | 共通 | 契約メソッド(`PaymentGateway.charge`・`DiscountStrategy.calculate`)は中身がないので変えられない。実装側の `charge` を private にすると `unused` -10。上級3の抽出した `calculate` を public にしてもインターフェースを付ければ点は同じ(付ける前は実装の宣言漏れで下がる) | すべて変わらない |
| 上級4(Merge) | 共通 | 共通 | 共通 | 抽出したメソッドを public にすると Merge できない(下がる方向) | すべて変わらない |
| **上級5(継承を畳む)** | 共通 | 共通 | **初期に `BaseExporter.escapeValue → CsvExporter.quoteChar`(親が子の protected を呼ぶ)が1件**(3-3 の ponytail)。継承を畳むと同じクラスになり消える | `quoteChar` を private にするのは、親から呼ばれているので `narrowing-breaks-callers` で拒否。`escapeValue` を public にしても点は同じ | **初期点が -10**(実測で確定)。模範解答100点・近道100点未満は変わらない見込み(実測)。上級5のテスト・E2Eの初期点の期待値を直す |
| 上級6(ISP) | 共通 | 共通 | 共通 | 契約メソッドは中身がないので変えられない(近道「契約メソッドを `IncidentService` へ移す」で、移した先で private にして約束違反を消す抜け道も塞がる)。空実装(`stub`)は中身があるので変えられるが、`stub` の減点は可視性を見ないので点は同じか下がる | すべて変わらない |
| 白紙設計(`blankDesigns`) | 共通(問題・部品置き場ともフィールドなし) | 共通 | 問題に `visibilityEnforced` がないので0件 | メソッドエディタを共有するので「可視性」が出る。部品は最初から public。狭めると呼ばれない部品は `unused` -10、呼ばれている部品は点が変わらない | 講評の点数は、プレイヤーが可視性を狭めない限り変わらない |
| 設計くらべ(`quizzes`) | 共通 | 共通 | 共通 | メソッドエディタが出ないので操作できない | 判定は変わらない |
| 変更依頼の部品・`sampleImplementation` | 部品はフィールドを触らず、呼び出しも持たない → 部品を置いても ⚠ は増えない | 共通 | 共通 | 部品は public のまま置かれる | 変わらない |
| 置き方の採点(`measurePlacement`・`scorePlacement`) | `scoreCodebase` を使わない | — | — | 変更依頼の実装中に既存メソッドの可視性を変えると、`classContent` に可視性が入っているので「触った既存クラス」に数える(正しい扱い) | 変わらない |
| AI講評の入力 | 減点の内訳に `cohesion` の行(0件)が1つ増える | 増えない(`encapsulation` の件数に入る) | 増えない(`visibility` の件数に入る) | — | `workers/critique/` は既知の項目だけを検証するので変更不要 |
| 既存のテスト | `score.test.ts` の内訳の配列を13ルールに更新(E) | — | `visibility.test.ts` の「protected メソッドを別クラスから呼ぶのは違反にしない」を「継承関係のないクラスからは違反・子クラスからは違反にしない」に書き換える(B) | E2E の中級3の初期点 80 → 70(B) | それ以外の期待値は変えない |

### 中級6のデータ修正(段階E)

- `frag-calc-fee` のラベルを「解約済み・支払い停止中なら請求しない。それ以外は席数と単価から今月の請求額を計算する」にし、`reads` を `['field-status', 'field-seats', 'field-unit-price']` にする。行数・責務・`suggestedName` は変えない
- 点数への影響:
  - 初期: `renewSubscription` が触る `Subscription` のフィールドは startedAt・status・seats・unitPrice の4つで、変わらない(status はもともと `frag-check-trial` が読んでいる)。Feature Envy・カプセル化・依存は同じで **40点のまま**
  - 模範解答のあと: `Subscription` の `isInTrial`(startedAt・status・trialDays)・`monthlyFee`(status・seats・unitPrice)・`cancel`(status・canceledAt)が status でつながり1塊。**100点**
  - 変更依頼: `measureChange` は責務と依存しか見ず、依存は変わらないので **75 → 95 のまま**
  - 近道5件: どれも100点未満のまま(近道1は `monthlyFee` が `BillingService` に残るので Feature Envy が続く)
- 中級6の E2E(「読む: Subscription.startedAt」の表示など)は変わらない

---

## A. アクセサの採点

### 型の変更(`src/domain/codebase/Codebase.ts`、domain)

```ts
export type Fragment = {
  // ...既存の項目
  /**
   * フィールドを返す・代入するだけの getter/setter の処理であることを示す隠しタグ。responsibility・stub と同じくプレイヤーには表示しない。
   * 全部の処理が accessor のメソッドを他の処理が呼ぶと、そのフィールドを読んだ・書いたものとして Feature Envy・カプセル化の破れを数える。省略時は通常の処理。
   */
  readonly accessor?: boolean;
};

/** getter/setter = 処理が1つ以上あり、すべて accessor。isStubMethod と同じ形。 */
export function isAccessorMethod(method: Method): boolean;

/**
 * 処理が呼んでいる getter/setter(isAccessorMethod)越しに読む・書くフィールドのID。
 * 呼び先のアクセサの処理の reads を reads に、writes を writes に集める。それぞれ重複なし、uses の順。存在しないメソッドIDは飛ばす。
 */
export function accessorFieldAccess(codebase: Codebase, fragment: Fragment): { readonly reads: string[]; readonly writes: string[] };
```

`mergeFragment` は `accessor` を引き継がない(`stub` と同じ。getter のコピペを統合する題材はない)。ほかの操作はスプレッドで運ぶので変更不要。

### 採点(`src/domain/scoring/fieldAccess.ts`、domain)

- `fieldCountsByClass`: 触ったフィールドの集合に、各処理の `accessorFieldAccess` の `reads ∪ writes` を足す
- `collectClassViolations`: 書き換えの候補に `accessorFieldAccess(...).writes` を足す(`isWriteViolation` で判定)。getter 越しの読み取りは `isReadViolation` に渡さない
- 新規:

```ts
/**
 * 持ち主以外のどのクラスからも呼ばれていない、private でない setter(isAccessorMethod で writes を持つ)のメソッドIDを出現順に返す。
 * 外から書き換えられる窓口が開いたまま。他クラスから呼ばれている setter は、呼ぶ側の書き換え(findEncapsulationViolations)で数えるのでここでは数えない。
 */
export function findOpenSetters(codebase: Codebase): string[];
```

- `// ponytail: アクセサは1段だけたどる。アクセサがアクセサを呼ぶ題材を作るときに再帰にする` を残す

`score.ts`: `encapsulation` の件数を `findEncapsulationViolations(codebase).length + findOpenSetters(codebase).length` にする(ルールは増やさない。表示名「カプセル化の破れ」のまま)。
`fileScores.ts`: `findOpenSetters` のメソッドIDを `violatingTargetIds` に足す(setter のあるファイル)。

### TDD対象(段階A)

すべて Vitest・AAA でテストを先に書く。

- `isAccessorMethod`: 全部 `accessor: true` → true / 1つでも通常の処理 → false / `fragments: []` → false
- `accessorFieldAccess`: getter と setter を呼ぶ → reads・writes に分かれる / アクセサでないメソッド・存在しないID・`uses` なし → 空 / 同じ getter を2回指しても1つ
- `findFeatureEnvy`: B の getter を2つ呼ぶ(自分側0)→ Feature Envy / getter 1つ + 直接の読み取り1つ → 2つとして数える / getter 1つだけ → 空 / B のアクセサでないメソッドを呼ぶ → 空 / 自クラスの getter → 自分側
- `findEncapsulationViolations`: B の setter を呼ぶ → 1件(呼ぶ側のクラス)/ B の getter(private フィールド)を呼ぶ → 空 / setter と直接の `writes` で同じフィールド → 1件 / B が自分の setter を呼ぶ → 空 / B の子クラスが B の setter を呼ぶ → 空(自分側)
- `findOpenSetters`: 他クラスから呼ばれていない public の setter → そのID / private の setter → 空 / 他クラスから呼ばれている public の setter → 空(書き換えの側で数えるため)/ 自クラスからだけ呼ばれる public の setter → そのID / 他クラスから呼ばれていない protected の setter → そのID / 子クラスからだけ呼ばれる protected の setter → 空 / 他クラスから呼ばれていない public の getter → 空
- `scoreCodebase`: 公開された setter 1つで `encapsulation` -10 / アクセサのない既存のテスト用 Codebase の結果が変わらない
- `fileDeductions`: 公開された setter は setter のファイルに数え、合計が `scoreCodebase`(アクセス制御を除く)と一致する

### 受け入れ基準(段階A)

- `npm run check` が通り、既存テストの期待値を変えない

---

## B. 可視性の採点と操作(domain・データ)

### 共通ヘルパー(`src/domain/codebase/Codebase.ts`、domain)

```ts
/** クラス自身と、extends(superclassId)をたどった先祖のクラスID集合。輪になっていても訪問済みで止まる。 */
export function extendsChainIds(codebase: Codebase, classId: string): Set<string>;
```

`fieldAccess.ts` の `selfClassIds` をここへ移し、`fieldAccess.ts` はこれを使う(振る舞いは変えない。既存の `fieldAccess.test.ts` がそのまま通ること)。
`interfaceContracts.ts` の `extendsChainMethodNames` は今回触らない。

### protected の越境(`src/domain/scoring/visibility.ts`、domain)

- 今の「private のメソッドを自クラス以外の処理が呼ぶ」に、「protected のメソッドを、`extendsChainIds(呼ぶ側のクラス)` に持ち主が入らないクラスの処理が呼ぶ」を足す。重複の除き方・並びは同じ。違反に `kind: 'private' | 'protected'` を足す
- JSDoc を「private / protected のメソッドが、届かないクラスから呼ばれている箇所」に直し、設計判断 3-3 の ponytail コメントを残す
- `score.ts`・`fileScores.ts`: `visibilityEnforced` なら全件、そうでなければ `kind === 'protected'` だけを数える(ユーザー決定: protected の越境は全ステージ)

### ドメイン操作(新規 `src/domain/codebase/changeVisibility.ts`、domain)

```ts
export type ChangeVisibilityError = 'method-not-found' | 'same-visibility' | 'contract-method' | 'widening-not-needed' | 'narrowing-breaks-callers';

/**
 * メソッドの可視性を変える。元の Codebase は変更しない。
 * 中身のない(fragments: [])メソッドは変えない。広げる(private → protected → public の向き)ときは、
 * public なら持ち主以外のクラスから、protected なら持ち主の子孫クラスから呼ばれていることを求める。
 * 狭めるときは、狭めた後の可視性では届かない呼び出し元(持ち主以外 / 子孫以外)が1つもないことを求める。
 */
export function changeVisibility(codebase: Codebase, methodId: string, visibility: Visibility): Result<Codebase, ChangeVisibilityError>;
```

- 検査の順: 見つからない → 同じ可視性 → 中身なし → 広げる必要 / 狭めると届かない呼び出し元
- 呼び出し元のクラスは、全クラスの処理の `uses` にこのメソッドIDがあるクラス(持ち主を除く)
- `mapClasses` で対象のメソッドだけ `{ ...method, visibility }` にする

### ステージの型(`src/domain/stage/Stage.ts`、domain)

フィールドは足さない。`visibilityEnforced` の JSDoc を次の意味に直す:
「private / protected のメソッドが届かないクラスから呼ばれていないかを採点するかどうか(protected は持ち主と子孫クラスから呼べる)。省略時は false。
越境は、呼ばれる側を public にしても消える(可視性の操作は全ステージで使える)。Move Method で直させたいステージは、依存の上限など別の採点で public にするだけでは100点にならないようにする(中級3は `dependencyLimit: 0`)」

### ユースケース(`src/application/RefactorUseCases.ts`、application)

```ts
/** 同じ可視性を選んだときは何もしない操作として成功扱いにする。 */
export function changeVisibilityUseCase(codebase: Codebase, methodId: string, visibility: Visibility): Result<Codebase, Exclude<ChangeVisibilityError, 'same-visibility'>>;
export function describeChangeVisibilityError(error: Exclude<ChangeVisibilityError, 'same-visibility'>): string;
```

文言:

- `method-not-found`「メソッドが見つかりません」
- `contract-method`「中身のないメソッド(インターフェースの約束)の可視性は変えられません」
- `widening-not-needed`「public は他のクラスから、protected は子クラスから呼ばれているメソッドにだけ選べます」

### 模範解答の手(`src/domain/stage/sampleAnswer.ts`、domain)

```ts
| { readonly changeVisibility: { readonly method: string; readonly class: string; readonly visibility: Visibility } }
```

`applyStep` で `moveField` の次に扱い、`StructuralStep` の `Exclude` に足す。`class` は必須(同名メソッドがありうるため)。

### 中級3のデータ(`src/infrastructure/stages/intermediateStages.ts`)

- `misplacedPrivateStage` の `dependencyLimit` を 2 → **0** にする
- goal の末尾に「NotificationService だけで通知を組み立てられるようにしよう(依存先は0クラス)」を足す。定義の冒頭コメントに「public にするだけでは依存が残るよう、依存先の上限を0にしている」を足す
- 点数(実測で直す): 初期 **70点**(行数 `notifyShipment` 82行 > 50・アクセス制御1・結合度1)。模範解答のあと100点(`NotificationService` は4種類 ≤ 4、依存0)。移したあと・ファイル削除前は90点(空のクラス・ファイル)で今の E2E と同じ
- `e2e/refactor.spec.ts` の「越境した private メソッドの呼び出しは減点され、…」の初期点の期待値を `80点` → `70点` に直し、`結合度 -10` の期待を足す(それ以外は変えない)

### `stageCatalog.test.ts` の `shortcuts` に足すもの(段階B)

1. 中級3「`sendMail`・`logDelivery` を抽出し、`renderTemplate` を public にするだけ」→ 結合度 -10 で80点
2. 上級6「契約メソッド `createTask`・`completeTask` を `IncidentService` へ移し、Slack・Teams の空実装を消す」の既存の近道はそのまま(移した契約メソッドは中身がないので private にできないことは `changeVisibility` のテストで守る)

### TDD対象(段階B)

- `extendsChainIds`: 自分だけ / 2段の先祖 / 輪になったデータで止まる(`fieldAccess.test.ts` が通ることも確認)
- `findVisibilityViolations`:
  - 継承関係のない別クラスから protected を呼ぶ → 1件(**既存のテスト「protected メソッドを別クラスから呼ぶのは違反にしない」を書き換える**)
  - 子クラスから親の protected を呼ぶ → 空 / 孫クラスから祖父の protected を呼ぶ → 空
  - 親から子の protected を呼ぶ → 1件
  - `implements` しているだけのクラスから protected を呼ぶ → 1件
  - private の既存のケースは変わらない
- `changeVisibility`:
  - private → public(他クラスから呼ばれている)→ 変わる / private → public(自クラスからしか呼ばれていない)→ `widening-not-needed` / 誰からも呼ばれていない private → public・protected とも `widening-not-needed`
  - private → protected(子クラスから呼ばれている)→ 変わる / private → protected(無関係なクラスからだけ呼ばれている)→ `widening-not-needed`
  - protected → public(子クラスから呼ばれている)→ 変わる
  - public → private・public → protected・protected → private(呼び出し元の有無によらず)→ 変わる
  - 同じ可視性 → `same-visibility` / 存在しないID → `method-not-found`
  - インターフェース役のクラスの契約メソッド → `contract-method` / インターフェース役でないクラスに移された中身のないメソッド → `contract-method`
  - 空実装(`stub`、中身はある)→ 変えられる
  - 元の Codebase を変更しない
- `changeVisibilityUseCase`: 同じ可視性は `ok` でそのまま / それ以外のエラーはそのまま返す
- `applySolutionSteps`: `changeVisibility` で指定クラスのメソッドだけが変わる(別クラスの同名メソッドは変わらない)
- `scoreCodebase`(`visibilityEnforced: true`): 他クラスから呼ばれているメソッドを private にすると `visibility` が1件増える / `setSuperclass` で protected に昇格したメソッドを無関係なクラスも呼んでいると1件残る(設計判断 3-4)

### 受け入れ基準(段階B)

- `npm run check` と `npm run test:e2e` が通る
- 既存テストの期待値の変更は、`visibility.test.ts` の protected のケースと、E2E の中級3の初期点だけ
- 中級3で `stageCatalog.test.ts` の共通テスト(初期は100点未満・模範解答100点・変更容易性)が通る

---

## C. 可視性の操作の画面(presentation)

| 場所 | 変更 |
| --- | --- |
| `presentation/store/useGameStore.ts` | `changeVisibility(methodId, visibility)`。`apply` を通して履歴に積む(Ctrl+Z / 取り消し・やり直しで戻せる)。エラーは既存の操作と同じ出し方で `describeChangeVisibilityError` の文言を出す |
| `presentation/editor/MethodEditor.tsx` `MethodActions` | **中身のあるメソッド(`fragments.length > 0`)なら全ステージ・白紙設計で**、`<label>可視性 <select>` を出す。選択肢は public / protected / private の順。今の値以外で `changeVisibility(codebase, method.id, v).ok` でない選択肢は `disabled`(`useMemo` で codebase が変わったときだけ計算する)。下に「public は他のクラスから、protected は子クラスから呼ばれているときだけ選べます」と1行出す。`aria-label` は「メソッド {name} の可視性」。ネイティブの `select` なので、矢印キーで選べ、`disabled` の選択肢は飛ばされる。既存の「呼び出し元へ戻す」(private のときだけ)は今のまま |
| `presentation/stage/describeSolutionStep.ts` | `changeVisibility`:「{class} の {method} を、メソッドエディタの「可視性」で {visibility} にしよう」 |

キャンバスの右クリックメニューはファイル・クラス向けで、メソッドの操作(抽出・呼び出し元へ戻す・空実装の削除)はメソッドエディタに集まっているので、そちらに合わせる。
メソッドのチップの可視性の記号(`+ # -`)は既存の表示のまま変わる。

### E2E(`e2e/refactor.spec.ts`)

1. 「中級3: renderTemplate を public にするとアクセス制御の減点は消えるが、依存が残るので満点にならない」
   - `score` に「70点」「アクセス制御 -10」「結合度 -10」
   - `renderTemplate` をクリック → 「メソッド renderTemplate の可視性」の `select` があり、`protected` の選択肢が `disabled`
   - `select` に**キーボードで**フォーカスし、`ArrowUp` で public にする(`disabled` の protected を飛ばす)→ `score` から「アクセス制御」が消え、「結合度 -10」は残り、100点ではない
   - `select` からフォーカスを外して(前提13)Ctrl+Z → 「アクセス制御 -10」が戻る
   - (矢印キーで閉じた `select` の値が変わらない環境で落ちる場合は、`selectOption` で値を変え、キーボードでフォーカスできることだけを別に確かめる形に直してよい。直したら仕様書にも書く)
2. 「中身のないメソッドには可視性の選択が出ない」: 上級6で `CollaborationTool` の `postMessage` をクリック → 「可視性」の `select` がない

### 受け入れ基準(段階C)

- `npm run check` と `npm run test:e2e` が通る
- 既存の E2E(白紙設計 `e2e/blank.spec.ts` を含む)が、メソッドエディタに選択欄が増えても変更なしで通る

---

## D. 中級7「getter/setter だけの口座クラス」(貧血ドメインモデル)

### ステージ(`src/infrastructure/stages/intermediateStages.ts` の `intermediateStages` の末尾)

- id: `intermediate-anemic-domain-model`、level: `'intermediate'`、title: `中級7: getter/setter だけの口座クラス`
- 定義の冒頭コメント: 中級6は public フィールドを外から触る形、中級7は private フィールド + getter/setter 越しに同じことをしている形。アクセサ越しのアクセスも数える。`visibilityEnforced` で、移したメソッドを public にする必要を見せる
- description:
  「ネット銀行の口座(Account)。フィールドはすべて private で、getBalance / setBalance のような getter と setter が並んでいるので、一見カプセル化できているように見える。
  しかし、凍結中かどうかの確認も、残高と1日の引き出し上限のチェックも、残高の更新も、すべて AccountService が getter で値を取り出して判断し、setter で書き戻している。」
- goal:
  「getter で取り出して判断し、setter で書き戻すのは、public フィールドを外から触るのと同じ。口座のルールは Account に任せよう(Tell, Don't Ask)。
  ルールの処理を Extract Method して Account へ移し、外から呼ぶメソッドは public に、もう外から使わない setter は private にしよう(メソッドエディタの「可視性」)。
  メソッドは60行以内、依存先は1クラスまで」
- `limits: { method: 60, class: 150, file: 300 }`、`dependencyLimit: 1`、`responsibilityLimit: 5`(決定済み)、**`visibilityEnforced: true`**
  - `responsibilityLimit: 5` は、主題(ルールの置き場所)を責務の混在で二重に減点しないため。近道4(メソッドごと移す)は6種類で超える

### 初期コード

| ファイル | クラス | フィールド | メソッド | 処理(行数, responsibility, 読む / 書く / 呼ぶ) |
| --- | --- | --- | --- | --- |
| `src/account/Account.ts` | `Account` | `balance`・`status`・`dailyWithdrawn`(すべて private) | `getBalance`・`setBalance`・`getStatus`・`getDailyWithdrawn`・`setDailyWithdrawn`(すべて public) | 各1処理(3行, `accessor`、**`accessor: true`**)。get は対応するフィールドを読む、set は書く |
| `src/account/AccountService.ts` | `AccountService` | `transactionLog`・`notifier`(private) | `withdraw`(public, 80行) | getStatus() で状態を取り出し、凍結されていないか確かめる(8, `account-status`, 呼ぶ: getStatus)<br>残高と1日の引き出し上限から引き出せるか確かめる(18, `withdrawal-limit`, 呼ぶ: getBalance・getDailyWithdrawn)<br>残高を減らし、本日の引き出し額を足して setter で書き戻す(8, `balance`, 呼ぶ: getBalance・setBalance・getDailyWithdrawn・setDailyWithdrawn)<br>取引履歴に記録する(24, `history`, 読む: transactionLog)<br>引き出し後の残高をメールで知らせる(22, `notification`, 読む: notifier, 呼ぶ: getBalance) |
| | | | `deposit`(public, 34行) | getStatus() で状態を取り出し、凍結されていないか確かめる(8, `account-status`, 呼ぶ: getStatus)<br>残高を増やして setBalance() で書き戻す(6, `balance`, 呼ぶ: getBalance・setBalance)<br>取引履歴に記録する(20, `history`, 読む: transactionLog) |

- Fragment ID: `frag-withdraw-check-status` / `frag-check-withdrawable` / `frag-debit-balance` / `frag-withdraw-log` / `frag-withdraw-notify` /
  `frag-deposit-check-status` / `frag-credit-balance` / `frag-deposit-log`、アクセサは `frag-get-balance` など。フィールドは `field-…`、メソッドは `method-…`
- `suggestedName` は `checkNotFrozen` / `checkWithdrawable` / `debitBalance` / `logWithdrawal` / `notifyWithdrawal` / `checkNotFrozenForDeposit` / `creditBalance` / `logDeposit`
- ラベルに getter/setter の名前を書く(`uses` は画面に出ないため)

### 初期の減点(手計算。実測で確かめ、違えば表を直す)

| ルール | 段階D時点 | E 適用後 | 内容 |
| --- | --- | --- | --- |
| 行数 | 1 | 1 | `withdraw` 80行 > 60 |
| Feature Envy | 2 | 2 | `withdraw`(Account 3、自分側2)/ `deposit`(Account 2、自分側1) |
| カプセル化の破れ | 2 | 2 | setter 越しに `balance`・`dailyWithdrawn` を書き換え(setter は外から呼ばれているので「公開された setter」には数えない) |
| 凝集度 | — | 1 | `Account` が balance(get/set)・status(get)・dailyWithdrawn(get/set)の3塊。`AccountService` は transactionLog でつながり1塊 |
| 責務の混在・アクセス制御・その他 | 0 | 0 | `AccountService` 5種類 ≤ 5。private / protected の越境なし |
| **合計** | **50点** | **40点** | |

### 変更依頼(2件とも modify)

| id | title / description | responsibility | linesPerSite | partName |
| --- | --- | --- | --- | --- |
| `req-premium-daily-limit` | 「プレミアム会員は1日の引き出し上限を上げて」/ プレミアム会員だけ、1日に引き出せる上限額を100万円にしたい | `withdrawal-limit` | 6 | `raisePremiumDailyLimit` |
| `req-deposit-while-frozen` | 「凍結中でも入金だけは受け付けて」/ 口座が凍結されていても、入金(給与の振込など)は受け付けるようにしたい | `account-status` | 4 | `allowDepositWhileFrozen` |

期待値(手計算。実測で表を直す):

| 依頼 | 初期 | 模範解答のあと |
| --- | --- | --- |
| `req-premium-daily-limit` | `withdraw` 1か所。巻き込み4 -20、上限超え(86行)-10 → 70点 | `Account.debit` 1か所。巻き込み2 -10、波及(`AccountService`)-5 → 85点 |
| `req-deposit-while-frozen` | `withdraw`・`deposit`(同じクラス)。巻き込み4+2 -30、上限超え -10 → 60点 | `debit`・`credit`。巻き込み2+1 -15、波及 -5 → 80点 |

変更容易性スコア 65 → 83。`classesTouched` [1, 1] → [1, 1]。

### 模範解答(`sampleAnswerSteps['intermediate-anemic-domain-model']`)

```ts
[
  { extract: { from: 'withdraw', fragmentIds: ['frag-withdraw-check-status', 'frag-check-withdrawable', 'frag-debit-balance'], name: 'debit' } },
  { move: { method: 'debit', toClass: 'Account' } },
  { changeVisibility: { method: 'debit', class: 'Account', visibility: 'public' } },
  { extract: { from: 'deposit', fragmentIds: ['frag-deposit-check-status', 'frag-credit-balance'], name: 'credit' } },
  { move: { method: 'credit', toClass: 'Account' } },
  { changeVisibility: { method: 'credit', class: 'Account', visibility: 'public' } },
  { changeVisibility: { method: 'setBalance', class: 'Account', visibility: 'private' } },
  { changeVisibility: { method: 'setDailyWithdrawn', class: 'Account', visibility: 'private' } },
]
```

完成形: `AccountService`(withdraw 47行・deposit 21行。責務 history・notification)→ `Account`(getter 3つ public・setter 2つ private・debit 34行・credit 14行 public。責務4種類)。
`debit`・`credit` がアクセサを呼ぶので `Account` の3つのフィールドは1塊になる(ルールを入れるとデータがつながる)。
`withdraw` に残る「残高をメールで知らせる」は getter を1つ呼ぶだけなので減点されない。100点。

2手目のあと(`debit` を移した直後)はアクセス制御の違反が出て、3手目で消える。7・8手目の前は「カプセル化の破れ -20」(公開された setter)が残る。これがこのステージの見せ場。
3手目は、`debit` を移す前(1手目のあと)には選べない(他クラスから呼ばれていないため。設計判断 3-1)。

### ヒント

既存の `HintPanel` をそのまま使う。8手。可視性の手は `describeSolutionStep` の新しい文になる。

### `stageCatalog.test.ts` の `shortcuts` に足すもの(どれも100点未満)

1. `debit`・`credit` を抽出するが `AccountService` に残す → Feature Envy 2・カプセル化 2・凝集度
2. 残高の更新だけを抽出して `Account` へ移し(public にし)、チェックはサービスに残す → `withdraw` 73行・Feature Envy
3. getter/setter 5つを `AccountService` へ移す → `Account` の private フィールドを直接読み書きしてカプセル化の破れ
4. `withdraw`・`deposit` をメソッドごと `Account` へ移す → 行数・責務(6種類)・`AccountService` の private フィールドの読み取り
5. 模範解答から setter を private にする2手を抜く → 公開された setter 2件(カプセル化の破れ -20)
6. 模範解答から `debit`・`credit` を public にする2手を抜く → アクセス制御 2件

「何も移さず setter を private にする」「setter を protected にする」「`debit` を `AccountService` に残して public にする」は操作が失敗するので近道の一覧には入れず、`changeVisibility` のテスト(段階B)で守る。

### ステージのテスト(新規 `src/infrastructure/stages/anemicDomainModelStage.test.ts`)

- 初期状態の減点が上の表どおり(段階Dでは「段階D時点」の列、段階Eで「E 適用後」の列に更新)。Feature Envy 2・カプセル化 2 が**アクセサ越しだけ**で出ていること
- 模範解答の2手目のあとに `visibility` が1件、3手目で0件
- 模範解答の1手目のあとに `debit` を public にしようとすると `widening-not-needed`
- 模範解答のあと: `withdraw` は Feature Envy にならない。`AccountService` の依存先は `Account` だけ。`setBalance`・`setDailyWithdrawn` が private
- 変更依頼2件の `classesTouched` と点数が上の表どおり

### 画面(`src/presentation/editor/MethodEditor.tsx`)

`FragmentFieldRefs` に、`accessorFieldAccess` の結果を別の行で出す:「getter 経由で読む: Account.balance, Account.status」「setter 経由で書く: Account.balance」。既存の `fieldRefText` を使い、文字で出す。

### E2E(`e2e/refactor.spec.ts`)

中級7を開くヘルパーを足す。

1. 「中級7: setter 越しの書き換えが見え、ルールを移して可視性を直すと減点が消える」
   - `score` に「カプセル化の破れ -20」
   - `withdraw` をクリック → メソッドエディタに「setter 経由で書く: Account.balance」
   - 3つの処理を選んで `debit` として抽出 → `debit` を `class-Account` へドラッグ → `score` に「アクセス制御」
   - `debit` をクリック → 「メソッド debit の可視性」の `select` を**キーボードで**public にする → 「アクセス制御」が消える
   - `credit` も同じように抽出・移動・public にし、`setBalance`・`setDailyWithdrawn` を private にする → `score` から「カプセル化の破れ」が消える

### 受け入れ基準(段階D)

- `npm run check` と `npm run test:e2e` が通る
- 中級7で `stageCatalog.test.ts` の共通テストが通り、追加した近道6件が100点未満
- 解答例の図(`sampleAnswerCodebase`)が中級7でも例外なく作れ、setter が `-` で表示される

---

## E. 凝集度ルール(全ステージ)

### 判定関数(新規 `src/domain/scoring/cohesion.ts`、domain)

```ts
export type LowCohesion = {
  readonly classId: string;
  /** 塊ごとの、触られている自クラスのフィールドID(宣言順)。塊の並びは、塊の中で最初に宣言されたフィールドの順。 */
  readonly fieldGroups: readonly (readonly string[])[];
};

/** 自クラスのフィールドを触るメソッドの塊(フィールド共有・自クラス内の呼び出しでつながる連結成分)が2つ以上あるクラスを、出現順に返す。 */
export function findLowCohesionClasses(codebase: Codebase): LowCohesion[];
```

- 定義は「設計判断 4」のとおり。関数は60行・循環的複雑度12・ネスト4段以内(クラス1つぶんの計算を関数に分ける)

### 採点

- `score.ts`: `ScoreRule` に `'cohesion'` を足す(`'encapsulation'` の後ろ)。**フラグなしで全ステージ**。1件 -10。JSDoc の列挙に足す
- `fileScores.ts`: `classId` を `violatingTargetIds` に足す
- `describeScore.ts`: `cohesion: '無関係なデータの塊が同居(凝集度が低い)'`

### 中級6のデータ修正(`intermediateStages.ts`)

「既存ステージへの影響」の「中級6のデータ修正」のとおり。

### TDD対象(段階E)

#### `findLowCohesionClasses`

- メソッド A がフィールド x、B が y だけを触る → `[{ classId, fieldGroups: [[x], [y]] }]`
- A が x・y、B が y → 空
- A が x、B が y、A が B を呼ぶ → 空 / B が A を呼ぶ向きでも空
- A が x、B が y、C(フィールドを触らない)が A と B を呼ぶ → 空
- A が x、B が y、C がどのフィールドも触らず誰も呼ばない → 塊は2つ
- getter/setter だけのクラス(x の get/set、y の get)→ 2塊。業務メソッドが両方のアクセサを呼ぶと1塊
- 契約メソッドだけのインターフェース役・空実装だけのクラス → 空
- フィールドを持たないクラス(`sampleCodebase()`)→ 空
- 他クラスのフィールドだけを触るメソッドは、どの塊にも入らない
- 継承元のフィールドを触るメソッドは、自クラスのフィールドを触ったことにならない
- どのメソッドも触らないフィールドは `fieldGroups` に出ない
- Extract Method の前後で結果が変わらない / 可視性を変えても結果が変わらない

#### `scoreCodebase` / `fileDeductions`

- 塊が2つのクラス1つで `cohesion` -10。内訳の並びの期待値を13ルールに更新
- `fileDeductions`: クラスのファイルに数え、合計が `scoreCodebase` の減点の合計(アクセス制御を除く)と一致する

#### ステージ

- `featureEnvyStage.test.ts` に足す: 模範解答のあとの `Subscription` は `findLowCohesionClasses` で空。初期状態は40点のまま
- `anemicDomainModelStage.test.ts` の初期点を「E 適用後」の列(40点)に更新

### 受け入れ基準(段階E)

- `npm run check` と `npm run test:e2e` が通る
- 「既存ステージへの影響」の表のとおり、`score.test.ts` の内訳の配列と中級7の初期点の更新以外に、既存テストの期待値の変更がない

---

## F. 中級8「給与と住所を抱えた社員クラス」(Extract Class)

### ステージ(`intermediateStages` の末尾、中級7の後ろ)

- id: `intermediate-extract-class`、level: `'intermediate'`、title: `中級8: 給与と住所を抱えた社員クラス`
- 定義の冒頭コメント: 中級6・7はデータの持ち主へ処理を寄せる話、中級8は1クラスの中のデータの塊ごとにクラスを分ける話。責務の混在で二重に減点しないよう `responsibilityLimit` を4にしている
- description:
  「人事システムの社員(Employee)クラス。基本給・残業単価・振込口座を使う給与計算のメソッドと、郵便番号・都道府県・番地を使う住所のメソッドが同居している。
  給与のメソッドは住所のフィールドを一切使わず、住所のメソッドも給与のフィールドを一切使わない。住所の書式を直すたびに、給与計算の入った大きなクラスを開くことになっている。」
- goal:
  「メソッドがどのフィールドを使っているかを見て、一緒に使われるフィールドとメソッドの塊ごとにクラスを分けよう(Extract Class)。
  新しいクラスを作り、フィールドは Move Field、メソッドは Move Method で移す。メソッドは60行・クラスは120行以内」
- `limits: { method: 60, class: 120, file: 300 }`、`dependencyLimit: 1`、`responsibilityLimit: 4`

### 初期コード

| ファイル | クラス | フィールド | メソッド | 処理(行数, responsibility, 読む / 書く) |
| --- | --- | --- | --- | --- |
| `src/hr/Employee.ts` | `Employee` | `baseSalary`・`overtimeRate`・`bankAccount`・`postalCode`・`prefecture`・`addressLine`(すべて private) | `calculateMonthlyPay`(public, 82行) | 残業時間と残業単価から残業代を計算する(26, `payroll`, 読む: baseSalary・overtimeRate)<br>所得税と社会保険料を差し引く(32, `withholding`, 読む: baseSalary)<br>給与の振込データを作る(24, `transfer`, 読む: bankAccount) |
| | | | `formatMailingAddress`(public, 22行) | 郵便番号・都道府県・番地を宛名ラベルの形に整える(22, `address`, 読む: postalCode・prefecture・addressLine) |
| | | | `changeAddress`(public, 20行) | 郵便番号の形式を確かめる(12, `address`, 読む: postalCode)<br>住所を書き換える(8, `address`, 書く: postalCode・prefecture・addressLine) |

- Fragment ID: `frag-overtime-pay` / `frag-withholding` / `frag-pay-transfer` / `frag-format-address` / `frag-validate-postal-code` / `frag-update-address`
- `suggestedName`: `calculateOvertimePay` / `withholdTaxes` / `buildTransferData` / `formatLabel` / `validatePostalCode` / `updateAddress`

初期の減点(手計算。実測で確かめる): **70点**

| ルール | 件数 | 内容 |
| --- | --- | --- |
| 行数 | 2 | `calculateMonthlyPay` 82行 > 60、`Employee` 124行 > 120 |
| 凝集度 | 1 | 給与の塊(baseSalary・overtimeRate・bankAccount)と住所の塊(postalCode・prefecture・addressLine) |
| 責務の混在 | 0 | 4種類 ≤ 4(二重減点しない設定) |

### 変更依頼(2件とも modify)

| id | title / description | responsibility | linesPerSite | partName |
| --- | --- | --- | --- | --- |
| `req-building-name` | 「住所に建物名・部屋番号の欄を足して」/ 源泉徴収票の郵送が届かないことがあるので、建物名と部屋番号も持てるようにしたい | `address` | 6 | `addBuildingName` |
| `req-late-night-overtime` | 「深夜残業の割増率を上げて」/ 22時以降の残業は、割増率を50%で計算したい | `payroll` | 8 | `applyLateNightPremium` |

| 依頼 | 初期 | 模範解答のあと |
| --- | --- | --- |
| `req-building-name` | 2メソッド(同じクラス)。上限超え(`Employee` 136行)-10 → 90点 | `Address` の2メソッド → 100点 |
| `req-late-night-overtime` | 巻き込み2 -10、上限超え(メソッド90行・クラス132行)-20 → 70点 | 巻き込み1 -5 → 95点 |

変更容易性スコア 80 → 98。`classesTouched` [1, 1] → [1, 1]。

### 模範解答(`sampleAnswerSteps['intermediate-extract-class']`)

```ts
[
  { extract: { from: 'calculateMonthlyPay', fragmentIds: ['frag-withholding'], name: 'withholdTaxes' } },
  { addFile: 'src/hr/Address.ts' },
  { addClass: { name: 'Address', file: 'src/hr/Address.ts' } },
  { moveField: { field: 'postalCode', fromClass: 'Employee', toClass: 'Address' } },
  { moveField: { field: 'prefecture', fromClass: 'Employee', toClass: 'Address' } },
  { moveField: { field: 'addressLine', fromClass: 'Employee', toClass: 'Address' } },
  { move: { method: 'formatMailingAddress', toClass: 'Address' } },
  { move: { method: 'changeAddress', toClass: 'Address' } },
]
```

完成形: `Employee`(給与の3フィールド。calculateMonthlyPay 51行・withholdTaxes 32行、83行)と `Address`(3フィールド・2メソッド、42行)。どちらも1塊で100点。
給与の側を新しいクラスへ出して `Employee` に住所を残しても100点になる(正解は1つではない)。中級8は `visibilityEnforced` を立てないので、可視性の操作は点に効かない。

### ヒント

既存の `HintPanel` をそのまま使う。8手。

### `stageCatalog.test.ts` の `shortcuts` に足すもの(どれも100点未満)

1. `withholdTaxes` を抽出するだけ → 凝集度・`Employee` 125行
2. 違う切り口で分ける: `withholdTaxes` と `buildTransferData` を抽出し、新しいクラス `PayTransfer` に `bankAccount` と `buildTransferData` を移す → 行数は上限内だが、`Employee` に給与と住所の2塊が残り凝集度 -10(**凝集度でしか捕まらない近道**)
3. `Address` を作ってメソッドだけ移し、フィールドは残す → Feature Envy 2・カプセル化の破れ
4. `Address` を作ってフィールドだけ移し、メソッドは残す → Feature Envy 2・カプセル化の破れ

### ステージのテスト(新規 `src/infrastructure/stages/extractClassStage.test.ts`)

- 初期状態の減点が上の表どおりで70点。`fieldGroups` が給与3つ・住所3つの2組
- 模範解答の1手目(抽出)のあとも凝集度の件数が変わらない
- 模範解答のあと、`Employee` と `Address` はどちらも1塊
- 近道2で、減点が凝集度の1件だけ(90点)
- 変更依頼2件の `classesTouched` と点数が上の表どおり

### E2E(`e2e/refactor.spec.ts`)

1. 「中級8: 住所のフィールドとメソッドを新しいクラスへ移すと、凝集度の減点が消える」
   - `score` に「無関係なデータの塊が同居(凝集度が低い) -10」
   - 右クリックのメニューで `src/hr/Employee.ts` に `Address` クラスを追加
   - 住所の3フィールドと2メソッドを `class-Address` へドラッグ → `score` から凝集度の行が消える

### 受け入れ基準(段階F)

- `npm run check` と `npm run test:e2e` が通る
- 中級8で `stageCatalog.test.ts` の共通テストが通り、追加した近道4件が100点未満

---

## G. 上級7「金額と通貨を Money にまとめる」(Primitive Obsession → Value Object)

新しいルール・操作は使わない。ステージのデータ・模範解答・テストだけを足す。

### ステージ(`src/infrastructure/stages/advancedStages.ts` の配列の末尾)

- id: `advanced-value-object`、level: `'advanced'`、title: `上級7: 金額と通貨を Money にまとめる`
- 定義の冒頭コメント: 上級4と中級8の組み合わせ。重複は各グループ2か所まで。不変性は採点しない(`amount`・`currency` への `writes` を置かない)。「`Expense` が `Money` を持つ」は図に出ない
- description:
  「経費精算システム。外貨の経費に対応したとき、経費(Expense)の金額を amount(数値)と currency(通貨コードの文字列)のまま持たせた。
  その結果、申請(ExpenseApplicationService)・承認(ApprovalService)・精算(PayoutService)の3つのサービスが、
  「金額が0より大きく対応している通貨か」「同じ通貨どうしで合計する」「通貨ごとの小数桁で表示する」を、それぞれコピペで持っている。」
- goal:
  「金額と通貨をひとまとまりの値(Money)として扱おう。コピペされた処理は抽出して統合(Merge Methods)し、amount・currency と一緒に新しい Money クラスへ移す。
  Money は自分で自分を検証し、足し算や表示も自分でする(値オブジェクト)。Expense に直接入れるのではなく、別のクラスにしよう。メソッドは50行・クラスは65行以内、1クラスの責務は3種類まで、依存先は2クラスまで」
- `limits: { method: 50, class: 65, file: 300 }`、`dependencyLimit: 2`、`responsibilityLimit: 3`

### 初期コード

| ファイル | クラス | フィールド | メソッド | 処理(行数, responsibility, 読む / 書く / 呼ぶ, duplicateGroup) |
| --- | --- | --- | --- | --- |
| `src/expense/Expense.ts` | `Expense` | `amount`・`currency`・`category`・`status`(すべて public) | `submit`(public) | 勘定科目が決まっているか確かめ、状態を提出済みにする(8, `workflow`, 読む: category, 書く: status) |
| | | | `isReceiptRequired`(public) | 勘定科目から領収書が必要か判定する(10, `category-rule`, 読む: category) |
| `src/expense/ExpenseApplicationService.ts` | `ExpenseApplicationService` | なし | `submitExpense`(public, 82行) | 日付・勘定科目・領収書の有無を確かめる(22, `application`, 呼ぶ: isReceiptRequired)<br>金額が0より大きく、対応している通貨か確かめる(18, `money-validation`, 読む: amount・currency, `money-validate`)<br>通貨ごとの小数桁で金額を表示用に整える(16, `money-format`, 読む: amount・currency, `money-format`)<br>申請を提出し、上長へ承認依頼を送る(26, `approval-request`, 呼ぶ: submit) |
| `src/expense/ApprovalService.ts` | `ApprovalService` | なし | `approveMonthlyExpenses`(public, 50行) | 部署ごとに今月の申請を集める(12, `aggregation`)<br>金額が0より大きく、対応している通貨か確かめる(18, `money-validation`, 読む: amount・currency, `money-validate`)<br>同じ通貨どうしで金額を合計し、新しい金額として返す(20, `money-arithmetic`, 読む: amount・currency, `money-sum`) |
| `src/expense/PayoutService.ts` | `PayoutService` | なし | `payOut`(public, 50行) | 同じ通貨どうしで金額を合計し、新しい金額として返す(20, `money-arithmetic`, 読む: amount・currency, `money-sum`)<br>通貨ごとの小数桁で金額を表示用に整える(16, `money-format`, 読む: amount・currency, `money-format`)<br>振込データを作って銀行へ送る(14, `transfer`) |

- `Expense.submit` が `category` も読むのは、凝集度の全ステージ化のため(`submit` と `isReceiptRequired` が category でつながり、模範解答のあとの `Expense` が1塊になる)。読まないと `Expense` が2塊に分かれ、模範解答が90点になる
- 重複グループ3つ(`money-validate`・`money-sum`・`money-format`)はどれも2か所だけで、同じグループの2つは行数も同じ
- Fragment ID: `frag-apply-check-form` / `frag-apply-validate-money` / `frag-apply-format-money` / `frag-apply-request-approval` /
  `frag-approve-collect` / `frag-approve-validate-money` / `frag-approve-sum-money` / `frag-payout-sum-money` / `frag-payout-format-money` / `frag-payout-transfer` /
  `frag-submit-expense` / `frag-receipt-required`

初期の減点(手計算。実測で確かめる): **40点**

| ルール | 件数 | 内容 |
| --- | --- | --- |
| 行数 | 2 | `submitExpense` 82行 > 50、`ExpenseApplicationService` 82行 > 65 |
| 責務の混在 | 1 | `ExpenseApplicationService` 4種類 > 3 |
| Feature Envy | 3 | 3つのサービスのメソッドが `Expense` の amount・currency を触り、自分側は0 |
| 凝集度 | 0 | `Expense` は `submit`・`isReceiptRequired` が category でつながり1塊(amount・currency は `Expense` のメソッドが触らないので数えない)。サービスはフィールドなし |

### 変更依頼(2件とも modify)

| id | title / description | responsibility | linesPerSite | partName |
| --- | --- | --- | --- | --- |
| `req-accept-euro` | 「ユーロ建ての経費も申請できるようにして」/ 海外出張が増えたので、対応通貨にユーロ(EUR)を足したい | `money-validation` | 4 | `acceptEuro` |
| `req-hide-yen-decimals` | 「円は小数点以下を表示しないで」/ 円の金額は「1,200円」のように小数点以下を出さずに表示したい | `money-format` | 6 | `hideYenDecimals` |

| 依頼 | 初期 | 模範解答のあと |
| --- | --- | --- |
| `req-accept-euro` | 2クラス。散らばり -10、巻き込み3+2 -25、上限超え3 -30 → 35点 | `Money.validate` 1か所。波及(3サービス)-15 → 85点 |
| `req-hide-yen-decimals` | 2クラス。散らばり -10、巻き込み3+2 -25、上限超え3 -30 → 35点 | `Money.format` 1か所(`Money` 60行 ≤ 65)。波及 -15 → 85点 |

変更容易性スコア 35 → 85。`classesTouched` [2, 2] → [1, 1]。

### 模範解答(`sampleAnswerSteps['advanced-value-object']`)

```ts
[
  { extract: { from: 'submitExpense', fragmentIds: ['frag-apply-validate-money'], name: 'validateMoney' } },
  { extract: { from: 'submitExpense', fragmentIds: ['frag-apply-format-money'], name: 'formatMoney' } },
  { extract: { from: 'approveMonthlyExpenses', fragmentIds: ['frag-approve-validate-money'], name: 'validateMoney' } },
  { extract: { from: 'approveMonthlyExpenses', fragmentIds: ['frag-approve-sum-money'], name: 'sumMoney' } },
  { extract: { from: 'payOut', fragmentIds: ['frag-payout-sum-money'], name: 'sumMoney' } },
  { extract: { from: 'payOut', fragmentIds: ['frag-payout-format-money'], name: 'formatMoney' } },
  { merge: { methodA: 'validateMoney', methodAClass: 'ExpenseApplicationService', methodB: 'validateMoney', methodBClass: 'ApprovalService', name: 'validate' } },
  { merge: { methodA: 'sumMoney', methodAClass: 'ApprovalService', methodB: 'sumMoney', methodBClass: 'PayoutService', name: 'add' } },
  { merge: { methodA: 'formatMoney', methodAClass: 'ExpenseApplicationService', methodB: 'formatMoney', methodBClass: 'PayoutService', name: 'format' } },
  { addFile: 'src/expense/Money.ts' },
  { addClass: { name: 'Money', file: 'src/expense/Money.ts' } },
  { moveField: { field: 'amount', fromClass: 'Expense', toClass: 'Money' } },
  { moveField: { field: 'currency', fromClass: 'Expense', toClass: 'Money' } },
  { move: { method: 'validate', toClass: 'Money' } },
  { move: { method: 'add', toClass: 'Money' } },
  { move: { method: 'format', toClass: 'Money' } },
]
```

完成形: `Money`(amount・currency。validate 18・add 20・format 16 の54行。責務3種類・1塊)。
`ExpenseApplicationService`(submitExpense 50行、依存 `Expense`・`Money`)、`ApprovalService`(14行)、`PayoutService`(16行)、`Expense`(category・status、1塊)。100点。
統合したメソッドは private のまま `Money` へ移り、サービスから呼ばれる。上級7は `visibilityEnforced` を立てないので上級4と同じく減点しない。
プレイヤーが `Money` のメソッドを public にしても点は変わらない(他クラスから呼ばれているので選べる)。ただし統合の前に public にすると Merge Methods が使えなくなる(下がる方向)。

### ヒント

既存の `HintPanel` をそのまま使う。16手。

### `stageCatalog.test.ts` の `shortcuts` に足すもの(どれも100点未満)

1. 統合せずに6つとも `Money` へ移す(抽出名はクラスごとに変える)→ `Money` 108行 > 65
2. `validate` の1組だけ統合し、残りの4つは統合せずに `Money` へ移す → `Money` 90行 > 65
3. `Money` を作らず、統合した3つを `Expense` へ移す → 責務5種類・72行・凝集度(経費の塊と金額の塊)
4. `Money` を作ってメソッドを3つ移すが、`amount`・`currency` を `Expense` に残す → Feature Envy 3

### ステージのテスト(新規 `src/infrastructure/stages/valueObjectStage.test.ts`)

- 初期状態の減点が上の表どおりで40点
- 各 `duplicateGroup` がちょうど2つの処理に付いている
- 模範解答のあと: `Money` に amount・currency と3メソッドがあり、どの処理も `amount`・`currency` を `writes` に持たない。`Expense` は1塊
- 変更依頼2件の `classesTouched` と点数が上の表どおり

### 受け入れ基準(段階G)

- `npm run check` が通る(操作の変更がないので E2E の追加は不要。既存の `npm run test:e2e` は通ること)
- 上級7で `stageCatalog.test.ts` の共通テストが通り、追加した近道4件が100点未満
- 解答例の図が例外なく作れ、`Money` に amount・currency が表示される

---

## 変更対象ファイル一覧(まとめ)

| パス | 層 | 段階 | 新規/変更 |
| --- | --- | --- | --- |
| `src/domain/codebase/Codebase.ts`・`.test.ts` | domain | A, B | 変更(`Fragment.accessor`、`isAccessorMethod`・`accessorFieldAccess`、`extendsChainIds` を `fieldAccess.ts` から移す) |
| `src/domain/scoring/fieldAccess.ts`・`.test.ts` | domain | A, B | 変更(アクセサ越しのアクセス、`findOpenSetters`、`extendsChainIds` を使う) |
| `src/domain/scoring/visibility.ts`・`.test.ts` | domain | B | 変更(protected の越境。既存の protected のテストを書き換え) |
| `src/domain/scoring/score.ts`・`fileScores.ts` と各テスト | domain | A, E | 変更(公開された setter を `encapsulation` に、`'cohesion'`) |
| `src/domain/codebase/changeVisibility.ts`・`.test.ts` | domain | B | 新規 |
| `src/domain/stage/Stage.ts` | domain | B | 変更(`visibilityEnforced` の JSDoc のみ。フィールドは足さない) |
| `src/domain/stage/sampleAnswer.ts`・`.test.ts` | domain | B, D, F, G | 変更(`changeVisibility` の手、3ステージの模範解答) |
| `src/application/RefactorUseCases.ts`・`.test.ts` | application | B | 変更(`changeVisibilityUseCase`・文言) |
| `src/presentation/store/useGameStore.ts` | presentation | C | 変更(`changeVisibility`) |
| `src/presentation/editor/MethodEditor.tsx` | presentation | C, D | 変更(可視性の選択、getter/setter 経由の表示) |
| `src/presentation/stage/describeSolutionStep.ts` | presentation | C | 変更 |
| `src/domain/scoring/cohesion.ts`・`.test.ts` | domain | E | 新規(`findLowCohesionClasses`) |
| `src/presentation/stage/describeScore.ts` | presentation | E | 変更(表示名) |
| `src/infrastructure/stages/intermediateStages.ts` | infrastructure | B, D, E, F | 変更(中級3の `dependencyLimit`・goal、中級7、中級6のデータ修正、中級8) |
| `src/infrastructure/stages/advancedStages.ts` | infrastructure | G | 変更(上級7) |
| `src/infrastructure/stages/stageCatalog.test.ts` | infrastructure | B, D, F, G | 変更(近道15件) |
| `src/infrastructure/stages/featureEnvyStage.test.ts` | infrastructure | E | 変更(模範解答のあとの凝集度) |
| `src/infrastructure/stages/anemicDomainModelStage.test.ts`・`extractClassStage.test.ts`・`valueObjectStage.test.ts` | infrastructure | D, F, G | 新規 |
| `e2e/refactor.spec.ts` | E2E | B, C, D, F | 変更(中級3の初期点、可視性の操作、中級7、中級8) |

変更しないもの: `dependencies.ts`・`lineCount.ts`・`setSuperclass.ts`・`moveMethod.ts`・`mergeMethods.ts`・`inlineMethod.ts`・`moveField.ts`・`leftovers.ts`・`interfaceContracts.ts`、
`src/domain/change/`、`src/domain/critique/`・`workers/critique/`、白紙設計・設計くらべのデータ、進捗の保存。

## スコープ外

- **「クラスの外から呼ばれていない public メソッド」(公開しすぎ)の一般的な採点と、エントリポイントの隠しタグ**(設計判断 3-5。公開しすぎを採点するのは setter だけ)
- **フィールドの可視性を変える操作**(設計判断 3-3。必要な題材が出たら同じ形で足す)
- **Move Method で親クラスへ移したときの protected への自動昇格**(今は `setSuperclass` のときだけ。プレイヤーが自分で選べる)
- **親が子の protected フックを呼ぶ Template Method の正しい表現**(親の抽象メソッドの宣言。今は違反に数える)
- **「子クラスからしか呼ばれない public を protected に絞る」の採点**
- **フィールドの型(`typeClassId`)と値オブジェクト型のフィールド**、不変性の採点
- **データクラスの減点**(フィールドしかない / getter・setter しかないクラス)
- **フィールドの追加・削除・名前の変更**、フィールドを余白へ落として新しいクラスを作る操作
- **`duplicateGroup` の重複そのものの減点**、3か所以上の重複の統合
- **凝集度の塊をキャンバスで色分けして見せる表示**、AI講評の入力への `fieldGroups` の追加、継承元のフィールドを凝集度に数えること
- **`Email` など他の値オブジェクトのステージ**

## 決定済み(ユーザー確認)

- 並びは 中級7 貧血ドメインモデル → 中級8 Extract Class → 上級7 Value Object
- 凝集度は全ステージで有効(フラグなし)。定義は LCOM4 の素朴版のまま、崩れる問題は**データを直す**(中級6は請求額の計算が `status` も読む、上級7は `submit` が `category` も読む)
- 貧血ドメインモデルは `accessor` タグ(アクセサ越しのアクセス)で採点する
- 責務の混在との二重減点は、ステージの上限設定で避ける。中級7は `responsibilityLimit: 5`、中級8は `4`
- 上級7の割り切り(値の出どころは `Expense` の1か所、`Money` 型のフィールドは表さない、不変は採点しない)
- メソッドの可視性を変える操作を今回作り、**全ステージで使える**(`visibilityEditable` フラグは作らない)
- **protected も選べる**。継承関係のない他クラスから protected のメソッドを使うと減点する(フィールドは既存のカプセル化の破れがすでに同じ線引きで数えている)
- **protected の越境は全ステージで数える**(private の越境は今までどおり `visibilityEnforced` のステージだけ)。上級5の初期点が下がる。親が子のフックを呼ぶ Template Method も違反に数える(ponytail)
- 可視性を狭める操作は、届かなくなる呼び出し元があれば拒否する(`narrowing-breaks-callers`。オーケストレーター判断: protected→private で越境を消す抜け道を塞ぐため)
- 抜け道は操作の前提条件で塞ぎ、公開しすぎの減点は setter だけにする(エントリポイントの隠しタグは作らない)
- 中級3の `dependencyLimit` を 2 → 0 にする(初期 80 → 70)
- **外から呼ばれていない、private でない setter をカプセル化の破れに数える**。外から呼ばれている setter は呼ぶ側の書き換えで数え、二重に減点しない

## 未決事項

なし(実装時に点数を実測して表を直す)
