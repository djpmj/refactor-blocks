import { useEffect, useState } from 'react';

const IDLE_DELAY = 30_000;

/** Reports inactivity after a fixed 30 seconds while enabled. */
export function useIdle(enabled: boolean, resetKey: unknown, activityKey?: unknown): boolean {
  const [state, setState] = useState<{ key: unknown; activityKey: unknown; idle: boolean }>({ key: resetKey, activityKey, idle: false });
  useEffect(() => {
    if (!enabled) return;
    let timer = window.setTimeout(() => setState({ key: resetKey, activityKey, idle: true }), IDLE_DELAY);
    const reset = () => {
      setState({ key: resetKey, activityKey, idle: false });
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setState({ key: resetKey, activityKey, idle: true }), IDLE_DELAY);
    };
    window.addEventListener('pointerdown', reset, true);
    window.addEventListener('keydown', reset, true);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('pointerdown', reset, true);
      window.removeEventListener('keydown', reset, true);
    };
  }, [activityKey, enabled, resetKey]);
  return enabled && state.key === resetKey && state.activityKey === activityKey && state.idle;
}
