import { useEffect, useState } from 'react';
import { useGameStore } from '../store/useGameStore';

type TargetKind = 'fileIds' | 'classIds' | 'methodIds';

export function useResolvedCelebration(kind: TargetKind, id: string): boolean {
  const celebration = useGameStore((state) => {
    const current = state.celebration;
    return current !== null && current.resolved[kind].includes(id) ? current : null;
  });
  const [activeSeq, setActiveSeq] = useState<number | null>(null);
  const seq = celebration?.seq ?? null;

  useEffect(() => {
    if (seq === null) return;
    let frame = 0;
    const duration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 1200 : 650;
    frame = requestAnimationFrame(() => setActiveSeq(seq));
    const timer = window.setTimeout(() => setActiveSeq(null), duration);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [seq]);

  return celebration !== null && activeSeq === celebration.seq;
}
