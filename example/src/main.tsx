import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import ColorPickerTestHarness from './ColorPickerTestHarness';
import './index.css';

const isHarness = new URLSearchParams(window.location.search).get('harness') === 'color-picker';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {isHarness ? <ColorPickerTestHarness /> : <App />}
  </React.StrictMode>,
);
