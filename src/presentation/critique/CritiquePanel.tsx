import { useGameStore } from '../store/useGameStore';

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

/** AIの講評の結果(講評文・エラー)の表示。ヘッダーの下に出し、サイドバーを閉じていても見えるようにする。 */
export function CritiqueResult() {
  const critique = useGameStore((state) => state.critique);
  if (critique.error === null && critique.text === null) return null;
  return (
    <div className="critique-panel">
      {critique.error !== null && (
        <p className="critique-panel__error" role="status">
          {critique.error}
        </p>
      )}
      {critique.text !== null && (
        <details className="critique-panel__details" open>
          <summary>講評</summary>
          <p className="critique-panel__text" data-testid="critique-text">
            {critique.text}
          </p>
        </details>
      )}
    </div>
  );
}
