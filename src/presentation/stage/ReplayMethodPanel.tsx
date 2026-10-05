import { useState } from 'react';
import { findClassOfMethod, findMethod, type Codebase } from '../../domain/codebase/Codebase';
import { fragmentLines, methodLines } from '../../domain/codebase/lineCount';
import { ClassCodePreview } from '../editor/ClassCodePreview';
import { FragmentFieldRefs } from '../editor/MethodEditor';

export function ReplayMethodPanel({ codebase, methodId }: Readonly<{ codebase: Codebase; methodId: string }>) {
  const method = findMethod(codebase, methodId);
  const owner = findClassOfMethod(codebase, methodId);
  const [activeTab, setActiveTab] = useState<'edit' | 'code'>('edit');
  if (method === undefined || owner === undefined) return <aside className="sample-replay__panel">このメソッドはこの手の時点では存在しません</aside>;

  return (
    <aside className="sample-replay__panel" aria-label="メソッドの内容">
      <h2 className="method-editor__title">{owner.name}.{method.name}() <span className="line-badge">{methodLines(method)}行</span></h2>
      <p className="sample-replay__visibility">{method.visibility}</p>
      <div className="method-editor__tabs" role="tablist" aria-label="メソッド表示">
        <button className="method-editor__tab" type="button" role="tab" aria-selected={activeTab === 'edit'} onClick={() => setActiveTab('edit')}>編集</button>
        <button className="method-editor__tab" type="button" role="tab" aria-selected={activeTab === 'code'} onClick={() => setActiveTab('code')}><span className="method-editor__tab-icon" aria-hidden="true">&lt;/&gt;</span>コード</button>
      </div>
      {activeTab === 'code' ? <ClassCodePreview codebase={codebase} classId={owner.id} /> : (
        <div role="tabpanel" aria-label="編集">
          <ul className="fragment-list">
            {method.fragments.map((fragment) => (
              <li key={fragment.id} className="fragment-list__item">
                <div className="sample-replay__fragment">
                  <span className="fragment-list__label">{fragment.label}</span>
                  <span className="fragment-list__lines">{fragmentLines(fragment)}行</span>
                </div>
                <FragmentFieldRefs codebase={codebase} fragment={fragment} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </aside>
  );
}
