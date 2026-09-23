import type { ChangeRequest } from '../../domain/change/ChangeRequest';
import type { ComparisonQuiz } from '../../domain/quiz/ComparisonQuiz';
import { sampleAnswerCodebase } from '../../domain/stage/sampleAnswer';
import type { Stage } from '../../domain/stage/Stage';
import { stages } from '../stages/stageCatalog';

/** 設計はステージの初期コードと模範解答から作る。ステージ定義は信頼できるデータなので、見つからなければ開発時に気づけるよう例外にする。 */
function stageById(id: string): Stage {
  const stage = stages.find((candidate) => candidate.id === id);
  if (stage === undefined) throw new Error(`クイズが参照するステージ ${id} がありません`);
  return stage;
}

function firstRequest(stage: Stage): ChangeRequest {
  const request = stage.changeRequests.at(0);
  if (request === undefined) throw new Error(`ステージ ${stage.id} に変更依頼がありません`);
  return request;
}

const userController = stageById('beginner-user-controller');
const volatileTax = stageById('intermediate-volatile-tax');
const volatileFormat = stageById('intermediate-volatile-format');

// 2問目と3問目は同じ2つの設計で、依頼だけが違う(どこが変わるかで良し悪しが入れ替わる)
const formatSplitDesign = { label: '帳票の整形を ReportFormatter に分けた設計', codebase: sampleAnswerCodebase(volatileFormat) };
const taxSplitDesign = { label: '税の計算を TaxCalculator に分けた設計', codebase: sampleAnswerCodebase(volatileTax) };

/** 設計くらべクイズの一覧。この順に出題する。 */
export const comparisonQuizzes: readonly ComparisonQuiz[] = [
  {
    id: 'quiz-user-controller-mail',
    title: '1問目: メールの文面を変えるなら',
    description: userController.description,
    limits: userController.limits,
    designs: {
      a: { label: 'DBは UserRepository、メールは Mailer に任せた設計', codebase: sampleAnswerCodebase(userController) },
      b: { label: 'UserController が全部やっている設計', codebase: userController.codebase },
    },
    changeRequest: firstRequest(userController),
    explanation:
      'メール送信が Mailer にまとまっていれば、直すのは Mailer だけで済む(呼び出し元の UserController は動作確認だけ)。UserController に混ざっていると、HTTPやDBの処理を巻き込んで壊すおそれがあり、行数の上限も超えてしまう。',
  },
  {
    id: 'quiz-sales-report-tax',
    title: '2問目: 税の計算ルールが変わるなら',
    description: '月次・四半期の売上帳票を作るコード。同じ機能を2通りに分けた設計がある。',
    limits: volatileTax.limits,
    designs: { a: formatSplitDesign, b: taxSplitDesign },
    changeRequest: firstRequest(volatileTax),
    explanation:
      '税の計算を TaxCalculator に閉じ込めた設計なら、税の変更は小さなクラスの中で済む。整形を分けた設計では、税の変更(2か所で+28行)が148行の SalesReportService に入り、クラスの上限150行を超えてしまう。',
  },
  {
    id: 'quiz-sales-report-format',
    title: '3問目: 帳票の形式が変わるなら',
    description: '2問目とまったく同じ2つの設計。今度は帳票の形式を変える依頼が来た。',
    limits: volatileFormat.limits,
    designs: { a: formatSplitDesign, b: taxSplitDesign },
    changeRequest: firstRequest(volatileFormat),
    explanation:
      '整形を ReportFormatter に閉じ込めた設計なら、形式の変更は小さなクラスの中で済む。税を分けた設計では、整形の変更(2か所で+28行)が148行の SalesReportService に入り、上限150行を超える。2問目と同じ2つの設計なのに答えが入れ替わる。良い設計とは、よく変わる所を閉じ込めた設計のこと。',
  },
];
