import { useState } from 'react';
import { Modal } from '@fluentui/react';
import { ContentEditorComponent, ContentEditorLevel } from 'lexical-rich-editor';

// Served statically from example/public — same-origin, no network dependency.
// (A `data:` URI won't do: the editor's sanitizer strips that scheme from `src`.)
const TEST_IMAGE_SRC = '/test-image.png';

/**
 * Reproduction harness for "can't select/resize image inside Full Panel view".
 * Mirrors a consumer wrapping ContentEditorComponent in a Fluent v8 Modal —
 * which renders its content through its own separate React root — the same
 * class of host chrome already implicated in the floating-link and
 * table-action-menu z-index bugs. Rendered via ?harness=modal-image.
 */
export default function ModalImageTestHarness() {
  const [value, setValue] = useState(
    `<p>Before image</p><img src="${TEST_IMAGE_SRC}" /><p>After image</p>`,
  );

  return (
    <Modal isOpen isBlocking={false} containerClassName="modal-image-harness-container">
      <div style={{ padding: 20, width: 700, height: 500 }} data-testid="harness-root">
        <div style={{ height: 400 }}>
          <ContentEditorComponent
            namespace="modal-image-harness"
            level={ContentEditorLevel.Pro}
            value={value}
            onChange={setValue}
          />
        </div>
        <pre data-testid="output-html" style={{ whiteSpace: 'pre-wrap', fontSize: 11 }}>
          {value}
        </pre>
      </div>
    </Modal>
  );
}
