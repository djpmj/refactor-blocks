import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useNarrowScreen } from './useNarrowScreen';
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
import { pageTitle } from './pageTitle';

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

function useMobileEditor(store: ReturnType<typeof useGameStoreApi>) {
  const [mobileEditorOpen, setMobileEditorOpen] = useState(false);
  const editorTrigger = useRef<HTMLElement | null>(null);
  const dismissedSelection = useRef<string | null>(null);
  useEffect(() => store.subscribe((state, previous) => {
    if (state.selectedMethodId !== null || state.selectedFieldId !== null) {
      const selected = document.querySelector<HTMLButtonElement>('[data-method-id][aria-pressed="true"], [data-field-id][aria-pressed="true"]');
      if (selected !== null) editorTrigger.current = selected;
      const selection = state.selectedMethodId ?? state.selectedFieldId;
      if (selection !== dismissedSelection.current
        && (state.selectedMethodId !== previous.selectedMethodId || state.selectedFieldId !== previous.selectedFieldId)) setMobileEditorOpen(true);
    }
    if (state.selectedMethodId === null && state.selectedFieldId === null) {
      dismissedSelection.current = null;
      setMobileEditorOpen(false);
    }
  }), [store]);
  useEffect(() => {
    if (!mobileEditorOpen) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setMobileEditorOpen(false);
    }
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [mobileEditorOpen]);
  useEffect(() => {
    if (!mobileEditorOpen && window.matchMedia('(max-width: 700px)').matches) editorTrigger.current?.focus();
  }, [mobileEditorOpen]);
  const close = useCallback(() => {
    const state = store.getState();
    dismissedSelection.current = state.selectedMethodId ?? state.selectedFieldId;
    setMobileEditorOpen(false);
  }, [store]);
  return { mobileEditorOpen, close };
}

function useEmptyEditor(store: ReturnType<typeof useGameStoreApi>) {
  const [emptyEditorOpen, setEmptyEditorOpen] = useState(false);
  useEffect(() => store.subscribe((state, previous) => {
    if (state.selectedMethodId !== previous.selectedMethodId || state.selectedFieldId !== previous.selectedFieldId
      || state.stage.id !== previous.stage.id || state.changeSession !== previous.changeSession
      || state.manualFix !== previous.manualFix || state.lastChangeReport !== previous.lastChangeReport) setEmptyEditorOpen(false);
  }), [store]);
  return { emptyEditorOpen, setEmptyEditorOpen };
}

function EditorRail({ onOpen }: Readonly<{ onOpen: () => void }>) {
  return <button type="button" className="editor-rail" data-testid="editor-rail" aria-label="メソッドエディタの案内を開く" onClick={onOpen}><span aria-hidden="true">👈</span><span className="editor-rail__label">メソッドをクリック</span></button>;
}

function MobileEditorDrawer({ open, onClose, children }: Readonly<{ open: boolean; onClose: () => void; children: ReactNode }>) {
  if (!open) return null;
  return <><button type="button" className="mobile-drawer-backdrop" aria-label="エディタを閉じる" onClick={onClose} /><div className="sidebar-resizable sidebar-resizable--mobile-open">{children}<button type="button" className="mobile-drawer-close" aria-label="メソッドエディタを閉じる" onClick={onClose}>閉じる</button></div></>;
}

function EditorPanel({ rail, emptyOpen, width, handleProps, content, onOpenGuide, onCloseGuide }: Readonly<{
  rail: boolean; emptyOpen: boolean; width: number; handleProps: ReturnType<typeof useResizableSidebarWidth>['handleProps'];
  content: ReactNode; onOpenGuide: () => void; onCloseGuide: () => void;
}>) {
  return <div className={`sidebar-resizable${rail ? ' sidebar-resizable--rail' : ''}${emptyOpen ? ' sidebar-resizable--empty-open' : ''}`} style={{ width: rail ? 48 : width }}>
    {rail ? null : <div className="sidebar-resizable__handle" {...handleProps} />}
    {content}
    {rail && <EditorRail onOpen={onOpenGuide} />}
    {!rail && emptyOpen && <button className="editor-empty-close" aria-label="案内を閉じる" onClick={onCloseGuide}>»</button>}
  </div>;
}

function RefactorView({ active }: Readonly<{ active: boolean }>) {
  const { width, handleProps } = useResizableSidebarWidth({ side: 'right', defaultWidth: 360, minWidth: 280, maxWidth: 640 });
  const store = useGameStoreApi();
  const { emptyEditorOpen, setEmptyEditorOpen } = useEmptyEditor(store);
  const { mobileEditorOpen, close: closeMobileEditor } = useMobileEditor(store);
  const narrowScreen = useNarrowScreen();
  const changeSession = useGameStore((state) => state.changeSession);
  // 結果を見ている間は、評価した配置が動かないようキャンバスの操作を止める
  const reviewing = (changeSession?.reviewing ?? null) !== null;
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
  const mobileDrawerOpen = mobileEditorOpen && !shouldRail;
  const mobileDrawerActive = mobileDrawerOpen && narrowScreen;
  useUndoRedoShortcut(active);
  const editorContent = <RightSidebarContent />;
  return (
    <StagePanel active={active}>
      <main className="app__body">
        <section className="app__canvas" aria-label="コードベース">
          <CodebaseCanvas active={active} inert={mobileDrawerActive || reviewing} />
          <div inert={mobileDrawerActive || reviewing}><ErrorToast /></div>
        </section>
        {!mobileDrawerActive && <EditorPanel rail={rail} emptyOpen={shouldRail && emptyEditorOpen} width={width} handleProps={handleProps} content={editorContent} onOpenGuide={() => setEmptyEditorOpen(true)} onCloseGuide={() => setEmptyEditorOpen(false)} />}
        <MobileEditorDrawer open={mobileDrawerActive} onClose={closeMobileEditor}>{editorContent}</MobileEditorDrawer>
      </main>
    </StagePanel>
  );
}

export function App() {
  const [mode, setMode] = useState<Mode>('refactor');
  const stageTitle = useGameStore((state) => state.stage.title);
  useEffect(() => {
    document.title = pageTitle(MODE_LABEL[mode], mode === 'refactor' ? stageTitle : null);
  }, [mode, stageTitle]);
  // クイズ・白紙設計のキャンバスは、見えない(大きさ0の)まま fitView すると表示がずれるので、初めて開いたときにマウントする
  const [quizOpened, setQuizOpened] = useState(false);
  const [blankOpened, setBlankOpened] = useState(false);
  const changeMode = (next: Mode) => {
    setMode(next);
    if (next === 'quiz') setQuizOpened(true);
    if (next === 'blank') setBlankOpened(true);
  };
  return (
    <div className="app">
      <nav className="mode-switch" aria-label="モード">
        {(['refactor', 'quiz', 'blank'] as const).map((candidate) => (
          <button
            key={candidate}
            type="button"
            data-testid={`mode-${candidate}`}
            aria-pressed={mode === candidate}
            onClick={() => changeMode(candidate)}
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
          <ComparisonQuizView onLeave={changeMode} />
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
