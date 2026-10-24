import { useSyncExternalStore } from 'react';

const NARROW_QUERY = '(max-width: 700px)';

function subscribe(onChange: () => void): () => void {
  const query = window.matchMedia(NARROW_QUERY);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

/** 幅700px以下(スマホ相当)か。画面幅の変更にも追従する。 */
export function useNarrowScreen(): boolean {
  return useSyncExternalStore(subscribe, () => window.matchMedia(NARROW_QUERY).matches);
}
