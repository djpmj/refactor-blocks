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
import { describeBoss } from './describeBoss';
import { describeDeductions, describePlacement, siteNames } from './describeChange';
import { describeRumorPayoff } from './describeRumorPayoff';
import { painRequestsOf } from '../../domain/change/changePain';
import { rumoredRequests } from '../../domain/change/rumors';
import { usesInheritance } from './usesInheritance';

const KIND_LABEL: Record<ChangeKind, string> = { modify: 'ルールの変更', extend: '機能の追加' };

function CostRows({ current, initial, codebase, previous }: Readonly<{ current: ChangeAssessment; initial: ChangeAssessment; codebase: Codebase; previous?: number }>) {
  return (
    <>
      <p className="change-outcome__facts">
        変更が必要: {siteNames(current, codebase)}({current.impact.classesTouched}クラス・{current.impact.filesTouched}ファイル・+{current.impact.linesAdded}行)
      </p>
      <p className="change-outcome__scores">
        変更のしやすさ <strong data-testid="outcome-current">{current.score.total}点</strong>(組み替える前は <span data-testid="outcome-initial">{initial.score.total}点</span>)
        {previous === undefined ? null : <span data-testid="outcome-previous"> / 前回 {previous}点</span>}
      </p>
    </>
  );
}

const SAMPLE_ON_IDEAL_BASE_NOTE = '解答例は、前の依頼もすべて解答例どおりに置いた場合の置き場所です';

/** 前の依頼で、解答例と違うクラスに置いていたか。 */
// ponytail: 解答例が新しいクラスの依頼は、新クラス名がプレイヤーの命名と一致しないので判定しない。ズレを案内したくなったら、置き先のクラスIDを outcome に持たせる
function placedOffSample({ sample, placement }: ChangeOutcome): boolean {
  return sample?.target.kind === 'existing-class' && sample.target.className !== placement.placement.partClassName;
}

/** 解答例: どこに置くのが最も点が高いか。 */
function SampleAnswer({ sample, onIdealBase }: Readonly<{ sample: SampleImplementation | undefined; onIdealBase: boolean }>) {
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
      {onIdealBase && <span data-testid="outcome-sample-note"> {SAMPLE_ON_IDEAL_BASE_NOTE}</span>}
      <CodebasePreviewDialog title="解答例の図" codebase={open ? sample.codebase : null} methodLimit={methodLimit} onClose={() => setOpen(false)} />
    </div>
  );
}

const BOSS_LABEL = '⚠ 鬼の変更';

/** ボスの結果: 組み替える前のコードに入れていたら、と今の設計を並べる。 */
function BossComparison({ outcome }: Readonly<{ outcome: ChangeOutcome }>) {
  const openingTitle = useGameStore((state) => painRequestsOf(state.stage).modify?.title);
  const { bossCounterfactual: before, placement } = outcome;
  if (before === undefined) return null;
  const modifiedCount = placement.placement.modifiedClassIds.length;
  return (
    <div data-testid="boss-comparison">
      <p>鬼の変更の置き方の点数で比べています</p>
      <div className="boss-comparison">
        <div className="boss-comparison__side">
          <strong>組み替える前のコードなら</strong>
          <p>最善の置き方でも {before.score}点</p>
          <p>既存の {before.modifiedClassNames.length} クラスを書き換え({before.modifiedClassNames.join('・')})</p>
          {before.overLimitClassNames.map((name) => <p key={name}>{name} が行数の上限を超える</p>)}
        </div>
        <div className="boss-comparison__side">
          <strong>あなたの設計では</strong>
          <p>置き方 {placement.score.total}点</p>
          <p>{modifiedCount === 0 ? '既存のクラスを書き換えずに済んだ' : `既存の ${modifiedCount} クラスを書き換え`}</p>
        </div>
      </div>
      <p className="boss-comparison__summary">{describeBoss(outcome, openingTitle)}</p>
    </div>
  );
}

