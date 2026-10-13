import { useEffect, useState } from 'react';
import { BlankDesignView } from './blank/BlankDesignView';
import { CodebaseCanvas } from './canvas/CodebaseCanvas';
import { ErrorToast } from './canvas/ErrorToast';
import { ChangeRequestPanel } from './change/ChangeRequestPanel';
import { MethodEditor } from './editor/MethodEditor';
import { ComparisonQuizView } from './quiz/ComparisonQuizView';
import { StagePanel } from './stage/StagePanel';
import { useGameStore, useGameStoreApi } from './store/useGameStore';
import { useUndoRedoShortcut } from './useUndoRedoShortcut';
import { useResizableSidebarWidth } from './useResizableSidebarWidth';
import { ManualFixMethodViewer } from './stage/ManualFixMethodViewer';

type Mode = 'refactor' | 'quiz' | 'blank';

const MODE_LABEL: Record<Mode, string> = { refactor: 'リファクタリング', quiz: '設計くらべ', blank: '白紙設計' };

function RightSidebarContent() {
  const investigating = useGameStore((state) => state.changeSession !== null);
  const manualFix = useGameStore((state) => state.manualFix);
  const codebase = useGameStore((state) => state.codebase);
  if (investigating) return <ChangeRequestPanel />;
  if (manualFix !== null) return <ManualFixMethodViewer codebase={codebase} methodId={manualFix.viewedMethodId} />;
  return <MethodEditor />;
}

function canCollapseEditor(hasChangeSession: boolean, hasManualFix: boolean, hasSelection: boolean, hasChangeReport: boolean): boolean {
  return !hasChangeSession && !hasManualFix && !hasSelection && !hasChangeReport;
}

function RefactorView({ active }: Readonly<{ active: boolean }>) {
  const { width, handleProps } = useResizableSidebarWidth({ side: 'right', defaultWidth: 360, minWidth: 280, maxWidth: 640 });
  const store = useGameStoreApi();
  const [emptyEditorOpen, setEmptyEditorOpen] = useState(false);
  const changeSession = useGameStore((state) => state.changeSession);
  const manualFix = useGameStore((state) => state.manualFix);
  const selectedMethodId = useGameStore((state) => state.selectedMethodId);
  const selectedFieldId = useGameStore((state) => state.selectedFieldId);
  const lastChangeReport = useGameStore((state) => state.lastChangeReport);
  const shouldRail = canCollapseEditor(
    changeSession !== null,
    manualFix !== null,
    selectedMethodId !== null || selectedFieldId !== null,
    lastChangeReport !== null,
  );
  const rail = shouldRail && !emptyEditorOpen;
  useEffect(() => {
    const previous = store.getState();
    let previousStageId = previous.stage.id;
    let hadChangeSession = previous.changeSession !== null;
    let hadManualFix = previous.manualFix !== null;
    let hadChangeReport = previous.lastChangeReport !== null;
    return store.subscribe((state) => {
      const stageChanged = state.stage.id !== previousStageId;
      const changeSessionChanged = (state.changeSession !== null) !== hadChangeSession;
      const manualFixChanged = (state.manualFix !== null) !== hadManualFix;
      const changeReportChanged = (state.lastChangeReport !== null) !== hadChangeReport;
      if (state.selectedMethodId !== null || state.selectedFieldId !== null || stageChanged || changeSessionChanged || manualFixChanged || changeReportChanged) {
        setEmptyEditorOpen(false);
      }
      previousStageId = state.stage.id;
      hadChangeSession = state.changeSession !== null;
      hadManualFix = state.manualFix !== null;
      hadChangeReport = state.lastChangeReport !== null;
    });
  }, [store]);
  useUndoRedoShortcut(active);
  return (
    <StagePanel active={active}>
      <main className="app__body">
        <section className="app__canvas" aria-label="コードベース">
          <CodebaseCanvas active={active} />
          <ErrorToast />
        </section>
        <div className={`sidebar-resizable${rail ? ' sidebar-resizable--rail' : ''}${shouldRail && emptyEditorOpen ? ' sidebar-resizable--empty-open' : ''}`} style={{ width: rail ? 48 : width }}>
          {rail ? (
            <button type="button" className="editor-rail" data-testid="editor-rail" aria-label="メソッドエディタの案内を開く" onClick={() => setEmptyEditorOpen(true)}>
              <span aria-hidden="true">👈</span><span className="editor-rail__label">メソッドをクリック</span>
            </button>
          ) : <div className="sidebar-resizable__handle" {...handleProps} />}
          <RightSidebarContent />
          {!rail && shouldRail && emptyEditorOpen && <button type="button" className="editor-empty-close" aria-label="案内を閉じる" onClick={() => setEmptyEditorOpen(false)}>»</button>}
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
