import { useId, useState, type ButtonHTMLAttributes, type Ref } from 'react';
import { disabledButtonProps } from './disabledButtonProps';

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'disabled' | 'onClick' | 'type' | 'aria-describedby'> & Readonly<{
  disabledReason: string | null;
  onClick: () => void;
  ref?: Ref<HTMLButtonElement>;
}>;

export function ReasonButton({ disabledReason, onClick, onFocus, onBlur, onKeyDown, title, children, ref, ...buttonProps }: Props) {
  const reasonId = useId();
  const [shown, setShown] = useState(false);
  const blocked = disabledReason !== null;
  return (
    <span className="reason-button" data-reason-shown={blocked && shown ? '' : undefined}>
      <button
        {...buttonProps}
        {...disabledButtonProps({ reason: disabledReason, reasonId, onClick, onBlockedClick: () => setShown(true) })}
        ref={ref}
        type="button"
        title={blocked ? undefined : title}
        onFocus={(event) => { if (blocked) { setShown(true); } onFocus?.(event); }}
        onBlur={(event) => { setShown(false); onBlur?.(event); }}
        onKeyDown={(event) => { if (event.key === 'Escape') { setShown(false); } onKeyDown?.(event); }}
      >{children}</button>
      {blocked && <span id={reasonId} className="reason-button__reason">{disabledReason}</span>}
    </span>
  );
}