/** 機能の追加(current が null)では、コストの行は出さず置き方だけで採点する。 */
function OutcomeCard({ outcome, codebase, previous, onIdealBase }: Readonly<{ outcome: ChangeOutcome; codebase: Codebase; previous?: number; onIdealBase: boolean }>) {
  const { current, initial, request, placement, sample } = outcome;
  const reasons = [...(current === null ? [] : describeDeductions(current, codebase)), ...describePlacement(outcome, codebase)];
  const rumorPayoff = describeRumorPayoff(outcome, codebase);
  return (
    <li className="change-outcome" data-testid={`change-outcome-${request.id}`}>
      {request.boss === true && <p className="boss-label">{BOSS_LABEL}</p>}
      <h3 className="change-outcome__title">{request.title}</h3>
      {current === null || initial === null ? (
        <p className="change-outcome__facts">機能の追加なので、置き方だけで採点します</p>
      ) : (
        <CostRows current={current} initial={initial} codebase={codebase} previous={previous} />
      )}
      <p className="change-outcome__scores" data-testid="outcome-placement">
        置き方 {placement.score.total}点(置いた先: {placement.placement.partClassName})
      </p>
      <SampleAnswer sample={sample} onIdealBase={onIdealBase} />
      <BossComparison outcome={outcome} />
      {rumorPayoff === undefined ? null : (
        <p className={`rumor-payoff${placement.score.total === 100 ? ' rumor-payoff--ready' : ' rumor-payoff--unready'}`} data-testid="rumor-payoff">
          {rumorPayoff}
        </p>
      )}
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
      <div className={`change-score-summary${costs.length === 0 ? ' change-score-summary--placement-only' : ''}`}>
        {costs.length === 0 ? null : <p data-testid="change-readiness">
          変更のしやすさ <strong data-testid="change-readiness-current">{averageScore(costs.map((cost) => cost.current.score))}点</strong>
          <span data-testid="change-readiness-initial">組み替える前は {averageScore(costs.map((cost) => cost.initial.score))}点</span>
          <span>この設計に、依頼の変更を入れる手間(直す場所・読む量・行数の上限)</span>
        </p>}
        <p data-testid="change-placement-score">
          置き方 <strong>{averageScore(outcomes.map((outcome) => outcome.placement.score))}点</strong>
          <span>あなたが部品を置いた場所が、自然な置き場所だったか</span>
        </p>
      </div>
      <ul className="change-outcomes">
        {outcomes.map((outcome, index) => (
          <OutcomeCard
            key={outcome.request.id}
            outcome={outcome}
            codebase={codebase}
            onIdealBase={outcomes.slice(0, index).some(placedOffSample)}
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
        {findClassOfMethod(codebase, method.id)?.name}.{method.name}() — {methodLines(method, codebase)}行
      </h3>
      <ul className="change-inspect__fragments">
        {method.fragments.map((fragment) => (
          <li key={fragment.id}>
            {fragment.label}({fragmentLines(fragment, codebase)}行)
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
  const isRumored = request !== undefined && rumoredRequests(stage).some((candidate) => candidate.id === request.id);
  return (
    <aside className={`method-editor change-panel${request?.boss === true ? ' change-panel--boss' : ''}`} aria-label="変更依頼" data-testid="change-panel">
      {request === undefined ? (
        <Results outcomes={session.outcomes} />
      ) : (
        <>
          {request.boss === true && <p className="boss-label" data-testid="boss-label">{BOSS_LABEL}</p>}
          <p className="method-editor__hint">
            依頼 {session.index + 1} / {stage.changeRequests.length}
            <span data-testid="change-request-kind"> {KIND_LABEL[changeKindOf(request)]}</span>
          </p>
          {isRumored && request.rumor !== undefined && <p className="rumor-came-true" data-testid="rumor-came-true">うわさが本当になりました: 『{request.rumor.text}』</p>}
          <h2 className="method-editor__title" data-testid="change-request-title">
            {request.title}
          </h2>
          <p>{request.description}</p>
          <p className="method-editor__hint">
            部品置き場の {changePart(request).name}() を、実装する場所へドラッグしてください。既存のクラスへ落とすとそのクラスに足し、余白へ落とすと新しいクラスができます。
            {usesInheritance(stage) ? '新しいクラスは右クリックで継承元・実装するインターフェースを設定できます。' : ''}Ctrl+Z で戻せます
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
