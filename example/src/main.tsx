import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import ColorPickerTestHarness from './ColorPickerTestHarness';
import ImageDataUrlRoundtripHarness from './ImageDataUrlRoundtripHarness';
import InlineImagePositionHarness from './InlineImagePositionHarness';
import ModalImageTestHarness from './ModalImageTestHarness';
import './index.css';

const harness = new URLSearchParams(window.location.search).get('harness');

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {harness === 'color-picker' ? (
      <ColorPickerTestHarness />
    ) : harness === 'modal-image' ? (
      <ModalImageTestHarness />
    ) : harness === 'image-roundtrip' ? (
      <ImageDataUrlRoundtripHarness />
    ) : harness === 'inline-image-position' ? (
      <InlineImagePositionHarness />
    ) : (
      <App />
    )}
  </React.StrictMode>,
);
