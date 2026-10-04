import type { Codebase } from '../../domain/codebase/Codebase';
import { measurePain } from '../../domain/change/changePain';
import type { Stage } from '../../domain/stage/Stage';
import { describePain } from './describePain';

export function ChangePainCard({ stage, codebase, score }: Readonly<{ stage: Stage; codebase: Codebase; score: number }>) {
  const pain = measurePain(stage, codebase);
  if (pain === undefined) return null;
  const perfect = score >= 100;
  const titleId = `change-pain-title-${stage.id}`;
  const described = describePain(codebase, pain.current);
  return (
    <section className="change-pain" aria-labelledby={titleId}>
      <h3 id={titleId}>{perfect ? 'なぜ分けるのか' : 'もし、この変更が来たら?'}</h3>
      {perfect ? (
        <>
          <p>{stage.why}</p>
          {pain.improved && <p>同じ変更が <strong>{pain.initial.siteIds.length} か所 → {pain.current.siteIds.length} か所</strong> で済むようになりました。</p>}
          <p>「変更依頼に挑戦」で、実際に確かめてみましょう</p>
        </>
      ) : (
        <>
          <p className="change-pain__request"><strong>{pain.request.title}</strong></p>
          <p>{pain.request.description}</p>
          <p aria-live="polite">直す場所は今 <strong>{pain.current.siteIds.length} か所</strong>（{pain.current.classes} クラス・{pain.current.files} ファイル）
            {pain.current.siteIds.length < pain.initial.siteIds.length && <>（最初は {pain.initial.siteIds.length} か所でした）</>}
          </p>
          <ul>
            {described.locations.map((location) => <li key={location}>{location}</li>)}
            {described.additionalLocations > 0 && <li>ほか {described.additionalLocations} 件</li>}
          </ul>
        </>
      )}
    </section>
  );
}
