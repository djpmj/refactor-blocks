import { useCallback, useEffect, useState } from 'react';
import type { Codebase } from '../../domain/codebase/Codebase';
import { useGameStore } from '../store/useGameStore';
import { loadModeIntroSeen, saveModeIntroSeen } from '../../infrastructure/tour/tourPreference';
import { MODE_INTRO_STEPS, nextTourStep, TOUR_STEPS, tourResultText, type ModeIntroKind, type TourStep } from './tourSteps';

type Spotlight = { readonly top: number; readonly right: number; readonly bottom: number; readonly left: number };
type Callout = { readonly left: number; readonly top: number };

function methodCount(codebase: Codebase): number {
  return codebase.files.reduce((count, file) => count + file.classes.reduce((classCount, codeClass) => classCount + codeClass.methods.length, 0), 0);
}

function fallbackCallout(): Callout {
  return { left: Math.max(16, (window.innerWidth - 360) / 2), top: Math.max(16, (window.innerHeight - 170) / 2) };
}

function getTargetRect(selector: string): DOMRect | null {
  const target = document.querySelector(selector);
  if (target === null || target.closest('[hidden]') !== null) return null;
  const rect = target.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;
  if (rect.right <= 0 || rect.bottom <= 0 || rect.left >= window.innerWidth || rect.top >= window.innerHeight) return null;
  return rect;
}

function calloutFor(spotlight: Spotlight): Callout {
  const width = Math.min(360, window.innerWidth - 32);
  // ponytail: 吹き出しの高さは固定の見積もり。文言が長くなって見積もりを超えたら、描画後の実測に切り替える
  const height = 200;
  const below = spotlight.bottom + 12;
  const top = below + height < window.innerHeight ? below : Math.max(12, spotlight.top - height - 12);
  return { left: Math.min(Math.max(16, spotlight.left), window.innerWidth - width - 16), top };
}

function measureSpotlight(selector: string): { readonly spotlight: Spotlight | null; readonly callout: Callout } {
  const rect = getTargetRect(selector);
  if (rect === null) return { spotlight: null, callout: fallbackCallout() };
  const padding = 6;
  const spotlight = {
    left: Math.max(0, rect.left - padding),
    top: Math.max(0, rect.top - padding),
    right: Math.min(window.innerWidth, rect.right + padding),
    bottom: Math.min(window.innerHeight, rect.bottom + padding),
  };
  return { spotlight, callout: calloutFor(spotlight) };
}

function sameSpotlight(current: Spotlight | null, next: Spotlight | null): boolean {
  return current === next || (current !== null && next !== null
    && current.left === next.left && current.top === next.top && current.right === next.right && current.bottom === next.bottom);
}

function sameCallout(current: Callout | null, next: Callout): boolean {
  return current !== null && current.left === next.left && current.top === next.top;
}

// 手順の開始後、対象が現れた最初の1回だけ、画面からはみ出していれば画面内へスクロールする
function scrollIntoViewOnce(selector: string): boolean {
  const target = document.querySelector(selector);
  if (target === null || target.closest('[hidden]') !== null) return false;
  const rect = target.getBoundingClientRect();
  const inside = rect.top >= 0 && rect.left >= 0 && rect.bottom <= window.innerHeight && rect.right <= window.innerWidth;
  if (!inside) target.scrollIntoView({ block: 'nearest' });
  return true;
}

function useSpotlightPosition(step: TourStep | undefined, tourStep: number | null) {
  const [spotlight, setSpotlight] = useState<Spotlight | null>(null);
  const [callout, setCallout] = useState<Callout | null>(null);
  useEffect(() => {
    if (tourStep === null || step === undefined) return;
    let frame = 0;
    let scrolled = false;
    const measure = () => {
      if (!scrolled) scrolled = scrollIntoViewOnce(step.target);
      const position = measureSpotlight(step.target);
      setSpotlight((current) => sameSpotlight(current, position.spotlight) ? current : position.spotlight);
      setCallout((current) => sameCallout(current, position.callout) ? current : position.callout);
      frame = requestAnimationFrame(measure);
    };
    frame = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(frame);
  }, [step, tourStep]);
  return { spotlight, callout };
}

function useExtractAdvance(step: TourStep | undefined, tourStep: number | null, codebase: Codebase, advanceTour: (event: { readonly kind: 'method-count'; readonly count: number; readonly countAtStepStart: number }) => void): void {
  useEffect(() => {
    if (tourStep !== null && step?.advance.kind === 'extract') {
      advanceTour({ kind: 'method-count', count: methodCount(codebase), countAtStepStart: 0 });
    }
  }, [advanceTour, codebase, step, tourStep]);
}

