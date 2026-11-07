export function disabledButtonProps(input: Readonly<{
  reason: string | null;
  reasonId: string;
  onClick: () => void;
  onBlockedClick?: () => void;
}>): Readonly<{
  'aria-disabled': true | undefined;
  'aria-describedby': string | undefined;
  onClick: () => void;
}> {
  if (input.reason === null) return { 'aria-disabled': undefined, 'aria-describedby': undefined, onClick: input.onClick };
  return {
    'aria-disabled': true,
    'aria-describedby': input.reasonId,
    onClick: () => input.onBlockedClick?.(),
  };
}
