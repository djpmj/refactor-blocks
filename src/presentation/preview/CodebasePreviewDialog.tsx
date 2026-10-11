import { useEffect, useRef, useState } from 'react';
import type { Codebase } from '../../domain/codebase/Codebase';
import { CodebasePreviewCanvas } from './CodebasePreviewCanvas';
import { WindowControls } from './WindowControls';
import { PreviewMethodPanel } from './PreviewMethodPanel';

const TITLE_ID = 'codebase-preview-title';

type CodebasePreviewDialogProps = {
  readonly title: string;
  /** null なら表示しない。ネイティブの dialog に Esc・背景の上乗せ・フォーカストラップを任せる。 */
  readonly codebase: Codebase | null;
  readonly methodLimit: number;
  readonly onClose: () => void;
};

export function CodebasePreviewDialog({ title, codebase, methodLimit, onClose }: CodebasePreviewDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const [maximized, setMaximized] = useState(false);
  const [selectedMethodId, setSelectedMethodId] = useState<string | null>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (codebase !== null && dialog !== null && !dialog.open) dialog.showModal();
  }, [codebase]);
  const close = () => {
    setMaximized(false);
    setSelectedMethodId(null);
    onClose();
  };
  if (codebase === null) return null;
  return (
    <dialog ref={ref} className={`codebase-preview${maximized ? ' codebase-preview--maximized' : ''}`} aria-labelledby={TITLE_ID} onClose={close} data-testid="codebase-preview">
      <div className="codebase-preview__header">
        <h2 className="codebase-preview__title" id={TITLE_ID}>
          {title}
        </h2>
        <WindowControls maximized={maximized} onToggleMaximize={() => setMaximized((current) => !current)} onClose={close} maximizeTestId="codebase-preview-maximize" />
      </div>
      <div className="codebase-preview__body">
        <div className="codebase-preview__canvas">
          <CodebasePreviewCanvas codebase={codebase} methodLimit={methodLimit} selectedMethodId={selectedMethodId} onSelectMethod={setSelectedMethodId} />
        </div>
        {selectedMethodId === null ? null : <PreviewMethodPanel key={selectedMethodId} codebase={codebase} methodId={selectedMethodId} />}
      </div>
    </dialog>
  );
}
