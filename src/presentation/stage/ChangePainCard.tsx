import type { Codebase } from '../../domain/codebase/Codebase';
import { measureExtendPain, measurePain, painRequestsOf, type ChangePain, type ExtendPain } from '../../domain/change/changePain';
import type { Stage } from '../../domain/stage/Stage';
import { useGameStore } from '../store/useGameStore';
import { describeClasses, describePain, type PainDescription } from './describePain';

function LocationList({ description }: Readonly<{ description: PainDescription }>) {
  return (
    <ul>
      {description.locations.map((location) => <li key={location}>{location}</li>)}
      {description.additionalLocations > 0 && <li>ほか {description.additionalLocations} 件</li>}
    </ul>
  );
}

function ModifyBefore({ pain, codebase }: Readonly<{ pain: ChangePain; codebase: Codebase }>) {
  return (
    <>
      <p className="change-pain__request"><strong>{pain.request.title}</strong></p>
      <p>{pain.request.description}</p>
      <p aria-live="polite">直す場所は今 <strong>{pain.current.siteIds.length} か所</strong>（{pain.current.classes} クラス・{pain.current.files} ファイル）
        {pain.current.siteIds.length < pain.initial.siteIds.length && <>（最初は {pain.initial.siteIds.length} か所でした）</>}
      </p>
      <p aria-live="polite">その場所を直すために、目を通す行数は今 <strong>{pain.current.readLines} 行</strong>
        {pain.current.readLines < pain.initial.readLines && <>（最初は {pain.initial.readLines} 行でした）</>}
      </p>
      <LocationList description={describePain(codebase, pain.current)} />
    </>
  );
}

function ModifyAfter({ pain }: Readonly<{ pain: ChangePain }>) {
  return (
    <>
      {pain.improved && <p>同じ変更が <strong>{pain.initial.siteIds.length} か所 → {pain.current.siteIds.length} か所</strong> で済むようになりました。</p>}
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

function cardHeading(perfect: boolean, hasModify: boolean): string {
  if (perfect) return 'なぜ分けるのか';
  return hasModify ? 'もし、この変更が来たら?' : EXTEND_HEADING;
}

function CardBody({ stage, codebase, perfect, pain, extendPain }: Readonly<{ stage: Stage; codebase: Codebase; perfect: boolean; pain?: ChangePain; extendPain?: ExtendPain }>) {
  if (perfect) {
    return (
      <>
        <p>{stage.why}</p>
        {pain !== undefined && <ModifyAfter pain={pain} />}
        {extendPain?.improved === true && <ExtendAfter pain={extendPain} />}
        <p>「変更依頼に挑戦」で、実際に確かめてみましょう</p>
      </>
    );
  }
  return (
    <>
      {pain !== undefined && <ModifyBefore pain={pain} codebase={codebase} />}
      {extendPain !== undefined && <ExtendBefore pain={extendPain} codebase={codebase} withHeading={pain !== undefined} />}
    </>
  );
}

export function ChangePainCard({ stage, codebase, score }: Readonly<{ stage: Stage; codebase: Codebase; score: number }>) {
  const pain = measurePain(stage, codebase);
  const { extend } = painRequestsOf(stage);
  const extendPain = extend === undefined ? undefined : measureExtendPain(stage, codebase, extend);
  const canFixByHand = useGameStore((state) => state.changeSession === null && state.manualFix === null);
  const startManualFix = useGameStore((state) => state.startManualFix);
  if (pain === undefined && extendPain === undefined) return null;
  const perfect = score >= 100;
  const titleId = `change-pain-title-${stage.id}`;
  return (
    <section className="change-pain" aria-labelledby={titleId}>
      <h3 id={titleId}>{cardHeading(perfect, pain !== undefined)}</h3>
      <CardBody stage={stage} codebase={codebase} perfect={perfect} pain={pain} extendPain={extendPain} />
      {canFixByHand && pain !== undefined && pain.current.siteIds.length >= 2 && (
        <button type="button" onClick={startManualFix}>実際に直してみる</button>
      )}
    </section>
  );
}
