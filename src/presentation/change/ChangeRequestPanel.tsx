import { useState } from 'react';
import type { ChangeOutcome } from '../../application/ChangeRequestUseCases';
import { changeKindOf, type ChangeKind, type ChangeRequest } from '../../domain/change/ChangeRequest';
import { changePart, isChangePartPlaced } from '../../domain/change/changePart';
import type { SampleImplementation } from '../../domain/change/sampleImplementation';
import { averageScore, type ChangeAssessment } from '../../domain/change/scoreChange';
import { findClassOfMethod, findMethod, type Codebase, type Method } from '../../domain/codebase/Codebase';
import { fragmentLines, methodLines } from '../../domain/codebase/lineCount';
import { CodebasePreviewDialog } from '../preview/CodebasePreviewDialog';
import { useGameStore } from '../store/useGameStore';
import { describeDeductions, describePlacement, siteNames } from './describeChange';

const KIND_LABEL: Record<ChangeKind, string> = { modify: 'ルールの変更', extend: '機能の追加' };

function CostRows({ current, initial, codebase, previous }: Readonly<{ current: ChangeAssessment; initial: ChangeAssessment; codebase: Codebase; previous?: number }>) {
  return (
    <>
      <p className="change-outcome__scores">
        今のコード <strong data-testid="outcome-current">{current.score.total}点</strong> / 初期状態 <span data-testid="outcome-initial">{initial.score.total}点</span>
        {previous === undefined ? null : <span data-testid="outcome-previous"> / 前回 {previous}点</span>}
      </p>
      <p className="change-outcome__facts">
        変更が必要: {siteNames(current, codebase)}({current.impact.classesTouched}クラス・{current.impact.filesTouched}ファイル・+{current.impact.linesAdded}行)
      </p>
    </>
  );
}

/** 解答例: どこに置くのが最も点が高いか。 */
function SampleAnswer({ sample }: Readonly<{ sample: SampleImplementation | undefined }>) {
  const [open, setOpen] = useState(false);
  const methodLimit = useGameStore((state) => state.stage.limits.method);
  if (sample === undefined) return null;
  const { target, score } = sample;
  const where = target.kind === 'existing-class' ? `既存の ${target.className} に置く` : `${target.implementing} を実装する新しいクラスを作って置く`;
  return (
    <div className="change-outcome__facts" data-testid="outcome-sample">
      解答例: {where}({score}点){' '}
      <button type="button" data-testid="outcome-sample-preview" onClick={() => setOpen(true)}>
        解答例の図を見る
      </button>
      <CodebasePreviewDialog title="解答例の図" codebase={open ? sample.codebase : null} methodLimit={methodLimit} onClose={() => setOpen(false)} />
    </div>
  );
}

