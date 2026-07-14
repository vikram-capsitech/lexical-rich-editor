import { $generateHtmlFromNodes, $generateNodesFromDOM } from '@lexical/html';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';
import { $getRoot } from 'lexical';
import { useEffect, useRef } from 'react';
import { normalizeToBlockHtml, postProcessOutput, sanitizeHtml } from '../Utils/Sanitize';

interface ICustomOnChangePluginProps {
  value: string;
  onChange: (value: string) => void;
  isReadOnly?: boolean;
}

/**
 * Splits heading elements (h1–h6) that contain two or more consecutive <br>
 * tags into separate same-level heading elements.
 *
 * Why: Lexical stores Shift+Enter inside a heading as a LineBreakNode, which
 * round-trips as a <br>.  When content is pasted or imported with double-<br>
 * paragraph separators inside a heading (common in email HTML), all text ends
 * up in one <hN> block.  After publishing, browser default heading margins
 * make that look completely different from the editor view.
 *
 * Rule:
 *  • 1 × <br>  → kept as-is (intentional Shift+Enter line break)
 *  • 2+ × <br> → paragraph boundary; the element is split at that run
 *
 * Applied both on import (so the Lexical node tree is clean) and on export
 * (so the saved HTML is semantically correct for the published view).
 */
export function splitHeadingsAtBrSequences(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const headings = Array.from(doc.querySelectorAll('h1, h2, h3, h4, h5, h6'));

  headings.forEach((el) => {
    const inner = el.innerHTML;

    // Regex: one <br> followed by one-or-more additional <br> (= 2+ total).
    // Whitespace between tags is allowed.
    const SEP = /<br\s*\/?>\s*(?:<br\s*\/?>)+/gi;
    if (!SEP.test(inner)) return;   // nothing to split
    SEP.lastIndex = 0;              // reset after .test()

    const parts = inner.split(SEP).map((p) => p.trim()).filter(Boolean);
    if (parts.length <= 1) return;

    const parent = el.parentNode;
    if (!parent) return;

    const tagName = el.tagName.toLowerCase();
    const attrs = Array.from(el.attributes);

    const fragment = doc.createDocumentFragment();
    parts.forEach((part) => {
      const newEl = doc.createElement(tagName);
      // Preserve the original element's attributes (e.g. style, dir).
      attrs.forEach((a) => newEl.setAttribute(a.name, a.value));
      newEl.innerHTML = part;
      fragment.appendChild(newEl);
    });

    parent.replaceChild(fragment, el);
  });

  return doc.body.innerHTML;
}

export const CustomOnChangePlugin = ({ value, onChange, isReadOnly }: ICustomOnChangePluginProps) => {
  const [editor] = useLexicalComposerContext();
  const initializedRef = useRef(false);
  // Tracks the last `value` string this instance imported (either from the
  // prop or from its own onChange echo), so read-only viewers can re-sync
  // to external updates without re-importing their own unchanged output.
  const lastImportedValueRef = useRef<string | null>(null);

  useEffect(() => {
    if (!value) return;
    // Editable instances import once: the editor itself is the source of
    // truth for `value`, so re-importing on every prop change would blow
    // away the user's live cursor/selection while typing.
    // Read-only instances (e.g. a "full view" panel fed by shared state)
    // have no cursor to protect and are never the source of `value`, so
    // they should keep syncing to external updates for their whole lifetime.
    if (!isReadOnly && initializedRef.current) return;
    if (value === lastImportedValueRef.current) return;

    initializedRef.current = true;
    lastImportedValueRef.current = value;

    editor.update(() => {
      const root = $getRoot();
      root.clear();

      // Sanitize → split headings → ensure block wrapper so Lexical root is valid.
      const safe    = sanitizeHtml(value);
      const cleaned = normalizeToBlockHtml(splitHeadingsAtBrSequences(safe));
      const parser  = new DOMParser();
      const dom     = parser.parseFromString(cleaned, 'text/html');
      const nodes = $generateNodesFromDOM(editor, dom);

      root.append(...nodes);
    });
  }, [editor, value, isReadOnly]);

  return (
    <OnChangePlugin
      // Without this, OnChangePlugin fires on every selection-only change
      // (cursor moves, Shift+Arrow extending a selection, clicking around) —
      // not just actual edits — because its default `ignoreSelectionChange`
      // is `false`. Each firing re-serializes the *entire* document via
      // $generateHtmlFromNodes plus two DOMParser passes below, then calls
      // the consumer's onChange (typically a setState causing a full
      // re-render). That heavy synchronous work running on every keystroke —
      // including plain arrow-key navigation — is enough to make rapid
      // keyboard input (e.g. holding Shift+Arrow, or typing quickly) feel
      // janky or drop/delay key handling. Only actual content edits
      // (dirty elements/leaves) need to produce new HTML.
      ignoreSelectionChange
      onChange={(editorState) => {
        editorState.read(() => {
          // Post-process: ensure any LineBreakNode-based paragraph separators
          // inside headings are split into proper block elements in the output.
          const raw = $generateHtmlFromNodes(editor);
          const html = postProcessOutput(splitHeadingsAtBrSequences(raw));
          // Record our own output as "already imported" so a read-only
          // instance doesn't re-clear+re-import itself when the caller
          // feeds this exact string back in as `value`.
          lastImportedValueRef.current = html;
          onChange(html);
        });
      }}
    />
  );
};
