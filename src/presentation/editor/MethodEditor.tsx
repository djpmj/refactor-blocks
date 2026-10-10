import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  accessorFieldAccess,
  findClass,
  findClassOfField,
  findClassOfMethod,
  findField,
  findMethod,
  isStubMethod,
  type Codebase,
  type Fragment,
  type Method,
  type Visibility,
} from '../../domain/codebase/Codebase';
import { changeVisibilityUseCase } from '../../application/RefactorUseCases';
import { previewExtractMethod } from '../../application/RefactorUseCases';
import { findCallerOf } from '../../domain/codebase/inlineMethod';
import { findMergeCandidates, type MergeCandidate } from '../../domain/codebase/mergeMethods';
import { fragmentLines, methodLines } from '../../domain/codebase/lineCount';
import { suggestMethodName } from '../../domain/codebase/suggestMethodName';
import { showsVisibilityControl } from '../../domain/stage/showsVisibilityControl';
import { ChangeMemo } from '../change/ChangeMemo';
import { ClassCodePreview } from './ClassCodePreview';
import { useGameStore } from '../store/useGameStore';
import { FieldInfo } from './FieldInfo';

function toggle(selected: ReadonlySet<string>, id: string): Set<string> {
  const next = new Set(selected);
  if (next.has(id)) {
    next.delete(id);
  } else {
    next.add(id);
  }
  return next;
}

/** 処理が読む・書くフィールドを「クラス名.フィールド名」の並びにする。見つからないIDは飛ばす。 */
function fieldRefText(codebase: Codebase, fieldIds: readonly string[]): string {
  return fieldIds
    .map((fieldId) => {
      const owner = findClassOfField(codebase, fieldId);
      const field = findField(codebase, fieldId);
      return owner === undefined || field === undefined ? null : `${owner.name}.${field.name}`;
    })
    .filter((text): text is string => text !== null)
    .join(', ');
}

/** 処理が触るフィールドを色だけに頼らず文字で出す。Feature Envy・カプセル化の破れをプレイヤーが判断する手がかりになる。 */
export function FragmentFieldRefs({ codebase, fragment }: Readonly<{ codebase: Codebase; fragment: Fragment }>) {
  const reads = fieldRefText(codebase, fragment.reads ?? []);
  const writes = fieldRefText(codebase, fragment.writes ?? []);
  const accessed = accessorFieldAccess(codebase, fragment);
  const accessorReads = fieldRefText(codebase, accessed.reads);
  const accessorWrites = fieldRefText(codebase, accessed.writes);
  if (reads === '' && writes === '' && accessorReads === '' && accessorWrites === '') return null;
  return (
    <div className="fragment-list__field-refs">
      {reads === '' ? null : <div>読む: {reads}</div>}
      {writes === '' ? null : <div>書く: {writes}</div>}
      {accessorReads === '' ? null : <div>getter 経由で読む: {accessorReads}</div>}
      {accessorWrites === '' ? null : <div>setter 経由で書く: {accessorWrites}</div>}
    </div>
  );
}

function FragmentList({
  codebase,
  method,
  selected,
  onToggle,
}: Readonly<{ codebase: Codebase; method: Method; selected: ReadonlySet<string>; onToggle: (id: string) => void }>) {
  return (
    <ul className="fragment-list" data-tour="fragment-list">
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
            <span className="fragment-list__lines">{fragmentLines(fragment)}行</span>
          </label>
          <FragmentFieldRefs codebase={codebase} fragment={fragment} />
        </li>
      ))}
    </ul>
  );
}

