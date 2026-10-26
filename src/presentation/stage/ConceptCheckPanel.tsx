import { useState } from 'react';
import { judgeCheck } from '../../domain/stage/conceptCheck';
import type { ConceptCheck } from '../../domain/stage/Stage';
import { AnswerVerdict } from '../feedback/AnswerVerdict';

type CheckItemProps = Readonly<{
  check: ConceptCheck;
  /** 答え済みなら、そのとき選んだ選択肢の添字。 */
  answered: number | undefined;
  onAnswer: (chosen: number) => void;
}>;

function CheckResult({ check, chosen }: Readonly<{ check: ConceptCheck; chosen: number }>) {
  const judgement = judgeCheck(check, chosen);
  const correctChoice = check.choices.at(judgement.answer);
  const chosenChoice = check.choices.at(chosen);
  return (
    <div className="concept-check__result" aria-live="polite" data-testid="check-result">
      <AnswerVerdict correct={judgement.correct} label={judgement.correct ? '✓ 正解' : `✗ 不正解(正解: ${correctChoice?.text ?? ''})`} />
      {chosenChoice !== undefined && (
        <p>
          <strong>{judgement.correct ? '解説:' : 'あなたの答えについて:'}</strong> {chosenChoice.explanation}
        </p>
      )}
      {!judgement.correct && correctChoice !== undefined && (
        <p>
          <strong>正解の理由:</strong> {correctChoice.explanation}
        </p>
      )}
    </div>
  );
}

function CheckItem({ check, answered, onAnswer }: CheckItemProps) {
  const [selected, setSelected] = useState<number | null>(null);
  const done = answered !== undefined;
  return (
    <fieldset className="concept-check__item">
      <legend>{check.question}</legend>
      {check.choices.map((choice, index) => (
        <div key={choice.text}>
          <label>
            <input
              type="radio"
              name={`check-${check.id}`}
              checked={(done ? answered : selected) === index}
              disabled={done}
              onChange={() => setSelected(index)}
            />{' '}
            {choice.text}
          </label>
        </div>
      ))}
      {!done && (
        <button type="button" disabled={selected === null} onClick={() => selected !== null && onAnswer(selected)}>
          答える
        </button>
      )}
      {done && <CheckResult check={check} chosen={answered} />}
    </fieldset>
  );
}

/** 100点のときに出す、選択式の理解度チェック。1回の挑戦で全問正解したら onAllCorrect を呼ぶ。回答の状態はここだけに持つ(呼び出し側で key={stage.id} を付ける)。 */
export function ConceptCheckPanel({ checks, onAllCorrect }: Readonly<{ checks: readonly ConceptCheck[]; onAllCorrect: () => void }>) {
  const [answers, setAnswers] = useState<Readonly<Partial<Record<string, number>>>>({});
  const [round, setRound] = useState(0);
  const correctCount = checks.filter((check) => judgeCheck(check, answers[check.id] ?? -1).correct).length;
  const allAnswered = checks.every((check) => answers[check.id] !== undefined);
  return (
    <section className="concept-check" aria-labelledby="concept-check-title">
      <h3 id="concept-check-title">理解度チェック</h3>
      {checks.map((check) => (
        <CheckItem
          key={`${String(round)}-${check.id}`}
          check={check}
          answered={answers[check.id]}
          onAnswer={(chosen) => {
            const next = { ...answers, [check.id]: chosen };
            setAnswers(next);
            if (checks.every((item) => judgeCheck(item, next[item.id] ?? -1).correct)) onAllCorrect();
          }}
        />
      ))}
      {allAnswered && (
        <div aria-live="polite">
          <p className={correctCount === checks.length ? 'concept-check__summary concept-check__summary--perfect' : 'concept-check__summary'} data-testid="check-summary">
            {correctCount === checks.length ? `全問正解!(${checks.length}問中${correctCount}問正解)` : `${checks.length}問中${correctCount}問正解`}
            {correctCount === checks.length && <span className="concept-check__perfect-confetti" aria-hidden="true">{Array.from({ length: 20 }, (_, index) => <span key={index} />)}</span>}
          </p>
          <button
            type="button"
            onClick={() => {
              setAnswers({});
              setRound((current) => current + 1);
            }}
          >
            もう一度
          </button>
        </div>
      )}
    </section>
  );
}
