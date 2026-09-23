import type { RefObject } from 'react';
import type { BlankDesignProblem } from '../../domain/blank/BlankDesignProblem';
import { findUnplacedParts } from '../../domain/blank/tray';
import { useGameStore } from '../store/useGameStore';

type BlankDesignPanelProps = {
  readonly problem: BlankDesignProblem;
  readonly reviewButtonRef: RefObject<HTMLButtonElement | null>;
  readonly onReview: () => void;
};

/** 白紙設計の上部パネル。要求文・目標・未配置の数と、答え合わせ・取り消し系のボタンを並べる。 */
export function BlankDesignPanel({ problem, reviewButtonRef, onReview }: Readonly<BlankDesignPanelProps>) {
  const codebase = useGameStore((state) => state.codebase);
  const resetStage = useGameStore((state) => state.resetStage);
  const undo = useGameStore((state) => state.undo);
  const redo = useGameStore((state) => state.redo);
  const canUndo = useGameStore((state) => state.history.past.length > 0);
  const canRedo = useGameStore((state) => state.history.future.length > 0);
  const unplaced = findUnplacedParts(problem.codebase, codebase);
  return (
    <header className="stage-panel">
      <div className="stage-panel__heading">
        <h1 className="stage-panel__title">{problem.title}</h1>
        <p className="stage-panel__goal">{problem.goal}</p>
        <p className="stage-panel__description" data-testid="blank-requirement">
          {problem.description}
        </p>
        <p className="method-editor__hint">
          部品をキャンバスの空いている所へドラッグすると新しいクラスができる。右クリックでクラス名の変更やクラスの追加ができる
        </p>
      </div>
      <div className="stage-panel__status" data-testid="blank-unplaced" aria-live="polite">
        {unplaced.length === 0 ? '全部品を配置しました' : `部品置き場に残っている部品: あと${String(unplaced.length)}個`}
      </div>
      <div className="stage-panel__actions">
        <button ref={reviewButtonRef} type="button" data-testid="blank-review" onClick={onReview} disabled={unplaced.length > 0}>
          答え合わせ
        </button>
        <button type="button" onClick={undo} disabled={!canUndo} title="Ctrl+Z">
          元に戻す
        </button>
        <button type="button" onClick={redo} disabled={!canRedo} title="Ctrl+Y">
          やり直し
        </button>
        <button type="button" className="stage-panel__reset" onClick={resetStage}>
          最初に戻す
        </button>
      </div>
    </header>
  );
}
