import type { Codebase } from '../../domain/codebase/Codebase';
import { measureExtendPain, measurePain, painRequestsOf, type ChangePain, type ExtendPain } from '../../domain/change/changePain';
import type { Stage } from '../../domain/stage/Stage';
import { useGameStore } from '../store/useGameStore';
import { stageStep } from '../../domain/change/stageStep';
import { TOUR_STEPS } from '../tour/tourSteps';
import { describeClasses, describePain, describePainTrend, summarizePain, type PainDescription } from './describePain';
import { explainChangeImpact } from '../../domain/change/changeImpact';

function LocationList({ description }: Readonly<{ description: PainDescription }>) {
  return (
    <ul>
      {description.locations.map((location) => <li key={location}>{location}</li>)}
      {description.additionalLocations > 0 && <li>ほか {description.additionalLocations} 件</li>}
    </ul>
  );
}

/** 減ったものだけを並べた「最初は …」の中身。何も減っていなければ undefined。 */
function firstSitesText({ initial, current }: Pick<ChangePain, 'initial' | 'current'>): string | undefined {
  const parts = [
    current.siteIds.length < initial.siteIds.length ? `${initial.siteIds.length} か所` : undefined,
    current.classes < initial.classes ? `${initial.classes} クラス` : undefined,
    current.files < initial.files ? `${initial.files} ファイル` : undefined,
  ].filter((part) => part !== undefined);
  return parts.length === 0 ? undefined : parts.join('・');
}

function ModifyBefore({ pain, codebase }: Readonly<{ pain: ChangePain; codebase: Codebase }>) {
  const trend = describePainTrend(pain);
  return (
    <>
      <p className="change-pain__request"><strong>{pain.request.title}</strong></p>
      <p>{pain.request.description}</p>
      <p aria-live="polite">直す場所は今 <strong>{pain.current.siteIds.length} か所</strong>（{pain.current.classes} クラス・{pain.current.files} ファイル）
        {firstSitesText(pain) !== undefined && <>（最初は {firstSitesText(pain)}でした）</>}
      </p>
      <p aria-live="polite">その場所を直すために、目を通す行数は今 <strong>{pain.current.readLines} 行</strong>
        {pain.current.readLines < pain.initial.readLines && <>（最初は {pain.initial.readLines} 行でした）</>}
      </p>
      <p aria-live="polite">そのクラスを開くと、目を通す行数は今 <strong>{pain.current.classLines} 行</strong>
        {pain.current.classLines < pain.initial.classLines && <>（最初は {pain.initial.classLines} 行でした）</>}
      </p>
      {trend !== undefined && <p data-testid="pain-trend">{trend}</p>}
      <LocationList description={describePain(codebase, pain.current)} />
    </>
  );
}

function ModifyAfter({ pain }: Readonly<{ pain: ChangePain }>) {
  const { initial, current } = pain;
  const filesShrank = current.files < initial.files;
  return (
    <>
      {(current.classes < initial.classes || filesShrank) && <p>直すクラスは <strong>{initial.classes} クラス{filesShrank && `・${initial.files} ファイル`} → {current.classes} クラス{filesShrank && `・${current.files} ファイル`}</strong> にまとまりました。</p>}
      {current.classLines < initial.classLines && <p>開いて読むクラスの行数は <strong>{initial.classLines} 行 → {current.classLines} 行</strong> になりました。</p>}
      {pain.current.siteIds.length < pain.initial.siteIds.length && <p>同じ変更が <strong>{pain.initial.siteIds.length} か所 → {pain.current.siteIds.length} か所</strong> で済むようになりました。</p>}
      {pain.current.readLines < pain.initial.readLines && <p>読む量は <strong>{pain.initial.readLines} 行 → {pain.current.readLines} 行</strong> になりました。</p>}
    </>
  );
}

const EXTEND_HEADING = '新しい種類を足すなら?';

function ExtendBefore({ pain, codebase, withHeading }: Readonly<{ pain: ExtendPain; codebase: Codebase; withHeading: boolean }>) {
  const now = pain.currentModified.length;
  const first = pain.initialModified.length;
  return (
    <div className="change-pain__extend">
      {withHeading && <h4>{EXTEND_HEADING}</h4>}
      <p className="change-pain__request"><strong>{pain.request.title}</strong></p>
      <p>{pain.request.description}</p>
      <p aria-live="polite">
        {now === 0
          ? <strong>既存のクラスを書き換えずに、新しいクラスを足すだけで済みます</strong>
          : <>今のコードでは、最善の置き方でも<strong>既存の {now} クラスを書き換えます</strong></>}
        {now < first && <>（最初は {first} クラスでした）</>}
      </p>
      {now > 0 && <LocationList description={describeClasses(codebase, pain.currentModified)} />}
    </div>
  );
}

function ExtendAfter({ pain }: Readonly<{ pain: ExtendPain }>) {
  return <p>既存の {pain.initialModified.length} クラスを書き換えていたのが、<strong>{pain.currentModified.length} クラス</strong>で済みます。</p>;
}

function cardHeading(step: ReturnType<typeof stageStep>, hasModify: boolean): string {
  if (step === 'closing-fix') return 'もし、この変更が来たら?(もう一度)';
  if (step === 'change-request') return 'なぜ分けるのか';
  return hasModify ? 'もし、この変更が来たら?' : EXTEND_HEADING;
}

