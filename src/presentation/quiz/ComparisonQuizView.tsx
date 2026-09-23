import { useEffect, useRef, useState } from 'react';
import type { ComparisonQuiz, DesignChoice } from '../../domain/quiz/ComparisonQuiz';
import { judgeComparison, type ComparisonVerdict } from '../../domain/quiz/judgeComparison';
import { comparisonQuizzes } from '../../infrastructure/quizzes/comparisonQuizzes';
import { describeDeductions, siteNames } from '../change/describeChange';
import { CodebasePreviewCanvas } from '../preview/CodebasePreviewCanvas';

const CHOICES: readonly DesignChoice[] = ['a', 'b'];
const CHOICE_LABEL: Record<DesignChoice, string> = { a: 'A', b: 'B' };

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

function DesignPanel({ quiz, choice, verdict }: Readonly<{ quiz: ComparisonQuiz; choice: DesignChoice; verdict: ComparisonVerdict | null }>) {
  const design = quiz.designs[choice];
  return (
    <section className="quiz-design" aria-label={`設計${CHOICE_LABEL[choice]}`} data-testid={`quiz-design-${choice}`}>
      <h3 className="quiz-design__title">
        設計{CHOICE_LABEL[choice]}: {design.label}
      </h3>
      <div className="quiz-design__canvas">
        <CodebasePreviewCanvas codebase={design.codebase} methodLimit={quiz.limits.method} wheelZoom={false} />
      </div>
      {verdict === null ? null : <DesignResult quiz={quiz} choice={choice} verdict={verdict} />}
    </section>
  );
}

/** 判定結果。出たらフォーカスを移し、押したボタンが無効になってもキーボード・読み上げの位置を見失わないようにする。 */
function Verdict({ quiz, verdict }: Readonly<{ quiz: ComparisonQuiz; verdict: ComparisonVerdict }>) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  return (
    <div ref={ref} className="quiz__verdict" data-testid="quiz-verdict" tabIndex={-1}>
      <p className="quiz__verdict-title">{verdict.correct ? '⭕ 正解!' : '❌ 不正解'}(楽なのは設計{CHOICE_LABEL[verdict.answer]})</p>
      <p>{quiz.explanation}</p>
    </div>
  );
}

/** 1問分。呼び出し側で key={quiz.id} を付け、問題が変わったら回答をリセットする。focusTitle なら表示時に見出しへフォーカスを移す。 */
function QuizQuestion({ quiz, onNext, focusTitle }: Readonly<{ quiz: ComparisonQuiz; onNext: (() => void) | null; focusTitle: boolean }>) {
  const [choice, setChoice] = useState<DesignChoice | null>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (focusTitle) titleRef.current?.focus();
  }, [focusTitle]);
  const judged = choice === null ? null : judgeComparison(quiz, choice);
  const verdict = judged?.ok === true ? judged.value : null;
  const { limits, changeRequest } = quiz;
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
            <button key={candidate} type="button" data-testid={`quiz-choose-${candidate}`} disabled={choice !== null} onClick={() => setChoice(candidate)}>
              {CHOICE_LABEL[candidate]}のほうが楽
            </button>
          ))}
          {verdict !== null && onNext !== null ? (
            <button type="button" data-testid="quiz-next" onClick={onNext}>
              次のクイズへ
            </button>
          ) : null}
        </div>
        {verdict === null ? null : <Verdict quiz={quiz} verdict={verdict} />}
      </div>
      <div className="quiz__designs">
        {CHOICES.map((candidate) => (
          <DesignPanel key={candidate} quiz={quiz} choice={candidate} verdict={verdict} />
        ))}
      </div>
    </>
  );
}

/** 設計くらべ: 同じ機能の設計A・Bと変更依頼を見せ、変更が楽な方を選ばせる。 */
export function ComparisonQuizView() {
  const [index, setIndex] = useState(0);
  // 「次のクイズへ」で進んだときだけ見出しへフォーカスを移す。最初の表示と、矢印キーで選び直せる select ではフォーカスを奪わない
  const [navigated, setNavigated] = useState(false);
  const quiz = comparisonQuizzes.at(index);
  if (quiz === undefined) return null;
  const goTo = (next: number, moveFocus: boolean) => {
    setIndex(next);
    setNavigated(moveFocus);
  };
  return (
    <main className="quiz" aria-label="設計くらべ">
      <select
        aria-label="クイズ"
        className="quiz__select"
        value={quiz.id}
        onChange={(event) => {
          goTo(comparisonQuizzes.findIndex((candidate) => candidate.id === event.target.value), false);
        }}
      >
        {comparisonQuizzes.map((candidate) => (
          <option key={candidate.id} value={candidate.id}>
            {candidate.title}
          </option>
        ))}
      </select>
      <QuizQuestion key={quiz.id} quiz={quiz} focusTitle={navigated} onNext={index + 1 < comparisonQuizzes.length ? () => goTo(index + 1, true) : null} />
    </main>
  );
}
