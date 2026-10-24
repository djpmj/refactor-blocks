import { useMemo } from 'react';
import { allClasses, fieldsOf, findClass, type Codebase } from '../../domain/codebase/Codebase';
import { entryPointMethodIds, findUnusedPublicMembers, type UnusedPublicMember } from '../../domain/scoring/unusedPublicMembers';
import type { Stage } from '../../domain/stage/Stage';
import { useGameStore } from '../store/useGameStore';

/** 「Subscription.status(フィールド)」「Account.getBalance()」の形の名前。 */
function memberLabel(codebase: Codebase, member: UnusedPublicMember): string {
  const codeClass = findClass(codebase, member.classId);
  const className = codeClass?.name ?? member.classId;
  if (member.kind === 'field') {
    const name = codeClass === undefined ? undefined : fieldsOf(codeClass).find((field) => field.id === member.id)?.name;
    return `${className}.${name ?? member.id}(フィールド)`;
  }
  const name = allClasses(codebase).flatMap((candidate) => candidate.methods).find((method) => method.id === member.id)?.name;
  return `${className}.${name ?? member.id}()`;
}

/** 100点のあとに出す、外から使われていない public のフィールド・メソッドのお知らせ。点数は変えない。 */
export function UnusedPublicNote({ stage, codebase }: Readonly<{ stage: Stage; codebase: Codebase }>) {
  const selectMethod = useGameStore((state) => state.selectMethod);
  const selectField = useGameStore((state) => state.selectField);
  const members = useMemo(
    () => findUnusedPublicMembers(codebase, { entryPointIds: entryPointMethodIds(stage.codebase) }),
    [codebase, stage],
  );
  if (members.length === 0) return null;
  return (
    <section className="rumor-list" aria-labelledby="unused-public-note-title" data-testid="unused-public-note">
      <h3 id="unused-public-note-title">仕上げのヒント</h3>
      <p>外から使われていない公開メンバーがあります。隠せるものは隠すと、あとで中身を変えても外に影響しません</p>
      {stage.visibilityEnforced === true && <p className="rumor-list__hint">メソッドエディタの「可視性」で private にできます</p>}
      <ul>
        {members.map((member) => (
          <li key={member.id}>
            <button type="button" onClick={() => (member.kind === 'field' ? selectField(member.id) : selectMethod(member.id))}>
              {memberLabel(codebase, member)}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
