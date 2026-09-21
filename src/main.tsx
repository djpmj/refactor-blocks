import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@xyflow/react/dist/style.css';
import './index.css';
import { App } from './presentation/App';

const container = document.getElementById('root');
if (container === null) throw new Error('#root が見つかりません');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
