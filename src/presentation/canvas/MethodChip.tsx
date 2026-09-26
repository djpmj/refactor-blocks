import { useDraggable } from '@dnd-kit/core';
import type { Method } from '../../domain/codebase/Codebase';
import { methodLines } from '../../domain/codebase/lineCount';
import { useGameStore } from '../store/useGameStore';
import { methodDragId } from './dndIds';
import { useInlineEdit } from './useInlineEdit';
import { VISIBILITY_MARK } from './visibilityMark';

type MethodChipViewProps = {
  method: Method;
  overLimit: boolean;
  selected?: boolean;
  /** 直前の変更依頼で、このメソッドの変更が必要だった依頼の数。 */
  changeCount?: number;
};

/** ドラッグ中のオーバーレイでも使う見た目だけのコンポーネント。 */
export function MethodChipView({ method, overLimit, selected = false, changeCount = 0 }: Readonly<MethodChipViewProps>) {
  const classNames = ['method-chip', `method-chip--${method.visibility}`];
  if (overLimit) classNames.push('method-chip--over');
  if (selected) classNames.push('method-chip--selected');
  return (
    <div className={classNames.join(' ')}>
      <span className="method-chip__visibility">{VISIBILITY_MARK[method.visibility]}</span>
      <span className="method-chip__name">{method.name}()</span>
      {changeCount > 0 ? (
        <span className="method-chip__badge" data-testid="change-site-badge" title="直前の変更依頼で、変更が必要だったメソッド">
          変更×{changeCount}
        </span>
      ) : null}
      <span className="method-chip__lines">{methodLines(method)}行</span>
    </div>
  );
}

/**
 * クラスノードの中に並ぶ、ドラッグで別クラスへ移せるメソッド。
 * React Flowにノードのドラッグ・パンとして奪われないよう nodrag / nopan を付ける。
 */
export function MethodChip({ method }: Readonly<{ method: Method }>) {
  const limit = useGameStore((state) => state.stage.limits.method);
  const selected = useGameStore((state) => state.selectedMethodId === method.id);
  const selectMethod = useGameStore((state) => state.selectMethod);
  const inspectMethod = useGameStore((state) => state.inspectMethod);
  const inspected = useGameStore((state) => state.changeSession?.inspected === method.id);
  const renameMethod = useGameStore((state) => state.renameMethod);
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
      <div className="method-chip nodrag nopan" data-testid={`method-${method.name}`}>
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
      onClick={() => {
        selectMethod(method.id);
      }}
      onDoubleClick={(event) => {
        event.stopPropagation();
        startEditing();
      }}
      {...attributes}
      {...listeners}
    >
      <MethodChipView method={method} overLimit={methodLines(method) > limit} selected={selected} changeCount={changeCount} />
    </button>
  );
}
