import { useDraggable } from '@dnd-kit/core';
import type { Method } from '../../domain/codebase/Codebase';
import { methodLines } from '../../domain/codebase/lineCount';
import { useGameStore } from '../store/useGameStore';
import { methodDragId } from './dndIds';

const VISIBILITY_MARK: Record<Method['visibility'], string> = {
  public: '+',
  private: '-',
  protected: '#',
};

type MethodChipViewProps = {
  method: Method;
  overLimit: boolean;
  selected?: boolean;
  /** 変更依頼の調査で「変更が必要」と選ばれている。 */
  investigated?: boolean;
};

/** ドラッグ中のオーバーレイでも使う見た目だけのコンポーネント。 */
export function MethodChipView({ method, overLimit, selected = false, investigated = false }: Readonly<MethodChipViewProps>) {
  const classNames = ['method-chip', `method-chip--${method.visibility}`];
  if (overLimit) classNames.push('method-chip--over');
  if (selected) classNames.push('method-chip--selected');
  if (investigated) classNames.push('method-chip--investigated');
  return (
    <div className={classNames.join(' ')}>
      <span className="method-chip__visibility">{VISIBILITY_MARK[method.visibility]}</span>
      <span className="method-chip__name">{method.name}()</span>
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
  const investigating = useGameStore((state) => state.changeSession !== null);
  const investigated = useGameStore((state) => state.changeSession?.selected.includes(method.id) ?? false);
  const toggleInvestigated = useGameStore((state) => state.toggleInvestigated);
  const inspectMethod = useGameStore((state) => state.inspectMethod);
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: methodDragId(method.id) });
  return (
    <button
      ref={setNodeRef}
      type="button"
      className="method-chip-button nodrag nopan"
      style={{ opacity: isDragging ? 0.3 : 1 }}
      data-testid={`method-${method.name}`}
      data-investigated={investigating ? investigated : undefined}
      onMouseEnter={() => {
        inspectMethod(method.id);
      }}
      onFocus={() => {
        inspectMethod(method.id);
      }}
      onClick={() => {
        if (investigating) toggleInvestigated(method.id);
        else selectMethod(method.id);
      }}
      {...attributes}
      {...listeners}
    >
      <MethodChipView method={method} overLimit={methodLines(method) > limit} selected={selected} investigated={investigated} />
    </button>
  );
}
