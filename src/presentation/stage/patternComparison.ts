/** ステージ一覧の「パターン比較」表に出す静的データ。採点や進捗とは連動しない。 */
export type PatternComparisonEntry = {
  readonly name: string;
  readonly stageId: string;
  readonly whenToUse: string;
  readonly whatVaries: string;
  readonly structure: string;
  readonly notSuitedFor: string;
};

export const PATTERN_COMPARISON: readonly PatternComparisonEntry[] = [
  {
    name: 'Strategy',
    stageId: 'advanced-discount-strategy',
    whenToUse: '同じ目的の計算や処理に、やり方が何通りもあり、呼び出し側が外から選びたいとき',
    whatVaries: 'やり方(アルゴリズム)そのもの。新しいやり方はクラスを1つ足すだけ',
    structure: '共通のインターフェースと、それを implements する方式ごとのクラス。使う側はインターフェースだけを持つ',
    notSuitedFor: 'やり方が1〜2通りで増える見込みが無いとき(if 1つで足りる)',
  },
  {
    name: 'State',
    stageId: 'advanced-order-state',
    whenToUse: 'オブジェクトの状態によって同じ操作の振る舞いが変わり、状態が移り変わるとき',
    whatVaries: '今の状態と、その状態での振る舞い。次の状態への遷移も状態クラスが知る',
    structure: '状態ごとのクラスが共通のインターフェースを implements し、持ち主は今の状態を1つ持って処理を任せる',
    notSuitedFor: '状態が少なく遷移も単純なとき。外から方式を選ぶだけなら Strategy で足りる',
  },
  {
    name: 'Template Method',
    stageId: 'advanced-template-method',
    whenToUse: '処理の手順(順番)は同じで、一部のステップだけが種類ごとに違うとき',
    whatVaries: '手順の中の一部のステップだけ。手順の順番は変わらない',
    structure: '基底クラスが手順を決めるメソッドを持ち、違うステップだけを子クラスが extends して上書きする',
    notSuitedFor: '手順そのものが種類ごとに違うとき。継承が深くなりそうなら Strategy で組み合わせる',
  },
  {
    name: 'Factory',
    stageId: 'advanced-report-factory',
    whenToUse: 'どのクラスを new するかの判断が、あちこちに散らばっているとき',
    whatVaries: '生成するクラスの種類。種類が増えても直すのは生成をまとめた場所だけ',
    structure: '生成の分岐を1つのクラス(Factory)に集め、使う側は Factory から受け取ったものを使う',
    notSuitedFor: '生成するものが1種類で、分岐が無いとき',
  },
  {
    name: 'ISP(インターフェース分離)',
    stageId: 'advanced-interface-segregation',
    whenToUse: '1つのインターフェースに、使わないメソッドまで実装させられるクラスがあるとき',
    whatVaries: '役割ごとの小さなインターフェースの組み合わせ。必要な役割だけを implements する',
    structure: '太いインターフェースを役割ごとに分け、各クラスは使う役割だけを implements する',
    notSuitedFor: 'どの実装もすべてのメソッドを本当に使うとき(分けると無駄に増えるだけ)',
  },
];
