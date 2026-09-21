import { useState } from 'react';
import { findClassOfMethod, findMethod, type Method } from '../../domain/codebase/Codebase';
import { methodLines } from '../../domain/codebase/lineCount';
import { suggestMethodName } from '../../domain/codebase/suggestMethodName';
import { useGameStore } from '../store/useGameStore';

function toggle(selected: ReadonlySet<string>, id: string): Set<string> {
  const next = new Set(selected);
  if (next.has(id)) {
    next.delete(id);
  } else {
    next.add(id);
  }
  return next;
}

function FragmentList({
  method,
  selected,
  onToggle,
}: Readonly<{ method: Method; selected: ReadonlySet<string>; onToggle: (id: string) => void }>) {
  return (
    <ul className="fragment-list">
      {method.fragments.map((fragment) => (
        <li key={fragment.id} className="fragment-list__item">
          <label>
            <input
              type="checkbox"
              checked={selected.has(fragment.id)}
              onChange={() => {
                onToggle(fragment.id);
              }}
            />
            <span className="fragment-list__label">{fragment.label}</span>
            <span className="fragment-list__lines">{fragment.lines}行</span>
          </label>
        </li>
      ))}
    </ul>
  );
}

/** 選択中のメソッドの中身を表示し、処理のまとまりを選んで Extract Method する。 */
function MethodEditorBody({ method }: Readonly<{ method: Method }>) {
  const owner = useGameStore((state) => findClassOfMethod(state.codebase, method.id));
  const extractMethod = useGameStore((state) => state.extractMethod);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  // null のあいだは選んだ処理から名前を自動で考え、プレイヤーが入力したらその名前を優先する
  const [customName, setCustomName] = useState<string | null>(null);
  const newName =
    customName ??
    suggestMethodName(
      method.fragments.filter((fragment) => selected.has(fragment.id)),
      owner?.methods.map((ownerMethod) => ownerMethod.name) ?? [],
    );

  const handleExtract = () => {
    const succeeded = extractMethod({ sourceMethodId: method.id, fragmentIds: [...selected], newMethodName: newName });
    if (succeeded) {
      setSelected(new Set());
      setCustomName(null);
    }
  };

  return (
    <>
      <h2 className="method-editor__title">
        {owner?.name ?? '?'}.{method.name}() <span className="line-badge">{methodLines(method)}行</span>
      </h2>
      <FragmentList method={method} selected={selected} onToggle={(id) => { setSelected(toggle(selected, id)); }} />
      <div className="method-editor__extract">
        <input
          aria-label="新しいメソッド名"
          placeholder="処理を選ぶと名前を自動で考えます"
          value={newName}
          onChange={(event) => {
            setCustomName(event.target.value);
          }}
        />
        <button type="button" onClick={handleExtract}>
          選んだ処理をメソッドとして抽出
        </button>
      </div>
    </>
  );
}

export function MethodEditor() {
  const method = useGameStore((state) =>
    state.selectedMethodId === null ? undefined : findMethod(state.codebase, state.selectedMethodId),
  );
  const message = useGameStore((state) => state.message);
  return (
    <aside className="method-editor" aria-label="メソッドエディタ">
      {method === undefined ? (
        <p className="method-editor__hint">メソッドをクリックすると、中の処理がここに表示されます</p>
      ) : (
        <MethodEditorBody key={method.id} method={method} />
      )}
      {message === null ? null : (
        <p className="method-editor__message" role="alert">
          {message}
        </p>
      )}
    </aside>
  );
}
