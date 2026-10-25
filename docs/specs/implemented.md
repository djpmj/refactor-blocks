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
| [success-feedback](success-feedback.md) | 点数のカウントアップとゲージの光、違反が消えたブロックの緑の演出 |
| [score-hover-preview](score-hover-preview.md) | 減点の内訳のボタンにホバー・フォーカスしている間だけ原因ブロックを一瞬光らせる |
| [button-style-base](button-style-base.md) | ボタンの見た目を詳細度0の共通既定スタイルにそろえ、主要ボタンから!importantを除去 |
| [replay-window-controls](replay-window-controls.md) | 解答の再生ヘッダー右上に最大化(□/重なった□)と閉じる(✕)をChromeのウィンドウ風に並べる |
| [story-default-on](story-default-on.md) | ストーリーを初回からオンにし、オン中の「ストーリー」ボタンをアクセント色で表示 |
| [fragment-label-comments](fragment-label-comments.md) | コードタブで各処理の前に処理名をコメント表示し、コメント・空行も行数に数える |
| [class-role-misplacement](class-role-misplacement.md) | 用意されたクラスに隠しの役割タグを持たせ、役割と違う処理が入ったら減点する |
| [freeze-file-positions](freeze-file-positions.md) | 表示済みファイルの位置を固定し、「整列」ボタンで依存の向きに並べ直す |
| [preview-method-panel](preview-method-panel.md) | 変更前・解答例の図でもメソッドパネルを出し、最大化できるようにする |
| [auto-class-naming](auto-class-naming.md) | 新しく作ったクラスに、中身の責務から名前を自動で付ける |
| [manual-fix-method-viewer](manual-fix-method-viewer.md) | 手で直す最中、クリックしたメソッドの処理一覧を右サイドバーに読み取り専用で出す |
| [preview-panel-resizable](preview-panel-resizable.md) | 図のプレビュー・解答の再生で、右のメソッドパネルの幅を変えられるようにする |
| [short-method-names](short-method-names.md) | 複数処理を抽出するときの自動メソッド名を、模範解答・責務表から短く付ける |
| [mixed-responsibility-method](mixed-responsibility-method.md) | 抽出で作ったメソッドに別々の責務の処理が混ざっていたら減点する |
| [warning-edge-popover-front](warning-edge-popover-front.md) | 警告の矢印の説明が、隣の「循環」バッジの下に隠れないよう前面に出す |
| [delete-inline-notice](delete-inline-notice.md) | クラス・ファイル削除時に、呼び出し元へ戻した処理をキャンバスに案内する |
| [answer-feedback-animation](answer-feedback-animation.md) | 理解度チェックと設計くらべの正誤を色分けし、正解・不正解のアニメーションを出す |
| [file-mark-reasons](file-mark-reasons.md) | ファイルの警告・危険アイコンにマウスを乗せる/フォーカスすると減点の理由を出す |
| [clear-condition-badges](clear-condition-badges.md) | クリア条件を丸バッジと行の色で見せ、達成数と達成した瞬間の演出を出す |
| [post-perfect-flow](post-perfect-flow.md) | 手直し・リファクタリング・仕上げ・変更依頼を段階的に進める |
| [toolbar-answer-menu](toolbar-answer-menu.md) | ツールバーの参考・答えをメニューにまとめ、答えの前にヒントを勧める |
| [change-rumors](change-rumors.md) | 後から届く変更依頼を「うわさ」として先に見せ、変更依頼の結果で回収する |
| [change-impact-review](change-impact-review.md) | 組み替える前と今を並べ、どの組み替えが効いたかを結びつける答え合わせ画面 |
| [extract-lines-and-editor-rail](extract-lines-and-editor-rail.md) | 抽出で行数が増える理由を伝え、何も選んでいないときの右パネルを細い帯に畳む |
| [cycle-count-display](cycle-count-display.md) | 循環依存を矢印の本数ではなく輪の組(クラス名と向き)で表示する |
| [tiered-hints](tiered-hints.md) | ヒントを「どこが問題?」→「次の一手」→「動きで見る」の3段階にする |
| [change-request-fairness](change-request-fairness.md) | 変更依頼の比較を開始時の設計にそろえ、チュートリアル・初級の解答例で変更が100点で入るようにする |
| [auto-public-on-move](auto-public-on-move.md) | 可視性を採点しないステージで、移動後に別クラスから呼ばれる private/protected メソッドを自動で public にする |
| [small-text-fixes](small-text-fixes.md) | 100点後カードの「か所」文・空クラス条件文・減点の内訳の開閉の小さな文言/表示不具合を直す |
| [change-results-clarity](change-results-clarity.md) | 変更依頼の点数を「変更のしやすさ」「置き方」にそろえ、継承の案内の出し分けと空の部品置き場の非表示を行う |
| [responsibility-colors](responsibility-colors.md) | 処理に責務の種類の色と英字の印を付け、クラスに責務の種類数を出す |
| [operation-discoverability](operation-discoverability.md) | 統合・呼び出し元へ戻す・可視性の操作を、操作ガイドとエディタの文言で見つけやすくする |
| [score-floor-progress](score-floor-progress.md) | 0点のままでも減点の合計を表示し、減ったらゲージを光らせて読み上げる |
| [context-menu-grouping](context-menu-grouping.md) | 右クリックメニューを対象ごとの組に分け、メソッドを新しいクラスへ移す項目を足す |
| [rank-branching-two-ranks](rank-branching-two-ranks.md) | 中級10の会員ランクを2つに減らし、模範解答を14手にする |
| [visibility-and-limit-notes](visibility-and-limit-notes.md) | 可視性の説明をやさしくし、依存上限0のステージにはクリア条件に理由を添える |
| [critique-contract-fix](critique-contract-fix.md) | AI講評リクエストからpath必須を外し、送る形と受ける形を契約テストで固定、400専用メッセージを出す |
| [field-access-info](field-access-info.md) | フィールドの説明に、使うメソッドをクラス名つきで出し、外からの読み書きと直し方を示す |
| [pain-request-alignment](pain-request-alignment.md) | 変更依頼カードに直すクラス・ファイル・クラス行数の前後を出し、各ステージの1件目の依頼を模範解答で守る |
| [e2e-port-isolation](e2e-port-isolation.md) | E2Eのポートを E2E_PORT で変えられるようにし、別worktreeのサーバーを黙って再利用しない |
| [boss-change-request](boss-change-request.md) | 組み替えの効果が出る11ステージの変更依頼の最後に鬼の変更を置き、組み替える前との比較を見せる |
| [canvas-refit-on-resize](canvas-refit-on-resize.md) | キャンバスの大きさが変わったとき、プレイヤーが動かしていなければ図を自動で合わせ直す |
| [boss-result-and-layout-fixes](boss-result-and-layout-fixes.md) | 鬼の変更の比較欄に指標名を付け、行数の折り返し・クラス見出し・うわさ引用の表示崩れを直す |
| [detail-zoom-floor](detail-zoom-floor.md) | 自動の全体表示でメソッドが隠れる倍率まで縮めず、収まらない分は左上から見せる |
| [sample-answer-publicize](sample-answer-publicize.md) | 解答例の各手順で、可視性を採点しないステージでは別クラスから呼ばれる private を自動で public にする |
| [sidebar-flow-visibility](sidebar-flow-visibility.md) | 左パネルをステージ切替で先頭へ戻し、段階が進んだら次のカードを見せ、章の結びの依頼タイトルは受ける段階だけ出す |
| [new-class-into-view](new-class-into-view.md) | 余白へのドロップで作ったクラスが画面外にはみ出したら、ズームを変えずに見える位置へパンする |
| [line-limit-why-by-kind](line-limit-why-by-kind.md) | 行数減点の説明をメソッド・クラス・ファイルのどれが超えているかで出し分ける |
| [change-cost-class-entanglement](change-cost-class-entanglement.md) | 変更のしやすさで、変更クラスに同居する別責務も「巻き込み(クラス)」として減点する |
| [pull-up-protected-merge](pull-up-protected-merge.md) | 基底へ移したメソッドを子孫からだけ呼ばれるなら protected にし、private/protected 間の統合候補を保つ |
| [method-chip-accessible-name](method-chip-accessible-name.md) | メソッドのボタンの読み上げ名に可視性・行数・警告・「直した」印を入れ、選択中を aria-pressed で伝える |
| [move-class-to-new-file-menu](move-class-to-new-file-menu.md) | クラスのメニューから、そのクラスを新しいファイルへ移動する(唯一のクラスでは非表示) |
| [blank-design-class-names](blank-design-class-names.md) | 白紙設計のクラスを責務に応じて自動命名し、手動改名は維持する |
| [manual-fix-clarity](manual-fix-clarity.md) | 冒頭の手直しの答えを隠し、結果文を変更箇所のクラス単位で説明する |
| [dark-mode-canvas-controls](dark-mode-canvas-controls.md) | ダークモードでキャンバスのズームボタン等をゲームの配色に合わせる |
| [concept-check-feedback-labels](concept-check-feedback-labels.md) | 理解度チェックの解説に見出しを付け、解説本文から正誤の文言を外す |
| [narrow-screen-layout](narrow-screen-layout.md) | 幅700px以下で課題とメソッドエディタをドロワー表示にしてキャンバスを広く使う |
| [critique-contract-version](critique-contract-version.md) | AI講評のサーバーとゲームの契約版の食い違いを見分けて伝える |
| [operation-guide-keyboard](operation-guide-keyboard.md) | 操作ガイドにキーボードだけで遊ぶ方法を書く |
| [comparison-quiz-no-giveaway](comparison-quiz-no-giveaway.md) | 設計くらべで答える前に答えが透ける表示(評価的な設計名・警告色・空クラス)をなくす |
| [comparison-quiz-summary](comparison-quiz-summary.md) | 設計くらべの最後の問題のあとに結果のまとめと次の行き先を出す |
| [comparison-quiz-preview-zoom](comparison-quiz-preview-zoom.md) | 設計くらべの設計A・Bを同じ縮尺で並べる |
| [change-request-sample-on-ideal-base](change-request-sample-on-ideal-base.md) | 変更依頼の解答例を、前の依頼を解答例どおりに置いた理想の土台から生成する |
| [header-score-summary](header-score-summary.md) | ヘッダーの点数の説明を短くし、減点の内訳との重複をなくす |
| [implements-candidates-interface-only](implements-candidates-interface-only.md) | 「実装するインターフェース」の候補をインターフェース役のクラスに絞る |
| [change-request-step-feedback](change-request-step-feedback.md) | 変更依頼を1件ごとに答え合わせし、その場で置き直せるようにする |
| [deduction-targets-named](deduction-targets-named.md) | 減点の内訳に、原因のクラス・メソッド・依存を名前で出す |
| [override-visibility-contract](override-visibility-contract.md) | 親のメソッドを上書きして公開範囲を狭めたら約束違反に数える |
| [hint-strategy-phases](hint-strategy-phases.md) | ヒント「次の一手」を方針のまとまりごとに見せる |
| [answer-comparison-view](answer-comparison-view.md) | 解答例の図を、自分の設計と並べて違いが分かるように見せる |
| [interface-abstract-marker](interface-abstract-marker.md) | インターフェース役・抽象クラス役のクラスに印と破線枠・「中身なし」表示を付ける |
| [page-title-by-view](page-title-by-view.md) | ブラウザのタブ名を今のモード・ステージに合わせて切り替える |
| [blank-design-tray-display](blank-design-tray-display.md) | 白紙設計の部品置き場を、採点対象のクラスのように見せない(バッジ・矢印を外し点線枠にする) |
| [tutorial-tour-fixes](tutorial-tour-fixes.md) | 初回ツアーが正しい抽出に導くよう手順と文言を直し、手直しの直し忘れを防ぐ |
| [unused-public-member-notes](unused-public-member-notes.md) | 100点のあとに、外から使われていない公開メンバーを知らせる |
| [layered-stage-lanes](layered-stage-lanes.md) | 層を扱うステージで、層ごとに段を分けて並べ、層を飛ばす・逆らう矢印を赤い破線で目立たせる |
| [resume-last-stage](resume-last-stage.md) | 再読み込みしても、最後に遊んでいたステージから続ける |
| [toolbar-hint-rumor-popovers](toolbar-hint-rumor-popovers.md) | ヒント・うわさをサイドバーからツールバーのポップオーバーへ移す |
| [extract-contiguous-only](extract-contiguous-only.md) | 離れた処理は1つのメソッドに抽出できないようにする |
| [toast-clears-when-stale](toast-clears-when-stale.md) | 役目を終えた通知トースト(失敗理由は状況変化で、お知らせは8秒で)を自動で消す |
| [extract-name-inline-error](extract-name-inline-error.md) | 抽出するメソッド名が重複しているとき、押す前に入力欄のそばで伝える |
| [next-stage-after-clear](next-stage-after-clear.md) | 100点にしたあと、次のおすすめのステージへ進むカードを出す |
| [hint-highlight-clears-on-change](hint-highlight-clears-on-change.md) | コードが変わったら、ヒントと「どこが問題?」の光りを消す |
| [change-pain-card-fold-while-fixing](change-pain-card-fold-while-fixing.md) | 手で直している間、変更依頼カードの本文を畳んで依頼文の二重表示をなくす |
| [new-file-no-overlap](new-file-no-overlap.md) | 余白へのドロップで作る新しいファイルが既存のファイルと重ならないようにする |
| [opening-fix-banner-fit](opening-fix-banner-fit.md) | 手直しの案内バナーを図に重ならない帯にし、狭い幅でも操作できるようにする |
| [untouched-stage-not-scored](untouched-stage-not-scored.md) | 開いただけのステージを自己ベストとして記録しない |
