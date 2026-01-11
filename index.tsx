
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

const mount = () => {
  const rootElement = document.getElementById('feedback-hub-root') || document.getElementById('root');

  if (rootElement) {
    const root = ReactDOM.createRoot(rootElement);
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  } else {
    // If no root found, create one for the widget
    const div = document.createElement('div');
    div.id = 'feedback-hub-root';
    document.body.appendChild(div);
    const root = ReactDOM.createRoot(div);
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  }
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mount);
} else {
  mount();
}
