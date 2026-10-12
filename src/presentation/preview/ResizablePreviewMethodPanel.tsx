import type { Codebase } from '../../domain/codebase/Codebase';
import type { useResizableSidebarWidth } from '../useResizableSidebarWidth';
import { PreviewMethodPanel } from './PreviewMethodPanel';

type ResizablePreviewMethodPanelProps = Readonly<{
  codebase: Codebase;
  methodId: string;
  width: number;
  handleProps: ReturnType<typeof useResizableSidebarWidth>['handleProps'];
}>;

export function ResizablePreviewMethodPanel({ codebase, methodId, width, handleProps }: ResizablePreviewMethodPanelProps) {
  return (
    <div className="preview-method-panel-resizable" style={{ width, maxWidth: 'calc(100% - 240px)' }}>
      <div className="sidebar-resizable__handle" {...handleProps} />
      <PreviewMethodPanel codebase={codebase} methodId={methodId} />
    </div>
  );
}
