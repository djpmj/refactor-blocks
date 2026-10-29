import { useId, useState } from 'react';
import { MAX_REFLECTION_NOTE_LENGTH } from '../../domain/progress/reflectionNotes';
import { useGameStore } from '../store/useGameStore';

export function ReflectionNoteCard({ stageId }: Readonly<{ stageId: string }>) {
  const headingId = useId();
  const inputId = useId();
  const countId = useId();
  const saved = useGameStore((state) => state.reflectionNotes[stageId]);
  const saveReflectionNote = useGameStore((state) => state.saveReflectionNote);
  const [value, setValue] = useState(saved ?? '');
  return (
    <section className="reflection-note" aria-labelledby={headingId} data-testid="reflection-note">
      <h3 id={headingId}>振り返りメモ</h3>
      <label htmlFor={inputId}>今回気づいたこと(任意・140字まで)</label>
      <textarea
        id={inputId}
        maxLength={MAX_REFLECTION_NOTE_LENGTH}
        rows={3}
        data-testid="reflection-note-input"
        aria-describedby={countId}
        value={value}
        onChange={(event) => {
          setValue(event.currentTarget.value);
          saveReflectionNote(stageId, event.currentTarget.value);
        }}
      />
      <p id={countId} data-testid="reflection-note-count">{value.length} / {MAX_REFLECTION_NOTE_LENGTH}</p>
      <p>自動で保存され、ステージ一覧から読み返せます。点数には関係しません。</p>
    </section>
  );
}
