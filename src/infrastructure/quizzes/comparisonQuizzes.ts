import type { ChangeRequest } from '../../domain/change/ChangeRequest';
import type { Codebase } from '../../domain/codebase/Codebase';
import type { ComparisonQuiz } from '../../domain/quiz/ComparisonQuiz';
import { sampleAnswerCodebase } from '../../domain/stage/sampleAnswer';
import type { ConceptCheck, Stage } from '../../domain/stage/Stage';
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

/** 全問共通の問い。選択肢は設計を名指ししない文にし、答える前に正解が透けないようにする。 */
const REASON_QUESTION = 'そう考えた理由に近いものは?';

function reasonCheck(quizId: string, answer: number, choices: ConceptCheck['choices']): ConceptCheck {
  return { id: `${quizId}-reason`, question: REASON_QUESTION, choices, answer };
}

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
    reason: reasonCheck('quiz-user-controller-mail', 1, [
      {
        text: 'クラスの数が少ないほど、読む場所が減って変更しやすいから',
        explanation:
          '数が少なくても、1クラスにHTTP・DB・メールが混ざっていると、メールを直すときに他の処理まで巻き込む。数より「変わる理由ごとに分かれているか」を見る。',
      },
      {
        text: 'メールの処理が1か所にまとまっていて、直すクラスがそこだけで済むから',
        explanation:
          'メール送信が Mailer にまとまっていれば、直すのは Mailer だけで済む(呼び出し元の UserController は動作確認だけ)。UserController に混ざっていると、HTTPやDBの処理を巻き込んで壊すおそれがあり、行数の上限も超えてしまう。',
      },
      {
        text: 'ファイルやクラスが多いほど、きちんと整理された設計だから',
        explanation:
          '分ける数が多いこと自体は良さではない。分けすぎると1つの変更で複数のクラスを直すことになる(4問目)。依頼で変わる処理が1か所に閉じているかで決まる。',
      },
    ]),
  },
  {
    id: 'quiz-sales-report-tax',
    title: '2問目: 税の計算ルールが変わるなら',
    description: '月次・四半期の売上帳票を作るコード。同じ機能を2通りに分けた設計がある。',
    limits: volatileTax.limits,
    designs: { a: formatSplitDesign, b: taxSplitDesign },
    changeRequest: firstRequest(volatileTax),
    reason: reasonCheck('quiz-sales-report-tax', 0, [
      {
        text: '税の計算が小さなクラスに閉じていて、変更がそのクラスの中で済むから',
        explanation:
          '税の計算を TaxCalculator に閉じ込めた設計なら、税の変更は小さなクラスの中で済む。整形を分けた設計では、税の変更(2か所で+28行)が54行の SalesReportService に入り、クラスの上限60行を超えてしまう(82行)。',
      },
      {
        text: '帳票の整形を分けてあるほうが、どんな変更にも強いから',
        explanation:
          '整形を分けた設計が強いのは整形が変わるとき(3問目)。税の変更は54行の SalesReportService に入り、クラスの上限60行を超える。',
      },
      {
        text: 'メソッドの数が少ないほうが、変更する場所を探しやすいから',
        explanation:
          'メソッドの数ではなく、依頼で変わる処理(税の計算)がどこにあるかで変更の大きさが決まる。',
      },
    ]),
  },
  {
    id: 'quiz-sales-report-format',
    title: '3問目: 帳票の形式が変わるなら',
    description: '2問目とまったく同じ2つの設計。今度は帳票の形式を変える依頼が来た。',
    limits: volatileFormat.limits,
    designs: { a: formatSplitDesign, b: taxSplitDesign },
    changeRequest: firstRequest(volatileFormat),
    reason: reasonCheck('quiz-sales-report-format', 2, [
      {
        text: '2問目で楽だった設計は、どんな依頼でも楽だから',
        explanation:
          '同じ2つの設計でも、依頼が変われば答えは入れ替わる。どこが変わるかを先に見る。',
      },
      {
        text: '大きなクラスに処理が集まっているほうが、まとめて直せるから',
        explanation:
          '46行の SalesReportService に+28行入ると上限60行を超える。大きなクラスへの追加は、上限超えと巻き込みが起きやすい。',
      },
      {
        text: '帳票の整形が小さなクラスに閉じていて、形式の変更がそのクラスの中で済むから',
        explanation:
          '整形を ReportFormatter に閉じ込めた設計なら、形式の変更は小さなクラスの中で済む。税を分けた設計では、整形の変更(2か所で+28行)が46行の SalesReportService に入り、クラスの上限60行を超える。2問目と同じ2つの設計なのに答えが入れ替わる。良い設計とは、よく変わる所を閉じ込めた設計のこと。',
      },
    ]),
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
    reason: reasonCheck('quiz-collapse-hierarchy', 1, [
      {
        text: '基底クラスを用意しておけば、将来ほかの出力形式を足しやすいから',
        explanation:
          'それは2つ目の出力形式が来たときの話。今の依頼(区切り文字の変更)では BaseExporter と CsvExporter の両方を直すことになる。拡張ポイントは本当に要るときに作れば間に合う。',
      },
      {
        text: 'CSVという1つの概念が1クラスにまとまっていて、区切り文字の変更が1か所で済むから',
        explanation:
          '子が1つしかない継承は、CSVという1つの概念を2クラスに分けてしまい、区切り文字の変更でも BaseExporter と CsvExporter の両方を直すことになる。拡張ポイントは、2つ目の出力形式が本当に必要になってから作れば間に合う。',
      },
      {
        text: 'クラスが1つなら、メソッドがどれだけ長くなっても困らないから',
        explanation:
          '1クラスにまとめても、メソッドが上限を超えて長くなれば読みにくくなる。この問題で楽なのは、変更が1か所で済むから。',
      },
    ]),
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
    reason: reasonCheck('quiz-discount-strategy', 2, [
      {
        text: 'if 分岐のほうが、コードが1か所に集まって読みやすいから',
        explanation:
          '集まっているぶん、通常・VIPの計算や入力の検証も同じメソッドに同居する。プレミアムだけ直したくても、それらを一緒に読んで巻き込むことになる。',
      },
      {
        text: 'クラスの数が少ないほど、変更しやすいから',
        explanation:
          'クラスの数ではなく、依頼で変わる処理(プレミアムの割引率)が1か所に閉じているかで決まる。分岐の設計はクラスが少ない代わりに、メソッドが上限を超えてしまう。',
      },
      {
        text: 'プレミアムの割引の計算が専用のクラスに閉じていて、変更がそのクラスの中で済むから',
        explanation:
          'ランクごとのクラスに分けた設計なら、プレミアムの割引率の変更は PremiumDiscount の中で済む。if 分岐の設計では、通常・VIPの計算や入力の検証が同居する24行の calculateDiscount に+5行が入り、メソッドの上限18行を超えたまま29行になってしまう。方式ごとにクラスを分けるのが Strategy パターン。',
      },
    ]),
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
    reason: reasonCheck('quiz-order-state', 0, [
      {
        text: '支払済みの扱いが専用のクラスにまとまっていて、そのクラスを読めば済むから',
        explanation:
          '状態ごとのクラスに分けた設計なら、支払済みの注文の扱いは PaidState の中を読めば済む。分岐を Order の各メソッドに書いた設計では、pay・ship・cancel のどれを直すときも、未払い・発送済みの分岐を一緒に読んで巻き込むことになる。状態そのものをクラスにするのが State パターン。',
      },
      {
        text: '分岐が1つのクラスの中にあるほうが、全体の流れを追いやすいから',
        explanation:
          '全体は追いやすくても、支払済みの扱いは pay・ship・cancel に散らばる。どれを直すときも、未払い・発送済みの分岐を一緒に読んで巻き込む。',
      },
      {
        text: '状態の種類が増えても、メソッドを足すだけで済むから',
        explanation:
          'それは状態が増えたときの話。今の依頼は支払済みの取り消しの変更で、変わる処理が1か所に閉じているかが問われている。',
      },
    ]),
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
    reason: reasonCheck('quiz-interface-segregation', 2, [
      {
        text: 'インターフェースが1つのほうが、実装するクラスが覚えることが少ないから',
        explanation:
          '1つにまとめると、タスクを扱えない Slack・Teams まで、呼ばれると例外を投げるだけの createTask を持つことになる。覚えることが減るより、直す対象が増える。',
      },
      {
        text: 'メソッドが多いインターフェースのほうが、将来の機能追加に強いから',
        explanation:
          '今の依頼はタスクの登録の変更で、機能追加ではない。使わない約束まで持たせると、変更のたびに関係ないクラスまで直す対象になる。',
      },
      {
        text: 'タスク管理の約束が分かれていて、直すのはタスクを扱うクラスだけで済むから',
        explanation:
          '役割ごとに分けた設計なら、タスクの登録を直すのは、本当にタスクを扱う Backlog と Chatwork のクラスで済む。1つにまとめた設計では、タスクを扱えない Slack・Teams の「未対応」の例外を投げるだけの createTask まで見直す対象になり、投稿の処理と同じクラスで巻き込みも増える。使わない約束を押し付けないのがインターフェース分離の原則。',
      },
    ]),
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
    reason: reasonCheck('quiz-value-object', 1, [
      {
        text: '数値と文字列のままのほうが、型が単純で扱いやすいから',
        explanation:
          '単純なぶん、表示のルールが申請と精算のサービスに同じ形で散らばる。表示を変えるときは、両方を直すことになる。',
      },
      {
        text: '金額と通貨が Money に閉じていて、表示の変更が Money の中で済むから',
        explanation:
          'Money にまとめた設計なら、金額の表示の変更は Money の format の中で済む(呼び出し元のサービスは動作確認だけ)。数値と文字列のまま扱う設計では、申請と精算の2つのサービスに同じ表示の処理があり、両方を直したうえ、承認依頼や振込の処理を巻き込む。値とそのルールを1か所にまとめるのが値オブジェクト。',
      },
      {
        text: 'サービスごとに金額の処理を持つほうが、他への影響が少ないから',
        explanation:
          '持つ場所が分かれるほど、同じ変更を何か所にも入れることになり、直し漏れも起きる。値とそのルールを1か所にまとめたほうが影響は小さい。',
      },
    ]),
  },
];
