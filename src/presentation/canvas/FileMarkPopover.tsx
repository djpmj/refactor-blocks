import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { findClass, findClassOfMethod, findMethod, type Codebase } from '../../domain/codebase/Codebase';
import type { FileDeductionReason, FileSeverity } from '../../domain/scoring/fileScores';
import { RULE_LABEL } from '../stage/describeScore';
import { RULE_WHY } from '../stage/ruleWhy';

function targetName(codebase: Codebase, targetId: string): string {
  const method = findMethod(codebase, targetId);
  const ownerClass = method === undefined ? undefined : findClassOfMethod(codebase, targetId);
  if (method !== undefined && ownerClass !== undefined) return `${ownerClass.name}.${method.name}()`;
  const codeClass = findClass(codebase, targetId);
  if (codeClass !== undefined) return codeClass.name;
  return codebase.files.find((file) => file.id === targetId)?.path ?? targetId;
}

export function FileMarkPopover({ anchor, tooltipId, severity, points, reasons, codebase }: Readonly<{
  anchor: HTMLElement;
  tooltipId: string;
  severity: FileSeverity;
  points: number;
  reasons: readonly FileDeductionReason[];
  codebase: Codebase;
}>) {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: 0, top: 0 });
  const label = severity === 'danger' ? `危険: -${points}点` : `修正が必要: -${points}点`;
  const rules = [...new Set(reasons.map((reason) => reason.rule))];

  useLayoutEffect(() => {
    const place = () => {
      const rect = anchor.getBoundingClientRect();
      const popup = ref.current?.getBoundingClientRect();
      const width = popup?.width ?? 320;
      const height = popup?.height ?? 100;
      setPosition({
        left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)),
        top: Math.max(8, Math.min(rect.bottom + 6, window.innerHeight - height - 8)),
      });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [anchor, reasons]);

  return createPortal(
    <div ref={ref} id={tooltipId} role="tooltip" data-testid="file-mark-reasons" className="file-mark-popover" style={{ left: position.left, top: position.top }}>
      <strong>{label}</strong>
      <ul>{reasons.map((reason, index) => <li key={`${reason.rule}-${reason.targetId}-${index}`}>{RULE_LABEL[reason.rule]}: {targetName(codebase, reason.targetId)} -{reason.points}点</li>)}</ul>
      {rules.map((rule) => <p className="file-mark-popover__why" key={rule}>{RULE_WHY[rule].trouble}</p>)}
    </div>,
    document.body,
  );
}
