import type { ChangeOutcome } from '../../application/ChangeRequestUseCases';
import { averageScore } from '../../domain/change/scoreChange';
import type { Codebase } from '../../domain/codebase/Codebase';
import { useGameStore } from '../store/useGameStore';
import { describeDeductions, siteNames } from './describeChange';

function OutcomeCard({ outcome, codebase }: Readonly<{ outcome: ChangeOutcome; codebase: Codebase }>) {
  const { current, initial, request } = outcome;
  const reasons = describeDeductions(outcome, codebase);
  return (
    <li className="change-outcome" data-testid={`change-outcome-${request.id}`}>
      <h3 className="change-outcome__title">{request.title}</h3>
      <p className="change-outcome__scores">
        今のコード <strong data-testid="outcome-current">{current.score.total}点</strong> / 初期状態 <span data-testid="outcome-initial">{initial.score.total}点</span>
      </p>
      <p className="change-outcome__facts">
        変更が必要: {siteNames(outcome, codebase)}({current.impact.classesTouched}クラス・{current.impact.filesTouched}ファイル・+{current.impact.linesAdded}行)
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
  return (
    <>
      <h2 className="method-editor__title">変更依頼の結果</h2>
      <p data-testid="change-readiness">
        変更容易性スコア: <strong data-testid="change-readiness-current">{averageScore(outcomes.map((outcome) => outcome.current.score))}点</strong>
        (初期状態は <span data-testid="change-readiness-initial">{averageScore(outcomes.map((outcome) => outcome.initial.score))}点</span>)
      </p>
      <ul className="change-outcomes">
        {outcomes.map((outcome) => (
          <OutcomeCard key={outcome.request.id} outcome={outcome} codebase={codebase} />
        ))}
      </ul>
      <button type="button" data-testid="change-request-close" onClick={endChangeRequests}>
        リファクタリングに戻る
      </button>
    </>
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
