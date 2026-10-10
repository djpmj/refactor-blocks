import { useReactFlow } from '@xyflow/react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { findClass, findClassOfField, findClassOfMethod, findField, findMethod, type Codebase } from '../../domain/codebase/Codebase';
import type { GhostMove } from '../../domain/stage/ghostMove';
import type { CodebaseFlowNode } from './layoutCodebase';
import { useGameStore } from '../store/useGameStore';
import { FieldChipView } from './FieldChip';
import { MethodChipView } from './MethodChip';
import { ghostFitDuration } from './ghostFitDuration';

type Position = { left: number; top: number; width: number; height: number };
type GhostTargets = { source: HTMLElement; target: HTMLElement; from: DOMRect; to: DOMRect };
type FitViewOptions = { readonly fitView: (options: { nodes: CodebaseFlowNode[]; padding: number; duration: number; maxZoom: number }) => Promise<boolean>; readonly reducedMotion: boolean };
const wait = (milliseconds: number) => new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds));

function ownerClassId(ghost: GhostMove, codebase: Codebase): string | undefined {
  switch (ghost.kind) {
    case 'method': return findClassOfMethod(codebase, ghost.methodId)?.id;
    case 'field': return findClassOfField(codebase, ghost.fieldId)?.id;
    case 'class': return ghost.classId;
  }
}

function focusNodeIds(ghost: GhostMove, codebase: Codebase): string[] {
  if (ghost.kind === 'class') return [ghost.classId, ghost.toFileId];
  const ownerId = ownerClassId(ghost, codebase);
  return ownerId === undefined ? [] : [ownerId, ghost.toClassId];
}

function sourceSelector(ghost: GhostMove, codebase: Codebase): string {
  if (ghost.kind === 'method') return `[data-method-id="${CSS.escape(ghost.methodId)}"]`;
  if (ghost.kind === 'field') return `[data-field-id="${CSS.escape(ghost.fieldId)}"]`;
  const name = findClass(codebase, ghost.classId)?.name ?? '';
  return `[data-testid="class-header-${CSS.escape(name)}"]`;
}

function targetSelector(ghost: GhostMove, codebase: Codebase): string {
  if (ghost.kind === 'class') {
    const path = codebase.files.find((file) => file.id === ghost.toFileId)?.path ?? '';
    return `[data-testid="file-${CSS.escape(path)}"]`;
  }
  const name = findClass(codebase, ghost.toClassId)?.name ?? '';
  return `[data-testid="class-${CSS.escape(name)}"]`;
}

async function findGhostTargets(ghost: GhostMove, codebase: Codebase, nodes: CodebaseFlowNode[], options: FitViewOptions): Promise<GhostTargets | undefined> {
  const ids = new Set(focusNodeIds(ghost, codebase));
  const targetNodes = nodes.filter((node) => ids.has(node.id));
  if (targetNodes.length === 0) return undefined;
  await options.fitView({ nodes: targetNodes, padding: 0.3, duration: ghostFitDuration(options.reducedMotion), maxZoom: 0.9 });
  if (!options.reducedMotion) await wait(400);
  const source = document.querySelector(sourceSelector(ghost, codebase));
  const target = document.querySelector(targetSelector(ghost, codebase));
  if (!(source instanceof HTMLElement) || !(target instanceof HTMLElement)) return undefined;
  return { source, target, from: source.getBoundingClientRect(), to: target.getBoundingClientRect() };
}

function methodAnnouncement(ghost: Extract<GhostMove, { readonly kind: 'method' }>, codebase: Codebase): string {
  return `${findMethod(codebase, ghost.methodId)?.name ?? 'メソッド'} を ${findClass(codebase, ghost.toClassId)?.name ?? 'クラス'} へ動かすと良さそうです`;
}

function fieldAnnouncement(ghost: Extract<GhostMove, { readonly kind: 'field' }>, codebase: Codebase): string {
  return `${findField(codebase, ghost.fieldId)?.name ?? 'フィールド'} を ${findClass(codebase, ghost.toClassId)?.name ?? 'クラス'} へ動かすと良さそうです`;
}

function classAnnouncement(ghost: Extract<GhostMove, { readonly kind: 'class' }>, codebase: Codebase): string {
  return `${findClass(codebase, ghost.classId)?.name ?? 'クラス'} を ${codebase.files.find((file) => file.id === ghost.toFileId)?.path ?? 'ファイル'} へ動かすと良さそうです`;
}

