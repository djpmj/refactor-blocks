/** ステージを C# のコンソールアプリとして実行するための情報。 */
export type StageRuntime = {
  /** 実行の入口にするメソッドのID。リファクタリングでクラスを移っても、IDで今の持ち主を探す。 */
  readonly entryMethodId: string;
  /** 入口のメソッドに渡す引数の C# の式(例: ['SampleData.Sales()'])。 */
  readonly entryArguments: readonly string[];
  /** ゲームのブロックにならない補助コード(データ型・リポジトリの偽物・サンプルデータ)。`Support/` の下に出す。 */
  readonly support: readonly { readonly path: string; readonly code: string }[];
  /** インターフェースの実装が複数あるときに、どれを注入するか(インターフェース名 → クラス名)。3本目で使う。 */
  readonly bindings?: Readonly<Record<string, string>>;
  /**
   * bindings で選んだ実装を、インターフェース越しに実行して見せる補助コードの呼び出し(インターフェース名 → C# の文。`{0}` は選んだ実装の変数名)。
   * 選んだ実装がそのインターフェースを実装している手順の Program.cs にだけ出る。補助コードは出力の各行に `[bindings] ` を付ける(手順どうしの出力比較では除く)。
   */
  readonly bindingDemos?: Readonly<Record<string, string>>;
  /** ビルド失敗を意図するスナップショット名(initial, 01, 02, …)。 */
  readonly expectedBuildFailures?: readonly string[];
};
