/** stageId の分を除いた新しい記録を返す。もともと無ければ同じ参照を返す(保存を省けるように。updateProgress と同じ約束)。 */
export function withoutStage<T>(
  record: Readonly<Partial<Record<string, T>>>,
  stageId: string,
): Readonly<Partial<Record<string, T>>> {
  if (!Object.hasOwn(record, stageId)) return record;
  return Object.fromEntries(Object.entries(record).filter(([id]) => id !== stageId));
}