function ghostAnnouncement(ghost: GhostMove, codebase: Codebase): string {
  if (ghost.kind === 'method') return methodAnnouncement(ghost, codebase);
  if (ghost.kind === 'field') return fieldAnnouncement(ghost, codebase);
  return classAnnouncement(ghost, codebase);
}

function positionAt(rect: DOMRect): Position {
  return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
}

function positionAtTarget(from: DOMRect, to: DOMRect): Position {
  return { left: to.left + (to.width - from.width) / 2, top: to.top + (to.height - from.height) / 2, width: from.width, height: from.height };
}

async function highlightOnly(targets: GhostTargets, cancelled: () => boolean, clearGhost: () => void): Promise<void> {
  const highlighted = [targets.source.closest('.class-node') ?? targets.source, targets.target];
  highlighted.forEach((element) => element.classList.add('ghost-hint-target'));
  await wait(2000);
  if (cancelled()) return;
  highlighted.forEach((element) => element.classList.remove('ghost-hint-target'));
  clearGhost();
}

async function travelGhost(targets: GhostTargets, setters: { readonly setPosition: (position: Position | null) => void; readonly setTravel: (travel: boolean) => void }, cancelled: () => boolean, clearGhost: () => void): Promise<void> {
  const highlighted = [targets.source.closest('.class-node') ?? targets.source, targets.target];
  setters.setPosition(positionAt(targets.from));
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  if (cancelled()) return;
  setters.setTravel(true);
  setters.setPosition(positionAtTarget(targets.from, targets.to));
  targets.target.classList.add('ghost-hint-target');
  await wait(1200);
  if (cancelled()) return;
  setters.setTravel(false);
  await wait(400);
  highlighted.forEach((element) => element.classList.remove('ghost-hint-target'));
  setters.setPosition(null);
  clearGhost();
}

/** Animates a visual-only copy of the next sample-answer drag. */
export function GhostAnimation({ nodes }: Readonly<{ nodes: CodebaseFlowNode[] }>) {
  const ghost = useGameStore((state) => state.ghost);
  const codebase = useGameStore((state) => state.codebase);
  const clearGhost = useGameStore((state) => state.clearGhost);
  const { fitView } = useReactFlow<CodebaseFlowNode>();
  const [position, setPosition] = useState<Position | null>(null);
  const [travel, setTravel] = useState(false);
  const [announcement, setAnnouncement] = useState('');

  useEffect(() => {
    if (ghost === null) return;
    let cancelled = false;
    const isCancelled = () => cancelled;
    const play = async () => {
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const targets = await findGhostTargets(ghost, codebase, nodes, { fitView, reducedMotion });
      if (cancelled) return;
      if (targets === undefined) { clearGhost(); return; }
      setAnnouncement(ghostAnnouncement(ghost, codebase));
      if (reducedMotion) {
        await highlightOnly(targets, isCancelled, clearGhost);
        return;
      }
      await travelGhost(targets, { setPosition, setTravel }, isCancelled, clearGhost);
    };
    void play();
    return () => {
      cancelled = true;
      setPosition(null);
      setTravel(false);
      document.querySelectorAll('.ghost-hint-target').forEach((element) => element.classList.remove('ghost-hint-target'));
    };
  }, [clearGhost, codebase, fitView, ghost, nodes]);

  if (ghost === null) return null;
  const method = ghost.kind === 'method' ? findMethod(codebase, ghost.methodId) : undefined;
  const field = ghost.kind === 'field' ? findField(codebase, ghost.fieldId) : undefined;
  const className = ghost.kind === 'class' ? findClass(codebase, ghost.classId)?.name : undefined;
  return createPortal(
    <>
      <div className="ghost-hint-live" data-testid="ghost-hint-live" aria-live="polite" aria-atomic="true">{announcement}</div>
      {position !== null && (
        <div className={`ghost-hint-animation${travel ? ' ghost-hint-animation--travel' : ''}`} style={{ left: position.left, top: position.top, width: position.width, height: position.height }} aria-hidden="true">
          {method !== undefined ? <MethodChipView method={method} overLimit={false} /> : null}
          {field !== undefined ? <FieldChipView field={field} /> : null}
          {className !== undefined ? <div className="class-drag-preview">{className}</div> : null}
        </div>
      )}
    </>, document.body,
  );
}
