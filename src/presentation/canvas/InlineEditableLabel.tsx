import { useInlineEdit } from './useInlineEdit';

type InlineEditableLabelProps = {
  readonly value: string;
  readonly ariaLabel: string;
  readonly className: string;
  readonly onSubmit: (next: string) => boolean;
};

/** ダブルクリックでその場編集になるクラス名ラベル。 */
export function InlineEditableLabel({ value, ariaLabel, className, onSubmit }: Readonly<InlineEditableLabelProps>) {
  const { editing, startEditing, inputProps } = useInlineEdit(value, onSubmit);

  if (editing) {
    return <input {...inputProps} aria-label={ariaLabel} className={`${className} nodrag nopan`} />;
  }

  return (
    <span
      className={className}
      onDoubleClick={(event) => {
        event.stopPropagation();
        startEditing();
      }}
    >
      {value}
    </span>
  );
}
