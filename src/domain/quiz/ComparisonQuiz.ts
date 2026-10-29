import type { ChangeRequest } from '../change/ChangeRequest';
import type { Codebase } from '../codebase/Codebase';
import type { LineLimits } from '../scoring/lineLimits';
import type { ConceptCheck } from '../stage/Stage';

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
  /** 2段目: 楽な設計を選んだ理由の3択。選択肢ごとの explanation が、その理由を選んだときの解説になる。 */
  readonly reason: ConceptCheck;
};

/** 1問への答え。設計(1段目)と理由の添字(2段目)の両方がそろって初めて「答えた」ことになる。 */
export type QuizAnswer = { readonly design: DesignChoice; readonly reason: number };
