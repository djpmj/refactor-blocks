import { useMemo } from 'react';
import { findLineLimitViolations, type LineLimitViolation } from '../../domain/scoring/lineLimits';
import { useGameStore } from '../store/useGameStore';

const KIND_LABEL: Record<LineLimitViolation['kind'], string> = { method: 'メソッド', class: 'クラス', file: 'ファイル' };

function describeViolation(violation: LineLimitViolation): string {
  return `${KIND_LABEL[violation.kind]} ${violation.lines}/${violation.limit}行`;
}

function describeStatus(violations: readonly LineLimitViolation[]): string {
  if (violations.length === 0) return '✅ 行数の上限をすべて守れています';
  return `⚠️ 上限超え ${violations.length}件: ${violations.map(describeViolation).join('、')}`;
}

/** ステージの目標と、行数上限の違反状況を表示する。 */
export function StagePanel() {
  const stage = useGameStore((state) => state.stage);
  const codebase = useGameStore((state) => state.codebase);
  const resetStage = useGameStore((state) => state.resetStage);
  const violations = useMemo(() => findLineLimitViolations(codebase, stage.limits), [codebase, stage.limits]);
  return (
    <header className="stage-panel">
      <div>
        <h1 className="stage-panel__title">{stage.title}</h1>
        <p className="stage-panel__goal">{stage.goal}</p>
      </div>
      <div className="stage-panel__status" data-testid="violation-count">
        {describeStatus(violations)}
      </div>
      <button type="button" className="stage-panel__reset" onClick={resetStage}>
        やり直す
      </button>
    </header>
  );
}