function useEscapeEnd(tourStep: number | null, endTour: () => void): void {
  useEffect(() => {
    if (tourStep === null) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        endTour();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [endTour, tourStep]);
}

export function SpotlightTour() {
  const tourStep = useGameStore((state) => state.tourStep);
  const codebase = useGameStore((state) => state.codebase);
  const tourResult = useGameStore((state) => state.tourResult);
  const advanceTour = useGameStore((state) => state.advanceTour);
  const endTour = useGameStore((state) => state.endTour);
  const step = tourStep === null ? undefined : TOUR_STEPS[tourStep];
  const { spotlight, callout } = useSpotlightPosition(step, tourStep);
  useExtractAdvance(step, tourStep, codebase, advanceTour);
  useEscapeEnd(tourStep, endTour);
  if (tourStep === null || step === undefined || callout === null) return null;
  return <SpotlightOverlay stepNumber={tourStep + 1} total={TOUR_STEPS.length} testId="first-visit-tour" label="初回ガイド" step={step} text={tourStep === TOUR_STEPS.length - 1 && tourResult !== null ? tourResultText(tourResult) : step.text} spotlight={spotlight} callout={callout} onAdvance={advanceTour} onEnd={endTour} />;
}

function SpotlightOverlay({
  stepNumber,
  total,
  testId,
  label,
  step,
  text,
  spotlight,
  callout,
  onAdvance,
  onEnd,
}: Readonly<{
  stepNumber: number;
  total: number;
  testId: string;
  label: string;
  step: TourStep;
  text: string;
  spotlight: Spotlight | null;
  callout: Callout;
  onAdvance: (event: { readonly kind: 'next' }) => void;
  onEnd: () => void;
}>) {
  const missingTarget = spotlight === null;
  const top = spotlight?.top ?? 0;
  const right = spotlight?.right ?? window.innerWidth;
  const bottom = spotlight?.bottom ?? window.innerHeight;
  const left = spotlight?.left ?? 0;
  const advanceButtonVisible = step.advance.kind === 'next' || missingTarget;
  return (
    <>
      {missingTarget ? <div className="spotlight-tour__shade spotlight-tour__shade--full" /> : (
        <>
          <div className="spotlight-tour__shade spotlight-tour__shade--top" style={{ height: top }} />
          <div className="spotlight-tour__shade spotlight-tour__shade--left" style={{ top, width: left, height: Math.max(0, bottom - top) }} />
          <div className="spotlight-tour__shade spotlight-tour__shade--right" style={{ top, left: right, height: Math.max(0, bottom - top) }} />
          <div className="spotlight-tour__shade spotlight-tour__shade--bottom" style={{ top: bottom }} />
          <div className="spotlight-tour__hole" style={{ left, top, width: Math.max(0, right - left), height: Math.max(0, bottom - top) }} />
        </>
      )}
      <section className="spotlight-tour__callout" role="dialog" aria-label={label} aria-live="polite" data-testid={testId} style={{ left: callout.left, top: callout.top }}>
        <p className="spotlight-tour__step">{stepNumber}/{total}</p>
        <p>{text}</p>
        <div className="spotlight-tour__actions">
          {advanceButtonVisible ? <button type="button" onClick={() => onAdvance({ kind: 'next' })}>次へ</button> : null}
          <button type="button" onClick={onEnd}>ガイドを終了</button>
        </div>
      </section>
    </>
  );
}

export function ModeIntroGuide({ kind, active }: Readonly<{ kind: ModeIntroKind; active: boolean }>) {
  const [started, setStarted] = useState<number | null>(null);
  const [wasActive, setWasActive] = useState(false);
  // 開いた瞬間に、見た印が無ければ手順1から始める(effect内の setState を避けて描画中に切り替える)
  if (active !== wasActive) {
    setWasActive(active);
    if (active) setStarted(loadModeIntroSeen(kind) ? null : 0);
  }
  // 表示中に別のモードへ切り替えたら、見た印を付ける
  useEffect(() => {
    if (!active && started !== null) saveModeIntroSeen(kind);
  }, [active, started, kind]);
  const steps = MODE_INTRO_STEPS[kind];
  const current = active ? started : null;
  const step = current === null ? undefined : steps[current];
  const end = useCallback(() => {
    setStarted(null);
    saveModeIntroSeen(kind);
  }, [kind]);
  const { spotlight, callout } = useSpotlightPosition(step, current);
  useEscapeEnd(current, end);
  if (current === null || step === undefined || callout === null) return null;
  const advance = () => {
    const next = nextTourStep(steps, current, { kind: 'next' });
    if (next === null) end();
    else setStarted(next);
  };
  return <SpotlightOverlay stepNumber={current + 1} total={steps.length} testId="mode-intro-guide" label="モードの案内" step={step} text={step.text} spotlight={spotlight} callout={callout} onAdvance={advance} onEnd={end} />;
}
