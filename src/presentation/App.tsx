import { CodebaseCanvas } from './canvas/CodebaseCanvas';
import { MethodEditor } from './editor/MethodEditor';
import { StagePanel } from './stage/StagePanel';

export function App() {
  return (
    <div className="app">
      <StagePanel />
      <main className="app__body">
        <section className="app__canvas" aria-label="コードベース">
          <CodebaseCanvas />
        </section>
        <MethodEditor />
      </main>
    </div>
  );
}
