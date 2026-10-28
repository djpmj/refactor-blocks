import type { ChangeRequest } from '../../domain/change/ChangeRequest';
import type { Codebase } from '../../domain/codebase/Codebase';
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

/** 先頭以外の変更依頼を使う問題のため。 */
function requestById(stage: Stage, id: string): ChangeRequest {
  const request = stage.changeRequests.find((candidate) => candidate.id === id);
  if (request === undefined) throw new Error(`ステージ ${stage.id} に変更依頼 ${id} がありません`);
  return request;
}

/** 出題用に、メソッドの無いクラスとクラスの無いファイルを取り除く(空の受け皿が「中身を入れる先」のヒントになるため)。 */
function withoutEmptyShells(codebase: Codebase): Codebase {
  const files = codebase.files.map((file) => ({ ...file, classes: file.classes.filter((codeClass) => codeClass.methods.length > 0) }));
  return { files: files.filter((file) => file.classes.length > 0) };
}

function design(label: string, codebase: Codebase) {
  return { label, codebase: withoutEmptyShells(codebase) };
}

const userController = stageById('beginner-user-controller');
const volatileTax = stageById('intermediate-volatile-tax');
const volatileFormat = stageById('intermediate-volatile-format');
const collapseHierarchy = stageById('advanced-collapse-hierarchy');
const discountStrategy = stageById('advanced-discount-strategy');
const orderState = stageById('advanced-order-state');
const interfaceSegregation = stageById('advanced-interface-segregation');
const valueObject = stageById('advanced-value-object');

// 2問目と3問目は同じ2つの設計で、依頼だけが違う(どこが変わるかで良し悪しが入れ替わる)
const formatSplitDesign = design('帳票の整形を ReportFormatter に分けた設計', sampleAnswerCodebase(volatileFormat));
const taxSplitDesign = design('税の計算を TaxCalculator に分けた設計', sampleAnswerCodebase(volatileTax));

/** 設計くらべクイズの一覧。この順に出題する。 */
export const comparisonQuizzes: readonly ComparisonQuiz[] = [
  {
    id: 'quiz-user-controller-mail',
    title: '1問目: メールの文面を変えるなら',
    description: userController.description,
    limits: userController.limits,
    designs: {
      a: design('保存は UserRepository、メールは Mailer に分けた設計', sampleAnswerCodebase(userController)),
      b: design('登録・保存・メール送信を UserController にまとめた設計', userController.codebase),
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
  {
    id: 'quiz-collapse-hierarchy',
    title: '4問目: 子が1つしかない継承',
    description: '売上をCSVでダウンロードさせるコード。CSVを書き出す処理を、継承を使う形と使わない形の2通りで作った。',
    limits: collapseHierarchy.limits,
    designs: {
      a: design('基底クラス BaseExporter と、その子 CsvExporter に分けた設計', collapseHierarchy.codebase),
      b: design('CSVの処理を CsvExporter 1クラスにまとめた設計', sampleAnswerCodebase(collapseHierarchy)),
    },
    changeRequest: firstRequest(collapseHierarchy),
    explanation:
      '子が1つしかない継承は、CSVという1つの概念を2クラスに分けてしまい、区切り文字の変更でも BaseExporter と CsvExporter の両方を直すことになる。拡張ポイントは、2つ目の出力形式が本当に必要になってから作れば間に合う。',
  },
  {
    id: 'quiz-discount-strategy',
    title: '5問目: プレミアム会員の割引率が変わるなら',
    description: 'ネットショップの注文で、会員ランク(通常・プレミアム・VIP)ごとに割引を計算するコード。同じ機能を2通りに書いた設計がある。',
    limits: discountStrategy.limits,
    designs: {
      a: design('割引の計算を、ランクごとのクラス RegularDiscount・PremiumDiscount・VipDiscount に分けた設計', sampleAnswerCodebase(discountStrategy)),
      b: design('ランクごとの割引を、DiscountService の calculateDiscount の中の if 分岐で切り替える設計', discountStrategy.codebase),
    },
    changeRequest: requestById(discountStrategy, 'req-premium-discount'),
    explanation:
      'ランクごとのクラスに分けた設計なら、プレミアムの割引率の変更は PremiumDiscount の中で済む。if 分岐の設計では、通常・VIPの計算や入力の検証が同居する14行の calculateDiscount に+5行が入り、メソッドの上限18行を超えてしまう。方式ごとにクラスを分けるのが Strategy パターン。',
  },
  {
    id: 'quiz-order-state',
    title: '6問目: 支払済みの注文の取り消しが変わるなら',
    description: 'ネットショップの注文の支払い・発送・取り消し。注文の状態(未払い・支払済み・発送済み)で振る舞いが変わる処理を、2通りに書いた設計がある。',
    limits: orderState.limits,
    designs: {
      a: design('状態ごとの分岐を、Order の pay・ship・cancel のそれぞれの中に書いた設計', orderState.codebase),
      b: design('状態ごとの処理を、UnpaidState・PaidState・ShippedState のクラスに分けた設計', sampleAnswerCodebase(orderState)),
    },
    changeRequest: requestById(orderState, 'req-paid-refund-fee'),
    explanation:
      '状態ごとのクラスに分けた設計なら、支払済みの注文の扱いは PaidState の中を読めば済む。分岐を Order の各メソッドに書いた設計では、pay・ship・cancel のどれを直すときも、未払い・発送済みの分岐を一緒に読んで巻き込むことになる。状態そのものをクラスにするのが State パターン。',
  },
  {
    id: 'quiz-interface-segregation',
    title: '7問目: タスクの登録が変わるなら',
    description: '障害対応の連絡を Slack・Teams・Backlog・Chatwork へ送るコード。チャットへの投稿とタスク管理の約束(インターフェース)を、2通りに作った設計がある。',
    limits: interfaceSegregation.limits,
    designs: {
      a: design('投稿は ChatClient、タスク管理は TaskTracker と、インターフェースを役割ごとに分けた設計', sampleAnswerCodebase(interfaceSegregation)),
      b: design('投稿とタスク管理を、1つのインターフェース CollaborationTool にまとめた設計', interfaceSegregation.codebase),
    },
    changeRequest: requestById(interfaceSegregation, 'req-task-assignee'),
    explanation:
      '役割ごとに分けた設計なら、タスクの登録を直すのは、本当にタスクを扱う Backlog と Chatwork のクラスで済む。1つにまとめた設計では、タスクを扱えない Slack・Teams の空実装(createTask)まで直す対象になり、投稿の処理と同じクラスで巻き込みも増える。使わない約束を押し付けないのがインターフェース分離の原則。',
  },
  {
    id: 'quiz-value-object',
    title: '8問目: 金額の表示が変わるなら',
    description: '経費精算システム。申請・承認・精算の3つのサービスが、外貨を含む経費の金額を扱う。金額と通貨の持ち方を2通りに作った設計がある。',
    limits: valueObject.limits,
    designs: {
      a: design('金額を数値、通貨を文字列のまま、各サービスで扱う設計', valueObject.codebase),
      b: design('金額と通貨を Money クラスにまとめた設計', sampleAnswerCodebase(valueObject)),
    },
    changeRequest: requestById(valueObject, 'req-hide-yen-decimals'),
    explanation:
      'Money にまとめた設計なら、金額の表示の変更は Money の format の中で済む(呼び出し元のサービスは動作確認だけ)。数値と文字列のまま扱う設計では、申請と精算の2つのサービスに同じ表示の処理があり、両方を直したうえ、承認依頼や振込の処理を巻き込む。値とそのルールを1か所にまとめるのが値オブジェクト。',
  },
];
