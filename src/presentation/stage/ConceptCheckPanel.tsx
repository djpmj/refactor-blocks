import { useState } from 'react';
import { judgeCheck } from '../../domain/stage/conceptCheck';
import type { ConceptCheck } from '../../domain/stage/Stage';

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
      <p className="concept-check__verdict">{judgement.correct ? '✓ 正解' : `✗ 不正解(正解: ${correctChoice?.text ?? ''})`}</p>
      {chosenChoice !== undefined && <p>{chosenChoice.explanation}</p>}
      {!judgement.correct && correctChoice !== undefined && <p>{correctChoice.explanation}</p>}
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

/** 100点のときに出す、選択式の理解度チェック。回答の状態はここだけに持つ(呼び出し側で key={stage.id} を付ける)。 */
export function ConceptCheckPanel({ checks }: Readonly<{ checks: readonly ConceptCheck[] }>) {
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
          onAnswer={(chosen) => setAnswers((current) => ({ ...current, [check.id]: chosen }))}
        />
      ))}
      {allAnswered && (
        <div aria-live="polite">
          <p data-testid="check-summary">
            {checks.length}問中{correctCount}問正解
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
