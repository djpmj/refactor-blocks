import { CodebaseCanvas } from './canvas/CodebaseCanvas';
import { ChangeRequestPanel } from './change/ChangeRequestPanel';
import { MethodEditor } from './editor/MethodEditor';
import { StagePanel } from './stage/StagePanel';
import { useGameStore } from './store/useGameStore';
import { useUndoRedoShortcut } from './useUndoRedoShortcut';

export function App() {
  useUndoRedoShortcut();
  const investigating = useGameStore((state) => state.changeSession !== null);
  return (
    <div className="app">
      <StagePanel />
      <main className="app__body">
        <section className="app__canvas" aria-label="コードベース">
          <CodebaseCanvas />
        </section>
        {investigating ? <ChangeRequestPanel /> : <MethodEditor />}
      </main>
    </div>
  );
}
