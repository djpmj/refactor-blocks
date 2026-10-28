import { useId, useRef, useState } from 'react';
import { splitByTerms, type GlossaryTerm, type TextSegment } from '../../domain/glossary/Glossary';
import { glossaryTerms } from '../../infrastructure/glossary/glossaryTerms';
import { usePopoverDismiss } from '../stage/usePopoverDismiss';

type TermButtonProps = {
  readonly term: GlossaryTerm;
  readonly text: string;
};

/** 用語1つ分。ホバー・フォーカス・タップで定義を出し、フォーカスだけで読み上げられるよう aria-describedby で常に結ぶ。 */
function GlossaryTermButton({ term, text }: TermButtonProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const ignoreFocus = useRef(false);
  const popoverId = useId();
  // Esc でボタンにフォーカスが戻るとき(同期で focus イベントが出る)、開き直さない
  const dismiss = () => {
    ignoreFocus.current = true;
    queueMicrotask(() => {
      ignoreFocus.current = false;
    });
    setOpen(false);
  };
  usePopoverDismiss(open, wrapRef, buttonRef, dismiss);
  return (
    <span
      ref={wrapRef}
      className="glossary-term-wrap"
      onMouseEnter={() => { setOpen(true); }}
      onMouseLeave={() => { setOpen(false); }}
    >
      <button
        ref={buttonRef}
        type="button"
        className="glossary-term"
        data-testid={`glossary-term-${term.id}`}
        aria-describedby={popoverId}
        onFocus={() => { if (!ignoreFocus.current) setOpen(true); }}
        onBlur={() => { setOpen(false); }}
        onClick={() => { setOpen(true); }}
      >
        {text}
      </button>
      <span id={popoverId} className="glossary-term__popover" data-testid={`glossary-popover-${term.id}`} hidden={!open} aria-hidden="true">
        <strong>{term.name}</strong>
        <span>{term.definition}</span>
        <span>例: {term.example}</span>
      </span>
    </span>
  );
}

function Segment({ segment }: Readonly<{ segment: TextSegment }>) {
  const term = segment.kind === 'term' ? glossaryTerms.find((candidate) => candidate.id === segment.termId) : undefined;
  return term === undefined ? <>{segment.text}</> : <GlossaryTermButton term={term} text={segment.text} />;
}

/** 文字列のうち用語を、点線の下線つきのボタン(ポップオーバーで定義を引ける)で包んで描く。用語が無ければ文字列だけ。 */
export function GlossaryText({ text }: Readonly<{ text: string }>) {
  return (
    <>
      {splitByTerms(text, glossaryTerms).map((segment, index) => (
        <Segment key={`${String(index)}-${segment.text}`} segment={segment} />
      ))}
    </>
  );
}

/** 「ことば: …」の1行。text に用語が1つも無ければ行ごと出さない。 */
export function GlossaryTermsRow({ text, className }: Readonly<{ text: string; className: string }>) {
  if (!splitByTerms(text, glossaryTerms).some((segment) => segment.kind === 'term')) return null;
  return <p className={className}>ことば: <GlossaryText text={text} /></p>;
}
