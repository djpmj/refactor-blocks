import type { ChangeRequest } from '../change/ChangeRequest';
import type { Codebase } from '../codebase/Codebase';
import type { LineLimits } from '../scoring/lineLimits';

/** ステージの難易度。ステージ選択ではこの順に並べる。 */
export type StageLevel = 'tutorial' | 'beginner' | 'intermediate';

export type Stage = {
  readonly id: string;
  readonly level: StageLevel;
  readonly title: string;
  readonly goal: string;
  /** どんなコードで、何が困っているのか。プレイヤーが題材を思い浮かべられるように書く。 */
  readonly description: string;
  readonly limits: LineLimits;
  /** 1クラスが依存してよいクラス数の上限。 */
  readonly dependencyLimit: number;
  /** 1クラスに混ぜてよい責務(Fragment の responsibility)の種類数の上限。 */
  readonly responsibilityLimit: number;
  readonly codebase: Codebase;
  /** リファクタリング後に出す変更依頼。責務は初期のコードベースに存在するものを選ぶ。 */
  readonly changeRequests: readonly ChangeRequest[];
  /** private メソッドが自クラス以外から呼ばれていないかを採点するかどうか。省略時は false。
   *  既存ステージの模範解答(Move Method で private メソッドを移す手順)を壊さないため、
   *  この採点を有効にするステージだけが明示的に true を書く。 */
  readonly visibilityEnforced?: boolean;
};
