import { useEffect, useState } from 'react';
import type { Codebase } from '../../domain/codebase/Codebase';
import { useGameStore } from '../store/useGameStore';
import { TOUR_STEPS, type TourStep } from './tourSteps';

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
  const height = 170;
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

function useSpotlightPosition(step: TourStep | undefined, tourStep: number | null) {
  const [spotlight, setSpotlight] = useState<Spotlight | null>(null);
  const [callout, setCallout] = useState<Callout | null>(null);
  useEffect(() => {
    if (tourStep === null || step === undefined) return;
    let frame = 0;
    const measure = () => {
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

function useClickAdvance(step: TourStep | undefined, tourStep: number | null, advanceTour: (event: { readonly kind: 'clicked-inside' }) => void): void {
  useEffect(() => {
    if (tourStep === null || step?.advance.kind !== 'click-inside') return;
    const onClick = (event: MouseEvent) => {
      const target = event.target;
      if (target instanceof Element && target.closest(step.target) !== null) advanceTour({ kind: 'clicked-inside' });
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [advanceTour, step, tourStep]);
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
  const advanceTour = useGameStore((state) => state.advanceTour);
  const endTour = useGameStore((state) => state.endTour);
  const step = tourStep === null ? undefined : TOUR_STEPS[tourStep];
  const { spotlight, callout } = useSpotlightPosition(step, tourStep);
  useClickAdvance(step, tourStep, advanceTour);
  useExtractAdvance(step, tourStep, codebase, advanceTour);
  useEscapeEnd(tourStep, endTour);
  if (tourStep === null || step === undefined || callout === null) return null;
  return <SpotlightOverlay stepNumber={tourStep + 1} step={step} spotlight={spotlight} callout={callout} onAdvance={advanceTour} onEnd={endTour} />;
}

function SpotlightOverlay({
  stepNumber,
  step,
  spotlight,
  callout,
  onAdvance,
  onEnd,
}: Readonly<{
  stepNumber: number;
  step: TourStep;
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
      <section className="spotlight-tour__callout" role="dialog" aria-label="初回ガイド" aria-live="polite" data-testid="first-visit-tour" style={{ left: callout.left, top: callout.top }}>
        <p className="spotlight-tour__step">{stepNumber}/5</p>
        <p>{step.text}</p>
        <div className="spotlight-tour__actions">
          {advanceButtonVisible ? <button type="button" onClick={() => onAdvance({ kind: 'next' })}>次へ</button> : null}
          <button type="button" onClick={onEnd}>ガイドを終了</button>
        </div>
      </section>
    </>
  );
}
