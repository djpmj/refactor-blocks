import type { SolutionStep } from '../stage/sampleAnswer';
import type { Stage } from '../stage/Stage';

/**
 * 白紙設計の問題。Stage の各項目は次の意味で使う。
 * - description: 要求文(何を作るか。どこが変わりやすいかもここでほのめかす)
 * - goal: 行数・責務・依存の上限と「全部品を配置しよう」
 * - codebase: 部品置き場だけのコードベース(trayCodebase で作る)
 * - changeRequests: 答え合わせで当てる変更依頼。遊んでいる間は見せない
 */
export type BlankDesignProblem = Stage & {
  /** 模範解答。codebase(部品置き場だけの状態)から適用する手順。 */
  readonly modelAnswer: readonly SolutionStep[];
  /** 答え合わせで出す、模範解答の狙い(1〜3文)。 */
  readonly explanation: string;
};
