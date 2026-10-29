import { useEffect, useMemo, useRef, useState } from 'react';
import type { ComparisonQuiz, DesignChoice, QuizAnswer } from '../../domain/quiz/ComparisonQuiz';
import { judgeQuizAnswer, type ComparisonVerdict, type QuizAnswerVerdict } from '../../domain/quiz/judgeComparison';
import { recordQuizAnswer } from '../../domain/quiz/quizRecord';
import { loadQuizRecord, saveQuizRecord } from '../../infrastructure/progress/quizRecordStorage';
import { comparisonQuizzes } from '../../infrastructure/quizzes/comparisonQuizzes';
import { describeDeductions, siteNames } from '../change/describeChange';
import { CodebasePreviewCanvas } from '../preview/CodebasePreviewCanvas';
import { AnswerVerdict } from '../feedback/AnswerVerdict';
import { sharedZoom } from './sharedZoom';
import { answerMark, isCorrect, summarizeQuiz, type QuizSummary } from './summarizeQuiz';

const CHOICES: readonly DesignChoice[] = ['a', 'b'];
const CHOICE_LABEL: Record<DesignChoice, string> = { a: 'A', b: 'B' };
/** これより小さいとメソッド名・行数が読めないので、A・Bをそろえる縮尺の下限にする。 */
const MIN_SHARED_ZOOM = 0.6;

