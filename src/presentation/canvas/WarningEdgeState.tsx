import { useState, type ReactNode } from 'react';
import { WarningEdgeContext } from './WarningEdgeContext';

export function WarningEdgeStateProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [openId, setOpenId] = useState<string | null>(null);
  return <WarningEdgeContext.Provider value={{ openId, setOpenId }}>{children}</WarningEdgeContext.Provider>;
}
