import { useMemo, useState } from 'react';
import type { Codebase } from '../../domain/codebase/Codebase';
import { describeDesignDiffGroup, type DesignDiffGroup } from '../stage/describeDesignDiff';
import { sharedZoom } from '../quiz/sharedZoom';
import { CodebasePreviewCanvas } from './CodebasePreviewCanvas';

const MIN_SHARED_ZOOM = 0.6;
const SAME_PLACEMENT = '解答例と同じ置き方です';

/** 「解答例の図」で、プレイヤーの設計と並べて見せる材料。 */
export type AnswerComparison = {
  readonly player: Codebase;
  readonly groups: readonly DesignDiffGroup[];
  /** 採点ルールごとの減点の違い(事実だけ)。 */
  readonly scoreFacts: readonly string[];
};

type ComparisonPanesProps = Readonly<{
  answer: Codebase;
  comparison: AnswerComparison;
  methodLimit: number;
  selectedMethodId: string | null;
  onSelectMethod: (methodId: string) => void;
}>;

function DiffList({ groups, scoreFacts, selected, onSelect }: Readonly<{ groups: readonly DesignDiffGroup[]; scoreFacts: readonly string[]; selected: number | null; onSelect: (index: number | null) => void }>) {
  return (
    <section className="comparison__diff" aria-label="設計の違い" data-testid="design-diff">
      {groups.length === 0 ? (
        <p className="comparison__same">{SAME_PLACEMENT}</p>
      ) : (
        <ul>
          {groups.map((group, index) => (
            <li key={`${group.responsibility}/${group.playerClass}/${group.answerClass}`}>
              <button type="button" className="comparison__diff-row" aria-pressed={selected === index} onClick={() => onSelect(selected === index ? null : index)}>
                {describeDesignDiffGroup(group)}
              </button>
            </li>
          ))}
        </ul>
      )}
      {scoreFacts.length === 0 ? null : (
        <ul className="comparison__facts" data-testid="design-diff-score">
          {scoreFacts.map((fact) => (
            <li key={fact}>{fact}</li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** 左に「あなたの設計」、右に「解答例」を同じ縮尺で並べ、下に置き場所の違いを出す。違いの行を押すと、その処理を持つクラスが両方の図で光る。 */
export function ComparisonPanes({ answer, comparison, methodLimit, selectedMethodId, onSelectMethod }: ComparisonPanesProps) {
  const [fitZooms, setFitZooms] = useState<{ readonly player?: number; readonly answer?: number }>({});
  const [selected, setSelected] = useState<number | null>(null);
  const { player: fitPlayer, answer: fitAnswer } = fitZooms;
  const zoom = fitPlayer === undefined || fitAnswer === undefined ? undefined : sharedZoom(fitPlayer, fitAnswer, MIN_SHARED_ZOOM);
  const onFit = useMemo(() => {
    const report = (side: 'player' | 'answer') => (value: number) => setFitZooms((current) => (current[side] === value ? current : { ...current, [side]: value }));
    return { player: report('player'), answer: report('answer') };
  }, []);
  const group = selected === null ? undefined : comparison.groups[selected];
  const playerGlow = useMemo(() => new Set(group === undefined ? [] : [group.playerClass]), [group]);
  const answerGlow = useMemo(() => new Set(group === undefined ? [] : [group.answerClass]), [group]);
  return (
    <div className="comparison">
      <div className="comparison__panes">
        <section className="comparison__pane" data-testid="player-diagram">
          <h3>あなたの設計</h3>
          <div className="comparison__canvas">
            <CodebasePreviewCanvas codebase={comparison.player} methodLimit={methodLimit} maxZoom={zoom} onFitZoom={onFit.player} glowClassNames={playerGlow} />
          </div>
        </section>
        <section className="comparison__pane" data-testid="answer-diagram">
          <h3>解答例</h3>
          <div className="comparison__canvas">
            <CodebasePreviewCanvas codebase={answer} methodLimit={methodLimit} maxZoom={zoom} onFitZoom={onFit.answer} selectedMethodId={selectedMethodId} onSelectMethod={onSelectMethod} glowClassNames={answerGlow} />
          </div>
        </section>
      </div>
      <DiffList groups={comparison.groups} scoreFacts={comparison.scoreFacts} selected={selected} onSelect={setSelected} />
    </div>
  );
}
