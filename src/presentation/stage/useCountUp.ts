import { useEffect, useState } from 'react';

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