/** 機能の追加(current が null)では、コストの行は出さず置き方だけで採点する。 */
function OutcomeCard({ outcome, codebase, previous }: Readonly<{ outcome: ChangeOutcome; codebase: Codebase; previous?: number }>) {
  const { current, initial, request, placement, sample } = outcome;
  const reasons = [...(current === null ? [] : describeDeductions(current, codebase)), ...describePlacement(outcome, codebase)];
  return (
    <li className="change-outcome" data-testid={`change-outcome-${request.id}`}>
      <h3 className="change-outcome__title">{request.title}</h3>
      {current === null || initial === null ? (
        <p className="change-outcome__facts">機能の追加なので、置き方だけで採点します</p>
      ) : (
        <CostRows current={current} initial={initial} codebase={codebase} previous={previous} />
      )}
      <p className="change-outcome__scores" data-testid="outcome-placement">
        置き方 {placement.score.total}点(置いた先: {placement.placement.partClassName})
      </p>
      <SampleAnswer sample={sample} />
      {reasons.length === 0 ? (
        <p className="change-outcome__good">減点なし。既存のコードを触らず、自然な場所に置けています</p>
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
  // 理由文の名前引きは、前の依頼で作ったクラスも引けるよう、実装を積み重ねたコードで行う
  const codebase = useGameStore((state) => state.changeSession?.carried ?? state.codebase);
  const endChangeRequests = useGameStore((state) => state.endChangeRequests);
  // 結果を閉じるまでは、直前の挑戦の結果がまだ残っているので、それを「前回」として並べる
  const previousOutcomes = useGameStore((state) => state.lastChangeReport?.outcomes);
  const costs = outcomes.flatMap((outcome) => (outcome.current === null || outcome.initial === null ? [] : [{ current: outcome.current, initial: outcome.initial }]));
  return (
    <>
      <h2 className="method-editor__title">変更依頼の結果</h2>
      <p data-testid="change-readiness">
        変更容易性スコア: <strong data-testid="change-readiness-current">{averageScore(costs.map((cost) => cost.current.score))}点</strong>
        (初期状態は <span data-testid="change-readiness-initial">{averageScore(costs.map((cost) => cost.initial.score))}点</span>)
      </p>
      <p data-testid="change-placement-score">
        実装スコア: <strong>{averageScore(outcomes.map((outcome) => outcome.placement.score))}点</strong>
      </p>
      <ul className="change-outcomes">
        {outcomes.map((outcome) => (
          <OutcomeCard
            key={outcome.request.id}
            outcome={outcome}
            codebase={codebase}
            previous={previousOutcomes?.find((previous) => previous.request.id === outcome.request.id)?.current?.score.total}
          />
        ))}
      </ul>
      <button type="button" data-testid="change-request-close" onClick={endChangeRequests}>
        リファクタリングに戻る
      </button>
    </>
  );
}

function MethodContents({ method, codebase }: Readonly<{ method: Method; codebase: Codebase }>) {
  return (
    <li className="change-inspect__method" data-testid={`change-inspect-${method.name}`}>
      <h3 className="change-inspect__title">
        {findClassOfMethod(codebase, method.id)?.name}.{method.name}() — {methodLines(method)}行
      </h3>
      <ul className="change-inspect__fragments">
        {method.fragments.map((fragment) => (
          <li key={fragment.id}>
            {fragment.label}({fragmentLines(fragment)}行)
          </li>
        ))}
      </ul>
    </li>
  );
}

/** カーソルを合わせているメソッドが何をしているか(処理の一覧)。置き場所を決める手がかりになる。 */
function InspectedMethod() {
  const codebase = useGameStore((state) => state.codebase);
  const inspected = useGameStore((state) => state.changeSession?.inspected ?? null);
  const method = inspected === null ? undefined : findMethod(codebase, inspected);
  return (
    <section className="change-inspect" data-testid="change-inspect" aria-live="polite">
      {method === undefined ? (
        <p className="method-editor__hint">メソッドにカーソルを合わせると、何をしているメソッドか(中の処理)がここに出ます</p>
      ) : (
        <ul className="change-inspect__methods">
          <MethodContents method={method} codebase={codebase} />
        </ul>
      )}
    </section>
  );
}

/** 部品を置いたかどうかと、置いた先のクラス名。 */
function PartStatus({ request }: Readonly<{ request: ChangeRequest }>) {
  const codebase = useGameStore((state) => state.codebase);
  const className = isChangePartPlaced(codebase, request) ? findClassOfMethod(codebase, changePart(request).id)?.name : undefined;
  return (
    <p className="method-editor__hint" data-testid="change-part-status" aria-live="polite">
      {className === undefined ? '部品はまだ部品置き場にあります' : `${className} に置きました`}
    </p>
  );
}

/** 変更依頼に挑戦中のサイドパネル。依頼票と実装(部品を置く)、全件終わったら結果を出す。 */
export function ChangeRequestPanel() {
  const stage = useGameStore((state) => state.stage);
  const session = useGameStore((state) => state.changeSession);
  const codebase = useGameStore((state) => state.codebase);
  const finishImplementation = useGameStore((state) => state.finishImplementation);
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
            <span data-testid="change-request-kind"> {KIND_LABEL[changeKindOf(request)]}</span>
          </p>
          <h2 className="method-editor__title" data-testid="change-request-title">
            {request.title}
          </h2>
          <p>{request.description}</p>
          <p className="method-editor__hint">
            部品置き場の {changePart(request).name}() を、実装する場所へドラッグしてください。既存のクラスへ落とすとそのクラスに足し、余白へ落とすと新しいクラスができます。
            新しいクラスは右クリックで継承元・実装するインターフェースを設定できます。Ctrl+Z で戻せます
          </p>
          <PartStatus request={request} />
          <InspectedMethod />
          <button type="button" data-testid="change-request-finish" onClick={finishImplementation} disabled={!isChangePartPlaced(codebase, request)}>
            実装を終える
          </button>
          <button type="button" onClick={endChangeRequests}>
            やめる
          </button>
        </>
      )}
    </aside>
  );
}
