/** 押すたびにヒントを1つ開くボタン。開いた数は呼び出し側が持つ。 */
export function HintButton({ revealed, total, disabled, onReveal }: Readonly<{ revealed: number; total: number; disabled: boolean; onReveal: () => void }>) {
  return (
    <div className="stage-panel__hint-step">
      <span className="stage-panel__hint-number" aria-hidden="true">2</span>
      <button type="button" onClick={onReveal} disabled={disabled || revealed >= total} title={disabled ? '先に「どこが問題?」を見てみよう' : undefined}>
        次の一手{revealed > 0 ? `(${String(revealed)}/${String(total)})` : ''}
      </button>
    </div>
  );
}
