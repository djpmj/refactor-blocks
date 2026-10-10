import { useCallback, useState } from 'react';

type SidebarState = { readonly stageId: string; readonly open: boolean; readonly openedOnPerfect: boolean };

/** サイドバーの開閉状態を保ちつつ、ステージごとに初回満点を記録する。 */
export function useStageSidebar(stageId: string, perfect: boolean): readonly [boolean, () => void, (open: boolean) => void] {
  const [sidebar, setSidebar] = useState<SidebarState>(() => ({
    stageId,
    open: window.matchMedia('(min-width: 1400px)').matches,
    openedOnPerfect: false,
  }));
  if (sidebar.stageId !== stageId) setSidebar({ ...sidebar, stageId, openedOnPerfect: false });
  else if (perfect && !sidebar.openedOnPerfect) setSidebar({ ...sidebar, open: true, openedOnPerfect: true });
  const toggle = useCallback(() => setSidebar((current) => ({ ...current, open: !current.open })), []);
  const setOpen = useCallback((open: boolean) => setSidebar((current) => current.open === open ? current : { ...current, open }), []);
  return [sidebar.open, toggle, setOpen];
}
