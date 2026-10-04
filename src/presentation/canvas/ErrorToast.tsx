import { useGameStore } from '../store/useGameStore';

/** キャンバス上に操作の失敗理由を示し、プレイヤーが閉じられるようにする。 */
export function ErrorToast() {
  const message = useGameStore((state) => state.message);
  const dismissMessage = useGameStore((state) => state.dismissMessage);
  if (message === null) return null;
  return (
    <div className="error-toast" role="alert">
      <span className="error-toast__icon" aria-hidden="true">⚠</span>
      <span className="error-toast__message">{message}</span>
      <button
        type="button"
        className="error-toast__close"
        aria-label="メッセージを閉じる"
        onClick={dismissMessage}
      >
        ×
      </button>
    </div>
  );
}
