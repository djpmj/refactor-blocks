import { useState } from 'react';
import { sampleAnswerSteps } from '../../domain/stage/sampleAnswer';
import type { Stage } from '../../domain/stage/Stage';
import { describeSolutionStep } from './describeSolutionStep';

/** 模範解答の手順を1手ずつ日本語の文にして、押すたびに1つ開くヒント。呼び出し側で key={stage.id} を付ける。 */
export function HintPanel({ stage, disabled }: Readonly<{ stage: Stage; disabled: boolean }>) {
  const [revealedCount, setRevealedCount] = useState(0);
  const steps = sampleAnswerSteps[stage.id] ?? [];
  const hints = steps.slice(0, revealedCount).map((step) => describeSolutionStep(stage.codebase, step));
  const hasMore = revealedCount < steps.length;
  return (
    <div className="stage-panel__hints">
      <button
        type="button"
        onClick={() => {
          setRevealedCount((count) => count + 1);
        }}
        disabled={disabled || !hasMore}
      >
        ヒントを見る{revealedCount > 0 ? `(${String(revealedCount)}/${String(steps.length)})` : ''}
      </button>
      {hints.length > 0 && (
        <ol className="stage-panel__hint-list">
          {hints.map((hint, index) => (
            <li key={index}>{hint}</li>
          ))}
        </ol>
      )}
    </div>
  );
}
