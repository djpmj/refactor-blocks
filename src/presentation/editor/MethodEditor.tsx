import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  accessorFieldAccess,
  findClass,
  findClassOfField,
  findClassOfMethod,
  findField,
  findMethod,
  isAbstractLike,
  isInterfaceLike,
  parentIds,
  isStubMethod,
  type CodeClass,
  type Codebase,
  type Fragment,
  type Method,
  type Visibility,
} from '../../domain/codebase/Codebase';
import { changeVisibilityUseCase } from '../../application/RefactorUseCases';
import { previewExtractMethod } from '../../application/RefactorUseCases';
import { describeExtractPreview } from './describeExtractPreview';
import { describeGrowthHeadsUp } from './describeGrowthHeadsUp';
import { extractDisabledReason, extractNameInvalid } from './extractDisabledReason';
import { findCallerOf } from '../../domain/codebase/inlineMethod';
import { findMergeCandidates, type MergeCandidate } from '../../domain/codebase/mergeMethods';
import { fragmentLines, methodLines } from '../../domain/codebase/lineCount';
import { suggestMethodName } from '../../domain/codebase/suggestMethodName';
import { methodNamingOf } from '../../domain/stage/methodNaming';
import { responsibilityMarks } from '../../domain/stage/responsibilityMarks';
import { CALL_RESPONSIBILITY, classResponsibilities } from '../../domain/scoring/responsibilities';
import type { Stage } from '../../domain/stage/Stage';
import { showsVisibilityControl } from '../../domain/stage/showsVisibilityControl';
import { ChangeMemo } from '../change/ChangeMemo';
import { ClassCodePreview } from './ClassCodePreview';
import { CodeChangeDialog } from './CodeChangeDialog';
import { useGameStore } from '../store/useGameStore';
import { FieldInfo } from './FieldInfo';
import { ResponsibilityMark } from './ResponsibilityMark';
import { describeVisibility } from './describeVisibility';
import { responsibilityBreakdown, responsibilityNameOf } from './responsibilityLabel';

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
  marks,
  names,
  method,
  selected,
  onToggle,
}: Readonly<{ codebase: Codebase; marks: ReadonlyMap<string, number>; names: Readonly<Record<string, string>>; method: Method; selected: ReadonlySet<string>; onToggle: (id: string) => void }>) {
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
            {fragment.responsibility === CALL_RESPONSIBILITY ? null : <ResponsibilityMark number={marks.get(fragment.responsibility) ?? 0} name={responsibilityNameOf(names, fragment.responsibility)} />}
            <span className="fragment-list__label">{fragment.label}</span>
            <span className="fragment-list__lines">{fragmentLines(fragment, codebase)}行</span>
          </label>
          <FragmentFieldRefs codebase={codebase} fragment={fragment} />
        </li>
      ))}
    </ul>
  );
}

/** 選んだメソッドのクラスが受け持つ責務の内訳。責務が0種類なら出さない。 */
function OwnerResponsibilities({ owner, marks, names }: Readonly<{ owner: CodeClass; marks: ReadonlyMap<string, number>; names: Readonly<Record<string, string>> }>) {
  const breakdown = responsibilityBreakdown(classResponsibilities(owner), marks, names);
  if (breakdown === '') return null;
  return <p className="method-editor__responsibilities" data-testid="owner-responsibilities">{owner.name} の責務: {breakdown}</p>;
}

