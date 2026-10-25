import type { ConceptMastery } from '../../domain/progress/roadmap';

type ConceptMasteryListProps = {
  readonly mastery: readonly ConceptMastery[];
  readonly onChoose: (stageId: string) => void;
};

export function ConceptMasteryList({ mastery, onChoose }: ConceptMasteryListProps) {
  return (
    <div className="concept-mastery" data-testid="concept-mastery">
      {mastery.map(({ concept, total, cleared, remaining }) => (
        <section key={concept} className="concept-mastery__row" data-testid="concept-mastery-row" data-concept={concept}>
          <h3 className="concept-mastery__name">{concept}</h3>
          <p className="concept-mastery__count">
            {`${String(total)}件中${String(cleared)}件クリア`}
            <progress max={total} value={cleared} aria-label={`${concept}の進み具合`} />
          </p>
          {remaining.length === 0 ? (
            <p className="concept-mastery__done">✅ すべてクリア</p>
          ) : (
            <div className="concept-mastery__stages">
              {remaining.map((stage) => (
                <button
                  key={stage.id}
                  type="button"
                  data-testid={`concept-stage-${stage.id}`}
                  onClick={() => {
                    onChoose(stage.id);
                  }}
                >
                  {stage.title}
                </button>
              ))}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
