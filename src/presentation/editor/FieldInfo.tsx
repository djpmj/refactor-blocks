import { findClassOfField, findField } from '../../domain/codebase/Codebase';
import { fieldAccessors, type FieldAccessor } from '../../domain/codebase/fieldAccessors';
import type { FieldAccess } from '../../domain/codebase/fieldUsage';
import { useGameStore } from '../store/useGameStore';
import { VISIBILITY_MARK } from '../canvas/visibilityMark';

function accessLabel(access: FieldAccess): string {
  if (access === 'read-write') return '読み書き';
  return access === 'read' ? '読む' : '書く';
}

function accessClass(access: FieldAccess): string {
  return access === 'read' ? 'field-info__access--read' : 'field-info__access--write';
}

function accessorRowClass(outside: boolean, access: FieldAccess): string {
  const classes = ['field-info__access'];
  if (outside) classes.push(accessClass(access));
  return classes.join(' ');
}

/** 選択したフィールドの説明と、参照・更新するメソッドを表示する。 */
export function FieldInfo({ fieldId }: Readonly<{ fieldId: string }>) {
  const codebase = useGameStore((state) => state.codebase);
  const field = findField(codebase, fieldId);
  const owner = field === undefined ? undefined : findClassOfField(codebase, field.id);
  if (field === undefined || owner === undefined) return null;
  const accessors = fieldAccessors(codebase, field.id);
  const outsideWriters = accessors.filter(({ outside, access }) => outside && access !== 'read');
  const outsideReaders = accessors.filter(({ outside, access }) => outside && access === 'read');
  const accessorNames = (items: readonly FieldAccessor[]) => items.map(({ className, methodName }) => `${className}.${methodName}()`).join('・');
  return (
    <div className="field-info">
      <h2 className="method-editor__title"><code>{owner.name}.{field.name}</code> <span>{VISIBILITY_MARK[field.visibility]}</span></h2>
      {field.type?.csharp === undefined ? null : <p>型: {field.type.csharp}</p>}
      <p>{field.description ?? '説明はまだありません'}</p>
      <h3>このフィールドを使うメソッド</h3>
      {accessors.length === 0 ? <p>どのメソッドからも使われていません</p> : (
        <ul>{accessors.map(({ methodId, methodName, className, access, outside }) => (
          <li key={methodId} className={accessorRowClass(outside, access)}>
            {className}.{methodName}() — {accessLabel(access)} {outside ? <span className="field-info__outside">外から</span> : null}
          </li>
        ))}</ul>
      )}
      {outsideWriters.length > 0 ? <p data-testid="field-fix-hint">{accessorNames(outsideWriters)} が、{owner.name} の外からこのデータを書き換えています。書き換える処理を {owner.name} へ移すと、カプセル化の破れが直ります</p> : null}
      {outsideWriters.length === 0 && outsideReaders.length > 0 ? <p data-testid="field-fix-hint">{accessorNames(outsideReaders)} が {owner.name} のデータを読んでいます。読む処理が多いなら、{owner.name} へ移すことを考えてみよう</p> : null}
    </div>
  );
}
