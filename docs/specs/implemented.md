# 実装済みの仕様書

実装が `master` にマージ済みの仕様書の一覧。作成経路(`feature-harness`
skill・`/spec-to-issue` コマンドなど)は問わず、`docs/specs/` にある仕様書はすべてここに集約する。

## 一覧

| 仕様書 | 機能 |
| --- | --- |
| [dependency-scoring](dependency-scoring.md) | 依存関係と採点 |
| [change-request](change-request.md) | 変更依頼(新機能追加課題) |
| [visibility-scoring](visibility-scoring.md) | public/private アクセス制御の採点 |
| [inheritance](inheritance.md) | 継承関係の表現と表示 |
| [cyclic-dependency-class-highlight](cyclic-dependency-class-highlight.md) | 循環依存の可視化と警告(クラスノードの強調表示) |
| [advanced-payment-gateway-interface](advanced-payment-gateway-interface.md) | 上級2: インターフェース越しの依存(決済ゲートウェイ)ステージ |
| [advanced-discount-strategy](advanced-discount-strategy.md) | 上級3: if分岐をStrategyパターンへ組み替えるステージ |
| [payment-gateway-true-dip](payment-gateway-true-dip.md) | 上級2 作り直し: 本物のDI/DIPを表現する決済ゲートウェイステージ |
| [merge-duplicate-methods](merge-duplicate-methods.md) | 重複メソッドの統合(Merge Methods) |
| [stage-progress-persistence](stage-progress-persistence.md) | ステージ進捗の保存(localStorage) |
| [advanced-report-factory](advanced-report-factory.md) | 上級4: オブジェクト生成処理をFactoryへ集約する |
| [stuck-player-hints](stuck-player-hints.md) | 詰まったときのヒント機能 |
| [context-menu-viewport-clamp](context-menu-viewport-clamp.md) | 右クリックメニューをビューポート内に収める |
| [volatility-axis-stages](volatility-axis-stages.md) | 中級4・中級5: 変わる場所しだいで正解が変わるステージ |
| [design-comparison-quiz](design-comparison-quiz.md) | 設計くらべクイズ |
| [lone-superclass-scoring](lone-superclass-scoring.md) | 子が1つしかない継承の減点と、上級5「使われない拡張ポイントを畳む」 |
| [blank-design-mode](blank-design-mode.md) | 白紙設計モード |
| [inline-edit-and-hover-submenu](inline-edit-and-hover-submenu.md) | キャンバスのその場編集と、継承元/インターフェースのホバーサブメニュー |
| [implement-change-request](implement-change-request.md) | 変更依頼を「実装」させる(置き方の採点) |
| [interface-segregation-stage](interface-segregation-stage.md) | 複数インターフェースの実装と、上級6「太ったインターフェースを役割ごとに分ける」(ISP) |
| [fields-and-feature-envy](fields-and-feature-envy.md) | クラスのデータ(フィールド)と、中級6「他人のデータばかり触るメソッド」(Feature Envy / Tell, Don't Ask) |
| [cohesion-value-object-anemic](cohesion-value-object-anemic.md) | フィールドの上に作る3ステージ: 貧血ドメインモデル(中級7)・Extract Class(中級8)・Value Object(上級7) |
| [move-via-context-menu](move-via-context-menu.md) | 右クリックメニューから移動先のクラスを選んでメソッド・フィールドを移す |
| [template-method-stage](template-method-stage.md) | 上級8「取り込みの手順を Template Method にまとめる」 |
| [delete-class-code-guard](delete-class-code-guard.md) | クラス・ファイルの削除で本物の処理が消えないようにする |
| [move-class-via-context-menu](move-class-via-context-menu.md) | 右クリックメニューから移動先のファイルを選んでクラスを移す |
| [extends-interface-loophole](extends-interface-loophole.md) | インターフェース役を extends にすると「実装漏れ」の採点をすり抜ける抜け道を塞ぐ |
| [concrete-superclass-loophole](concrete-superclass-loophole.md) | 具象クラスを extends して契約の実装を「借りる」抜け道を塞ぐ |
| [class-code-preview-tab](class-code-preview-tab.md) | メソッドエディタにコードプレビュータブを追加する |
| [over-split-scoring](over-split-scoring.md) | 「やりすぎ」検知(極小メソッド・極小クラスの減点) |
| [method-editor-tab-style](method-editor-tab-style.md) | メソッドエディタの「編集/コード」タブに見た目のスタイルを当てる |
| [call-fragment-code](call-fragment-code.md) | call Fragment を `// 未入力` ではなく呼び出し文で表示する |
| [resizable-sidebar](resizable-sidebar.md) | 右サイドバーの幅をドラッグ・キーボードで変更できるようにする |
| [sidebar-toggle-position](sidebar-toggle-position.md) | 左サイドバーの開閉ボタンをサイドバーの境界へ移す |
| [edge-handles-by-position](edge-handles-by-position.md) | 矢印の出入り口をファイルの実際の位置関係で決める |
| [visibility-restore-original](visibility-restore-original.md) | ステージ開始時の可視性へは呼び出し元がなくても戻せる |
| [visibility-select-by-stage](visibility-select-by-stage.md) | 可視性の選択欄は可視性が課題に関係するステージと白紙設計だけに出す |
| [hide-file-names](hide-file-names.md) | ファイル名を画面に表示せず、入力も求めずに自動追加する |
| [inheritance-arrow-clarity](inheritance-arrow-clarity.md) | 継承・実装の矢印を白抜き三角にし、同じ親へ集まる矢印の着地点をずらす |
| [extends-implements-edge-colors](extends-implements-edge-colors.md) | 継承(extends)と実装(implements)の矢印を色と線種で分ける |
| [method-editor-tab-bar](method-editor-tab-bar.md) | メソッドエディタの「編集/コード」タブをエディタ風のタブバーにする |
| [drop-new-file-at-position](drop-new-file-at-position.md) | 余白へドロップしたとき、新しいファイルをドロップ位置に置く |
| [field-info-and-types](field-info-and-types.md) | フィールドをクリックで説明表示し、コードに説明コメントと実際の型を出す |
| [canvas-error-toast](canvas-error-toast.md) | 操作の失敗理由をキャンバス上のトーストで見せ、×で閉じられるようにする |
| [score-jump-to-violations](score-jump-to-violations.md) | 採点の減点項目から該当ブロックをキャンバス上で強調してジャンプする |
| [operation-guide](operation-guide.md) | ツールバーと?キーで開ける操作ガイドを追加する |
| [why-split-change-pain](why-split-change-pain.md) | 変更の痛みカードと達成時の「なぜ分けるか」で分割の意義を実感させる |
| [code-preview-wrap](code-preview-wrap.md) | コードタブの長い行をサイドバー幅に合わせて折り返す |
| [change-pain-wrap](change-pain-wrap.md) | 変更の痛みカードと前回の変更依頼の長い名前をサイドバー幅に合わせて折り返す |
| [code-lines-match](code-lines-match.md) | コードを持つFragmentの行数を実際のC#ソースの行数から計算し、表示・採点をそろえる |
| [replay-maximize-method-panel](replay-maximize-method-panel.md) | 解答の再生に最大化ボタンと読み取り専用のメソッドパネルを追加する |
| [fill-fragment-code](fill-fragment-code.md) | 全ステージの処理とフィールドに現実的なC#コードを入れ「未入力」をなくす |
| [resizable-left-sidebar](resizable-left-sidebar.md) | 左サイドバー(課題とヒント)の幅をドラッグ・キーボードで変更できるようにする |
| [sidebar-toggle-overlap](sidebar-toggle-overlap.md) | 左サイドバーの開閉ボタンをスクロールバーに重ならない境界の外側に置く |
| [remove-stage-select](remove-stage-select.md) | ヘッダーのステージ選択コンボボックスを削除し「ステージ一覧」に一本化する |
| [#102 inline-middle-man](https://github.com/djpmj/refactor-blocks/issues/102) | Inline Methodを一般化し、横流しだけのクラスを採点する中級ステージを追加する |
| [sidebar-problem-structure](sidebar-problem-structure.md) | サイドバーを「困っていること」と採点から自動で出す「クリア条件」中心に組み替え、他は折りたたむ |
| [action-affordance](action-affordance.md) | 抽出ボタンの活性/非活性、ブロックのホバー説明、メソッドエディタの空状態の案内で操作を見た目で伝える |
| [hint-highlight](hint-highlight.md) | ヒントごとに「キャンバスで見る」ボタンを付け、模範解答の手が触るブロックを光らせて画面を寄せる |
| [first-visit-tour](first-visit-tour.md) | チュートリアル1の初回に、操作に合わせて進むスポットライトガイドを出す |
| [ghost-hint](ghost-hint.md) | 「少しだけヒント」で次に動かすブロックの半透明ゴーストを移動先へ動かして見せる |
| [drag-drop-targets](drag-drop-targets.md) | ドラッグ中に置けるクラス・ファイルを光らせ、置けない場所を薄暗くする |
| [extract-preview](extract-preview.md) | 抽出する処理を選んでいる間、元のメソッドの行数変化と新メソッドの仮の姿をキャンバスとエディタに表示する |
