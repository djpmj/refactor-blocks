import { useDraggable } from '@dnd-kit/core';
import type { Field } from '../../domain/codebase/Codebase';
import { fieldDragId } from './dndIds';
import { VISIBILITY_MARK } from './visibilityMark';

/** ドラッグ中のオーバーレイでも使う見た目だけのコンポーネント。行数は持たないので表示しない。 */
export function FieldChipView({ field }: Readonly<{ field: Field }>) {
  return (
    <div className={['field-chip', `field-chip--${field.visibility}`].join(' ')}>
      <span className="field-chip__visibility">{VISIBILITY_MARK[field.visibility]}</span>
      <span className="field-chip__name">{field.name}</span>
    </div>
  );
}

/**
 * クラスノードの中に並ぶ、ドラッグで別クラスへ移せるフィールド。
 * メソッドのチップと同じ仕組み(nodrag nopan・useDraggable)に乗せ、キーボード操作もそのまま使える。
 */
export function FieldChip({ field }: Readonly<{ field: Field }>) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: fieldDragId(field.id) });
  const label = `フィールド ${field.name}(${field.visibility})。ドラッグで別クラスへ移動`;
  return (
    <button
      ref={setNodeRef}
      type="button"
      className="field-chip-button nodrag nopan"
      style={{ opacity: isDragging ? 0.3 : 1 }}
      data-testid={`field-${field.name}`}
      aria-label={label}
      {...attributes}
      {...listeners}
    >
      <FieldChipView field={field} />
    </button>
  );
}
