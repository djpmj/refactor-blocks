import { practiceStages, type AntipatternEntry } from '../../domain/gallery/Antipattern';
import type { Stage } from '../../domain/stage/Stage';

type AntipatternGalleryProps = {
  readonly entries: readonly AntipatternEntry[];
  readonly stages: readonly Stage[];
  readonly onChoose: (stageId: string) => void;
};

const KINDS: readonly { readonly kind: AntipatternEntry['kind']; readonly heading: string }[] = [
  { kind: 'smell', heading: 'コードの臭い' },
  { kind: 'principle', heading: '設計の原則' },
];

export function AntipatternGallery({ entries, stages, onChoose }: AntipatternGalleryProps) {
  return (
    <div className="antipattern-gallery" data-testid="antipattern-gallery">
      {KINDS.map(({ kind, heading }) => (
        <section key={kind}>
          <h3>{heading}</h3>
          {entries
            .filter((entry) => entry.kind === kind)
            .map((entry) => {
              const practice = practiceStages(entry, stages);
              return (
                <article key={entry.id} className="antipattern-gallery__entry" data-testid={`gallery-entry-${entry.id}`}>
                  <h4>{entry.name}</h4>
                  <dl>
                    <dt>症状</dt>
                    <dd>{entry.symptom}</dd>
                    <dt>弊害</dt>
                    <dd>{entry.harm}</dd>
                    <dt>直し方</dt>
                    <dd>{entry.remedy}</dd>
                  </dl>
                  {practice.length === 0 ? (
                    <p>練習できるステージはまだありません</p>
                  ) : (
                    <div className="antipattern-gallery__stages">
                      <span>練習できるステージ:</span>
                      {practice.map((stage) => (
                        <button
                          key={stage.id}
                          type="button"
                          data-testid={`gallery-stage-${stage.id}`}
                          onClick={() => {
                            onChoose(stage.id);
                          }}
                        >
                          {stage.title}
                        </button>
                      ))}
                    </div>
                  )}
                </article>
              );
            })}
        </section>
      ))}
    </div>
  );
}
