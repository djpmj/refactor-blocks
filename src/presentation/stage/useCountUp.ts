import { useEffect, useState } from 'react';
import { useGameStore } from '../store/useGameStore';

type AnimationValue = { readonly seq: number; readonly value: number };

export function useCountUp(value: number, seq: number | null, start: number, enabled: boolean): { readonly value: number; readonly active: boolean } {
  const [animation, setAnimation] = useState<AnimationValue | null>(null);

  useEffect(() => {
    if (!enabled || seq === null || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let frame = 0;
    const duration = value === 100 ? 1000 : 600;
    const from = Math.min(start, value);
    const begin = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - begin) / duration);
      setAnimation({ seq, value: Math.round(from + (value - from) * progress) });
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [enabled, seq, start, value]);

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const counting = enabled && !reducedMotion && seq !== null;
  let current = value;
  if (counting) {
    current = Math.min(start, value);
    if (animation?.seq === seq) current = animation.value;
  }
  const active = counting && (animation?.seq !== seq || animation.value !== value);
  return { value: current, active };
}

type ScoreCelebrationLike = { readonly seq: number; readonly scoreBefore: number; readonly scoreAfter: number } | null;

/** 点数リングを数え上げるか、どこから数えるか。点数が上がった直後の celebration がそのときの点数と一致するときだけ数える。 */
export function scoreCountUpInput(celebration: ScoreCelebrationLike, total: number): { readonly seq: number | null; readonly start: number; readonly enabled: boolean } {
  if (celebration !== null && celebration.scoreAfter === total && celebration.scoreAfter > celebration.scoreBefore) {
    return { seq: celebration.seq, start: celebration.scoreBefore, enabled: true };
  }
  return { seq: null, start: total, enabled: false };
}

/** 点数リングと同じ条件で数え上げる。ヘッダーのリングとツアーが同じ判定を使う。 */
export function useScoreCountUp(total: number): { readonly value: number; readonly active: boolean } {
  const celebration = useGameStore((state) => state.celebration);
  const input = scoreCountUpInput(celebration, total);
  return useCountUp(total, input.seq, input.start, input.enabled);
}
