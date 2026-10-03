import type { ChangeRequest } from '../change/ChangeRequest';
import type { Codebase } from '../codebase/Codebase';
import type { LineLimits } from '../scoring/lineLimits';

export type DesignChoice = 'a' | 'b';

export type QuizDesign = {
  /** 画面に出す短い説明。例: 「税の計算を TaxCalculator に分けた設計」 */
  readonly label: string;
  readonly codebase: Codebase;
};

/** 同じ機能の設計A・Bと変更依頼を1つ見せ、変更が楽な方を選ばせるクイズ。 */
export type ComparisonQuiz = {
  readonly id: string;
  readonly title: string;
  /** 状況の説明(何のコードで、どんな依頼が来たか)。 */
  readonly description: string;
  readonly limits: LineLimits;
  readonly designs: Readonly<Record<DesignChoice, QuizDesign>>;
  readonly changeRequest: ChangeRequest;
  /** 答え合わせで出す、なぜその設計が楽なのかの1〜2文。 */
  readonly explanation: string;
};
