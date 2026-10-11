import { findMethod, type Codebase } from '../../domain/codebase/Codebase';
import { PreviewMethodPanel } from '../preview/PreviewMethodPanel';

export function ManualFixMethodViewer({ codebase, methodId }: Readonly<{ codebase: Codebase; methodId: string | null }>) {
  if (methodId === null || findMethod(codebase, methodId) === undefined) {
    return (
      <section className="manual-fix-method-viewer" aria-label="手で直す中のメソッドの内容">
        <p className="manual-fix-method-viewer__empty">メソッドをクリックすると、ここにそのメソッドの処理の一覧が出ます</p>
      </section>
    );
  }

  return (
    <section className="manual-fix-method-viewer" aria-label="手で直す中のメソッドの内容">
      <PreviewMethodPanel key={methodId} codebase={codebase} methodId={methodId} />
    </section>
  );
}
