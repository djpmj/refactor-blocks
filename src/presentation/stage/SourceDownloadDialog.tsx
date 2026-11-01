import { useEffect, useMemo, useRef } from 'react';
import { findClass, findMethod, type Codebase } from '../../domain/codebase/Codebase';
import { findBuildIssues } from '../../domain/codebase/buildIssues';
import { csharpProjectName, generateCSharpProject } from '../../domain/codebase/csharpProject';
import type { StageRuntime } from '../../domain/stage/StageRuntime';
import { downloadZip } from '../../infrastructure/export/zip';

function issueText(codebase: Codebase, issue: ReturnType<typeof findBuildIssues>[number]): string {
  const className = findClass(codebase, issue.classId)?.name ?? issue.classId;
  const methodName = findMethod(codebase, issue.methodId)?.name ?? issue.methodId;
  const ownerName = findClass(codebase, issue.ownerClassId)?.name ?? issue.ownerClassId;
  return `${className}.${methodName} が ${ownerName}.${issue.memberName}(private)を使っている`;
}

/** C# プロジェクトのダウンロード前に開く確認ダイアログ。ビルドが通らない箇所があっても、そのままダウンロードできる。 */
export function SourceDownloadDialog({ stageId, runtime, codebase, onClose }: Readonly<{ stageId: string; runtime: StageRuntime; codebase: Codebase; onClose: () => void }>) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const issues = useMemo(() => findBuildIssues(codebase), [codebase]);
  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);
  const download = () => {
    downloadZip(`${stageId}.zip`, generateCSharpProject(codebase, runtime, csharpProjectName));
    onClose();
  };
  return (
    <dialog ref={dialogRef} className="answer-confirm" data-testid="source-download-dialog" aria-labelledby="source-download-title" onClose={onClose}>
      <h2 id="source-download-title">ソースをダウンロード(C#)</h2>
      {issues.length === 0 ? (
        <p>Visual Studio で <code>.csproj</code> を開くと、ビルドしてデバッグ実行できます。</p>
      ) : (
        <>
          <p data-testid="source-download-issues">この状態ではビルドが通らない箇所: {issues.length}件</p>
          <ul>
            {issues.map((issue) => <li key={`${issue.methodId}-${issue.ownerClassId}-${issue.memberName}`}>{issueText(codebase, issue)}</li>)}
          </ul>
        </>
      )}
      <div className="answer-confirm__actions">
        <button type="button" className="button--primary" data-testid="source-download-confirm" onClick={download}>ダウンロードする</button>
        <button type="button" onClick={() => dialogRef.current?.close()}>やめる</button>
      </div>
    </dialog>
  );
}
