import { useGameStore } from '../store/useGameStore';

/** AIの講評をもらうボタンと、その結果(講評文・エラー)の表示。 */
export function CritiquePanel({ disabled }: Readonly<{ disabled: boolean }>) {
  const critique = useGameStore((state) => state.critique);
  const requestCritique = useGameStore((state) => state.requestCritique);
  return (
    <div className="critique-panel">
      <button type="button" onClick={requestCritique} disabled={disabled || critique.loading}>
        {critique.loading ? 'AIが講評中…' : 'AIの講評をもらう'}
      </button>
      {critique.error !== null && (
        <p className="critique-panel__error" role="alert">
          {critique.error}
        </p>
      )}
      {critique.text !== null && (
        <p className="critique-panel__text" data-testid="critique-text">
          {critique.text}
        </p>
      )}
    </div>
  );
}
