import { useEffect, useMemo, useRef, useState } from 'react';
import { checkManualFix } from '../../domain/change/checkManualFix';
import { explainChangeImpact } from '../../domain/change/changeImpact';
import type { ChangeRequest } from '../../domain/change/ChangeRequest';
import type { Codebase } from '../../domain/codebase/Codebase';
import type { Stage } from '../../domain/stage/Stage';
import { describeImpact } from './describeImpact';
import { CodebasePreviewCanvas } from '../preview/CodebasePreviewCanvas';
import { WindowControls } from '../preview/WindowControls';
import type { MethodHighlight } from '../preview/CodebasePreviewContext';

type OpeningFix = { readonly fixedIds: readonly string[] } | null | undefined;
type Props = {
  readonly stage: Stage;
  readonly current: Codebase;
  readonly request: ChangeRequest;
  readonly openingFix: OpeningFix;
  readonly open: boolean;
  readonly onClose: () => void;
};

function highlightMap(siteIds: readonly string[], missedIds: readonly string[] = []): ReadonlyMap<string, MethodHighlight> {
  const highlights = new Map<string, MethodHighlight>(siteIds.map((id) => [id, 'site']));
  for (const id of missedIds) highlights.set(id, 'missed');
  return highlights;
}

function PreviewSide({ title, codebase, highlights, siteCount, readLines, openingMissed }: Readonly<{
  title: string;
  codebase: Codebase;
  highlights: ReadonlyMap<string, MethodHighlight>;
  siteCount: number;
  readLines: number;
  openingMissed?: number;
}>) {
  return (
    <section className="impact-review__side" aria-label={title}>
      <h3>{title}</h3>
      <div className="impact-review__canvas"><CodebasePreviewCanvas codebase={codebase} methodLimit={Number.MAX_SAFE_INTEGER} wheelZoom={false} highlights={highlights} /></div>
      <p>直す場所 {siteCount} か所・読む量 {readLines} 行{openingMissed === undefined ? '' : `（冒頭のあなた: 直し忘れ ${openingMissed} か所）`}</p>
    </section>
  );
}

/** 組み替える前と今の変更箇所・責務移動を並べて振り返る。 */
export function ChangeImpactDialog({ stage, current, request, openingFix, open, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [maximized, setMaximized] = useState(false);
  const impact = useMemo(() => explainChangeImpact(stage.codebase, current, request), [stage.codebase, current, request]);
  const openingResult = openingFix == null ? null : checkManualFix(stage.codebase, request, openingFix.fixedIds);
  const beforeHighlights = useMemo(() => impact === undefined ? new Map<string, MethodHighlight>() : highlightMap(impact.before.sites.map((site) => site.methodId), openingResult?.missed), [impact, openingResult]);
  const afterHighlights = useMemo(() => impact === undefined ? new Map<string, MethodHighlight>() : highlightMap(impact.after.sites.map((site) => site.methodId)), [impact]);
  useEffect(() => {
    const dialog = ref.current;
    if (open && impact !== undefined && dialog !== null && !dialog.open) dialog.showModal();
  }, [impact, open]);
  if (impact === undefined) return null;
  const close = () => {
    setMaximized(false);
    onClose();
  };
  const explanation = describeImpact(impact, openingResult?.missed.length ?? null);
  return (
    <dialog ref={ref} className={`impact-review${maximized ? ' impact-review--maximized' : ''}`} aria-labelledby="impact-review-title" data-testid="impact-review" onClose={close} onCancel={(event) => { event.preventDefault(); ref.current?.close(); }} onKeyDown={(event) => { if (event.key === 'Escape') { event.preventDefault(); ref.current?.close(); } }}>
      <div className="impact-review__header">
        <h2 id="impact-review-title">答え合わせ: 「{request.title}」</h2>
        <WindowControls maximized={maximized} onToggleMaximize={() => setMaximized((value) => !value)} onClose={() => ref.current?.close()} maximizeTestId="impact-review-maximize" />
      </div>
      <div className="impact-review__body">
        <div className="impact-review__previews">
          <PreviewSide title="組み替える前" codebase={stage.codebase} highlights={beforeHighlights} siteCount={impact.before.sites.length} readLines={impact.before.readLines} openingMissed={openingResult?.missed.length} />
          <PreviewSide title="今" codebase={current} highlights={afterHighlights} siteCount={impact.after.sites.length} readLines={impact.after.readLines} />
        </div>
        <ul className="impact-review__explanation" data-testid="impact-explanation">
          {explanation.map((line) => <li key={line}>{line}</li>)}
        </ul>
      </div>
    </dialog>
  );
}
