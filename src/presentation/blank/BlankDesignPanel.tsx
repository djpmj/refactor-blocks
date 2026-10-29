import type { RefObject } from 'react';
import type { BlankDesignProblem } from '../../domain/blank/BlankDesignProblem';
import { findUnplacedParts } from '../../domain/blank/tray';
import { allClasses } from '../../domain/codebase/Codebase';
import { blankDesignProblems } from '../../infrastructure/blankDesigns/blankDesignProblems';
import { useGameStore } from '../store/useGameStore';

type BlankDesignPanelProps = {
  readonly problem: BlankDesignProblem;
  readonly reviewButtonRef: RefObject<HTMLButtonElement | null>;
  readonly onReview: () => void;
  /** 問題を切り替えたあとに呼ぶ(答え合わせの結果パネルを閉じるため)。 */
  readonly onProblemChange: () => void;
};

/** 問題の選択欄。配置を始めていたら、切り替えて消える前に確かめる(キャンセルなら選択欄は controlled なので元の値のまま)。 */
function ProblemSelect({ problem, onProblemChange }: Readonly<{ problem: BlankDesignProblem; onProblemChange: () => void }>) {
  const codebase = useGameStore((state) => state.codebase);
  const selectStage = useGameStore((state) => state.selectStage);
  const partCount = allClasses(problem.codebase).flatMap((codeClass) => codeClass.methods).length;
  const changeProblem = (id: string) => {
    if (findUnplacedParts(problem.codebase, codebase).length < partCount && !window.confirm('今の配置は消えます。別の問題に切り替えますか?')) return;
    selectStage(id);
    onProblemChange();
  };
  return (
    <label className="method-editor__hint">
      問題{' '}
      <select
        data-testid="blank-problem-select"
        value={problem.id}
        onChange={(event) => {
          changeProblem(event.target.value);
        }}
      >
        {blankDesignProblems.map((candidate) => (
          <option key={candidate.id} value={candidate.id}>
            {candidate.title}
          </option>
        ))}
      </select>
    </label>
  );
}

/** 白紙設計の上部パネル。要求文・目標・未配置の数と、答え合わせ・取り消し系のボタンを並べる。 */
export function BlankDesignPanel({ problem, reviewButtonRef, onReview, onProblemChange }: Readonly<BlankDesignPanelProps>) {
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
        <p className="stage-panel__description stage-panel__description--blank" data-testid="blank-requirement">
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
        {/* 見出しの上に置くと panel が1行高くなり、Fit View の倍率が下がってメソッドが隠れるため、ボタンと同じ行に置く */}
        <ProblemSelect problem={problem} onProblemChange={onProblemChange} />
        <button ref={reviewButtonRef} type="button" data-testid="blank-review" onClick={onReview} disabled={unplaced.length > 0} aria-describedby={unplaced.length > 0 ? 'blank-review-disabled-reason' : undefined}>
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
      {unplaced.length > 0 && (
        <p id="blank-review-disabled-reason" data-testid="blank-review-disabled-reason" className="method-editor__extract-hint">
          答え合わせは、部品置き場の部品をすべてクラスへ置くと押せます。まだ置いていない部品: {unplaced.join('、')}
        </p>
      )}
    </header>
  );
}
