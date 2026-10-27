import { useGameStore } from '../store/useGameStore';
import type { OperationTone } from '../stage/describeOperationResult';

const TONE_MARK: Record<OperationTone, string> = { better: '↑', worse: '↓', mixed: '↕' };

/** 直前の操作で増えた・消えた減点を、キャンバス上部に1〜2行で示す。 */
export function OperationResult() {
  const result = useGameStore((state) => state.operationResult);
  const dismiss = useGameStore((state) => state.dismissOperationResult);
  if (result === null) return null;
  return (
    <div className={`operation-result operation-result--${result.tone} nodrag nopan`} role="status" data-testid="operation-result">
      <span className="operation-result__mark" aria-hidden="true">{TONE_MARK[result.tone]}</span>
      <div className="operation-result__lines">
        {result.lines.map((line) => <p key={line} data-testid="operation-result-line">{line}</p>)}
      </div>
      <button type="button" className="operation-result__close" aria-label="操作の結果を閉じる" onClick={dismiss}>×</button>
    </div>
  );
}
