import { useDraggable } from '@dnd-kit/core';
import type { Method } from '../../domain/codebase/Codebase';
import { methodLines } from '../../domain/codebase/lineCount';
import { violationTargets } from '../../domain/scoring/violationTargets';
import { useGameStore } from '../store/useGameStore';
import { methodDragId } from './dndIds';
import { useInlineEdit } from './useInlineEdit';
import { VISIBILITY_MARK } from './visibilityMark';
import { BLOCK_OPERATION_TITLES } from '../guide/operationGuide';

type MethodChipViewProps = {
  method: Method;
  overLimit: boolean;
  selected?: boolean;
  /** 直前の変更依頼で、このメソッドの変更が必要だった依頼の数。 */
  changeCount?: number;
  flagged?: boolean;
  /** 手で直すシミュレーションで「直した」印が付いている。 */
  fixed?: boolean;
  linePreview?: { readonly before: number; readonly after: number; readonly afterOverLimit: boolean };
};

type MethodLinePreview = { readonly before: number; readonly after: number; readonly afterOverLimit: boolean };

function MethodChipLineCount({ method, preview }: Readonly<{ method: Method; preview: MethodLinePreview | undefined }>) {
  if (preview === undefined) return <span className="method-chip__lines">{methodLines(method)}行</span>;
  return <span className="method-chip__lines"><span className="method-chip__lines-before">{preview.before}行</span> → <span className={preview.afterOverLimit ? 'method-chip__lines-after method-chip__lines-after--over' : 'method-chip__lines-after'}>{preview.after}行</span></span>;
}

function MethodChipMarkers({ fixed, changeCount }: Readonly<{ fixed: boolean; changeCount: number }>) {
  return <>{fixed ? <span className="method-chip__fixed-mark" data-testid="fixed-mark">✔ 直した</span> : null}{changeCount > 0 ? <span className="method-chip__badge" data-testid="change-site-badge" title="直前の変更依頼で、変更が必要だったメソッド">変更×{changeCount}</span> : null}</>;
}

/** ドラッグ中のオーバーレイでも使う見た目だけのコンポーネント。 */
export function MethodChipView({ method, overLimit, selected = false, changeCount = 0, flagged = false, fixed = false, linePreview }: Readonly<MethodChipViewProps>) {
  const classNames = ['method-chip', `method-chip--${method.visibility}`];
  if (linePreview?.afterOverLimit ?? overLimit) classNames.push('method-chip--over');
  if (selected) classNames.push('method-chip--selected');
  if (flagged) classNames.push('method-chip--flagged');
  if (fixed) classNames.push('method-chip--fixed');
  return (
    <div className={classNames.join(' ')}>
      <MethodChipMarkers fixed={fixed} changeCount={changeCount} />
      <span className="method-chip__visibility">{VISIBILITY_MARK[method.visibility]}</span>
      <span className="method-chip__name">{method.name}()</span>
      <MethodChipLineCount method={method} preview={linePreview} />
    </div>
  );
}

/** 手で直すシミュレーション中の「直した」印の状態と切り替え。 */
function useManualFixMark(methodId: string) {
  const manualFixing = useGameStore((state) => state.manualFix !== null);
  const fixed = useGameStore((state) => state.manualFix?.fixedIds.includes(methodId) ?? false);
  const toggleFixed = useGameStore((state) => state.toggleFixed);
  const selectMethod = useGameStore((state) => state.selectMethod);
  /** 印の付け替え中は、メソッドの選択ではなく「直した」印を切り替える。 */
  const onClick = () => {
    if (manualFixing) toggleFixed(methodId);
    else selectMethod(methodId);
  };
  return { manualFixing, fixed, onClick };
}

/**
 * クラスノードの中に並ぶ、ドラッグで別クラスへ移せるメソッド。
 * React Flowにノードのドラッグ・パンとして奪われないよう nodrag / nopan を付ける。
 */
export function MethodChip({ method, linePreview }: Readonly<{ method: Method; linePreview?: MethodLinePreview }>) {
  const limit = useGameStore((state) => state.stage.limits.method);
  const flagged = useGameStore((state) => {
    const rule = state.focusedRule;
    return rule !== null ? violationTargets(state.codebase, state.stage)[rule].methodIds.includes(method.id) : state.hintTarget?.methodIds.includes(method.id) ?? false;
  });
  const selected = useGameStore((state) => state.selectedMethodId === method.id);
  const inspectMethod = useGameStore((state) => state.inspectMethod);
  const inspected = useGameStore((state) => state.changeSession?.inspected === method.id);
  const renameMethod = useGameStore((state) => state.renameMethod);
  const { manualFixing, fixed, onClick } = useManualFixMark(method.id);
  // 実装中に出すと答えが見えてしまうので、変更依頼に挑戦していないときだけ数える
  const changeCount = useGameStore((state) =>
    state.changeSession === null
      ? (state.lastChangeReport?.outcomes.filter((outcome) => outcome.current?.impact.sites.includes(method.id)).length ?? 0)
      : 0,
  );
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: methodDragId(method.id) });
  const { editing, startEditing, inputProps } = useInlineEdit(method.name, (name) => renameMethod(method.id, name));

  // buttonの中にinputを入れると無効なHTMLになるため、編集中は draggable なボタンごと入力欄に差し替える
  if (editing) {
    return (
      <div className={`method-chip nodrag nopan${flagged ? ' method-chip--flagged' : ''}`} data-testid={`method-${method.name}`}>
        <input {...inputProps} aria-label="メソッド名" className="method-chip__name-input" />
      </div>
    );
  }

  return (
    <button
      data-method-id={method.id}
      ref={setNodeRef}
      type="button"
      className="method-chip-button nodrag nopan"
      style={{ opacity: isDragging ? 0.3 : 1 }}
      data-testid={`method-${method.name}`}
      onMouseEnter={() => {
        inspectMethod(method.id);
      }}
      onMouseLeave={() => {
        if (inspected) inspectMethod(null);
      }}
      onFocus={() => {
        inspectMethod(method.id);
      }}
      onBlur={() => {
        if (inspected) inspectMethod(null);
      }}
      onClick={onClick}
      onDoubleClick={(event) => {
        event.stopPropagation();
        startEditing();
      }}
      {...attributes}
      // 印の付け外し中は Enter/Space を、キーボードドラッグの開始ではなくボタンのクリックとして使う
      {...(manualFixing ? { ...listeners, onKeyDown: undefined } : listeners)}
      aria-pressed={manualFixing ? fixed : undefined}
      title={manualFixing ? BLOCK_OPERATION_TITLES.manualFix : BLOCK_OPERATION_TITLES.method}
    >
      <MethodChipView method={method} overLimit={methodLines(method) > limit} selected={selected} changeCount={changeCount} flagged={flagged} fixed={fixed} linePreview={linePreview} />
    </button>
  );
}
