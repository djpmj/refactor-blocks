import { useDraggable } from '@dnd-kit/core';
import type { Field } from '../../domain/codebase/Codebase';
import { fieldDragId } from './dndIds';
import { VISIBILITY_MARK } from './visibilityMark';
import { useGameStore } from '../store/useGameStore';

/** ドラッグ中のオーバーレイでも使う見た目だけのコンポーネント。行数は持たないので表示しない。 */
export function FieldChipView({ field, selected = false }: Readonly<{ field: Field; selected?: boolean }>) {
  return (
    <div className={['field-chip', `field-chip--${field.visibility}`, selected ? 'field-chip--selected' : null].filter(Boolean).join(' ')}>
      <span className="field-chip__visibility">{VISIBILITY_MARK[field.visibility]}</span>
      <span className="field-chip__name">{field.name}</span>
    </div>
  );
}

/**
 * クラスノードの中に並ぶ、ドラッグで別クラスへ移せるフィールド。
 * メソッドのチップと同じ仕組み(nodrag nopan・useDraggable)に乗せ、選択とキーボードドラッグのキー処理を両立する。
 */
export function FieldChip({ field }: Readonly<{ field: Field }>) {
  const selected = useGameStore((state) => state.selectedFieldId === field.id);
  const selectField = useGameStore((state) => state.selectField);
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: fieldDragId(field.id) });
  const label = `フィールド ${field.name}(${field.visibility})。クリックで詳細を表示、ドラッグで別クラスへ移動`;
  return (
    <button
      data-field-id={field.id}
      ref={setNodeRef}
      type="button"
      className="field-chip-button nodrag nopan"
      style={{ opacity: isDragging ? 0.3 : 1 }}
      data-testid={`field-${field.name}`}
      aria-label={label}
      {...attributes}
      {...listeners}
      aria-pressed={selected}
      onClick={() => selectField(field.id)}
      onKeyDownCapture={(event) => {
        if (event.key === 'Enter' || event.key === ' ') selectField(field.id);
      }}
    >
      <FieldChipView field={field} selected={selected} />
    </button>
  );
}
