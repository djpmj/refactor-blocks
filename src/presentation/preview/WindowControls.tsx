function MaximizeIcon({ maximized }: Readonly<{ maximized: boolean }>) {
  return (
    <svg viewBox="0 0 10 10" stroke="currentColor" fill="none" aria-hidden="true">
      {maximized ? <><rect x="2.5" y="1.5" width="6" height="6" /><rect x="1.5" y="2.5" width="6" height="6" /></> : <rect x="1.5" y="1.5" width="7" height="7" />}
    </svg>
  );
}

export function WindowControls({ maximized, onToggleMaximize, onClose, maximizeTestId }: Readonly<{
  maximized: boolean;
  onToggleMaximize: () => void;
  onClose: () => void;
  maximizeTestId: string;
}>) {
  const label = maximized ? '元のサイズに戻す' : '最大化';
  return (
    <div className="window-controls">
      <button type="button" className="window-control" data-testid={maximizeTestId} aria-pressed={maximized} aria-label={label} title={label} onClick={onToggleMaximize}>
        <MaximizeIcon maximized={maximized} />
      </button>
      <button type="button" className="window-control window-control--close" onClick={onClose} aria-label="閉じる" title="閉じる">✕</button>
    </div>
  );
}
