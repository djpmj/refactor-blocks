import type { CSSProperties } from 'react';
import { responsibilityMarkLetter } from '../../domain/stage/responsibilityMarks';

/** 責務の種類名を隠し、色と英字で同じ種類を識別する印。 */
export function ResponsibilityMark({ number }: Readonly<{ number: number }>) {
  const letter = responsibilityMarkLetter(number);
  const style: CSSProperties & { readonly '--responsibility-color': string } = {
    '--responsibility-color': `var(--resp-${number % 8})`,
  };
  return (
    <span
      className="responsibility-mark"
      style={style}
      aria-label={`責務 ${letter}`}
      title={`責務 ${letter}`}
    >
      {letter}
    </span>
  );
}
