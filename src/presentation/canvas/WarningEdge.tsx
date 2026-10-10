import { BaseEdge, EdgeLabelRenderer, type EdgeProps } from '@xyflow/react';
import { useEffect } from 'react';
import { RULE_WHY } from '../stage/ruleWhy';
import { offsetBezierPath, topRoutePath } from './edgePaths';
import { useWarningEdgeState } from './WarningEdgeContext';

type WarningData = {
  readonly route?: unknown;
  readonly lane?: unknown;
  readonly targetOffset?: unknown;
  readonly cyclic?: unknown;
  readonly visibility?: unknown;
};

type VisibilityData = { readonly kind: 'private' | 'protected'; readonly methodNames: readonly string[] };

function badgeLabel(cyclic: boolean, visibility: VisibilityData | undefined): string | undefined {
  if (cyclic && visibility !== undefined) return `循環・${visibility.kind}`;
  if (cyclic) return '循環';
  return visibility?.kind;
}

function visibilityHeading(kind: VisibilityData['kind']): string {
  return kind === 'private'
    ? 'private のメソッドが外のクラスから呼ばれています'
    : 'protected のメソッドが届かないクラスから呼ばれています';
}

function VisibilityDetails({ visibility }: Readonly<{ visibility: VisibilityData }>) {
  return (
    <div className="warning-edge__section">
      <h3>{visibilityHeading(visibility.kind)}</h3>
      <ul>{visibility.methodNames.map((name) => <li key={name}>{name}</li>)}</ul>
      <p><strong>こう困ります:</strong> {RULE_WHY.visibility.trouble}</p>
      <p><strong>だから:</strong> {RULE_WHY.visibility.because}</p>
    </div>
  );
}

function CycleDetails() {
  return (
    <div className="warning-edge__section">
      <h3>2つのクラスが互いに呼び合っています</h3>
      <p><strong>こう困ります:</strong> {RULE_WHY.cycle.trouble}</p>
      <p><strong>だから:</strong> {RULE_WHY.cycle.because}</p>
    </div>
  );
}

function visibilityData(value: unknown): VisibilityData | undefined {
  if (typeof value !== 'object' || value === null || !('kind' in value) || !('methodNames' in value)) return undefined;
  const { kind, methodNames } = value;
  if ((kind !== 'private' && kind !== 'protected') || !Array.isArray(methodNames) || !methodNames.every((name) => typeof name === 'string')) return undefined;
  return { kind, methodNames };
}

export function WarningEdge(props: Readonly<EdgeProps>) {
  const { id, sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition, markerEnd, style } = props;
  const data: WarningData = props.data ?? {};
  const { openId, setOpenId } = useWarningEdgeState();
  const open = openId === id;
  const visibility = visibilityData(data.visibility);
  const cyclic = data.cyclic === true;
  const lane = typeof data.lane === 'number' ? data.lane : 0;
  const targetOffset = typeof data.targetOffset === 'number' ? data.targetOffset : 0;
  const route = data.route === 'topRoute'
    ? topRoutePath({ sourceX, sourceY, targetX, targetY, targetPosition, lane, targetOffset })
    : offsetBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition, targetOffset });
  let labelY = route.labelY;
  if (data.route !== 'topRoute') labelY += sourceX < targetX ? -18 : 18;

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenId(null);
    };
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!(event.target instanceof Element) || event.target.closest('.warning-edge__popover, .warning-edge__button') !== null) return;
      setOpenId(null);
    };
    document.addEventListener('keydown', closeOnEscape);
    document.addEventListener('pointerdown', closeOnOutsidePointer);
    return () => {
      document.removeEventListener('keydown', closeOnEscape);
      document.removeEventListener('pointerdown', closeOnOutsidePointer);
    };
  }, [open, setOpenId]);

  const badge = badgeLabel(cyclic, visibility);
  return (
    <>
      <BaseEdge path={route.path} markerEnd={markerEnd} style={style} />
      <EdgeLabelRenderer>
        <div className="warning-edge" style={{ transform: `translate(-50%, -50%) translate(${route.labelX}px,${labelY}px)` }}>
          <button
            className="warning-edge__button nodrag nopan"
            type="button"
            aria-label="この矢印の問題を見る"
            aria-expanded={open}
            onClick={(event) => {
              event.stopPropagation();
              setOpenId(open ? null : id);
            }}
          >
            <span aria-hidden="true">⚠</span>{badge === undefined ? null : <span className="warning-edge__badge-text">{badge}</span>}
          </button>
          {open ? (
            <section className="warning-edge__popover nodrag nopan" role="dialog" aria-label="矢印の問題の説明">
              {visibility === undefined ? null : <VisibilityDetails visibility={visibility} />}
              {cyclic ? <CycleDetails /> : null}
            </section>
          ) : null}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
