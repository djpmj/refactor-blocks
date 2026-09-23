import type { ChangeOutcome } from '../../application/ChangeRequestUseCases';
import { averageScore } from '../../domain/change/scoreChange';
import { findClassOfMethod, findMethod, type Codebase, type Method } from '../../domain/codebase/Codebase';
import { methodLines } from '../../domain/codebase/lineCount';
import { useGameStore } from '../store/useGameStore';
import { describeDeductions, siteNames } from './describeChange';

function OutcomeCard({ outcome, codebase, previous }: Readonly<{ outcome: ChangeOutcome; codebase: Codebase; previous?: number }>) {
  const { current, initial, request } = outcome;
  const reasons = describeDeductions(current, codebase);
  return (
    <li className="change-outcome" data-testid={`change-outcome-${request.id}`}>
      <h3 className="change-outcome__title">{request.title}</h3>
      <p className="change-outcome__scores">
        今のコード <strong data-testid="outcome-current">{current.score.total}点</strong> / 初期状態 <span data-testid="outcome-initial">{initial.score.total}点</span>
        {previous === undefined ? null : <span data-testid="outcome-previous"> / 前回 {previous}点</span>}
      </p>
      <p className="change-outcome__facts">
        変更が必要: {siteNames(current, codebase)}({current.impact.classesTouched}クラス・{current.impact.filesTouched}ファイル・+{current.impact.linesAdded}行)
      </p>
      {reasons.length === 0 ? (
        <p className="change-outcome__good">減点なし。この変更は1か所で済み、影響も小さい設計です</p>
      ) : (
        <ul className="change-outcome__reasons">
          {reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      )}
    </li>
  );
}

function Results({ outcomes }: Readonly<{ outcomes: readonly ChangeOutcome[] }>) {
  const codebase = useGameStore((state) => state.codebase);
  const endChangeRequests = useGameStore((state) => state.endChangeRequests);
  // 結果を閉じるまでは、直前の挑戦の結果がまだ残っているので、それを「前回」として並べる
  const previousOutcomes = useGameStore((state) => state.lastChangeReport?.outcomes);
  return (
    <>
      <h2 className="method-editor__title">変更依頼の結果</h2>
      <p data-testid="change-readiness">
        変更容易性スコア: <strong data-testid="change-readiness-current">{averageScore(outcomes.map((outcome) => outcome.current.score))}点</strong>
        (初期状態は <span data-testid="change-readiness-initial">{averageScore(outcomes.map((outcome) => outcome.initial.score))}点</span>)
      </p>
      <ul className="change-outcomes">
        {outcomes.map((outcome) => (
          <OutcomeCard
            key={outcome.request.id}
            outcome={outcome}
            codebase={codebase}
            previous={previousOutcomes?.find((previous) => previous.request.id === outcome.request.id)?.current.score.total}
          />
        ))}
      </ul>
      <button type="button" data-testid="change-request-close" onClick={endChangeRequests}>
        リファクタリングに戻る
      </button>
    </>
  );
}

function MethodContents({ method, codebase, preview }: Readonly<{ method: Method; codebase: Codebase; preview: boolean }>) {
  return (
    <li className="change-inspect__method" data-testid={`change-inspect-${method.name}`}>
      <h3 className="change-inspect__title">
        {findClassOfMethod(codebase, method.id)?.name}.{method.name}() — {methodLines(method)}行{preview ? '(確認中)' : ''}
      </h3>
      <ul className="change-inspect__fragments">
        {method.fragments.map((fragment) => (
          <li key={fragment.id}>
            {fragment.label}({fragment.lines}行)
          </li>
        ))}
      </ul>
    </li>
  );
}

/** 選んだメソッドと、カーソルを合わせているメソッドが何をしているか(処理の一覧)。調査の手がかりになる。 */
function InspectedMethods() {
  const codebase = useGameStore((state) => state.codebase);
  const selected = useGameStore((state) => state.changeSession?.selected ?? []);
  const inspected = useGameStore((state) => state.changeSession?.inspected ?? null);
  const previewId = inspected !== null && !selected.includes(inspected) ? inspected : null;
  const methods = [...selected.map((id) => ({ id, preview: false })), ...(previewId === null ? [] : [{ id: previewId, preview: true }])].flatMap(
    ({ id, preview }) => {
      const method = findMethod(codebase, id);
      return method === undefined ? [] : [{ method, preview }];
    },
  );
  return (
    <section className="change-inspect" data-testid="change-inspect" aria-live="polite">
      {methods.length === 0 ? (
        <p className="method-editor__hint">メソッドにカーソルを合わせると、何をしているメソッドか(中の処理)がここに出ます。選んだメソッドは並べて表示します</p>
      ) : (
        <ul className="change-inspect__methods">
          {methods.map(({ method, preview }) => (
            <MethodContents key={method.id} method={method} codebase={codebase} preview={preview} />
          ))}
        </ul>
      )}
    </section>
  );
}

/** 変更依頼に挑戦中のサイドパネル。依頼票と影響調査、全件終わったら結果を出す。 */
export function ChangeRequestPanel() {
  const stage = useGameStore((state) => state.stage);
  const session = useGameStore((state) => state.changeSession);
  const message = useGameStore((state) => state.message);
  const finishInvestigation = useGameStore((state) => state.finishInvestigation);
  const endChangeRequests = useGameStore((state) => state.endChangeRequests);
  if (session === null) return null;
  const request = stage.changeRequests.at(session.index);
  return (
    <aside className="method-editor change-panel" aria-label="変更依頼" data-testid="change-panel">
      {request === undefined ? (
        <Results outcomes={session.outcomes} />
      ) : (
        <>
          <p className="method-editor__hint">
            依頼 {session.index + 1} / {stage.changeRequests.length}
          </p>
          <h2 className="method-editor__title" data-testid="change-request-title">
            {request.title}
          </h2>
          <p>{request.description}</p>
          <p className="method-editor__hint">この依頼で変更が必要だと思うメソッドを、キャンバス上でクリックして選んでください(選んだ数: {session.selected.length})</p>
          <InspectedMethods />
          {message === null ? null : <p className="method-editor__message">{message}</p>}
          <button type="button" data-testid="change-request-finish" onClick={finishInvestigation}>
            調査を終える
          </button>
          <button type="button" onClick={endChangeRequests}>
            やめる
          </button>
        </>
      )}
    </aside>
  );
}
