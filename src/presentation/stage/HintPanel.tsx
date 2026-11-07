/** 押すたびにヒントを1つ開くボタン。開いた数は呼び出し側が持つ。 */
export function HintButton({ revealed, total, disabled, onReveal }: Readonly<{ revealed: number; total: number; disabled: boolean; onReveal: () => void }>) {
  return (
    <div className="stage-panel__hint-step">
      <span className="stage-panel__hint-number" aria-hidden="true">2</span>
      <ReasonButton onClick={onReveal} disabledReason={hintStepReason({ problemRevealed: !disabled, revealed, total })}>
        次の一手{revealed > 0 ? `(${String(revealed)}/${String(total)})` : ''}
      </ReasonButton>
    </div>
  );
}
import { ReasonButton } from '../ReasonButton';
import { hintStepReason } from './disabledReasons';
