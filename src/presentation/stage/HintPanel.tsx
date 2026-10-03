/** 押すたびにヒントを1つ開くボタン。開いた数は呼び出し側が持つ。 */
export function HintButton({ revealed, total, disabled, onReveal }: Readonly<{ revealed: number; total: number; disabled: boolean; onReveal: () => void }>) {
  return (
    <button type="button" onClick={onReveal} disabled={disabled || revealed >= total}>
      ヒントを見る{revealed > 0 ? `(${String(revealed)}/${String(total)})` : ''}
    </button>
  );
}
