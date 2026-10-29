/** ステージIDごとの、学習者が書いた一言メモ(前後の空白を除いた1〜140字)。 */
export type ReflectionNotes = Readonly<Partial<Record<string, string>>>;

// ponytail: String.length は UTF-16 のコード単位で数え、絵文字は2字になる。textarea の maxLength と合わせる
export const MAX_REFLECTION_NOTE_LENGTH = 140;

export function updateReflectionNote(notes: ReflectionNotes, stageId: string, text: string): ReflectionNotes {
  const value = text.trim().slice(0, MAX_REFLECTION_NOTE_LENGTH);
  if (value === notes[stageId] || (value === '' && notes[stageId] === undefined)) return notes;
  if (value === '') {
    const next = { ...notes };
    delete next[stageId];
    return next;
  }
  return { ...notes, [stageId]: value };
}

/** localStorage・学習記録ファイルを読むときの信頼境界の検証。 */
export function isReflectionNotes(value: unknown): value is ReflectionNotes {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  return Object.values(value).every((note) => typeof note === 'string' && note.length > 0 && note.length <= MAX_REFLECTION_NOTE_LENGTH);
}
