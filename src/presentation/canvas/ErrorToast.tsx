import { useGameStore } from '../store/useGameStore';

/** キャンバス上に操作の失敗理由を示し、プレイヤーが閉じられるようにする。 */
export function ErrorToast() {
  const message = useGameStore((state) => state.message);
  const notice = useGameStore((state) => state.notice);
  const dismissMessage = useGameStore((state) => state.dismissMessage);
  if (message === null && notice === null) return null;
  const isNotice = message === null;
  return (
    <div className={`error-toast${isNotice ? ' error-toast--info' : ''}`} role={isNotice ? 'status' : 'alert'}>
      <span className="error-toast__icon" aria-hidden="true">{isNotice ? 'ℹ' : '⚠'}</span>
      <span className="error-toast__message">{message ?? notice}</span>
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
