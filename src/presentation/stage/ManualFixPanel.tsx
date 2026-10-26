import { useEffect, useMemo, useRef } from 'react';
import { findClassOfMethod, type Codebase } from '../../domain/codebase/Codebase';
import { checkManualFix, isManualFixSolved, type ManualFixResult } from '../../domain/change/checkManualFix';
import { measurePain, painRequestsOf } from '../../domain/change/changePain';
import type { Stage } from '../../domain/stage/Stage';
import { useGameStore } from '../store/useGameStore';
import { explainChangeImpact } from '../../domain/change/changeImpact';
import { ChangeImpactDialog } from '../change/ChangeImpactDialog';
import { describeManualFix } from './describeManualFix';

function nameOf(codebase: Codebase, methodId: string): string {
  const owner = findClassOfMethod(codebase, methodId);
  const method = owner?.methods.find((candidate) => candidate.id === methodId);
  return owner === undefined || method === undefined ? methodId : `${owner.name}.${method.name}`;
}

type ResultViewProps = Readonly<{
  stage: Stage;
  codebase: Codebase;
  result: ManualFixResult;
  opening: boolean;
  closingFix: boolean;
  openingFix: { readonly missed: number; readonly extra: number; readonly sites: number; readonly fixedIds: readonly string[] } | null | undefined;
  canReviewImpact: boolean;
  onOpenImpact: () => void;
  onRestart: () => void;
  onClose: () => void;
}>;

function FixResultStatus({ codebase, result }: Readonly<{ codebase: Codebase; result: ManualFixResult }>) {
  return isManualFixSolved(result) ? <p role="status">✅ 直し忘れなし。{result.sites} か所すべてを直せました</p> : (
    <div role="status"><p>⚠ 直し忘れ {result.missed.length} か所。本番でバグになります</p><ul>{result.missed.map((id) => <li key={id}>{nameOf(codebase, id)}</li>)}</ul></div>
  );
}

function FixComparison({ stage, codebase, openingFix }: Readonly<{ stage: Stage; codebase: Codebase; openingFix: ResultViewProps['openingFix'] }>) {
  const pain = measurePain(stage, codebase);
  if (pain === undefined) return null;
  const classShift = pain.current.classes < pain.initial.classes ? `(${pain.initial.classes} クラス → ${pain.current.classes} クラス)` : '';
  return openingFix === null
    ? <p data-testid="fix-comparison">直す場所 {pain.initial.siteIds.length} か所 → {pain.current.siteIds.length} か所{classShift}、読む量 {pain.initial.readLines} 行 → {pain.current.readLines} 行になりました</p>
    : <p data-testid="fix-comparison">冒頭: 直す場所 {pain.initial.siteIds.length} か所・読む量 {pain.initial.readLines} 行(直し忘れ {openingFix?.missed ?? 0} か所) → 今回: 直す場所 {pain.current.siteIds.length} か所{classShift}・読む量 {pain.current.readLines} 行</p>;
}

function PainSummary({ codebase, stage, result, opening }: Readonly<{ codebase: Codebase; stage: Stage; result: ManualFixResult; opening: boolean }>) {
  const pain = measurePain(stage, codebase);
  const classNames = result.siteClassIds.map((id) => codebase.files.flatMap((file) => file.classes).find((codeClass) => codeClass.id === id)?.name ?? id);
  const messages = describeManualFix({ result, classNames, opening, readLines: pain?.current.readLines ?? 0 });
  return <>
    {result.extra.length > 0 && <p>関係のないメソッドに印を付けていました: {result.extra.map((id) => nameOf(codebase, id)).join('、')}</p>}
    {messages.map((message) => <p key={message}>{message}</p>)}
  </>;
}

function ResultActions({ opening, closingFix, solved, canReviewImpact, onOpenImpact, onRestart, onClose }: Pick<ResultViewProps, 'opening' | 'closingFix' | 'canReviewImpact' | 'onOpenImpact' | 'onRestart' | 'onClose'> & { readonly solved: boolean }) {
  return <div className="manual-fix__actions">
    {opening ? <button type="button" onClick={onClose}>組み替えを始める</button> : <>
      {closingFix && solved && canReviewImpact && <button type="button" data-testid="impact-review-open" onClick={onOpenImpact}>答え合わせを見る</button>}
      {closingFix && !solved && <button type="button" onClick={onRestart}>もう一度やる</button>}
      <button type="button" onClick={onClose}>閉じる</button>
    </>}
  </div>;
}

function ResultView({ stage, codebase, result, opening, closingFix, openingFix, canReviewImpact, onOpenImpact, onRestart, onClose }: ResultViewProps) {
  const solved = isManualFixSolved(result);
  return (
    <>
      <FixResultStatus codebase={codebase} result={result} />
      <PainSummary codebase={codebase} stage={stage} result={result} opening={opening} />
      {closingFix && solved && <FixComparison stage={stage} codebase={codebase} openingFix={openingFix} />}
      {closingFix && solved && <p>次は「変更依頼に挑戦」で、新しい機能を実際に足してみましょう</p>}
      {closingFix && !solved && <p>直し忘れや関係のない印がなくなるまで、もう一度やってみましょう。</p>}
      <ResultActions opening={opening} closingFix={closingFix} solved={solved} canReviewImpact={canReviewImpact} onOpenImpact={onOpenImpact} onRestart={onRestart} onClose={onClose} />
    </>
  );
}