/** 答え合わせで、その設計に依頼を当てたときの結果を出す。 */
function DesignResult({ quiz, choice, verdict }: Readonly<{ quiz: ComparisonQuiz; choice: DesignChoice; verdict: ComparisonVerdict }>) {
  const assessment = verdict.assessments[choice];
  const { codebase } = quiz.designs[choice];
  const reasons = describeDeductions(assessment, codebase);
  const { impact } = assessment;
  return (
    <div className="quiz-design__result" data-testid={`quiz-result-${choice}`}>
      <p>
        <strong>{assessment.score.total}点</strong>
        {verdict.answer === choice ? '(楽なのはこちら)' : ''}
      </p>
      <p>
        変更が必要: {siteNames(assessment, codebase)}({impact.classesTouched}クラス・{impact.filesTouched}ファイル・+{impact.linesAdded}行)
      </p>
      {reasons.length === 0 ? (
        <p>減点なし</p>
      ) : (
        <ul>
          {reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

type DesignPanelProps = Readonly<{ quiz: ComparisonQuiz; choice: DesignChoice; verdict: ComparisonVerdict | null; zoom?: number; onFitZoom: (zoom: number) => void }>;

function DesignPanel({ quiz, choice, verdict, zoom, onFitZoom }: DesignPanelProps) {
  const design = quiz.designs[choice];
  return (
    <section className="quiz-design" aria-label={`設計${CHOICE_LABEL[choice]}`} data-testid={`quiz-design-${choice}`}>
      <h3 className="quiz-design__title">
        設計{CHOICE_LABEL[choice]}: {design.label}
      </h3>
      {/* 答える前は上限超えの警告色を出さない(赤い方を避けるだけで正解できてしまうため) */}
      <div className="quiz-design__canvas">
        <CodebasePreviewCanvas codebase={design.codebase} methodLimit={verdict === null ? Infinity : quiz.limits.method} wheelZoom={false} maxZoom={zoom} onFitZoom={onFitZoom} />
      </div>
      {verdict === null ? null : <DesignResult quiz={quiz} choice={choice} verdict={verdict} />}
    </section>
  );
}

/** 設計と理由の合否に応じた判定の文。 */
function verdictLabel({ design, correct }: QuizAnswerVerdict): string {
  const easier = `(楽なのは設計${CHOICE_LABEL[design.answer]})`;
  if (correct) return `⭕ 正解!${easier}`;
  return design.correct ? `❌ 不正解: 設計は合っているが、理由がちがう${easier}` : `❌ 不正解${easier}`;
}

/** 選んだ理由の解説と、理由が誤りのときの正解の理由。 */
function ReasonExplanation({ quiz, verdict, chosen }: Readonly<{ quiz: ComparisonQuiz; verdict: QuizAnswerVerdict; chosen: number }>) {
  const chosenChoice = quiz.reason.choices.at(chosen);
  const correctChoice = quiz.reason.choices.at(verdict.reason.answer);
  return (
    <>
      {chosenChoice === undefined ? null : (
        <p>
          <strong>{verdict.reason.correct ? '解説:' : 'あなたの理由について:'}</strong> {chosenChoice.explanation}
        </p>
      )}
      {verdict.reason.correct || correctChoice === undefined ? null : (
        <p>
          <strong>正解の理由:</strong> {correctChoice.text}。{correctChoice.explanation}
        </p>
      )}
    </>
  );
}

type VerdictProps = Readonly<{ quiz: ComparisonQuiz; verdict: QuizAnswerVerdict; chosen: number; autoFocus: boolean }>;

/** 判定結果。出たらフォーカスを移し、押したボタンが無効になってもキーボード・読み上げの位置を見失わないようにする。 */
function Verdict({ quiz, verdict, chosen, autoFocus }: VerdictProps) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (autoFocus) ref.current?.focus();
  }, [autoFocus]);
  return (
    <div ref={ref} className={`quiz__verdict quiz__verdict--${verdict.correct ? 'correct' : 'incorrect'}`} data-testid="quiz-verdict" tabIndex={-1}>
      <AnswerVerdict correct={verdict.correct} label={verdictLabel(verdict)} />
      <ReasonExplanation quiz={quiz} verdict={verdict} chosen={chosen} />
    </div>
  );
}

type ReasonStepProps = Readonly<{
  quiz: ComparisonQuiz;
  /** 答え済みなら、選んだ理由の添字。 */
  answered: number | undefined;
  onSubmit: (reason: number) => void;
  autoFocus: boolean;
}>;

/** 2段目: 楽だと考えた理由を3択で選ぶ。出たらフォーカスを移し、無効になった1段目のボタンで位置を見失わないようにする。 */
function ReasonStep({ quiz, answered, onSubmit, autoFocus }: ReasonStepProps) {
  const [selected, setSelected] = useState<number | null>(null);
  const ref = useRef<HTMLFieldSetElement>(null);
  useEffect(() => {
    if (autoFocus) ref.current?.focus();
  }, [autoFocus]);
  const done = answered !== undefined;
  return (
    <fieldset ref={ref} className="concept-check__item" data-testid="quiz-reason" tabIndex={-1}>
      <legend>{quiz.reason.question}</legend>
      {quiz.reason.choices.map((choice, index) => (
        <div key={choice.text}>
          <label>
            <input type="radio" name={`quiz-reason-${quiz.id}`} checked={(done ? answered : selected) === index} disabled={done} onChange={() => setSelected(index)} /> {choice.text}
          </label>
        </div>
      ))}
      {done ? null : (
        <button type="button" data-testid="quiz-reason-submit" disabled={selected === null} onClick={() => selected !== null && onSubmit(selected)}>
          答える
        </button>
      )}
    </fieldset>
  );
}

/** A・Bのプレビューが収まる縮尺をそれぞれ受け取り、両方そろったら小さい方にそろえた縮尺を返す。 */
function useSharedZoom() {
  const [fitZooms, setFitZooms] = useState<Partial<Record<DesignChoice, number>>>({});
  const { a: fitA, b: fitB } = fitZooms;
  const zoom = fitA === undefined || fitB === undefined ? undefined : sharedZoom(fitA, fitB, MIN_SHARED_ZOOM);
  const onFitZooms = useMemo(() => {
    const report = (candidate: DesignChoice) => (value: number) => setFitZooms((current) => (current[candidate] === value ? current : { ...current, [candidate]: value }));
    return { a: report('a'), b: report('b') };
  }, []);
  return { zoom, onFitZooms };
}

function NextButton({ isLast, onNext }: Readonly<{ isLast: boolean; onNext: () => void }>) {
  return (
    <button type="button" data-testid={isLast ? 'quiz-results' : 'quiz-next'} onClick={onNext}>
      {isLast ? '結果を見る' : '次のクイズへ'}
    </button>
  );
}

type QuestionProps = Readonly<{
  quiz: ComparisonQuiz;
  answer: QuizAnswer | null;
  onAnswer: (answer: QuizAnswer) => void;
  isLast: boolean;
  onNext: () => void;
  focusTitle: boolean;
}>;

/** 1問分。答えは親が持つので、答え済みの問題を開き直すと答えと解説が出たままになる(1段目だけ選んだ設計はここで持ち、別の問題へ移ると捨てる)。focusTitle なら表示時に見出しへフォーカスを移す。 */
function QuizQuestion({ quiz, answer, onAnswer, isLast, onNext, focusTitle }: QuestionProps) {
  // 開いた時点で答え済みなら判定へフォーカスを奪わない(select の矢印キーで見返しているため)
  const [answeredOnOpen] = useState(answer !== null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (focusTitle) titleRef.current?.focus();
  }, [focusTitle]);
  const [pickedDesign, setPickedDesign] = useState<DesignChoice | null>(null);
  const design = answer?.design ?? pickedDesign;
  const judged = answer === null ? null : judgeQuizAnswer(quiz, answer);
  const verdict = judged?.ok === true ? judged.value : null;
  const { limits, changeRequest } = quiz;
  const { zoom, onFitZooms } = useSharedZoom();
  return (
    <>
      <div className="quiz__question">
        <h2 ref={titleRef} className="quiz__title" tabIndex={-1}>
          {quiz.title}
        </h2>
        <p>{quiz.description}</p>
        <p>
          依頼: <strong>{changeRequest.title}</strong> — {changeRequest.description}(変更箇所1つにつき+{changeRequest.linesPerSite}行)
        </p>
        <p className="quiz__limits">
          行数の上限: メソッド{limits.method}行・クラス{limits.class}行・ファイル{limits.file}行
        </p>
        <p className="quiz__prompt">この変更が楽なのはどちらの設計?</p>
        <div className="quiz__actions">
          {CHOICES.map((candidate) => (
            <button key={candidate} type="button" data-testid={`quiz-choose-${candidate}`} aria-pressed={design === candidate} disabled={design !== null} onClick={() => setPickedDesign(candidate)}>
              {CHOICE_LABEL[candidate]}のほうが楽
            </button>
          ))}
          {verdict === null ? null : <NextButton isLast={isLast} onNext={onNext} />}
        </div>
        {design === null ? null : <ReasonStep quiz={quiz} answered={answer?.reason} onSubmit={(reason) => onAnswer({ design, reason })} autoFocus={!answeredOnOpen} />}
        {verdict === null || answer === null ? null : <Verdict quiz={quiz} verdict={verdict} chosen={answer.reason} autoFocus={!answeredOnOpen} />}
      </div>
      <div className="quiz__designs">
        {CHOICES.map((candidate) => (
          <DesignPanel key={candidate} quiz={quiz} choice={candidate} verdict={verdict?.design ?? null} zoom={zoom} onFitZoom={onFitZooms[candidate]} />
        ))}
      </div>
    </>
  );
}

type LeaveMode = 'refactor' | 'blank';

function titleOf(id: string): string {
  return comparisonQuizzes.find((candidate) => candidate.id === id)?.title ?? id;
}

type SummaryProps = Readonly<{ summary: QuizSummary; onReview: (id: string) => void; onRetry: () => void; onLeave: (mode: LeaveMode) => void }>;

/** 全問の結果。不正解の問題は押すとその問題へ移る。 */
function QuizSummaryView({ summary, onReview, onRetry, onLeave }: SummaryProps) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  const { correct, total, wrongIds } = summary;
  return (
    <div ref={ref} className="quiz__summary" data-testid="quiz-summary" tabIndex={-1}>
      <h2 className="quiz__title">{correct === total ? `全問正解!(${total}問中${correct}問正解)` : `${total}問中${correct}問正解`}</h2>
      {wrongIds.length === 0 ? null : (
        <>
          <p>まちがえた問題:</p>
          <ul>
            {wrongIds.map((id) => (
              <li key={id}>
                <button type="button" onClick={() => onReview(id)}>
                  {titleOf(id)}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      <div className="quiz__actions">
        <button type="button" data-testid="quiz-retry" onClick={onRetry}>
          もう一度解く
        </button>
        <button type="button" data-testid="quiz-to-refactor" onClick={() => onLeave('refactor')}>
          リファクタリングに戻る
        </button>
        <button type="button" data-testid="quiz-to-blank" onClick={() => onLeave('blank')}>
          白紙設計に挑戦する
        </button>
      </div>
    </div>
  );
}

type SelectProps = Readonly<{ currentId: string; answers: Readonly<Record<string, QuizAnswer>>; onSelect: (id: string) => void }>;

/** 問題を選ぶプルダウン。答えた問題には正解(✓)・不正解(✗)の印を付ける。 */
function QuizSelect({ currentId, answers, onSelect }: SelectProps) {
  return (
    <select
      aria-label="クイズ"
      className="quiz__select"
      value={currentId}
      onChange={(event) => {
        onSelect(event.target.value);
      }}
    >
      {comparisonQuizzes.map((candidate) => (
        <option key={candidate.id} value={candidate.id}>
          {candidate.title}
          {answerMark(candidate, answers[candidate.id])}
        </option>
      ))}
    </select>
  );
}

/** 設計くらべ: 同じ機能の設計A・Bと変更依頼を見せ、変更が楽な方を選ばせる。最後の問題のあとは結果のまとめを出す。 */
export function ComparisonQuizView({ onLeave }: Readonly<{ onLeave: (mode: LeaveMode) => void }>) {
  const [index, setIndex] = useState(0);
  // 「次のクイズへ」で進んだときだけ見出しへフォーカスを移す。最初の表示と、矢印キーで選び直せる select ではフォーカスを奪わない
  const [navigated, setNavigated] = useState(false);
  const [answers, setAnswers] = useState<Readonly<Record<string, QuizAnswer>>>({});
  const [resultsRequested, setResultsRequested] = useState(false);
  const quiz = comparisonQuizzes.at(index);
  if (quiz === undefined) return null;
  const goTo = (next: number, moveFocus: boolean) => {
    setIndex(next);
    setNavigated(moveFocus);
    setResultsRequested(false);
  };
  const goToId = (id: string, moveFocus: boolean) => {
    goTo(comparisonQuizzes.findIndex((candidate) => candidate.id === id), moveFocus);
  };
  const summary = summarizeQuiz(comparisonQuizzes, answers);
  const isLast = index + 1 >= comparisonQuizzes.length;
  const showSummary = resultsRequested && summary.unansweredIds.length === 0;
  return (
    <main className="quiz" aria-label="設計くらべ">
      <QuizSelect currentId={quiz.id} answers={answers} onSelect={(id) => goToId(id, false)} />
      {showSummary ? (
        <QuizSummaryView
          summary={summary}
          onReview={(id) => goToId(id, true)}
          onRetry={() => {
            setAnswers({});
            goTo(0, true);
          }}
          onLeave={onLeave}
        />
      ) : (
        <>
          {resultsRequested ? (
            <p role="alert" className="quiz__unanswered" data-testid="quiz-unanswered">
              まだ答えていない問題があります: {summary.unansweredIds.map(titleOf).join('、')}
            </p>
          ) : null}
          <QuizQuestion
            key={quiz.id}
            quiz={quiz}
            answer={answers[quiz.id] ?? null}
            onAnswer={(answer) => {
              saveQuizRecord(recordQuizAnswer(loadQuizRecord(), quiz.id, isCorrect(quiz, answer)));
              setAnswers((previous) => ({ ...previous, [quiz.id]: answer }));
            }}
            focusTitle={navigated}
            isLast={isLast}
            onNext={isLast ? () => setResultsRequested(true) : () => goTo(index + 1, true)}
          />
        </>
      )}
    </main>
  );
}
