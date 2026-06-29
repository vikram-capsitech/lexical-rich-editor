import { useState } from 'react';
import { ContentEditorComponent, ContentEditorLevel } from 'lexical-rich-editor';

/**
 * Deterministic harness for the color-picker Playwright suite.
 *
 * Mirrors how a real consumer wires this component (controlled `value` +
 * `onChange`, mounted inside a `<form>`), without the marketing demo's
 * unrelated UI getting in the way of stable selectors. Rendered standalone
 * via the `?harness=color-picker` query param (see main.tsx).
 */
export default function ColorPickerTestHarness() {
  const [value, setValue] = useState('<p>AAAA BBBB</p>');
  const [renderCount, setRenderCount] = useState(0);
  const [submitCount, setSubmitCount] = useState(0);

  return (
    <form
      data-testid="harness-form"
      onSubmit={(e) => {
        e.preventDefault();
        setSubmitCount((c) => c + 1);
      }}
      style={{ padding: 20, fontFamily: 'sans-serif' }}>
      <div data-testid="render-count" style={{ display: 'none' }}>
        {renderCount}
      </div>
      <div data-testid="submit-count" style={{ display: 'none' }}>
        {submitCount}
      </div>

      <button
        type="button"
        data-testid="force-rerender"
        onClick={() => setRenderCount((c) => c + 1)}>
        Force parent re-render
      </button>

      <div style={{ height: 300, marginTop: 12 }}>
        <ContentEditorComponent
          namespace="color-picker-harness"
          level={ContentEditorLevel.Basic}
          value={value}
          onChange={setValue}
        />
      </div>

      <pre data-testid="output-html" style={{ whiteSpace: 'pre-wrap' }}>
        {value}
      </pre>
    </form>
  );
}
