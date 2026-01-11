import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';

const rootId = document.getElementById('feedback-hub-root') || document.getElementById('root');
const container = rootId || (() => {
  const div = document.createElement('div');
  div.id = 'feedback-hub-root';
  document.body.appendChild(div);
  return div;
})();

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>
);
