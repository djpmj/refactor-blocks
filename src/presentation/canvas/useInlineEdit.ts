import { useRef, useState, type ChangeEvent, type FocusEvent, type KeyboardEvent, type PointerEvent, type RefObject } from 'react';

export type InlineEditInputProps = {
  readonly ref: RefObject<HTMLInputElement | null>;
  readonly value: string;
  readonly autoFocus: true;
  readonly onFocus: (event: FocusEvent<HTMLInputElement>) => void;
  readonly onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  readonly onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  readonly onPointerDown: (event: PointerEvent<HTMLInputElement>) => void;
  readonly onBlur: () => void;
};

export type InlineEdit = {
  readonly editing: boolean;
  readonly startEditing: () => void;
  readonly inputProps: InlineEditInputProps;
};

/**
 * ダブルクリックでその場編集にする、ファイル・クラス・メソッドの名前欄で共通の状態管理。
 * Enterまたはフォーカスを外すと確定を試み、失敗したら(空欄・重複名など)入力欄に留まる。Escapeで元の値に戻す。
 */
export function useInlineEdit(value: string, onSubmit: (next: string) => boolean): InlineEdit {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const canceledRef = useRef(false);

  const commit = () => {
    if (canceledRef.current) {
      canceledRef.current = false;
      return;
    }
    if (onSubmit(draft)) setEditing(false);
    else inputRef.current?.focus();
  };

  return {
    editing,
    startEditing: () => {
      setDraft(value);
      setEditing(true);
    },
    inputProps: {
      ref: inputRef,
      value: draft,
      autoFocus: true,
      onFocus: (event) => {
        event.target.select();
      },
      onChange: (event) => {
        setDraft(event.target.value);
      },
      onKeyDown: (event) => {
        // クラス名の入力欄はdnd-kitのdraggableな見出しの中にあり、Enter/SpaceがそこまでバブルするとキーボードでのDrag開始として奪われる
        event.stopPropagation();
        if (event.key === 'Enter') event.currentTarget.blur();
        if (event.key === 'Escape') {
          canceledRef.current = true;
          setEditing(false);
        }
      },
      // 入力欄はdnd-kitのdraggableな見出しの中にあるため、pointerdownがそこまでバブルしないようにする
      onPointerDown: (event) => {
        event.stopPropagation();
      },
      onBlur: commit,
    },
  };
}