/** 選択中のメソッドと形が一致する、別クラスのprivateメソッドへのボタンを並べ、Merge Methodsを実行する。 */
function MergeSection({ method, candidates }: Readonly<{ method: Method; candidates: readonly MergeCandidate[] }>) {
  const codebase = useGameStore((state) => state.codebase);
  const mergeMethods = useGameStore((state) => state.mergeMethods);
  const [name, setName] = useState(method.name);

  return (
    <div className="method-editor__merge">
      <h3 className="method-editor__merge-title">似た処理を持つメソッドと統合</h3>
      <p className="method-editor__merge-description">同じ処理を1つのメソッドにまとめます。統合したメソッドは、今選んでいるメソッドの場所に残ります</p>
      <label className="method-editor__merge-label" htmlFor="method-editor-merge-name">統合後の名前</label>
      <input
        id="method-editor-merge-name"
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
              {findClass(codebase, candidate.ownerClassId)?.name ?? '?'}.{candidate.method.name}() と統合する
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

const VISIBILITY_OPTIONS: readonly Visibility[] = ['public', 'protected', 'private'];

function ExtractControls({
  newName,
  disabledReason,
  isDuplicate,
  onNameChange,
  onExtract,
  previewSummary,
  growthHeadsUp,
}: Readonly<{
  newName: string;
  disabledReason: string | null;
  isDuplicate: boolean;
  onNameChange: (name: string) => void;
  onExtract: () => void;
  previewSummary: string | undefined;
  growthHeadsUp: string | undefined;
}>) {
  return (
    <>
      <div className="method-editor__extract">
        <input
          aria-label="新しいメソッド名"
          aria-invalid={isDuplicate ? true : undefined}
          aria-describedby={isDuplicate ? 'method-editor-extract-disabled-reason' : undefined}
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
      {previewSummary === undefined ? null : <div aria-live="polite"><p className="method-editor__extract-preview">{previewSummary}</p>{growthHeadsUp === undefined ? null : <p className="method-editor__growth-heads-up" data-testid="extract-growth-heads-up">{growthHeadsUp}</p>}</div>}
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

function implementsAbstractMethod(codebase: Codebase, method: Method): boolean {
  const owner = findClassOfMethod(codebase, method.id);
  if (owner === undefined) return false;
  const pending = [...parentIds(owner)];
  const visited = new Set<string>();
  while (pending.length > 0) {
    const parentId = pending.shift();
    if (parentId === undefined || visited.has(parentId)) continue;
    visited.add(parentId);
    const parent = findClass(codebase, parentId);
    if (parent === undefined) continue;
    const hasAbstractDeclaration = (isAbstractLike(parent) || isInterfaceLike(parent))
      && parent.methods.some((candidate) => candidate.name === method.name && candidate.fragments.length === 0);
    if (hasAbstractDeclaration) return true;
    pending.push(...parentIds(parent));
  }
  return false;
}

function useExtractPreviewSummary(method: Method, selected: ReadonlySet<string>, newName: string): { summary: string | undefined; growthHeadsUp: string | undefined } {
  const setExtractDraft = useGameStore((state) => state.setExtractDraft);
  const codebase = useGameStore((state) => state.codebase);
  const draft = useGameStore((state) => state.extractDraft);
  const allowed = useGameStore((state) => state.changeSession === null && state.manualFix === null);
  const limits = useGameStore((state) => state.stage.limits);
  const preview = useMemo(() => draft === null || !allowed ? undefined : previewExtractMethod(codebase, draft), [allowed, codebase, draft]);
  useEffect(() => {
    setExtractDraft(selected.size === 0 ? null : { sourceMethodId: method.id, fragmentIds: [...selected], newMethodName: newName });
  }, [method.id, newName, selected, setExtractDraft]);
  return preview === undefined ? { summary: undefined, growthHeadsUp: undefined } : { summary: describeExtractPreview(method.name, preview), growthHeadsUp: describeGrowthHeadsUp(preview, limits) };
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
  const visibilityDescription = describeVisibility({
    current: method.visibility,
    disabled: VISIBILITY_OPTIONS.filter((visibility) => disabled.has(visibility)),
    implementsAbstract: implementsAbstractMethod(codebase, method),
  });
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
      <p className="method-editor__visibility-hint">{visibilityDescription.map((line) => <span key={line}>{line}</span>)}</p>
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
        <div className="method-editor__inline-action">
          <button
            type="button"
            title="このメソッドの中身を呼び出し元へ書き戻して、このメソッドを消します"
            onClick={() => {
              inlineMethod(method.id);
            }}
          >
            呼び出し元へ戻す
          </button>
          <p className="method-editor__inline-hint">このメソッドの中身を呼び出し元へ書き戻して、このメソッドを消します</p>
        </div>
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

/** 印の番号。codebaseが変わらない限り同じ参照を保つ。 */
function useResponsibilityMarks(stage: Stage, codebase: Codebase): ReadonlyMap<string, number> {
  return useMemo(
    () => responsibilityMarks(stage.codebase, codebase, stage.changeRequests.map((request) => request.responsibility)),
    [stage, codebase],
  );
}

/** コードタブ。組み替える前(ステージの初期状態)と今のコードを並べるダイアログを開くボタンを上に置く。 */
function CodeTab({ before, codebase, classId }: Readonly<{ before: Codebase; codebase: Codebase; classId: string }>) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="code-change__open" onClick={() => { setOpen(true); }}>組み替える前と比べる</button>
      <ClassCodePreview codebase={codebase} classId={classId} />
      {open ? <CodeChangeDialog before={before} after={codebase} onClose={() => { setOpen(false); }} /> : null}
    </>
  );
}

/** 選択中のメソッドの中身を表示し、処理のまとまりを選んで Extract Method する。 */
function MethodEditorBody({ method, showVisibility, stage }: Readonly<{ method: Method; showVisibility: boolean; stage: Stage }>) {
  const codebase = useGameStore((state) => state.codebase);
  const owner = findClassOfMethod(codebase, method.id);
  // codebaseが変わらない限り同じ配列参照を保つ(毎レンダー新しい配列を作るとZustandの購読が無限ループする)
  const mergeCandidates = useMemo(() => findMergeCandidates(codebase, method.id), [codebase, method.id]);
  const marks = useResponsibilityMarks(stage, codebase);
  const extractMethod = useGameStore((state) => state.extractMethod);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'edit' | 'code'>('edit');
  // null のあいだは選んだ処理から名前を自動で考え、プレイヤーが入力したらその名前を優先する
  const [customName, setCustomName] = useState<string | null>(null);
  const existingNames = owner?.methods.map((ownerMethod) => ownerMethod.name) ?? [];
  const methodNaming = useMemo(() => methodNamingOf(stage), [stage]);
  const newName =
    customName ??
    suggestMethodName(
      method.fragments.filter((fragment) => selected.has(fragment.id)),
      existingNames,
      methodNaming,
    );
  const disabledReason = extractDisabledReason(method, selected, newName, existingNames);

  const { summary: previewSummary, growthHeadsUp } = useExtractPreviewSummary(method, selected, newName);

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
        {owner?.name ?? '?'}.{method.name}() <span className="line-badge">{methodLines(method, codebase)}行</span>
      </h2>
      {owner === undefined ? null : <OwnerResponsibilities owner={owner} marks={marks} names={stage.responsibilityNames} />}
      <div className="method-editor__tabs" role="tablist" aria-label="メソッド表示">
        <button className="method-editor__tab" type="button" role="tab" aria-selected={activeTab === 'edit'} onClick={() => { setActiveTab('edit'); }}>編集</button>
        <button className="method-editor__tab" type="button" role="tab" aria-selected={activeTab === 'code'} onClick={() => { setActiveTab('code'); }}><span className="method-editor__tab-icon" aria-hidden="true">&lt;/&gt;</span>コード</button>
      </div>
      {activeTab === 'code' ? <CodeTab before={stage.codebase} codebase={codebase} classId={owner?.id ?? ''} /> : (
        <div role="tabpanel" aria-label="編集">
          <div data-tour="extract-area">
            <FragmentList codebase={codebase} marks={marks} names={stage.responsibilityNames} method={method} selected={selected} onToggle={(id) => { setSelected(toggle(selected, id)); }} />
            <ExtractControls
              newName={newName}
              disabledReason={disabledReason}
              isDuplicate={extractNameInvalid(method, selected, newName, existingNames)}
              onNameChange={setCustomName}
              onExtract={handleExtract}
              previewSummary={previewSummary}
              growthHeadsUp={growthHeadsUp}
            />
          </div>
          {mergeCandidates.length > 0 ? <MergeSection method={method} candidates={mergeCandidates} /> : null}
          <MethodActions method={method} showVisibility={showVisibility} />
        </div>
      )}
    </>
  );
}

export function MethodEditor({ alwaysShowVisibility = false, emptyMessage = 'refactor' }: Readonly<{ alwaysShowVisibility?: boolean; emptyMessage?: 'refactor' | 'blank' }>) {
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
        {emptyMessage === 'blank' ? (
          <>
            <h2>部品置き場の部品を、置きたいクラスへドラッグしよう</h2>
            <p>キャンバスの空いている所へ落とすと新しいクラスができ、クラスへ落とすとそのクラスに入ります</p>
            <p>置いたメソッドをクリックすると、中身と public / private がここに出ます</p>
            <p>全部品を置いたら、上の「答え合わせ」を押そう</p>
          </>
        ) : (
          <>
            <h2>中央の図から、直したいメソッドをクリックしてみよう</h2>
            <p>クリックすると、中の処理がここに並びます。まとまりを選んで「メソッドとして抽出」できます</p>
            <p>メソッドはドラッグで別のクラスへ移せます</p>
            <p>フィールドをクリックすると説明が出ます</p>
          </>
        )}
      </div>
    );
  }
  else content = <MethodEditorBody key={method.id} method={method} stage={stage} showVisibility={alwaysShowVisibility || showsVisibilityControl(stage)} />;
  return (
    <aside className="method-editor" aria-label="メソッドエディタ">
      {content}
      <ChangeMemo />
    </aside>
  );
}
