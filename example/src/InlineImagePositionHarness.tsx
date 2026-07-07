import { useRef, useState } from 'react';
import { ContentEditorComponent, ContentEditorLevel, ContentEditorRef } from 'lexical-rich-editor';

/**
 * Reproduction harness for "typing text, then inserting a right-positioned
 * inline image, shifts the already-typed text to the right too". Rendered
 * via ?harness=inline-image-position. Starts empty so the only paragraph in
 * the document is the one the test types into and inserts the image into —
 * no pre-existing demo content to confuse a `document.querySelector('p')`
 * check.
 *
 * Root cause under test: INSERT_INLINE_IMAGE_COMMAND (src/Plugins/InlineImage.tsx)
 * used to call `parent.setFormat(fmt)` on the image's containing paragraph
 * to fake a "position: right" effect — but that applies `text-align: right`
 * to the WHOLE paragraph, including any text sharing it with the image, not
 * just the image itself. Fixed by removing that side effect and instead
 * giving `.inline-editor-image.position-left/right` real `float: left/right`
 * (src/Theme/index.css), so the image wraps within the line without
 * touching the paragraph's own alignment.
 */
export default function InlineImagePositionHarness() {
  const [value, setValue] = useState('<p>Hello world this is my text</p>');
  const editorRef = useRef<ContentEditorRef>(null);

  return (
    <div style={{ padding: 20 }}>
      <button
        type="button"
        data-testid="simulate-view-change"
        onClick={() => {
          // Same getValue() -> setValue() round-trip a consumer performs when
          // swapping ContentEditorComponent instances (e.g. compose <->
          // full-panel view) — see ImageDataUrlRoundtripHarness for the sibling
          // repro of a different bug this same round-trip exposed.
          const html = editorRef.current?.getValue() ?? '';
          editorRef.current?.setValue(html);
        }}>
        Simulate view change (getValue -&gt; setValue round-trip)
      </button>

      <div style={{ height: 300, marginTop: 12 }}>
        <ContentEditorComponent
          ref={editorRef}
          namespace="inline-image-position-harness"
          level={ContentEditorLevel.Pro}
          value={value}
          onChange={setValue}
        />
      </div>

      <pre data-testid="output-html" style={{ whiteSpace: 'pre-wrap', fontSize: 11 }}>
        {value}
      </pre>
    </div>
  );
}