function FixInput({ fixedCount, onRelease, onClose }: Readonly<{ fixedCount: number; onRelease: () => void; onClose: () => void }>) {
  return (
    <>
      <p>メソッドをクリックすると中身が右に出ます。直す必要があると判断したメソッドの右のチェックボックスで『直した』印を付けてください。付け終えたらリリースします</p>
      <p>直した印: {fixedCount} 個</p>
      <div className="manual-fix__actions"><button type="button" onClick={onRelease}>リリースする</button><button type="button" onClick={onClose}>やめる</button></div>
    </>
  );
}

function manualFixResult(codebase: Codebase, request: ReturnType<typeof painRequestsOf>['modify'], manualFix: { readonly fixedIds: readonly string[] } | null): ManualFixResult | null {
  if (request === undefined || manualFix === null) return null;
  return checkManualFix(codebase, request, manualFix.fixedIds);
}

function scrollBehavior(): ScrollBehavior {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
}

function manualFixPhase(manualFix: { readonly released: boolean } | null): string {
  if (manualFix === null) return 'closed';
  return manualFix.released ? 'released' : 'editing';
}

/** 変更依頼を「手で直す」シミュレーション。印を付けてリリースすると、付け漏れ(直し忘れ)が本番バグとして報告される。 */
export function ManualFixPanel({ stage, codebase }: Readonly<{ stage: Stage; codebase: Codebase }>) {
  const manualFix = useGameStore((state) => state.manualFix);
  const impactReviewOpen = useGameStore((state) => state.impactReviewOpen);
  const openImpactReview = useGameStore((state) => state.openImpactReview);
  const closeImpactReview = useGameStore((state) => state.closeImpactReview);
  const releaseManualFix = useGameStore((state) => state.releaseManualFix);
  const restartManualFix = useGameStore((state) => state.restartManualFix);
  const endManualFix = useGameStore((state) => state.endManualFix);
  const openingFix = useGameStore((state) => state.openingFixes[stage.id]);
  const request = painRequestsOf(stage).modify;
  const impact = useMemo(() => request === undefined ? undefined : explainChangeImpact(stage.codebase, codebase, request), [codebase, request, stage.codebase]);
  const result = manualFixResult(codebase, request, manualFix);
  const solved = result !== null && isManualFixSolved(result);
  const sectionRef = useRef<HTMLElement>(null);
  const visiblePhase = manualFixPhase(manualFix);
  const previousPhase = useRef(visiblePhase);
  const autoOpenedImpactReview = useRef(false);
  useEffect(() => {
    if (manualFix?.released !== true) autoOpenedImpactReview.current = false;
    if (manualFix?.released === true && manualFix.step === 'closing-fix' && solved && impact !== undefined && !autoOpenedImpactReview.current) {
      autoOpenedImpactReview.current = true;
      openImpactReview();
    }
  }, [impact, manualFix?.released, manualFix?.step, openImpactReview, solved]);
  useEffect(() => {
    if (visiblePhase !== 'closed' && visiblePhase !== previousPhase.current) {
      requestAnimationFrame(() => {
        const sidebar = sectionRef.current?.closest('.sidebar');
        sectionRef.current?.scrollIntoView({ block: 'nearest', behavior: scrollBehavior() });
        if (sidebar instanceof HTMLElement && sectionRef.current !== null) {
          const target = sectionRef.current.getBoundingClientRect();
          const container = sidebar.getBoundingClientRect();
          if (target.bottom > container.bottom) sidebar.scrollBy({ top: target.bottom - container.bottom, behavior: scrollBehavior() });
          if (target.top < container.top) sidebar.scrollBy({ top: target.top - container.top, behavior: scrollBehavior() });
        }
      });
    }
    previousPhase.current = visiblePhase;
  }, [visiblePhase]);
  if (request === undefined) return null;
  const fixedCount = manualFix?.fixedIds.filter((id) => findClassOfMethod(codebase, id) !== undefined).length ?? 0;
  const canReviewImpact = impact !== undefined;
  return (
    <>
      {manualFix !== null && <section ref={sectionRef} className="manual-fix" aria-label="手で直すシミュレーション">
        <h3>手で直してみる</h3>
        <p><strong>{request.title}</strong>: {request.description}</p>
        {manualFix.released && result !== null
          ? <ResultView stage={stage} codebase={codebase} result={result} opening={manualFix.step === 'opening-fix'} closingFix={manualFix.step === 'closing-fix'} openingFix={openingFix} canReviewImpact={canReviewImpact} onOpenImpact={openImpactReview} onRestart={restartManualFix} onClose={endManualFix} />
          : <FixInput fixedCount={fixedCount} onRelease={releaseManualFix} onClose={endManualFix} />}
      </section>}
      {impact !== undefined && impactReviewOpen && <ChangeImpactDialog stage={stage} current={codebase} request={request} openingFix={openingFix} open={impactReviewOpen} onClose={closeImpactReview} />}
    </>
  );
}
