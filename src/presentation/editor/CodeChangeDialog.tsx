import { useEffect, useMemo, useRef, useState } from 'react';
import { allClasses, type Codebase } from '../../domain/codebase/Codebase';
import { fragmentChanges, type FragmentChange } from '../../domain/codebase/fragmentChanges';
import { generateClassSourceLines, type SourceLine } from '../../domain/codebase/generateClassSource';
import { WindowControls } from '../preview/WindowControls';
import { highlightCsharpLines } from './highlightCsharp';

type Side = 'before' | 'after';

/** 要約。変化が1件もなければ「まだ組み替えていません」。 */
function summarize(changes: ReadonlyMap<string, FragmentChange>): string {
  const counts = { moved: 0, added: 0, removed: 0 };
  for (const change of changes.values()) counts[change.kind] += 1;
  const parts = [
    counts.moved > 0 ? `移動 ${counts.moved} 件` : '',
    counts.added > 0 ? `追加 ${counts.added} 件` : '',
    counts.removed > 0 ? `削除 ${counts.removed} 件` : '',
  ].filter((part) => part !== '');
  return parts.length === 0 ? 'まだ組み替えていません' : parts.join('・');
}

/** その列に出す変化。左は moved・removed、右は moved・added だけ。 */
function changeOnSide(change: FragmentChange | undefined, side: Side): FragmentChange | undefined {
  if (change === undefined) return undefined;
  if (side === 'before') return change.kind === 'added' ? undefined : change;
  return change.kind === 'removed' ? undefined : change;
}

function labelOf(change: FragmentChange, side: Side): string {
  if (change.kind === 'removed') return '削除';
  if (change.kind === 'added') return '追加';
  if (side === 'before') return `→ ${change.to.className}.${change.to.methodName}() へ`;
  return `← ${change.from.className}.${change.from.methodName}() から`;
}

function sourceLinesOf(codebase: Codebase): SourceLine[] {
  return allClasses(codebase).flatMap((codeClass, index) => [
    ...(index > 0 ? [{ text: '' }] : []),
    ...generateClassSourceLines(codebase, codeClass.id, 'csharp'),
  ]);
}

function CodeColumn({ side, title, codebase, changes }: Readonly<{ side: Side; title: string; codebase: Codebase; changes: ReadonlyMap<string, FragmentChange> }>) {
  const lines = useMemo(() => sourceLinesOf(codebase), [codebase]);
  const highlighted = useMemo(() => highlightCsharpLines(lines.map((line) => line.text).join('\n')), [lines]);
  const labelled = new Set<string>();
  return (
    <section className="code-change__side" aria-label={title} data-testid={`code-${side}`}>
      <h3>{title}</h3>
      <div className="code-preview code-change__code" role="region" tabIndex={0} aria-label={`${title}のコード`}>
        <pre><code className="hljs">{lines.map((line, index) => {
          const change = line.fragmentId === undefined ? undefined : changeOnSide(changes.get(line.fragmentId), side);
          // 変化のあった処理の最初の行(処理名のコメント行)だけにラベルを付ける
          const showLabel = change !== undefined && line.fragmentId !== undefined && !labelled.has(line.fragmentId);
          if (showLabel) labelled.add(line.fragmentId ?? '');
          return (
            <span className="code-preview__line" data-line-number={index + 1} data-fragment-id={line.fragmentId} data-change={change?.kind} key={index}>
              <span className="code-preview__line-source" dangerouslySetInnerHTML={{ __html: highlighted[index] }} />
              {showLabel ? <span className="code-change__label">{labelOf(change, side)}</span> : null}
            </span>
          );
        })}</code></pre>
      </div>
    </section>
  );
}

/** 組み替える前と今のコードを左右に並べ、移動・追加・削除した処理を色と文字で示す。 */
export function CodeChangeDialog({ before, after, onClose }: Readonly<{ before: Codebase; after: Codebase; onClose: () => void }>) {
  const ref = useRef<HTMLDialogElement>(null);
  const [maximized, setMaximized] = useState(false);
  const changes = useMemo(() => fragmentChanges(before, after), [before, after]);
  useEffect(() => {
    const dialog = ref.current;
    if (dialog !== null && !dialog.open) dialog.showModal();
  }, []);
  return (
    <dialog ref={ref} className={`impact-review${maximized ? ' impact-review--maximized' : ''}`} aria-labelledby="code-change-title" data-testid="code-change-dialog" onClose={onClose} onCancel={(event) => { event.preventDefault(); ref.current?.close(); }} onKeyDown={(event) => { if (event.key === 'Escape') { event.preventDefault(); ref.current?.close(); } }}>
      <div className="impact-review__header">
        <h2 id="code-change-title">組み替える前と今のコード</h2>
        <WindowControls maximized={maximized} onToggleMaximize={() => setMaximized((value) => !value)} onClose={() => ref.current?.close()} maximizeTestId="code-change-maximize" />
      </div>
      <div className="impact-review__body">
        <p className="code-change__summary" data-testid="code-change-summary">{summarize(changes)}</p>
        <div className="code-change__columns">
          <CodeColumn side="before" title="組み替える前" codebase={before} changes={changes} />
          <CodeColumn side="after" title="今" codebase={after} changes={changes} />
        </div>
      </div>
    </dialog>
  );
}