/** 選択中のメソッドと形が一致する、別クラスのprivateメソッドへのボタンを並べ、Merge Methodsを実行する。 */
function MergeSection({ method, candidates }: Readonly<{ method: Method; candidates: readonly MergeCandidate[] }>) {
  const codebase = useGameStore((state) => state.codebase);
  const mergeMethods = useGameStore((state) => state.mergeMethods);
  const [name, setName] = useState(method.name);

  return (
    <div className="method-editor__merge">
      <h3 className="method-editor__merge-title">似た処理を持つメソッド</h3>
      <input
        aria-label="統合後のメソッド名"
        value={name}
        onChange={(event) => {
          setName(event.target.value);
        }}
      />
      <ul className="merge-candidate-list">
        {candidates.map((candidate) => (
          <li key={candidate.method.id} className="merge-candidate-list__item">
            <button
              type="button"
              data-testid={`merge-candidate-${candidate.method.name}`}
              onClick={() => {
                mergeMethods(method.id, candidate.method.id, name);
              }}
            >
              {findClass(codebase, candidate.ownerClassId)?.name ?? '?'}.{candidate.method.name}()
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

const VISIBILITY_OPTIONS: readonly Visibility[] = ['public', 'protected', 'private'];

function extractDisabledReason(selectedCount: number, newName: string): string | null {
  if (selectedCount === 0) return '処理を1つ以上選ぶと押せます';
  if (newName.trim() === '') return 'メソッド名を入れると押せます';
  return null;
}

function ExtractControls({
  newName,
  disabledReason,
  onNameChange,
  onExtract,
  previewSummary,
}: Readonly<{
  newName: string;
  disabledReason: string | null;
  onNameChange: (name: string) => void;
  onExtract: () => void;
  previewSummary: string | undefined;
}>) {
  return (
    <>
      <div className="method-editor__extract">
        <input
          aria-label="新しいメソッド名"
          placeholder="処理を選ぶと名前を自動で考えます"
          value={newName}
          onChange={(event) => onNameChange(event.target.value)}
        />
        <button
          type="button"
          className={disabledReason === null ? 'button--primary' : undefined}
          disabled={disabledReason !== null}
          aria-describedby={disabledReason === null ? undefined : 'method-editor-extract-disabled-reason'}
          data-tour="extract-button"
          onClick={onExtract}
        >
          選んだ処理をメソッドとして抽出
        </button>
      </div>
      {previewSummary === undefined ? null : <p className="method-editor__extract-preview" aria-live="polite">{previewSummary}</p>}
      {disabledReason === null ? null : (
        <p id="method-editor-extract-disabled-reason" className="method-editor__extract-hint">
          {disabledReason}
        </p>
      )}
    </>
  );
}

function isVisibility(value: string): value is Visibility {
  return VISIBILITY_OPTIONS.some((visibility) => visibility === value);
}

function useExtractPreviewSummary(method: Method, selected: ReadonlySet<string>, newName: string): string | undefined {
  const setExtractDraft = useGameStore((state) => state.setExtractDraft);
  const codebase = useGameStore((state) => state.codebase);
  const draft = useGameStore((state) => state.extractDraft);
  const allowed = useGameStore((state) => state.changeSession === null && state.manualFix === null);
  const preview = useMemo(() => draft === null || !allowed ? undefined : previewExtractMethod(codebase, draft), [allowed, codebase, draft]);
  useEffect(() => {
    setExtractDraft(selected.size === 0 ? null : { sourceMethodId: method.id, fragmentIds: [...selected], newMethodName: newName });
  }, [method.id, newName, selected, setExtractDraft]);
  return preview === undefined
    ? undefined
    : `抽出すると: ${method.name} ${preview.sourceLinesBefore}行 → ${preview.sourceLinesAfter}行 / 新しい ${preview.newMethodName} ${preview.newMethodLines}行`;
}

/** 可視性(public / protected / private)を選ぶ欄。選んでも前提条件を満たさない値は disabled にする。 */
function VisibilitySelect({ method }: Readonly<{ method: Method }>) {
  const codebase = useGameStore((state) => state.codebase);
  const originalCodebase = useGameStore((state) => state.stage.codebase);
  const changeVisibility = useGameStore((state) => state.changeVisibility);
  const disabled = useMemo(
    () =>
      new Set(
        VISIBILITY_OPTIONS.filter(
          (visibility) => visibility !== method.visibility && !changeVisibilityUseCase(codebase, method.id, visibility, originalCodebase).ok,
        ),
      ),
    [codebase, method.id, method.visibility, originalCodebase],
  );
  return (
    <div className="method-editor__visibility">
      <label>
        可視性{' '}
        <select
          className="method-editor__visibility-select"
          aria-label={`メソッド ${method.name} の可視性`}
          value={method.visibility}
          onChange={(event) => {
            const { value } = event.target;
            if (isVisibility(value)) changeVisibility(method.id, value);
          }}
        >
          {VISIBILITY_OPTIONS.map((visibility) => (
            <option key={visibility} value={visibility} disabled={disabled.has(visibility)}>
              {visibility}
            </option>
          ))}
        </select>
      </label>
      <p className="method-editor__visibility-hint">可視性を広げるには呼び出し元が必要です。ステージ開始時の可視性にはいつでも戻せます。親の抽象宣言を実装する場合も public / protected を選べます</p>
    </div>
  );
}

/** 呼び出し元へ戻す・空実装のメソッドを削除、の2つのボタン。どちらも条件を満たすときだけ表示する。 */
function MethodActions({ method, showVisibility }: Readonly<{ method: Method; showVisibility: boolean }>) {
  const codebase = useGameStore((state) => state.codebase);
  const inlineMethod = useGameStore((state) => state.inlineMethod);
  const deleteMethod = useGameStore((state) => state.deleteMethod);
  const hasCaller = findCallerOf(codebase, method.id) !== undefined;
  return (
    <>
      {showVisibility && method.fragments.length > 0 ? <VisibilitySelect method={method} /> : null}
      {hasCaller ? (
        <button
          type="button"
          onClick={() => {
            inlineMethod(method.id);
          }}
        >
          呼び出し元へ戻す
        </button>
      ) : null}
      {isStubMethod(method) ? (
        <button
          type="button"
          onClick={() => {
            deleteMethod(method.id);
          }}
        >
          空実装のメソッドを削除
        </button>
      ) : null}
    </>
  );
}

/** 選択中のメソッドの中身を表示し、処理のまとまりを選んで Extract Method する。 */
function MethodEditorBody({ method, showVisibility }: Readonly<{ method: Method; showVisibility: boolean }>) {
  const codebase = useGameStore((state) => state.codebase);
  const owner = findClassOfMethod(codebase, method.id);
  // codebaseが変わらない限り同じ配列参照を保つ(毎レンダー新しい配列を作るとZustandの購読が無限ループする)
  const mergeCandidates = useMemo(() => findMergeCandidates(codebase, method.id), [codebase, method.id]);
  const extractMethod = useGameStore((state) => state.extractMethod);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'edit' | 'code'>('edit');
  // null のあいだは選んだ処理から名前を自動で考え、プレイヤーが入力したらその名前を優先する
  const [customName, setCustomName] = useState<string | null>(null);
  const newName =
    customName ??
    suggestMethodName(
      method.fragments.filter((fragment) => selected.has(fragment.id)),
      owner?.methods.map((ownerMethod) => ownerMethod.name) ?? [],
    );
  const disabledReason = extractDisabledReason(selected.size, newName);

  const previewSummary = useExtractPreviewSummary(method, selected, newName);

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
      <div className="method-editor__tabs" role="tablist" aria-label="メソッド表示">
        <button className="method-editor__tab" type="button" role="tab" aria-selected={activeTab === 'edit'} onClick={() => { setActiveTab('edit'); }}>編集</button>
        <button className="method-editor__tab" type="button" role="tab" aria-selected={activeTab === 'code'} onClick={() => { setActiveTab('code'); }}><span className="method-editor__tab-icon" aria-hidden="true">&lt;/&gt;</span>コード</button>
      </div>
      {activeTab === 'code' ? <ClassCodePreview codebase={codebase} classId={owner?.id ?? ''} /> : (
        <div role="tabpanel" aria-label="編集">
          <FragmentList codebase={codebase} method={method} selected={selected} onToggle={(id) => { setSelected(toggle(selected, id)); }} />
          <ExtractControls
            newName={newName}
            disabledReason={disabledReason}
            onNameChange={setCustomName}
            onExtract={handleExtract}
            previewSummary={previewSummary}
          />
          {mergeCandidates.length > 0 ? <MergeSection method={method} candidates={mergeCandidates} /> : null}
          <MethodActions method={method} showVisibility={showVisibility} />
        </div>
      )}
    </>
  );
}

export function MethodEditor({ alwaysShowVisibility = false }: Readonly<{ alwaysShowVisibility?: boolean }>) {
  const stage = useGameStore((state) => state.stage);
  const selectedFieldId = useGameStore((state) => state.selectedFieldId);
  const method = useGameStore((state) =>
    state.selectedMethodId === null ? undefined : findMethod(state.codebase, state.selectedMethodId),
  );
  let content: ReactNode;
  if (selectedFieldId !== null) content = <FieldInfo fieldId={selectedFieldId} />;
  else if (method === undefined) {
    content = (
      <div className="method-editor__empty" data-testid="method-editor-empty">
        <span className="method-editor__empty-icon" aria-hidden="true">👈</span>
        <h2>中央の図から、直したいメソッドをクリックしてみよう</h2>
        <p>クリックすると、中の処理がここに並びます。まとまりを選んで「メソッドとして抽出」できます</p>
        <p>メソッドはドラッグで別のクラスへ移せます</p>
        <p>フィールドをクリックすると説明が出ます</p>
      </div>
    );
  }
  else content = <MethodEditorBody key={method.id} method={method} showVisibility={alwaysShowVisibility || showsVisibilityControl(stage)} />;
  return (
    <aside className="method-editor" aria-label="メソッドエディタ">
      {content}
      <ChangeMemo />
    </aside>
  );
}
