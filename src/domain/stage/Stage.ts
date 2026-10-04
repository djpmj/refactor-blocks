import type { ChangeRequest } from '../change/ChangeRequest';
import type { Codebase } from '../codebase/Codebase';
import type { LineLimits } from '../scoring/lineLimits';

/** ステージの難易度。ステージ選択ではこの順に並べる。 */
export type StageLevel = 'tutorial' | 'beginner' | 'intermediate' | 'advanced';

export type Stage = {
  readonly id: string;
  readonly level: StageLevel;
  readonly title: string;
  /** 100点になったときに見せる、この題材で分ける理由。 */
  readonly why: string;
  readonly goal: string;
  /** どんなコードで、何が困っているのか。プレイヤーが題材を思い浮かべられるように書く。 */
  readonly description: string;
  /** ステージ一覧に出す「学べること」。1〜3個の短い名前。 */
  readonly learns: readonly string[];
  readonly limits: LineLimits;
  /** 1クラスが依存してよいクラス数の上限。 */
  readonly dependencyLimit: number;
  /** 1クラスに混ぜてよい責務(Fragment の responsibility)の種類数の上限。 */
  readonly responsibilityLimit: number;
  readonly codebase: Codebase;
  /** リファクタリング後に出す変更依頼。責務は初期のコードベースに存在するものを選ぶ。 */
  readonly changeRequests: readonly ChangeRequest[];
  /** private / protected のメソッドが届かないクラスから呼ばれていないかを採点するかどうか(protectedは持ち主と子孫クラスから呼べる)。省略時は false。
   *  越境は、呼ばれる側を public にしても消える(可視性の操作は全ステージで使える)。Move Method で直させたいステージは、
   *  依存の上限など別の採点で public にするだけでは100点にならないようにする(中級3は dependencyLimit: 0)。 */
  readonly visibilityEnforced?: boolean;
};
