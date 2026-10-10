import { useState } from 'react';
import { BlankDesignView } from './blank/BlankDesignView';
import { CodebaseCanvas } from './canvas/CodebaseCanvas';
import { ErrorToast } from './canvas/ErrorToast';
import { ChangeRequestPanel } from './change/ChangeRequestPanel';
import { MethodEditor } from './editor/MethodEditor';
import { ComparisonQuizView } from './quiz/ComparisonQuizView';
import { StagePanel } from './stage/StagePanel';
import { useGameStore } from './store/useGameStore';
import { useUndoRedoShortcut } from './useUndoRedoShortcut';
import { useResizableSidebarWidth } from './useResizableSidebarWidth';

type Mode = 'refactor' | 'quiz' | 'blank';

const MODE_LABEL: Record<Mode, string> = { refactor: 'リファクタリング', quiz: '設計くらべ', blank: '白紙設計' };

function RefactorView({ active }: Readonly<{ active: boolean }>) {
  const investigating = useGameStore((state) => state.changeSession !== null);
  const { width, handleProps } = useResizableSidebarWidth({ side: 'right', defaultWidth: 360, minWidth: 280, maxWidth: 640 });
  useUndoRedoShortcut(active);
  return (
    <StagePanel active={active}>
      <main className="app__body">
        <section className="app__canvas" aria-label="コードベース">
          <CodebaseCanvas active={active} />
          <ErrorToast />
        </section>
        <div className="sidebar-resizable" style={{ width }}>
          <div className="sidebar-resizable__handle" {...handleProps} />
          {investigating ? <ChangeRequestPanel /> : <MethodEditor />}
        </div>
      </main>
    </StagePanel>
  );
}

export function App() {
  const [mode, setMode] = useState<Mode>('refactor');
  // クイズ・白紙設計のキャンバスは、見えない(大きさ0の)まま fitView すると表示がずれるので、初めて開いたときにマウントする
  const [quizOpened, setQuizOpened] = useState(false);
  const [blankOpened, setBlankOpened] = useState(false);
  return (
    <div className="app">
      <nav className="mode-switch" aria-label="モード">
        {(['refactor', 'quiz', 'blank'] as const).map((candidate) => (
          <button
            key={candidate}
            type="button"
            data-testid={`mode-${candidate}`}
            aria-pressed={mode === candidate}
            onClick={() => {
              setMode(candidate);
              if (candidate === 'quiz') setQuizOpened(true);
              if (candidate === 'blank') setBlankOpened(true);
            }}
          >
            {MODE_LABEL[candidate]}
          </button>
        ))}
      </nav>
      {/* 切り替えてもアンマウントせず隠すだけにして、ファイルの位置・ズーム・選びかけの処理・クイズの回答などを残す */}
      <div className="app__view" hidden={mode !== 'refactor'}>
        <RefactorView active={mode === 'refactor'} />
      </div>
      {quizOpened ? (
        <div className="app__view" hidden={mode !== 'quiz'}>
          <ComparisonQuizView />
        </div>
      ) : null}
      {blankOpened ? (
        <div className="app__view" hidden={mode !== 'blank'} data-testid="blank-view">
          <BlankDesignView active={mode === 'blank'} />
        </div>
      ) : null}
    </div>
  );
}