function needsManualFix(step: ReturnType<typeof stageStep>, siteCount: number): boolean {
  return step === 'opening-fix' || step === 'closing-fix' || (step === 'refactor' && siteCount >= 2);
}

function painSummary(step: ReturnType<typeof stageStep>, pain?: ChangePain, extendPain?: ExtendPain): string {
  if (step === 'opening-fix') return 'まず手で直してみよう';
  if (step === 'closing-fix') return '同じ変更をもう一度手で直す';
  return summarizePain(pain?.current, extendPain);
}

function visibleStep(step: ReturnType<typeof stageStep>, pain?: ChangePain): ReturnType<typeof stageStep> {
  return pain === undefined && step === 'opening-fix' ? 'refactor' : step;
}

function requestDescription(pain?: ChangePain): React.ReactNode {
  if (pain === undefined) return null;
  return <><p><strong>{pain.request.title}</strong></p><p>{pain.request.description}</p></>;
}

function beforeInstruction(step: ReturnType<typeof stageStep>, pain?: ChangePain): React.ReactNode {
  if (pain === undefined) return null;
  if (step === 'opening-fix') return <p>組み替える前に、まずこのコードのままで変更を入れてみよう。直す必要があるメソッドに印を付けてリリースします。</p>;
  if (step === 'closing-fix') return <p>組み替えたあとのコードで、同じ変更をもう一度入れてみよう。</p>;
  return null;
}

function ManualFixButton({ onStart }: Readonly<{ onStart: () => void }>) {
  return <button type="button" className="button--primary" data-tour="manual-fix-start" onClick={onStart}>実際に直してみる</button>;
}

function CardBody({ stage, codebase, step, pain, extendPain }: Readonly<{ stage: Stage; codebase: Codebase; step: ReturnType<typeof stageStep>; pain?: ChangePain; extendPain?: ExtendPain }>) {
  if (step === 'change-request') {
    return (
      <>
        <p>{stage.why}</p>
        {pain !== undefined && <ModifyAfter pain={pain} />}
        {extendPain?.improved === true && <ExtendAfter pain={extendPain} />}
        {pain !== undefined && explainChangeImpact(stage.codebase, codebase, pain.request) !== undefined && <ImpactReviewButton />}
        <p>「変更依頼に挑戦」で、実際に確かめてみましょう</p>
      </>
    );
  }
  return (
    <>
      {step === 'closing-fix' || step === 'opening-fix'
        ? requestDescription(pain)
        : pain !== undefined && <ModifyBefore pain={pain} codebase={codebase} />}
      {beforeInstruction(step, pain)}
      {extendPain !== undefined && <ExtendBefore pain={extendPain} codebase={codebase} withHeading={pain !== undefined} />}
    </>
  );
}

function ImpactReviewButton() {
  const openImpactReview = useGameStore((state) => state.openImpactReview);
  return <button type="button" data-testid="impact-review-open" onClick={openImpactReview}>答え合わせを見る</button>;
}

function manualFixButtonVisible(canFixByHand: boolean, pain: ChangePain | undefined, step: ReturnType<typeof stageStep>, tourNeedsManualFix: boolean): boolean {
  if (!canFixByHand || pain === undefined) return false;
  return step === 'opening-fix' || tourNeedsManualFix || needsManualFix(step, pain.current.siteIds.length);
}

export function ChangePainCard({ stage, codebase, score }: Readonly<{ stage: Stage; codebase: Codebase; score: number }>) {
  const pain = measurePain(stage, codebase);
  const { extend } = painRequestsOf(stage);
  const extendPain = extend === undefined ? undefined : measureExtendPain(stage, codebase, extend);
  const canFixByHand = useGameStore((state) => state.changeSession === null && state.manualFix === null);
  const startManualFix = useGameStore((state) => state.startManualFix);
  const openingDone = useGameStore((state) => Object.prototype.hasOwnProperty.call(state.openingFixes, stage.id));
  const closingSolved = useGameStore((state) => state.closingFixSolved);
  const tourNeedsManualFix = useGameStore((state) => state.tourStep !== null && TOUR_STEPS[state.tourStep]?.advance.kind === 'manual-fix-released');
  if (pain === undefined && extendPain === undefined) return null;
  const step = visibleStep(stageStep({ score, hasModifyRequest: pain !== undefined, openingDone, closingSolved }), pain);
  const titleId = `change-pain-title-${stage.id}`;
  const shouldShowManualFixButton = manualFixButtonVisible(canFixByHand, pain, step, tourNeedsManualFix);
  return (
    <section className="change-pain" aria-labelledby={titleId}>
      <details open={step === 'opening-fix' || step === 'closing-fix' || step === 'change-request' || tourNeedsManualFix}>
        <summary>
          <h3 id={titleId}>{cardHeading(step, pain !== undefined)}</h3>
          <span>{painSummary(step, pain, extendPain)}</span>
        </summary>
        <CardBody stage={stage} codebase={codebase} step={step} pain={pain} extendPain={extendPain} />
        {shouldShowManualFixButton && <ManualFixButton onStart={startManualFix} />}
      </details>
    </section>
  );
}
