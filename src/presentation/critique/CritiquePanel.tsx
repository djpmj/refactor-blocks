import { useGameStore } from '../store/useGameStore';
import { describeCritiqueTiming } from './describeCritiqueTiming';

/** AIの講評をもらうボタン(ヘッダー用)。 */
export function CritiqueButton({ disabled }: Readonly<{ disabled: boolean }>) {
  const loading = useGameStore((state) => state.critique.loading);
  const requestCritique = useGameStore((state) => state.requestCritique);
  return (
    <button type="button" onClick={requestCritique} disabled={disabled || loading}>
      {loading ? 'AIが講評中…' : 'AIの講評をもらう'}
    </button>
  );
}

/** 講評がいつの時点のものかの1行。古くなったら、消さずに「もう一度もらう」ボタンを添える。 */
function CritiqueTiming() {
  const critique = useGameStore((state) => state.critique);
  const current = useGameStore((state) => state.changeSession?.base ?? state.codebase);
  const investigating = useGameStore((state) => state.changeSession !== null);
  const requestCritique = useGameStore((state) => state.requestCritique);
  if (critique.snapshot === null || (critique.text === null && critique.fallback === null)) return null;
  const { stale, text } = describeCritiqueTiming(critique.snapshot, current);
  return (
    <p className={stale ? 'critique-panel__timing critique-panel__timing--stale' : 'critique-panel__timing'} data-testid="critique-timing" role="status">
      {text}
      {stale && (
        <button type="button" onClick={requestCritique} disabled={investigating || critique.loading}>
          もう一度もらう
        </button>
      )}
    </p>
  );
}

/** AIの講評の結果(講評文・エラー)の表示。キャンバスの右上に重ねて出す。レイアウトを押し下げない。 */
export function CritiqueResult() {
  const critique = useGameStore((state) => state.critique);
  const dismissCritique = useGameStore((state) => state.dismissCritique);
  if (critique.error === null && critique.text === null && critique.fallback === null) return null;
  return (
    <div className="critique-panel" role="region" aria-label="AIの講評" data-testid="critique-panel">
      <div className="critique-panel__header">
        <h2 className="critique-panel__title">AIの講評</h2>
        <button type="button" className="critique-panel__close" aria-label="講評を閉じる" onClick={dismissCritique}>
          ×
        </button>
      </div>
      {critique.error !== null && (
        <p className="critique-panel__error" role="status">
          {critique.error}
        </p>
      )}
      <CritiqueTiming />
      {critique.text !== null && (
        <details className="critique-panel__details" open>
          <summary>講評</summary>
          <p className="critique-panel__text" data-testid="critique-text">
            {critique.text}
          </p>
        </details>
      )}
      {critique.fallback !== null && (
        <details className="critique-panel__details" open>
          <summary>簡易講評(AI講評ではありません)</summary>
          <p className="critique-panel__text" data-testid="critique-fallback-text">
            {critique.fallback}
          </p>
        </details>
      )}
    </div>
  );
}
