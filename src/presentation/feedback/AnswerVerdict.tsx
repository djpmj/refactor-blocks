type AnswerVerdictProps = Readonly<{
  correct: boolean;
  label: string;
  celebrate?: boolean;
  confettiCount?: number;
}>;

/** 回答の正誤を色と控えめな動きで示す共通表示。 */
export function AnswerVerdict({ correct, label, celebrate = correct, confettiCount = 8 }: AnswerVerdictProps) {
  const showConfetti = correct && celebrate;
  return (
    <div className={`answer-verdict answer-verdict--${correct ? 'correct' : 'incorrect'}${showConfetti ? ' answer-verdict--celebrate' : ''}`}>
      {showConfetti && (
        <span className="answer-verdict__confetti" aria-hidden="true">
          {Array.from({ length: confettiCount }, (_, index) => (
            <span className="answer-verdict__piece" key={index} />
          ))}
        </span>
      )}
      <span className="answer-verdict__label">{label}</span>
    </div>
  );
}
