import { useRef, useState } from 'react';
import { ContentEditorComponent, ContentEditorLevel, ContentEditorRef } from 'lexical-rich-editor';

// A 4x4 red PNG, matching what FileReader.readAsDataURL produces for an
// uploaded/pasted image (see ImagePlugin.tsx / InlineImage.tsx).
const IMAGE_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAAEElEQVR4nGP4z8AARwzEcQCukw/x0F8jngAAAABJRU5ErkJggg==';

/**
 * Reproduction harness for "uploaded image becomes broken after
 * changing the view". Rendered via ?harness=image-roundtrip.
 *
 * Root cause under test: an uploaded/pasted image is inserted with a
 * `data:image/...;base64,` src (see ImagePlugin.tsx's FileReader usage). That
 * insert bypasses sanitizeHtml (it goes straight through a Lexical command),
 * so it renders fine immediately. But re-mounting the editor elsewhere (a
 * consumer app switching between an inline compose panel and a "Full Panel"
 * view, each its own ContentEditorComponent instance) re-seeds the new
 * instance from the captured HTML via the `value` prop / setValue(), which
 * DOES run through sanitizeHtml() — and that sanitizer used to strip every
 * `data:` URI unconditionally, including `data:image/...` on <img src>,
 * silently dropping the attribute and leaving a broken image icon. Fixed in
 * src/Utils/Sanitize.ts by allowlisting `data:image/...;base64,` specifically
 * for `img[src]` (still blocking `data:` on links and any non-image data URI).
 */
export default function ImageDataUrlRoundtripHarness() {
  const [value, setValue] = useState('<p>before</p>');
  const editorRef = useRef<ContentEditorRef>(null);

  return (
    <div style={{ padding: 20 }}>
      <button
        type="button"
        data-testid="simulate-view-change"
        onClick={() => {
          // Simulates a consumer capturing the current HTML (as it would from
          // onChange/getValue) and re-seeding a freshly mounted editor with it
          // — exactly what switching between compose/full-panel views does.
          const html = editorRef.current?.getValue() ?? '';
          editorRef.current?.setValue(html);
        }}>
        Simulate view change (getValue -&gt; setValue round-trip)
      </button>

      <button
        type="button"
        data-testid="insert-data-url-image"
        onClick={() => {
          editorRef.current?.setValue(`<p>before</p><img src="${IMAGE_DATA_URL}" alt="test" /><p>after</p>`);
        }}>
        Insert data-URL image
      </button>

      <button
        type="button"
        data-testid="insert-dangerous-content"
        onClick={() => {
          // Confirms the security boundary is unchanged: only `img[src]` with
          // a `data:image/...;base64,` value is allowlisted — `data:`/`javascript:`
          // on links, and on <img src> for non-image data, must still be stripped.
          editorRef.current?.setValue(
            '<p><a href="data:text/html,evil">link</a></p>' +
              '<p><a href="javascript:alert(1)">js link</a></p>' +
              '<p><img src="javascript:alert(1)" alt="evil-img" /></p>',
          );
        }}>
        Insert dangerous content
      </button>

      <button
        type="button"
        data-testid="insert-broken-image"
        onClick={() => {
          // A syntactically valid but unreachable URL — unlike `src=""`, this
          // actually triggers the browser's image fetch and fires `onerror`,
          // exercising the useSuspenseImage Suspense-hang fix.
          editorRef.current?.setValue(
            '<p><img src="https://localhost:1/does-not-exist.png" alt="broken-img" /></p>',
          );
        }}>
        Insert broken image
      </button>

      <div style={{ height: 300, marginTop: 12 }}>
        <ContentEditorComponent
          ref={editorRef}
          namespace="image-roundtrip-harness"
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
