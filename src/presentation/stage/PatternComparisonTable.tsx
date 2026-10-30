import type { Stage } from '../../domain/stage/Stage';
import { PATTERN_COMPARISON, type PatternComparisonEntry } from './patternComparison';

type Aspect = { readonly label: string; readonly key: 'whenToUse' | 'whatVaries' | 'structure' | 'notSuitedFor' };

const ASPECTS: readonly Aspect[] = [
  { label: 'いつ使う', key: 'whenToUse' },
  { label: '何が変わる', key: 'whatVaries' },
  { label: 'クラス構成の特徴', key: 'structure' },
  { label: '向かない場面', key: 'notSuitedFor' },
];

type PatternComparisonTableProps = {
  readonly stages: readonly Stage[];
  readonly onChoose: (stageId: string) => void;
};

function ColumnHeader({ entry, stages, onChoose }: Readonly<{ entry: PatternComparisonEntry } & PatternComparisonTableProps>) {
  const stage = stages.find((s) => s.id === entry.stageId);
  return (
    <th scope="col">
      <span className="pattern-comparison__name">{entry.name}</span>
      {stage !== undefined && (
        <button type="button" data-testid={`pattern-stage-${entry.stageId}`} onClick={() => { onChoose(entry.stageId); }}>
          {stage.title}
        </button>
      )}
    </th>
  );
}

export function PatternComparisonTable({ stages, onChoose }: PatternComparisonTableProps) {
  return (
    <div className="pattern-comparison" data-testid="pattern-comparison">
      <table>
        <caption>似たパターンの使い分け</caption>
        <thead>
          <tr>
            <th scope="col"><span className="sr-only">観点</span></th>
            {PATTERN_COMPARISON.map((entry) => (
              <ColumnHeader key={entry.stageId} entry={entry} stages={stages} onChoose={onChoose} />
            ))}
          </tr>
        </thead>
        <tbody>
          {ASPECTS.map(({ label, key }) => (
            <tr key={key}>
              <th scope="row">{label}</th>
              {PATTERN_COMPARISON.map((entry) => (
                <td key={entry.stageId}>{entry[key]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
