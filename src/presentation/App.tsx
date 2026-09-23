import { useState } from 'react';
import { CodebaseCanvas } from './canvas/CodebaseCanvas';
import { ChangeRequestPanel } from './change/ChangeRequestPanel';
import { MethodEditor } from './editor/MethodEditor';
import { ComparisonQuizView } from './quiz/ComparisonQuizView';
import { StagePanel } from './stage/StagePanel';
import { useGameStore } from './store/useGameStore';
import { useUndoRedoShortcut } from './useUndoRedoShortcut';

type Mode = 'refactor' | 'quiz';

const MODE_LABEL: Record<Mode, string> = { refactor: 'リファクタリング', quiz: '設計くらべ' };

function RefactorView({ active }: Readonly<{ active: boolean }>) {
  const investigating = useGameStore((state) => state.changeSession !== null);
  return (
    <>
      <StagePanel />
      <main className="app__body">
        <section className="app__canvas" aria-label="コードベース">
          <CodebaseCanvas active={active} />
        </section>
        {investigating ? <ChangeRequestPanel /> : <MethodEditor />}
      </main>
    </>
  );
}

export function App() {
  const [mode, setMode] = useState<Mode>('refactor');
  // クイズのキャンバスは、見えない(大きさ0の)まま fitView すると表示がずれるので、初めて開いたときにマウントする
  const [quizOpened, setQuizOpened] = useState(false);
  useUndoRedoShortcut(mode === 'refactor');
  return (
    <div className="app">
      <nav className="mode-switch" aria-label="モード">
        {(['refactor', 'quiz'] as const).map((candidate) => (
          <button
            key={candidate}
            type="button"
            data-testid={`mode-${candidate}`}
            aria-pressed={mode === candidate}
            onClick={() => {
              setMode(candidate);
              if (candidate === 'quiz') setQuizOpened(true);
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
    </div>
  );
}
