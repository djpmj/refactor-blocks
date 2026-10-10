import { createContext, useContext, type Dispatch, type SetStateAction } from 'react';

export type WarningEdgeState = { readonly openId: string | null; readonly setOpenId: Dispatch<SetStateAction<string | null>> };
export const WarningEdgeContext = createContext<WarningEdgeState | null>(null);

export function useWarningEdgeState(): WarningEdgeState {
  const state = useContext(WarningEdgeContext);
  if (state === null) throw new Error('WarningEdgeStateProvider が必要です');
  return state;
}
