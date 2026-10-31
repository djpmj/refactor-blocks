import type { ChangeRequest } from '../change/ChangeRequest';
import type { Codebase } from '../codebase/Codebase';
import type { LineLimits } from '../scoring/lineLimits';
import type { ScoreRule } from '../scoring/score';

/** ステージの区分。ステージ選択ではこの順に並べる。drill は1操作の短い練習。 */
export type StageLevel = 'tutorial' | 'beginner' | 'intermediate' | 'advanced' | 'drill';

export type CheckChoice = {
  readonly text: string;
  /** この選択肢を選んだときに出す解説。 */
  readonly explanation: string;
};

export type ConceptCheck = {
  readonly id: string;
  readonly question: string;
  readonly choices: readonly CheckChoice[];
  /** 正解の選択肢の添字(0始まり)。 */
  readonly answer: number;
};

export type StageLayer = {
  /** 画面に出す層の名前。例: 'Controller' / 'Service' / 'Repository' */
  readonly name: string;
  /** この層に属する処理の責務(Fragment.responsibility)。 */
  readonly responsibilities: readonly string[];
};

/** ステージに関係する設計原則。表示のみに使い、採点には使わない。 */
export type DesignPrinciple = 'srp' | 'ocp' | 'dip' | 'isp' | 'dry' | 'adp' | 'encapsulation' | 'yagni';

export type Stage = {
  readonly id: string;
  readonly level: StageLevel;
  readonly title: string;
  /** 100点になったときに見せる、この題材で分ける理由。 */
  readonly why: string;
  readonly goal: string;
  /** サイドバーに出す問題の症状。解き方や数値条件は含めない。 */
  readonly problem: string;
  /** どんなコードで、何が困っているのか。プレイヤーが題材を思い浮かべられるように書く。 */
  readonly description: string;
  /** ステージ一覧に出す「学べること」。1〜3個の短い名前。 */
  readonly learns: readonly string[];
  /** ステージ一覧に出す「このステージでできるようになること」。1文・40文字以内・「〜できる」で終える。行数などの数値条件や解き方の手順は書かない。 */
  readonly outcome: string;
  /** このステージで練習する組み替えの背骨になる設計原則。1〜2個。表示のみ(採点に使わない)。 */
  readonly principles?: readonly DesignPrinciple[];
  /** 100点になったときに出す理解度チェック。ドリルは0問。 */
  readonly checks: readonly ConceptCheck[];
  readonly limits: LineLimits;
  /** 1クラスが依存してよいクラス数の上限。 */
  readonly dependencyLimit: number;
  /** クリア条件に添える、そのステージで上限を特別にしている理由。ルールごとに1文。 */
  readonly conditionNotes?: Readonly<Partial<Record<ScoreRule, string>>>;
  /** 1クラスに混ぜてよい責務(Fragment の responsibility)の種類数の上限。 */
  readonly responsibilityLimit: number;
  /** 1つのメソッドに一緒に入っていても減点しない責務の組。 */
  readonly cohesiveResponsibilities?: readonly (readonly string[])[];
  readonly codebase: Codebase;
  /** 責務(Fragment.responsibility)ごとの自動命名先。 */
  readonly classNames: Readonly<Record<string, string>>;
  /** 責務(Fragment.responsibility)ごとの画面に出す日本語名。例: { aggregation: '集計' }。'call' には書かない。 */
  readonly responsibilityNames: Readonly<Record<string, string>>;
  /** 責務(Fragment.responsibility)ごとの自動メソッド名。 */
  readonly methodNames?: Readonly<Record<string, string>>;
  /** リファクタリング後に出す変更依頼。ドリルは0件。 */
  readonly changeRequests: readonly ChangeRequest[];
  /** private / protected のメソッドが届かないクラスから呼ばれていないかを採点するかどうか(protectedは持ち主と子孫クラスから呼べる)。省略時は false。
   *  越境は、呼ばれる側を public にしても消える(可視性の操作は全ステージで使える)。Move Method で直させたいステージは、
   *  依存の上限など別の採点で public にするだけでは100点にならないようにする(中級3は dependencyLimit: 0)。 */
  readonly visibilityEnforced?: boolean;
  /** 層の並び(上 → 下)。省略時は層の採点をしない。 */
  readonly layers?: readonly StageLayer[];
};
