import { useDraggable } from '@dnd-kit/core';
import type { Method } from '../../domain/codebase/Codebase';
import { methodLines } from '../../domain/codebase/lineCount';
import { violationTargets } from '../../domain/scoring/violationTargets';
import { useGameStore } from '../store/useGameStore';
import { methodDragId } from './dndIds';
import { useInlineEdit } from './useInlineEdit';
import { VISIBILITY_MARK } from './visibilityMark';
import { BLOCK_OPERATION_TITLES } from '../guide/operationGuide';
import { useResolvedCelebration } from './useResolvedCelebration';
import { methodChipLabel } from './methodChipLabel';

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

function useMethodOverLimit(method: Method): boolean {
  const codebase = useGameStore((state) => state.codebase);
  const limit = useGameStore((state) => state.stage.limits.method);
  return methodLines(method, codebase) > limit;
}

function useMethodAccessibleName(method: Method, fixed: boolean, mixed: boolean): string {
  const codebase = useGameStore((state) => state.codebase);
  const limit = useGameStore((state) => state.stage.limits.method);
  const lines = methodLines(method, codebase);
  return methodChipLabel({ name: method.name, visibility: method.visibility, lines, lineLimit: limit, overLimit: lines > limit, mixed, fixed });
}

function MethodChipLineCount({ method, preview }: Readonly<{ method: Method; preview: MethodLinePreview | undefined }>) {
  const codebase = useGameStore((state) => state.codebase);
  if (method.fragments.length === 0) return <span className="method-chip__lines">中身なし</span>;
  if (preview === undefined) return <span className="method-chip__lines">{methodLines(method, codebase)}行</span>;
  return <span className="method-chip__lines"><span className="method-chip__lines-before">{preview.before}行</span> → <span className={preview.afterOverLimit ? 'method-chip__lines-after method-chip__lines-after--over' : 'method-chip__lines-after'}>{preview.after}行</span></span>;
}

function MethodChipMarkers({ fixed, changeCount }: Readonly<{ fixed: boolean; changeCount: number }>) {
  return <>{fixed ? <span className="method-chip__fixed-mark" data-testid="fixed-mark">✔ 直した</span> : null}{changeCount > 0 ? <span className="method-chip__badge" data-testid="change-site-badge" title="直前の変更依頼で、変更が必要だったメソッド">変更×{changeCount}</span> : null}</>;
}

function useMethodMixed(methodId: string): boolean {
  return useGameStore((state) => violationTargets(state.codebase, state.stage)['mixed-method'].methodIds.includes(methodId));
}

function useMethodFlagged(methodId: string): boolean {
  return useGameStore((state) => {
    const rule = state.focusedRule ?? (state.hintTarget === null ? state.previewRule : null);
    return rule !== null ? violationTargets(state.codebase, state.stage)[rule].methodIds.includes(methodId) : state.hintTarget?.methodIds.includes(methodId) ?? false;
  });
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
      <span className="method-chip__visibility" aria-hidden="true">{VISIBILITY_MARK[method.visibility]}</span>
      <span className={method.fragments.length === 0 ? 'method-chip__name method-chip__name--empty' : 'method-chip__name'}>{method.name}()</span>
      <MethodChipLineCount method={method} preview={linePreview} />
    </div>
  );
}

/** 手で直すシミュレーション中の「直した」印の状態と、クリックの意味(手で直す間は中身を読むだけ)。 */
function useManualFixMark(methodId: string) {
  const manualFixing = useGameStore((state) => state.manualFix !== null);
  const fixed = useGameStore((state) => state.manualFix?.fixedIds.includes(methodId) ?? false);
  const viewManualFixMethod = useGameStore((state) => state.viewManualFixMethod);
  const selectMethod = useGameStore((state) => state.selectMethod);
  const onClick = () => {
    if (manualFixing) viewManualFixMethod(methodId);
    else selectMethod(methodId);
  };
  return { manualFixing, fixed, onClick };
}

/** 手で直す間、メソッドのチップの右に出す「直した」印のチェックボックス。リリース後は出さない。 */
export function ManualFixCheck({ method, className }: Readonly<{ method: Method; className: string }>) {
  const shown = useGameStore((state) => state.manualFix !== null && !state.manualFix.released);
  const fixed = useGameStore((state) => state.manualFix?.fixedIds.includes(method.id) ?? false);
  const toggleFixed = useGameStore((state) => state.toggleFixed);
  if (!shown) return null;
  return (
    <label className="manual-fix-check nodrag nopan" title={BLOCK_OPERATION_TITLES.manualFixCheck}>
      <input type="checkbox" checked={fixed} onChange={() => { toggleFixed(method.id); }} aria-label={`${className}.${method.name}() を直した`} />
    </label>
  );
}

/**
 * クラスノードの中に並ぶ、ドラッグで別クラスへ移せるメソッド。
 * React Flowにノードのドラッグ・パンとして奪われないよう nodrag / nopan を付ける。
 */
export function MethodChip({ method, linePreview }: Readonly<{ method: Method; linePreview?: MethodLinePreview }>) {
  const resolved = useResolvedCelebration('methodIds', method.id);
  const overLimit = useMethodOverLimit(method);
  const flagged = useMethodFlagged(method.id);
  const selected = useGameStore((state) => (state.manualFix === null ? state.selectedMethodId : state.manualFix.viewedMethodId) === method.id);
  const inspectMethod = useGameStore((state) => state.inspectMethod);
  const inspected = useGameStore((state) => state.changeSession?.inspected === method.id);
  const renameMethod = useGameStore((state) => state.renameMethod);
  const { manualFixing, fixed, onClick } = useManualFixMark(method.id);
  const mixed = useMethodMixed(method.id);
  const accessibleName = useMethodAccessibleName(method, fixed, mixed);
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
      <div className={`method-chip nodrag nopan${flagged ? ' method-chip--flagged' : ''}${resolved ? ' method-chip--resolved' : ''}`} data-testid={`method-${method.name}`}>
        <input {...inputProps} aria-label="メソッド名" className="method-chip__name-input" />
      </div>
    );
  }

  return (
    <button
      data-method-id={method.id}
      ref={setNodeRef}
      type="button"
      className={`method-chip-button nodrag nopan${resolved ? ' method-chip-button--resolved' : ''}`}
      style={{ opacity: isDragging ? 0.3 : 1 }}
      data-testid={`method-${method.name}`}
      aria-label={accessibleName}
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
      aria-pressed={selected}
      title={manualFixing ? BLOCK_OPERATION_TITLES.manualFix : BLOCK_OPERATION_TITLES.method}
    >
      <MethodChipView method={method} overLimit={overLimit} selected={selected} changeCount={changeCount} flagged={flagged} fixed={fixed} linePreview={linePreview} />
    </button>
  );
}
