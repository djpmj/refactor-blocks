import { findClassOfMethod, type Codebase } from '../../domain/codebase/Codebase';
import { checkManualFix } from '../../domain/change/checkManualFix';
import { painRequestsOf } from '../../domain/change/changePain';
import type { Stage } from '../../domain/stage/Stage';
import { useGameStore } from '../store/useGameStore';

function nameOf(codebase: Codebase, methodId: string): string {
  const owner = findClassOfMethod(codebase, methodId);
  const method = owner?.methods.find((candidate) => candidate.id === methodId);
  return owner === undefined || method === undefined ? methodId : `${owner.name}.${method.name}`;
}

/** 変更依頼を「手で直す」シミュレーション。印を付けてリリースすると、付け漏れ(直し忘れ)が本番バグとして報告される。 */
export function ManualFixPanel({ stage, codebase }: Readonly<{ stage: Stage; codebase: Codebase }>) {
  const manualFix = useGameStore((state) => state.manualFix);
  const releaseManualFix = useGameStore((state) => state.releaseManualFix);
  const restartManualFix = useGameStore((state) => state.restartManualFix);
  const endManualFix = useGameStore((state) => state.endManualFix);
  const request = painRequestsOf(stage).modify;
  if (manualFix === null || request === undefined) return null;
  const result = checkManualFix(codebase, request, manualFix.fixedIds);
  const fixedCount = manualFix.fixedIds.filter((id) => findClassOfMethod(codebase, id) !== undefined).length;
  return (
    <section className="manual-fix" aria-label="手で直すシミュレーション">
      <h3>手で直してみる</h3>
      <p><strong>{request.title}</strong>: {request.description}</p>
      {manualFix.released ? (
        <>
          {result.missed.length === 0 ? (
            <p role="status">✅ 直し忘れなし。{result.sites} か所すべてを直せました</p>
          ) : (
            <div role="status">
              <p>⚠ 直し忘れ {result.missed.length} か所。本番でバグになります</p>
              <ul>{result.missed.map((id) => <li key={id}>{nameOf(codebase, id)}</li>)}</ul>
            </div>
          )}
          {result.extra.length > 0 && <p>関係のないメソッドに印を付けていました: {result.extra.map((id) => nameOf(codebase, id)).join('、')}</p>}
          {result.sites >= 2 && <p>今のコードでは、この変更を入れるのに {result.sites} か所を直す必要があります。1か所にまとめれば、直し忘れは起きません</p>}
          <div className="manual-fix__actions">
            <button type="button" onClick={restartManualFix}>もう一度やる</button>
            <button type="button" onClick={endManualFix}>閉じる</button>
          </div>
        </>
      ) : (
        <>
          <p>直す必要がありそうなメソッドをクリックして『直した』印を付けてください。付け終えたらリリースします</p>
          <p>直した印: {fixedCount} 個</p>
          <div className="manual-fix__actions">
            <button type="button" onClick={releaseManualFix}>リリースする</button>
            <button type="button" onClick={endManualFix}>やめる</button>
          </div>
        </>
      )}
    </section>
  );
}
