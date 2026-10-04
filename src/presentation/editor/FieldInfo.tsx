import { findClassOfField, findField } from '../../domain/codebase/Codebase';
import { fieldUsage, type FieldAccess } from '../../domain/codebase/fieldUsage';
import { useGameStore } from '../store/useGameStore';
import { VISIBILITY_MARK } from '../canvas/visibilityMark';

function accessLabel(access: FieldAccess): string {
  if (access === 'read-write') return '読み書き';
  return access === 'read' ? '読む' : '書く';
}

/** 選択したフィールドの説明と、参照・更新するメソッドを表示する。 */
export function FieldInfo({ fieldId }: Readonly<{ fieldId: string }>) {
  const codebase = useGameStore((state) => state.codebase);
  const field = findField(codebase, fieldId);
  const owner = field === undefined ? undefined : findClassOfField(codebase, field.id);
  if (field === undefined || owner === undefined) return null;
  const usages = fieldUsage(codebase, field.id);
  return (
    <div className="field-info">
      <h2 className="method-editor__title"><code>{owner.name}.{field.name}</code> <span>{VISIBILITY_MARK[field.visibility]}</span></h2>
      {field.type?.csharp === undefined ? null : <p>型: {field.type.csharp}</p>}
      <p>{field.description ?? '説明はまだありません'}</p>
      <h3>このフィールドを使うメソッド</h3>
      {usages.length === 0 ? <p>どのメソッドからも使われていません</p> : (
        <ul>{usages.map(({ method, access }) => <li key={method.id}>{method.name} — {accessLabel(access)}</li>)}</ul>
      )}
    </div>
  );
}
