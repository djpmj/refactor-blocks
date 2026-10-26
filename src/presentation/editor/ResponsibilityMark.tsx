import type { CSSProperties } from 'react';
import { responsibilityMarkLetter } from './responsibilityMarkLetter';

/** 色と英字で同じ種類を識別する印。名前があれば、丸の右に責務の日本語名を文字で出す。 */
export function ResponsibilityMark({ number, name }: Readonly<{ number: number; name?: string }>) {
  const letter = responsibilityMarkLetter(number);
  const style: CSSProperties & { readonly '--responsibility-color': string } = {
    '--responsibility-color': `var(--resp-${number % 8})`,
  };
  const hasName = name !== undefined && name !== '';
  return (
    <>
      <span
        className="responsibility-mark"
        style={style}
        aria-label={`責務 ${letter}`}
        title={hasName ? `責務 ${letter}: ${name}` : `責務 ${letter}`}
      >
        {letter}
      </span>
      {hasName ? <span className="responsibility-mark__name">{name}</span> : null}
    </>
  );
}
