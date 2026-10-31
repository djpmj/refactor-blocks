import { useMemo, useRef, useState } from 'react';
import { reviewBlankDesign } from '../../domain/blank/reviewBlankDesign';
import { blankDesignProblems } from '../../infrastructure/blankDesigns/blankDesignProblems';
import { CodebaseCanvas } from '../canvas/CodebaseCanvas';
import { MethodEditor } from '../editor/MethodEditor';
import { createGameStore, GameStoreContext, useGameStore } from '../store/useGameStore';
import { useUndoRedoShortcut } from '../useUndoRedoShortcut';
import { useResizableSidebarWidth } from '../useResizableSidebarWidth';
import { BlankDesignPanel } from './BlankDesignPanel';
import { BlankDesignResultPanel } from './BlankDesignResultPanel';

// 白紙設計はリファクタリングと別の編集状態を持つので、専用のストアを1つだけ作る(exportしない)
const blankStore = createGameStore(blankDesignProblems, false, false);

function BlankDesignBody({ active }: Readonly<{ active: boolean }>) {
  const codebase = useGameStore((state) => state.codebase);
  const stageId = useGameStore((state) => state.stage.id);
  const problem = blankDesignProblems.find((candidate) => candidate.id === stageId) ?? blankDesignProblems[0];
  const [reviewing, setReviewing] = useState(false);
  const { width, handleProps } = useResizableSidebarWidth({ side: 'right', defaultWidth: 360, minWidth: 280, maxWidth: 640 });
  const reviewButtonRef = useRef<HTMLButtonElement>(null);
  useUndoRedoShortcut(active);
  // 答え合わせを開いている間は、配置を変えるたびに結果を計算し直す(試行錯誤しやすいように)
  const review = useMemo(() => (reviewing ? reviewBlankDesign(problem, codebase) : null), [reviewing, codebase, problem]);
  return (
    <>
      <BlankDesignPanel
        problem={problem}
        reviewButtonRef={reviewButtonRef}
        onProblemChange={() => {
          setReviewing(false);
        }}
        onReview={() => {
          setReviewing(true);
        }}
      />
      <main className="app__body">
        <section className="app__canvas" aria-label="コードベース">
          <CodebaseCanvas active={active} inert={false} />
        </section>
        <div className="sidebar-resizable" style={{ width }}>
          <div className="sidebar-resizable__handle" {...handleProps} />
          {reviewing && review !== null ? (
            <BlankDesignResultPanel
              problem={problem}
              review={review}
              onClose={() => {
                setReviewing(false);
                reviewButtonRef.current?.focus();
              }}
            />
          ) : (
            <MethodEditor alwaysShowVisibility emptyMessage="blank" />
          )}
        </div>
      </main>
    </>
  );
}

/** 白紙設計モードの画面全体。要求文だけを渡し、部品をどのクラスへ置くかをプレイヤーに組ませる。 */
export function BlankDesignView({ active }: Readonly<{ active: boolean }>) {
  return (
    <GameStoreContext.Provider value={blankStore}>
      <BlankDesignBody active={active} />
    </GameStoreContext.Provider>
  );
}
