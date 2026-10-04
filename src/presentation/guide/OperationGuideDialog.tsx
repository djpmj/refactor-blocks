import { useEffect, useRef } from 'react';
import { OPERATION_GUIDE } from './operationGuide';

const TITLE_ID = 'operation-guide-title';
const KEY_PATTERN = /(Ctrl\+Shift\+Z|Ctrl\+Z|Cmd\+Shift\+Z|Cmd\+Z|Ctrl\+Y|Cmd\+Y|Enter|Esc|←|→|\?)/g;
const KEY_MATCH = /^(Ctrl\+Shift\+Z|Ctrl\+Z|Cmd\+Shift\+Z|Cmd\+Z|Ctrl\+Y|Cmd\+Y|Enter|Esc|←|→|\?)$/;

function OperationText({ text }: Readonly<{ text: string }>) {
  return text.split(KEY_PATTERN).map((part, index) =>
    KEY_MATCH.test(part) ? <kbd key={`${part}-${String(index)}`}>{part}</kbd> : part,
  );
}

export function OperationGuideDialog({ open, onClose }: Readonly<{ open: boolean; onClose: () => void }>) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (dialog === null) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);
  return (
    <dialog ref={ref} className="operation-guide" aria-labelledby={TITLE_ID} onClose={onClose} data-testid="operation-guide">
      <div className="operation-guide__header">
        <h2 className="operation-guide__title" id={TITLE_ID}>操作ガイド</h2>
        <button type="button" onClick={onClose} aria-label="閉じる" data-testid="operation-guide-close">✕</button>
      </div>
      <div className="operation-guide__content">
        {OPERATION_GUIDE.map((section) => (
          <section className="operation-guide__section" key={section.heading}>
            <h3>{section.heading}</h3>
            <dl>
              {section.items.map(({ operation, description }) => (
                <div className="operation-guide__item" key={operation}>
                  <dt><OperationText text={operation} /></dt>
                  <dd>{description}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </dialog>
  );
}
