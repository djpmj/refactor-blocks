import { useGameStore } from '../store/useGameStore';
import { describeDeductions } from './describeChange';

/** 直前の変更依頼の結果を、リファクタリングの手がかりとして編集パネルに残す。 */
export function ChangeMemo() {
  const report = useGameStore((state) => state.lastChangeReport);
  if (report === null) return null;
  return (
    <section className="change-memo" data-testid="change-memo" aria-label="前回の変更依頼">
      <h3 className="change-memo__title">前回の変更依頼</h3>
      <p className="method-editor__hint">
        減点の理由を減らすように直してから、「もう一度挑戦」で点数を比べましょう。「変更×n」の印は、変更が必要だったメソッドです
      </p>
      <ul className="change-memo__list">
        {report.outcomes.map((outcome) => (
          <li key={outcome.request.id}>
            <strong>{outcome.request.title}</strong> {outcome.current.score.total}点
            <ul>
              {describeDeductions(outcome.current, report.codebase).map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </section>
  );
}
